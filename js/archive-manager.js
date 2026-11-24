/**
 * archive-manager.js — Orquestador de extracción multiformato en Web Workers
 */

export class ArchiveManager {
  constructor(securityManager) {
    this.security = securityManager;
    this.zipWorker = null;
    this.archiveWorker = null;
    this.activeReject = null;
  }

  getWorkerForFormat(ext) {
    const lower = String(ext || '').toLowerCase();
    if (lower === 'zip') {
      if (!this.zipWorker) {
        this.zipWorker = new Worker('./workers/zip-worker.js', { type: 'module' });
      }
      return this.zipWorker;
    }
    if (!this.archiveWorker) {
      this.archiveWorker = new Worker('./workers/archive-worker.js', { type: 'module' });
    }
    return this.archiveWorker;
  }

  runWorkerTask(ext, payload, onProgress) {
    const worker = this.getWorkerForFormat(ext);
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise((resolve, reject) => {
      this.activeReject = () => reject(new Error('Tarea cancelada por el usuario.'));

      const onMessage = (event) => {
        const data = event.data;
        if (!data || data.id !== id) return;

        if (data.type === 'progress') {
          onProgress?.(data);
          return;
        }

        cleanup();
        if (data.ok) {
          resolve(data);
        } else {
          const err = new Error(data.error || 'Error procesando el archivo.');
          err.needsPassword = Boolean(data.needsPassword);
          reject(err);
        }
      };

      const onError = (err) => {
        cleanup();
        reject(new Error(err?.message || 'Fallo interno en el Web Worker.'));
      };

      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        this.activeReject = null;
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ id, ...payload });
    });
  }

  cancelActiveTask() {
    if (this.zipWorker) {
      this.zipWorker.terminate();
      this.zipWorker = null;
    }
    if (this.archiveWorker) {
      this.archiveWorker.terminate();
      this.archiveWorker = null;
    }
    this.activeReject?.();
    this.activeReject = null;
  }

  async listEntries(item, password = '') {
    const res = await this.runWorkerTask(item.ext, {
      action: 'list',
      file: item.fileRef,
      password
    });

    let totalUncompressed = 0;
    let totalCompressed = 0;
    let unsafeCount = 0;

    const entries = (res.entries || []).map((entry) => {
      const check = this.security.sanitizeEntryPath(entry.rawPath);
      if (check.isUnsafe) unsafeCount += 1;
      totalUncompressed += entry.size || 0;
      totalCompressed += entry.compressedSize || 0;

      return {
        ...entry,
        safePath: check.safePath,
        isUnsafe: check.isUnsafe,
        isSuspicious: this.security.isSuspiciousFile(check.safePath)
      };
    });

    const limits = this.security.validateDecompressionMetrics({
      totalUncompressed,
      totalCompressed: totalCompressed || item.size || 0
    });

    return {
      entries,
      unsafeCount,
      totalUncompressed,
      limits
    };
  }

  async extractEntries(item, { entryPaths = null, password = '', onProgress = null } = {}) {
    const res = await this.runWorkerTask(
      item.ext,
      {
        action: 'extract',
        file: item.fileRef,
        entryPaths,
        password
      },
      onProgress
    );

    const safeResults = [];
    const seenPaths = new Set();
    for (const entry of res.results || []) {
      const check = this.security.sanitizeEntryPath(entry.rawPath);
      if (!check.safePath) continue;
      const uniquePath = this.security.resolveDuplicatePath(check.safePath, seenPaths);
      const filename = uniquePath.split('/').pop() || 'archivo';
      safeResults.push({
        path: uniquePath,
        filename,
        isUnsafe: check.isUnsafe,
        isSuspicious: this.security.isSuspiciousFile(filename),
        blob: entry.blob
      });
    }

    return safeResults;
  }
}

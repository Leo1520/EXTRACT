/**
 * compression-manager.js — Creación local de archivos ZIP en Web Worker
 */

export class CompressionManager {
  constructor() {
    this.worker = null;
  }

  createZip(files, { password = '', onProgress = null } = {}) {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new Worker('./workers/zip-worker.js', { type: 'module' });
    const id = `zip_create_${Date.now()}`;

    const payloadFiles = files.map((f) => ({
      path: (f.relativePath || f.webkitRelativePath || f.name || 'archivo').replace(/^\/+/, ''),
      blob: f
    }));

    return new Promise((resolve, reject) => {
      const onMessage = (event) => {
        const data = event.data;
        if (!data || data.id !== id) return;

        if (data.type === 'progress') {
          onProgress?.(data);
          return;
        }

        cleanup();
        if (data.ok) {
          resolve(data.blob);
        } else {
          reject(new Error(data.error || 'Error al crear el archivo ZIP.'));
        }
      };

      const onError = (err) => {
        cleanup();
        reject(new Error(err?.message || 'Error interno en el worker de compresión.'));
      };

      const cleanup = () => {
        this.worker?.removeEventListener('message', onMessage);
        this.worker?.removeEventListener('error', onError);
      };

      this.worker.addEventListener('message', onMessage);
      this.worker.addEventListener('error', onError);
      this.worker.postMessage({
        id,
        action: 'create',
        files: payloadFiles,
        password: password || ''
      });
    });
  }

  cancel() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

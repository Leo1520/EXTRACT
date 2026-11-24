/**
 * file-manager.js — Recepción, detección de formato, validación y gestión en biblioteca
 */

const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz'
]);

export class FileManager {
  constructor(appState, ui, onStateChange) {
    this.state = appState;
    this.ui = ui;
    this.onStateChange = onStateChange;
    this.dragDepth = 0;
  }

  initDragAndDrop() {
    const overlay = document.getElementById('drop-overlay');

    window.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      this.dragDepth += 1;
      overlay?.classList.remove('hidden');
    });

    window.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('dragleave', () => {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) {
        overlay?.classList.add('hidden');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.dragDepth = 0;
      overlay?.classList.add('hidden');

      const files = await this.extractFilesFromDrop(e.dataTransfer);
      if (files.length > 0) {
        await this.importFiles(files, { source: 'Arrastrar y soltar' });
      }
    });
  }

  async extractFilesFromDrop(dataTransfer) {
    if (!dataTransfer) return [];
    const items = [...(dataTransfer.items || [])];
    const hasEntries = items.some((it) => typeof it.webkitGetAsEntry === 'function');

    if (!hasEntries) {
      return [...(dataTransfer.files || [])];
    }

    const collected = [];
    const traverse = async (entry, prefix = '') => {
      if (!entry) return;
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
        if (file) {
          if (prefix && !file.relativePath) {
            Object.defineProperty(file, 'relativePath', { value: `${prefix}${file.name}` });
          }
          collected.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise((resolve) => {
          const all = [];
          const readBatch = () => {
            reader.readEntries((batch) => {
              if (!batch.length) resolve(all);
              else {
                all.push(...batch);
                readBatch();
              }
            }, () => resolve(all));
          };
          readBatch();
        });
        for (const child of entries) {
          await traverse(child, `${prefix}${entry.name}/`);
        }
      }
    };

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) await traverse(entry);
    }

    return collected.length ? collected : [...(dataTransfer.files || [])];
  }

  async detectFormat(file) {
    const lower = (file.name || '').toLowerCase();
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
    if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) return 'tar.xz';
    if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) return 'tar.bz2';

    const ext = lower.includes('.') ? lower.split('.').pop() : '';

    // Detección por firma mágica (primeros 8 bytes)
    try {
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (head[0] === 0x50 && head[1] === 0x4b) return 'zip';
      if (head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72 && head[3] === 0x21) return 'rar';
      if (head[0] === 0x37 && head[1] === 0x7a && head[2] === 0xbc && head[3] === 0xaf) return '7z';
      if (head[0] === 0x1f && head[1] === 0x8b) return ext === 'tgz' || lower.endsWith('.tar.gz') ? 'tar.gz' : 'gz';
      if (head[0] === 0x42 && head[1] === 0x5a && head[2] === 0x68) return 'bz2';
      if (head[0] === 0xfd && head[1] === 0x37 && head[2] === 0x7a && head[3] === 0x58 && head[4] === 0x5a) return 'xz';
    } catch (_) {
      // Fallback a extensión
    }

    return ext || 'bin';
  }

  isArchiveFormat(format) {
    const base = format.split('.').pop();
    return ARCHIVE_EXTENSIONS.has(format) || ARCHIVE_EXTENSIONS.has(base);
  }

  async importFiles(fileList, { source = 'Selector de archivos' } = {}) {
    const files = [...(fileList || [])].filter((f) => f && f.name);
    if (!files.length) return [];

    const imported = [];
    for (const file of files) {
      const format = await this.detectFormat(file);
      const isArchive = this.isArchiveFormat(format);
      const item = {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        ext: format,
        size: file.size || 0,
        updatedAt: file.lastModified || Date.now(),
        category: isArchive ? 'archive' : 'file',
        isFolder: false,
        favorite: false,
        source,
        relativePath: file.webkitRelativePath || file.relativePath || file.name,
        fileRef: file
      };
      this.state.items.unshift(item);
      imported.push(item);
    }

    if (imported.length > 0) {
      this.state.focusedItem = imported[0];
      this.onStateChange?.(imported);
      this.ui.showToast(
        imported.length === 1
          ? `Importado: ${imported[0].name}`
          : `${imported.length} archivos importados localmente`,
        'check-circle'
      );
    }

    return imported;
  }

  async openNativeFolderPicker() {
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const collected = [];
        const walk = async (handle, prefix = '') => {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              Object.defineProperty(file, 'relativePath', { value: `${prefix}${file.name}` });
              collected.push(file);
            } else if (entry.kind === 'directory') {
              await walk(entry, `${prefix}${entry.name}/`);
            }
          }
        };
        await walk(dirHandle, `${dirHandle.name}/`);
        await this.importFiles(collected, { source: 'Carpeta del dispositivo' });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    document.getElementById('input-folder-picker')?.click();
  }
}

/**
 * storage-manager.js — Persistencia local en IndexedDB, preferencias, historial y cuota
 */

const DB_NAME = 'extract_db';
const DB_VERSION = 2;
const SHARED_INBOX_CACHE = 'extract-shared-inbox';

export class StorageManager {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    if (!('indexedDB' in window)) return null;

    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.db;
  }

  async tx(storeName, mode, operation) {
    const db = await this.init();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const req = operation(store);
      if (req) {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } else {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      }
    });
  }

  async getAllFiles() {
    const metas = (await this.tx('files', 'readonly', (s) => s.getAll())) || [];
    const restored = [];

    for (const meta of metas) {
      if (meta.isFolder) {
        restored.push(meta);
        continue;
      }
      const blobRow = await this.tx('blobs', 'readonly', (s) => s.get(meta.id));
      if (blobRow && blobRow.blob) {
        const fileRef = new File([blobRow.blob], meta.name, {
          type: blobRow.blob.type || 'application/octet-stream',
          lastModified: meta.updatedAt || Date.now()
        });
        restored.push({ ...meta, savedInLibrary: true, fileRef });
      } else {
        // Limpiar entradas huérfanas sin contenido real de sesiones anteriores
        await this.tx('files', 'readwrite', (s) => s.delete(meta.id));
      }
    }

    return restored;
  }

  async putFile(item) {
    const { fileRef, ...serializable } = item;
    await this.tx('files', 'readwrite', (s) => s.put(serializable));
    if (item.savedInLibrary && fileRef) {
      await this.tx('blobs', 'readwrite', (s) => s.put({ id: item.id, blob: fileRef }));
    }
  }

  async deleteFile(id) {
    await this.tx('files', 'readwrite', (s) => s.delete(id));
    await this.tx('blobs', 'readwrite', (s) => s.delete(id));
  }

  async clearFavorites() {
    const all = await this.getAllFiles();
    for (const item of all) {
      if (item.favorite) {
        await this.putFile({ ...item, favorite: false });
      }
    }
  }

  async getAllFolders() {
    return (await this.tx('folders', 'readonly', (s) => s.getAll())) || [];
  }

  async putFolder(folder) {
    return this.tx('folders', 'readwrite', (s) => s.put(folder));
  }

  async deleteFolder(id) {
    return this.tx('folders', 'readwrite', (s) => s.delete(id));
  }

  async getHistory() {
    const list = (await this.tx('history', 'readonly', (s) => s.getAll())) || [];
    return list.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  }

  async putHistory(task) {
    return this.tx('history', 'readwrite', (s) => s.put(task));
  }

  async clearHistory() {
    return this.tx('history', 'readwrite', (s) => s.clear());
  }

  async getSettings() {
    const rows = (await this.tx('settings', 'readonly', (s) => s.getAll())) || [];
    const map = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  async saveSetting(key, value) {
    return this.tx('settings', 'readwrite', (s) => s.put({ key, value }));
  }

  async resetSettings() {
    return this.tx('settings', 'readwrite', (s) => s.clear());
  }

  async clearTemporaryCaches() {
    if ('caches' in window) {
      await caches.delete(SHARED_INBOX_CACHE);
    }
  }

  async getStorageEstimate() {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return null;
    }
    try {
      const est = await navigator.storage.estimate();
      return {
        usage: est.usage || 0,
        quota: est.quota || 0
      };
    } catch (_) {
      return null;
    }
  }
}

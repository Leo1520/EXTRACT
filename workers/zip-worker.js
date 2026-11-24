/**
 * zip-worker.js — Web Worker dedicado para extracción y creación de archivos ZIP (@zip.js/zip.js)
 */

import * as zip from '../lib/zip.js/index.min.js';

zip.configure({ useWebWorkers: false });

self.addEventListener('message', async (event) => {
  const { id, action, file, password, entryPaths, files } = event.data;

  try {
    if (action === 'list') {
      const reader = new zip.ZipReader(new zip.BlobReader(file), password ? { password } : undefined);
      try {
        const rawEntries = await reader.getEntries();
        const entries = rawEntries.map((e) => ({
          rawPath: e.filename,
          isDirectory: e.directory,
          size: e.uncompressedSize || 0,
          compressedSize: e.compressedSize || 0,
          encrypted: Boolean(e.encrypted),
          lastModified: e.lastModDate ? e.lastModDate.getTime() : Date.now()
        }));
        self.postMessage({ id, ok: true, entries });
      } finally {
        await reader.close();
      }
      return;
    }

    if (action === 'extract') {
      const reader = new zip.ZipReader(new zip.BlobReader(file), password ? { password } : undefined);
      try {
        const rawEntries = await reader.getEntries();
        const targetSet = Array.isArray(entryPaths) && entryPaths.length > 0 ? new Set(entryPaths) : null;
        const targets = rawEntries.filter((e) => !e.directory && (!targetSet || targetSet.has(e.filename)));

        const results = [];
        for (let i = 0; i < targets.length; i += 1) {
          const entry = targets[i];
          self.postMessage({
            id,
            type: 'progress',
            current: i + 1,
            total: targets.length,
            filename: entry.filename
          });

          const blob = await entry.getData(new zip.BlobWriter(), password ? { password } : undefined);
          results.push({ rawPath: entry.filename, blob });
        }

        self.postMessage({ id, ok: true, results });
      } finally {
        await reader.close();
      }
      return;
    }

    if (action === 'create') {
      const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'), password ? { password } : undefined);
      const list = files || [];
      for (let i = 0; i < list.length; i += 1) {
        const item = list[i];
        self.postMessage({
          id,
          type: 'progress',
          current: i + 1,
          total: list.length,
          filename: item.path
        });
        await writer.add(item.path, new zip.BlobReader(item.blob));
      }
      const zipBlob = await writer.close();
      self.postMessage({ id, ok: true, blob: zipBlob });
    }
  } catch (error) {
    const msg = String(error?.message || error || 'Error en zip-worker');
    const needsPassword = msg.includes('encrypted') || msg.includes('password') || msg.includes('ERR_ENCRYPTED') || msg.includes('ERR_INVALID_PASSWORD');
    self.postMessage({
      id,
      ok: false,
      needsPassword,
      error: needsPassword ? 'Archivo protegido o contraseña incorrecta.' : msg
    });
  }
});

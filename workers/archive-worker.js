/**
 * archive-worker.js — Web Worker dedicado para 7z-wasm (RAR4/5, 7Z, TAR, GZ, BZ2, XZ, TAR.GZ, TAR.XZ)
 */

import SevenZip from '../lib/7z-wasm/7zz.es6.js';

let stdoutLines = [];
let stderrLines = [];

async function getEngine() {
  stdoutLines = [];
  stderrLines = [];
  return SevenZip({
    locateFile: (path) => new URL(`../lib/7z-wasm/${path}`, import.meta.url).href,
    print: (line) => stdoutLines.push(String(line)),
    printErr: (line) => stderrLines.push(String(line))
  });
}

function parseSltOutput(lines) {
  const entries = [];
  let current = null;
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('----------')) {
      inList = true;
      continue;
    }
    if (!inList) continue;

    if (!line.trim()) {
      if (current && current.rawPath) {
        entries.push(current);
      }
      current = null;
      continue;
    }

    const eq = line.indexOf(' = ');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 3).trim();

    if (!current) {
      current = {
        rawPath: '',
        isDirectory: false,
        size: 0,
        compressedSize: 0,
        encrypted: false,
        lastModified: Date.now()
      };
    }

    if (key === 'Path') current.rawPath = val;
    else if (key === 'Folder') current.isDirectory = val === '+';
    else if (key === 'Size') current.size = Number(val) || 0;
    else if (key === 'Packed Size') current.compressedSize = Number(val) || 0;
    else if (key === 'Encrypted') current.encrypted = val === '+';
    else if (key === 'Modified') {
      const parsed = Date.parse(val.replace(' ', 'T'));
      if (Number.isFinite(parsed)) current.lastModified = parsed;
    }
  }

  if (current && current.rawPath) {
    entries.push(current);
  }
  return entries;
}

function cleanupFs(sz, dir) {
  try {
    const items = sz.FS.readdir(dir);
    for (const item of items) {
      if (item === '.' || item === '..') continue;
      const full = `${dir}/${item}`;
      const stat = sz.FS.stat(full);
      if (sz.FS.isDir(stat.mode)) {
        cleanupFs(sz, full);
        sz.FS.rmdir(full);
      } else {
        sz.FS.unlink(full);
      }
    }
  } catch (_) {
    // Ignorar si no existe
  }
}

function collectFiles(sz, dir, prefix = '', out = []) {
  const items = sz.FS.readdir(dir);
  for (const item of items) {
    if (item === '.' || item === '..') continue;
    const full = `${dir}/${item}`;
    const rel = prefix ? `${prefix}/${item}` : item;
    const stat = sz.FS.stat(full);
    if (sz.FS.isDir(stat.mode)) {
      collectFiles(sz, full, rel, out);
    } else {
      const bytes = sz.FS.readFile(full);
      out.push({
        rawPath: rel,
        blob: new Blob([bytes], { type: 'application/octet-stream' })
      });
    }
  }
  return out;
}

self.addEventListener('message', async (event) => {
  const { id, action, file, password, entryPaths } = event.data;
  let sz;

  try {
    sz = await getEngine();
    const safeName = (file.name || 'archive.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    const workDir = '/work';
    const outDir = '/out';

    try { sz.FS.mkdir(workDir); } catch (_) {}
    try { sz.FS.mkdir(outDir); } catch (_) {}

    const archivePath = `${workDir}/${safeName}`;
    const buffer = new Uint8Array(await file.arrayBuffer());
    sz.FS.writeFile(archivePath, buffer);

    const pwArg = password ? `-p${password}` : '-p';

    if (action === 'list') {
      const code = sz.callMain(['l', '-slt', pwArg, archivePath]);
      const errText = stderrLines.join('\n');
      if (code !== 0 || errText.includes('Wrong password') || errText.includes('Can not open encrypted')) {
        const needsPassword = errText.includes('password') || errText.includes('encrypted') || stdoutLines.join('\n').includes('Enter password');
        throw new Error(needsPassword ? 'PASSWORD_REQUIRED' : (errText || `Error al listar archivo (código ${code})`));
      }
      const entries = parseSltOutput(stdoutLines);
      self.postMessage({ id, ok: true, entries });
      return;
    }

    if (action === 'extract') {
      const args = ['x', '-y', pwArg, `-o${outDir}`, archivePath];
      if (Array.isArray(entryPaths) && entryPaths.length > 0) {
        args.push(...entryPaths);
      }

      const code = sz.callMain(args);
      const errText = stderrLines.join('\n');
      if (code !== 0) {
        const needsPassword = errText.includes('Wrong password') || errText.includes('encrypted') || errText.includes('password');
        throw new Error(needsPassword ? 'PASSWORD_REQUIRED' : (errText || `Error al extraer archivo (código ${code})`));
      }

      const results = collectFiles(sz, outDir);
      self.postMessage({ id, ok: true, results });
    }
  } catch (error) {
    const msg = String(error?.message || error || 'Error en archive-worker');
    const needsPassword = msg === 'PASSWORD_REQUIRED' || msg.includes('password') || msg.includes('encrypted');
    self.postMessage({
      id,
      ok: false,
      needsPassword,
      error: needsPassword ? 'Archivo protegido o contraseña incorrecta.' : msg
    });
  } finally {
    if (sz) {
      cleanupFs(sz, '/work');
      cleanupFs(sz, '/out');
    }
  }
});

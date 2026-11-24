/**
 * app.js — Punto de entrada de EXTRACT (Fase 1: UI Shell y navegación)
 */

import { Router } from './router.js';
import { UIManager } from './ui-manager.js';
import { InstallationManager } from './installation.js';
import { UpdateManager } from './update-manager.js';
import { FileManager } from './file-manager.js';
import { ShareTargetHandler } from './share-target.js';
import { SecurityManager } from './security-manager.js';
import { ArchiveManager } from './archive-manager.js';
import { CompressionManager } from './compression-manager.js';
import { DownloadManager } from './download-manager.js';
import { StorageManager } from './storage-manager.js';

const appState = {
  viewMode: 'grid',
  sortBy: 'date',
  sortDir: 'desc',
  extFilter: 'all',
  searchQuery: '',
  maxUncompressedMB: 512,
  storageText: 'Calculando...',
  selectedIds: new Set(),
  selectedArchiveEntries: new Set(),
  focusedItem: null,
  activeArchive: null,
  explorerPath: [],
  items: [],
  tasks: [],
  hasActiveTasks: false
};

let ui;
let router;
let installer;
let updater;
let fileManager;
let shareTarget;
let securityManager;
let archiveManager;
let compressionManager;
let downloadManager;
let storageManager;

function handleAction(action) {
  switch (action) {
    case 'import-files':
      document.getElementById('input-file-picker')?.click();
      break;
    case 'import-folder':
      fileManager?.openNativeFolderPicker();
      break;
    case 'clear-selection':
      appState.selectedIds.clear();
      ui.renderRoute(router.currentRoute);
      break;
    case 'open-create-zip':
      openCreateZipModal();
      break;
    case 'show-install-preview':
      installer?.showInstallDialog({ manual: true });
      break;
    case 'check-updates':
      updater?.checkForUpdates();
      break;
    case 'clear-temp':
      storageManager?.clearTemporaryCaches().then(async () => {
        await refreshStorageEstimate();
        ui.showToast('Archivos temporales eliminados.', 'check-circle');
        ui.renderRoute(router.currentRoute);
      });
      break;
    case 'clear-history':
    case 'clear-activity':
      appState.tasks = [];
      storageManager?.clearHistory();
      ui.showToast('Historial de actividad limpiado.', 'check-circle');
      ui.renderRoute(router.currentRoute);
      break;
    case 'clear-favorites':
      appState.items.forEach((i) => { i.favorite = false; });
      storageManager?.clearFavorites();
      ui.showToast('Favoritos eliminados.', 'check-circle');
      ui.renderRoute(router.currentRoute);
      break;
    case 'reset-settings':
      appState.viewMode = 'grid';
      appState.sortBy = 'date';
      appState.sortDir = 'desc';
      appState.maxUncompressedMB = 512;
      securityManager.maxUncompressedBytes = 512 * 1024 * 1024;
      storageManager?.resetSettings();
      ui.showToast('Preferencias restablecidas.', 'check-circle');
      ui.renderRoute(router.currentRoute);
      break;
    case 'create-virtual-folder':
      openCreateFolderModal();
      break;
    case 'extract-all':
      runExtraction(null);
      break;
    case 'extract-selected':
      runExtraction([...appState.selectedArchiveEntries]);
      break;
    case 'extract-multiple-selected':
      runMultipleArchiveExtraction();
      break;
    case 'cancel-task':
      archiveManager?.cancelActiveTask();
      compressionManager?.cancel();
      appState.hasActiveTasks = false;
      ui.showToast('Tarea cancelada.', 'info');
      ui.renderRoute(router.currentRoute);
      break;
    default:
      break;
  }
}

async function refreshStorageEstimate() {
  const est = await storageManager?.getStorageEstimate();
  if (est) {
    const usedText = ui.formatBytes(est.usage);
    const quotaText = est.quota ? ui.formatBytes(est.quota) : '—';
    appState.storageText = `${usedText} de ${quotaText}`;
    const label = document.getElementById('sidebar-storage-label');
    const bar = document.getElementById('sidebar-storage-bar');
    if (label) label.textContent = usedText;
    if (bar && est.quota > 0) {
      bar.style.width = `${Math.min(100, Math.max(2, Math.round((est.usage / est.quota) * 100)))}%`;
    }
  } else {
    appState.storageText = 'No disponible';
  }
}

function openCreateFolderModal() {
  const modal = ui.openModal({
    title: 'Nueva carpeta virtual',
    icon: 'folder-plus',
    bodyHtml: `
      <div class="form-field">
        <label class="form-label" for="new-folder-name">Nombre de la carpeta</label>
        <input class="input-control" id="new-folder-name" type="text" placeholder="Ej. Documentos" />
      </div>
    `,
    footerHtml: `
      <button class="btn btn-ghost" type="button" data-modal-close>Cancelar</button>
      <button class="btn btn-primary" type="button" id="btn-confirm-folder">Crear</button>
    `
  });

  const input = modal.querySelector('#new-folder-name');
  input?.focus();

  const submit = async () => {
    const name = (input?.value || '').trim();
    if (!name) return;
    const folder = {
      id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      ext: 'dir',
      size: 0,
      updatedAt: Date.now(),
      category: 'folder',
      isFolder: true,
      favorite: false,
      source: 'Biblioteca local'
    };
    appState.items.unshift(folder);
    await storageManager?.putFile(folder);
    ui.closeModal();
    ui.renderRoute(router.currentRoute);
  };

  modal.querySelector('#btn-confirm-folder')?.addEventListener('click', submit);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function promptPassword(archiveName) {
  return new Promise((resolve) => {
    const modal = ui.openModal({
      title: 'Archivo protegido con contraseña',
      icon: 'lock',
      bodyHtml: `
        <p class="setting-desc">Introduce la contraseña para abrir o extraer <strong>${ui.escapeHtml(archiveName)}</strong>.</p>
        <div class="form-field">
          <label class="form-label" for="archive-password-input">Contraseña</label>
          <input class="input-control" id="archive-password-input" type="password" autocomplete="off" placeholder="Contraseña del archivo" />
        </div>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" type="button" id="btn-submit-password">Desbloquear</button>
      `
    });

    const input = modal.querySelector('#archive-password-input');
    input?.focus();

    const submit = () => {
      const val = input?.value || '';
      ui.closeModal();
      resolve(val || null);
    };

    modal.querySelector('#btn-submit-password')?.addEventListener('click', submit);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    modal.querySelectorAll('[data-modal-close]').forEach((b) => {
      b.addEventListener('click', () => resolve(null));
    });
  });
}

async function openArchiveInExplorer(item, password = '') {
  if (!item?.fileRef) {
    const modal = ui.openModal({
      title: 'Archivo no cargado en esta sesión',
      icon: 'file-archive',
      bodyHtml: `
        <p class="setting-desc">
          Por privacidad y ahorro de espacio, EXTRACT conserva en la biblioteca solo los metadatos de <strong>${ui.escapeHtml(item?.name || 'este archivo')}</strong> tras recargar la página.
        </p>
        <p class="setting-desc">Selecciónalo nuevamente desde tu dispositivo para abrirlo en el explorador.</p>
        <input type="file" id="reattach-file-input" class="hidden" />
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-modal-close>Cerrar</button>
        <button class="btn btn-primary" type="button" id="btn-reattach-file">Seleccionar archivo</button>
      `
    });

    const input = modal.querySelector('#reattach-file-input');
    modal.querySelector('#btn-reattach-file')?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      item.fileRef = f;
      item.size = f.size || item.size;
      item.updatedAt = f.lastModified || Date.now();
      await storageManager?.putFile(item);
      ui.closeModal();
      await openArchiveInExplorer(item, password);
    });
    return;
  }

  try {
    ui.showToast(`Analizando ${item.name}...`, 'loader');
    const info = await archiveManager.listEntries(item, password);

    if (!info.limits.ok) {
      ui.showToast(info.limits.reason, 'shield-alert');
      return;
    }

    if (info.unsafeCount > 0) {
      ui.showToast(`Se neutralizaron ${info.unsafeCount} ruta(s) potencialmente insegura(s).`, 'shield-check');
    }

    appState.activeArchive = {
      ...item,
      password,
      entries: info.entries
    };
    appState.explorerPath = [];
    appState.selectedArchiveEntries = new Set();
    router.navigate('explorador');
  } catch (error) {
    if (error.needsPassword) {
      const pw = await promptPassword(item.name);
      if (pw !== null) {
        await openArchiveInExplorer(item, pw);
      }
      return;
    }
    ui.showToast(error.message || 'No se pudo abrir el archivo.', 'alert-circle');
  }
}

async function runExtraction(entryPaths) {
  const active = appState.activeArchive;
  if (!active || appState.hasActiveTasks) return;

  const task = {
    id: `act_${Date.now()}`,
    type: 'extract',
    name: active.name,
    statusLabel: 'Extrayendo',
    progress: 5,
    detail: 'Iniciando motor local...',
    startedAt: Date.now(),
    duration: 0
  };
  appState.tasks.unshift(task);
  appState.hasActiveTasks = true;
  ui.renderRoute(router.currentRoute);

  try {
    const results = await archiveManager.extractEntries(active, {
      entryPaths,
      password: active.password || '',
      onProgress: (p) => {
        const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 50;
        task.progress = pct;
        task.detail = `${p.current}/${p.total}: ${p.filename}`;
      }
    });

    task.progress = 100;
    task.statusLabel = 'Completada';
    task.duration = Date.now() - task.startedAt;
    task.detail = `${results.length} archivo(s) extraído(s)`;
    await storageManager?.putHistory(task);

    await downloadManager.downloadMultiple(results);
    ui.showToast(`Extracción completada: ${results.length} archivo(s).`, 'check-circle');
  } catch (error) {
    task.statusLabel = 'Error';
    task.duration = Date.now() - task.startedAt;
    task.detail = error.message || 'Fallo de extracción';
    await storageManager?.putHistory(task);
    ui.showToast(error.message || 'No se pudo completar la extracción.', 'alert-circle');
  } finally {
    appState.hasActiveTasks = false;
    ui.renderRoute(router.currentRoute);
  }
}

function openCreateZipModal() {
  const preselectedFiles = appState.items
    .filter((i) => appState.selectedIds.has(i.id) && i.fileRef)
    .map((i) => i.fileRef);

  let chosenFiles = [...preselectedFiles];

  const modal = ui.openModal({
    title: 'Crear archivo ZIP',
    icon: 'folder-archive',
    bodyHtml: `
      <div class="form-field">
        <label class="form-label" for="zip-output-name">Nombre del archivo</label>
        <input class="input-control" id="zip-output-name" type="text" value="archivo.zip" placeholder="nombre.zip" />
      </div>
      <div class="form-field">
        <label class="form-label" for="zip-password-opt">Contraseña opcional (AES-256)</label>
        <input class="input-control" id="zip-password-opt" type="password" autocomplete="new-password" placeholder="Dejar vacío para sin contraseña" />
      </div>
      <div class="form-field">
        <span class="form-label">Archivos y carpetas a comprimir</span>
        <div class="toolbar-left">
          <button class="btn btn-secondary btn-sm" type="button" id="btn-zip-pick-files">Elegir archivos</button>
          <button class="btn btn-secondary btn-sm" type="button" id="btn-zip-pick-folder">Elegir carpeta</button>
        </div>
        <span class="setting-desc" id="zip-files-count">${chosenFiles.length} elemento(s) listo(s)</span>
        <input type="file" id="zip-modal-files" class="hidden" multiple />
        <input type="file" id="zip-modal-folder" class="hidden" webkitdirectory directory multiple />
      </div>
    `,
    footerHtml: `
      <button class="btn btn-ghost" type="button" data-modal-close>Cancelar</button>
      <button class="btn btn-primary" type="button" id="btn-confirm-zip-modal">Crear ZIP</button>
    `
  });

  const countLabel = modal.querySelector('#zip-files-count');
  const fileIn = modal.querySelector('#zip-modal-files');
  const folderIn = modal.querySelector('#zip-modal-folder');

  modal.querySelector('#btn-zip-pick-files')?.addEventListener('click', () => fileIn?.click());
  modal.querySelector('#btn-zip-pick-folder')?.addEventListener('click', () => folderIn?.click());

  const appendFiles = (list) => {
    chosenFiles = [...chosenFiles, ...list];
    if (countLabel) countLabel.textContent = `${chosenFiles.length} elemento(s) listo(s)`;
  };

  fileIn?.addEventListener('change', (e) => { if (e.target.files?.length) appendFiles(e.target.files); });
  folderIn?.addEventListener('change', (e) => { if (e.target.files?.length) appendFiles(e.target.files); });

  modal.querySelector('#btn-confirm-zip-modal')?.addEventListener('click', async () => {
    if (!chosenFiles.length) {
      ui.showToast('Selecciona al menos un archivo o carpeta para comprimir.', 'alert-circle');
      return;
    }

    let outName = (modal.querySelector('#zip-output-name')?.value || 'archivo.zip').trim();
    if (!outName.toLowerCase().endsWith('.zip')) outName += '.zip';
    const password = modal.querySelector('#zip-password-opt')?.value || '';

    ui.closeModal();
    await runZipCompression(chosenFiles, outName, password);
  });
}

async function runZipCompression(files, outName, password) {
  if (appState.hasActiveTasks) return;

  const task = {
    id: `zip_${Date.now()}`,
    type: 'compress',
    name: outName,
    statusLabel: 'Comprimiendo',
    progress: 5,
    detail: `Empaquetando ${files.length} elemento(s)...`,
    startedAt: Date.now(),
    duration: 0
  };
  appState.tasks.unshift(task);
  appState.hasActiveTasks = true;
  ui.renderRoute(router.currentRoute);

  try {
    const zipBlob = await compressionManager.createZip(files, {
      password,
      onProgress: (p) => {
        task.progress = p.total > 0 ? Math.round((p.current / p.total) * 100) : 50;
        task.detail = `${p.current}/${p.total}: ${p.filename}`;
      }
    });

    task.progress = 100;
    task.statusLabel = 'Completada';
    task.duration = Date.now() - task.startedAt;
    task.detail = `${ui.formatBytes(zipBlob.size)} generados`;
    await storageManager?.putHistory(task);

    downloadManager.downloadBlob(zipBlob, outName);
    const zipFile = new File([zipBlob], outName, { type: 'application/zip', lastModified: Date.now() });
    await fileManager.importFiles([zipFile], { source: 'Creado con EXTRACT' });
    ui.showToast(`Archivo ${outName} creado y descargado.`, 'check-circle');
  } catch (error) {
    task.statusLabel = 'Error';
    task.duration = Date.now() - task.startedAt;
    task.detail = error.message || 'Fallo al comprimir';
    await storageManager?.putHistory(task);
    ui.showToast(error.message || 'No se pudo crear el ZIP.', 'alert-circle');
  } finally {
    appState.hasActiveTasks = false;
    ui.renderRoute(router.currentRoute);
  }
}

async function runMultipleArchiveExtraction() {
  const targets = appState.items.filter((i) => appState.selectedIds.has(i.id) && i.category === 'archive' && i.fileRef);
  if (!targets.length) {
    ui.showToast('Selecciona archivos comprimidos cargados en esta sesión.', 'info');
    return;
  }

  for (const item of targets) {
    appState.activeArchive = { ...item, password: '', entries: [] };
    await runExtraction(null);
  }
}

async function previewArchiveEntry(rawPath) {
  const active = appState.activeArchive;
  if (!active || appState.hasActiveTasks) return;

  const lower = rawPath.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() : '';
  const blockedActive = new Set(['html', 'htm', 'svg', 'xhtml', 'js', 'mjs', 'exe', 'bat', 'cmd', 'ps1', 'sh', 'apk']);
  if (blockedActive.has(ext) || securityManager.isSuspiciousFile(rawPath)) {
    ui.showToast('Vista previa bloqueada por seguridad para archivos ejecutables, HTML o SVG.', 'shield-alert');
    return;
  }

  const textExts = new Set(['txt', 'md', 'json', 'csv', 'log', 'xml', 'yaml', 'yml', 'ini', 'css', 'ts', 'py', 'sql']);
  const imgExts = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
  const videoMimeMap = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    ogv: 'video/ogg'
  };
  const audioMimeMap = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4'
  };

  const isVideo = Boolean(videoMimeMap[ext]);
  const isAudio = Boolean(audioMimeMap[ext]);

  if (!textExts.has(ext) && !imgExts.has(ext) && !isVideo && !isAudio) {
    ui.showToast('Vista previa disponible para texto plano, imágenes, video (.mp4, .webm, .mov) y audio seguros.', 'info');
    return;
  }

  const entryMeta = active.entries?.find((e) => e.rawPath === rawPath);
  const MAX_MEDIA_PREVIEW_BYTES = 100 * 1024 * 1024;
  if ((isVideo || isAudio) && entryMeta && entryMeta.size > MAX_MEDIA_PREVIEW_BYTES) {
    ui.showToast('El archivo multimedia supera los 100 MB de vista previa. Usa Descargar para reproducirlo.', 'info');
    return;
  }

  try {
    const results = await archiveManager.extractEntries(active, {
      entryPaths: [rawPath],
      password: active.password || ''
    });
    const entry = results[0];
    if (!entry) return;

    if (imgExts.has(ext)) {
      const url = URL.createObjectURL(entry.blob);
      const modal = ui.openModal({
        title: entry.filename,
        icon: 'image',
        bodyHtml: `<img id="safe-img-preview" alt="${ui.escapeHtml(entry.filename)}" style="max-width:100%;max-height:60dvh;object-fit:contain;border-radius:10px;" />`,
        footerHtml: `<button class="btn btn-primary" type="button" data-modal-close>Cerrar</button>`
      });
      const imgEl = modal.querySelector('#safe-img-preview');
      if (imgEl) imgEl.src = url;
      const cleanup = () => URL.revokeObjectURL(url);
      modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });
      modal.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', cleanup));
    } else if (isVideo) {
      const typedBlob = new Blob([entry.blob], { type: videoMimeMap[ext] });
      const url = URL.createObjectURL(typedBlob);
      const modal = ui.openModal({
        title: entry.filename,
        icon: 'film',
        bodyHtml: `
          <video id="safe-video-preview" controls playsinline preload="metadata" style="width:100%;max-height:62dvh;border-radius:10px;background:#05161A;"></video>
          <p id="safe-video-error" class="setting-desc hidden">Tu navegador no pudo decodificar este códec de video. Usa Descargar para abrirlo en tu reproductor.</p>
        `,
        footerHtml: `<button class="btn btn-primary" type="button" data-modal-close>Cerrar</button>`
      });
      const videoEl = modal.querySelector('#safe-video-preview');
      const errEl = modal.querySelector('#safe-video-error');
      if (videoEl) {
        videoEl.src = url;
        videoEl.addEventListener('error', () => {
          videoEl.classList.add('hidden');
          errEl?.classList.remove('hidden');
        });
      }
      const cleanup = () => {
        if (videoEl) {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        }
        URL.revokeObjectURL(url);
      };
      modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });
      modal.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', cleanup));
    } else if (isAudio) {
      const typedBlob = new Blob([entry.blob], { type: audioMimeMap[ext] });
      const url = URL.createObjectURL(typedBlob);
      const modal = ui.openModal({
        title: entry.filename,
        icon: 'music',
        bodyHtml: `<audio id="safe-audio-preview" controls preload="metadata" style="width:100%;"></audio>`,
        footerHtml: `<button class="btn btn-primary" type="button" data-modal-close>Cerrar</button>`
      });
      const audioEl = modal.querySelector('#safe-audio-preview');
      if (audioEl) audioEl.src = url;
      const cleanup = () => {
        if (audioEl) {
          audioEl.pause();
          audioEl.removeAttribute('src');
        }
        URL.revokeObjectURL(url);
      };
      modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });
      modal.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', cleanup));
    } else {
      const slice = entry.blob.slice(0, 128 * 1024);
      const text = await slice.text();
      const modal = ui.openModal({
        title: entry.filename,
        icon: 'file-text',
        bodyHtml: `<pre id="safe-text-preview" class="mono" style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:0.8rem;max-height:60dvh;overflow:auto;background:#05161A;padding:1rem;border-radius:10px;"></pre>`,
        footerHtml: `<button class="btn btn-primary" type="button" data-modal-close>Cerrar</button>`
      });
      const pre = modal.querySelector('#safe-text-preview');
      if (pre) pre.textContent = text;
    }
  } catch (error) {
    ui.showToast(error.message || 'No se pudo generar la vista previa.', 'alert-circle');
  }
}

function openInstallModalPreview() {
  const modal = ui.openModal({
    title: 'Instala EXTRACT',
    icon: 'download',
    bodyHtml: `
      <div class="install-hero">
        <div class="install-hero-icon"><i data-lucide="archive"></i></div>
        <div>
          <h3 class="block-title">Instala EXTRACT</h3>
          <p class="setting-desc">Accede a tus archivos y herramientas desde una aplicación independiente, rápida y gratuita.</p>
        </div>
      </div>
      <div class="ios-steps">
        <strong>En iOS / Safari:</strong> Pulsa el botón Compartir del navegador y elige <em>Añadir a pantalla de inicio</em>.
      </div>
    `,
    footerHtml: `
      <button class="btn btn-ghost" type="button" data-modal-close>Ahora no</button>
      <button class="btn btn-primary" type="button" id="btn-install-preview-ok">Instalar aplicación</button>
    `
  });

  modal.querySelector('#btn-install-preview-ok')?.addEventListener('click', () => {
    ui.closeModal();
    ui.showToast('El flujo completo de instalación PWA (beforeinstallprompt + regla 7 días) se implementa en la Fase 2.', 'info');
  });
}

function initGlobalListeners() {
  document.getElementById('btn-open-sidebar')?.addEventListener('click', () => ui.toggleSidebar(true));
  document.getElementById('btn-close-sidebar')?.addEventListener('click', () => ui.toggleSidebar(false));
  document.getElementById('btn-toggle-properties')?.addEventListener('click', () => ui.toggleProperties());
  document.getElementById('btn-close-properties')?.addEventListener('click', () => ui.toggleProperties(false));

  document.getElementById('btn-import-sidebar')?.addEventListener('click', () => handleAction('import-files'));
  document.getElementById('btn-new-zip-sidebar')?.addEventListener('click', () => handleAction('open-create-zip'));
  document.getElementById('btn-mobile-fab')?.addEventListener('click', () => handleAction('import-files'));

  document.querySelectorAll('.nav-item, .bottom-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.toggleSidebar(false);
      router.navigate(btn.dataset.route);
    });
  });

  const searchInput = document.getElementById('global-search');
  searchInput?.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value;
    ui.renderRoute(router.currentRoute);
  });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput?.focus();
    } else if (e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      ui.toggleProperties();
    } else if (e.key === 'Escape') {
      ui.closeContextMenu();
      ui.closeModal();
      ui.toggleSidebar(false);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('[data-menu-id]')) {
      ui.closeContextMenu();
    }
  });

  // Recepción real de archivos desde selector manual y carpeta
  document.getElementById('input-file-picker')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files?.length) {
      await fileManager.importFiles(files, { source: 'Selector de archivos' });
      e.target.value = '';
    }
  });

  document.getElementById('input-folder-picker')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files?.length) {
      await fileManager.importFiles(files, { source: 'Carpeta del dispositivo' });
      e.target.value = '';
    }
  });
}

async function bootstrap() {
  storageManager = new StorageManager();
  securityManager = new SecurityManager();
  archiveManager = new ArchiveManager(securityManager);
  compressionManager = new CompressionManager();
  downloadManager = new DownloadManager();

  const [savedFiles, savedHistory, savedSettings] = await Promise.all([
    storageManager.getAllFiles(),
    storageManager.getHistory(),
    storageManager.getSettings()
  ]);

  appState.items = savedFiles;
  appState.tasks = savedHistory;
  if (savedSettings.viewMode) appState.viewMode = savedSettings.viewMode;
  if (savedSettings.sortBy) appState.sortBy = savedSettings.sortBy;
  if (savedSettings.sortDir) appState.sortDir = savedSettings.sortDir;
  if (savedSettings.maxUncompressedMB) {
    appState.maxUncompressedMB = savedSettings.maxUncompressedMB;
    securityManager.maxUncompressedBytes = savedSettings.maxUncompressedMB * 1024 * 1024;
  }

  ui = new UIManager(appState, {
    onNavigate: (route) => router.navigate(route),
    onAction: handleAction,
    onFilterExt: (ext) => {
      appState.extFilter = ext;
      ui.renderRoute(router.currentRoute);
    },
    onViewMode: (mode) => {
      appState.viewMode = mode;
      storageManager?.saveSetting('viewMode', mode);
      ui.renderRoute(router.currentRoute);
    },
    onSortChange: (by, dir) => {
      appState.sortBy = by;
      appState.sortDir = dir;
      storageManager?.saveSetting('sortBy', by);
      storageManager?.saveSetting('sortDir', dir);
      ui.renderRoute(router.currentRoute);
    },
    onMaxMbChange: (mb) => {
      appState.maxUncompressedMB = mb;
      securityManager.maxUncompressedBytes = mb * 1024 * 1024;
      storageManager?.saveSetting('maxUncompressedMB', mb);
      ui.showToast(`Límite preventivo actualizado a ${mb} MB.`, 'shield-check');
    },
    onToggleSelect: (id) => {
      if (appState.selectedIds.has(id)) {
        appState.selectedIds.delete(id);
      } else {
        appState.selectedIds.add(id);
      }
      ui.renderRoute(router.currentRoute);
    },
    onFocusItem: (id) => {
      appState.focusedItem = appState.items.find((i) => i.id === id) || null;
      ui.renderProperties();
      ui.toggleProperties(true);
    },
    onContextAction: (action, id) => {
      const target = appState.items.find((i) => i.id === id);
      if (!target) return;
      if (action === 'properties') {
        appState.focusedItem = target;
        ui.renderProperties();
        ui.toggleProperties(true);
      } else if (action === 'favorite') {
        target.favorite = !target.favorite;
        if (target.savedInLibrary || target.isFolder) {
          storageManager?.putFile(target);
        }
        ui.renderRoute(router.currentRoute);
      } else if (action === 'toggle-save') {
        if (!target.fileRef) return;
        if (target.savedInLibrary) {
          target.savedInLibrary = false;
          storageManager?.deleteFile(target.id).then(refreshStorageEstimate);
          ui.showToast('Eliminado del almacenamiento permanente (sigue disponible en esta sesión).', 'info');
        } else {
          target.savedInLibrary = true;
          storageManager?.putFile(target).then(refreshStorageEstimate);
          ui.showToast('Guardado en tu biblioteca local.', 'check-circle');
        }
        ui.renderRoute(router.currentRoute);
      } else if (action === 'remove') {
        appState.items = appState.items.filter((i) => i.id !== id);
        appState.selectedIds.delete(id);
        if (appState.focusedItem?.id === id) appState.focusedItem = null;
        storageManager?.deleteFile(id);
        ui.renderRoute(router.currentRoute);
      } else if (action === 'open') {
        openArchiveInExplorer(target);
      }
    },
    onOpenItem: (id) => {
      const target = appState.items.find((i) => i.id === id);
      if (target && target.category === 'archive') {
        openArchiveInExplorer(target);
      }
    },
    onExplorerCrumb: (idx) => {
      appState.explorerPath = idx < 0 ? [] : appState.explorerPath.slice(0, idx + 1);
      ui.renderRoute('explorador');
    },
    onExplorerEnterDir: (dirName) => {
      appState.explorerPath.push(dirName);
      ui.renderRoute('explorador');
    },
    onExplorerToggleEntry: (rawPath) => {
      if (appState.selectedArchiveEntries.has(rawPath)) {
        appState.selectedArchiveEntries.delete(rawPath);
      } else {
        appState.selectedArchiveEntries.add(rawPath);
      }
      ui.renderRoute('explorador');
    },
    onExplorerExtractSingle: (rawPath) => {
      runExtraction([rawPath]);
    },
    onExplorerPreviewSingle: (rawPath) => {
      previewArchiveEntry(rawPath);
    }
  });

  router = new Router((route) => {
    ui.renderRoute(route);
    if (updater?.waitingWorker) {
      updater.notifyUpdateAvailable();
    }
  });

  installer = new InstallationManager(ui);
  updater = new UpdateManager(ui, () => appState.hasActiveTasks);
  fileManager = new FileManager(appState, ui, async (imported) => {
    ui.renderRoute(router.currentRoute);
    if (imported?.length === 1 && imported[0].category === 'archive') {
      await openArchiveInExplorer(imported[0]);
    }
  });
  shareTarget = new ShareTargetHandler(fileManager, ui);

  initGlobalListeners();
  fileManager.initDragAndDrop();
  ui.refreshIcons();
  router.init();
  installer.init();
  updater.init();
  await refreshStorageEstimate();
  shareTarget.checkIncomingShare();
}

document.addEventListener('DOMContentLoaded', bootstrap);

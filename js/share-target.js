/**
 * share-target.js — Recuperación de archivos compartidos desde el Service Worker (Web Share Target)
 */

const SHARED_INBOX_CACHE = 'extract-shared-inbox';

export class ShareTargetHandler {
  constructor(fileManager, ui) {
    this.fileManager = fileManager;
    this.ui = ui;
  }

  async checkIncomingShare() {
    const params = new URLSearchParams(window.location.search);
    const sharedStatus = params.get('shared');
    if (!sharedStatus) return;

    // Limpiar parámetro de la URL sin recargar
    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);

    if (sharedStatus === 'error') {
      this.ui.showToast('No se pudieron recibir los archivos compartidos.', 'alert-circle');
      return;
    }

    if (sharedStatus !== '1' || !('caches' in window)) return;

    try {
      const sharedCache = await caches.open(SHARED_INBOX_CACHE);
      const metaRes = await sharedCache.match('./__shared/latest-share');
      if (!metaRes) return;

      const payload = await metaRes.json();
      await sharedCache.delete('./__shared/latest-share');

      const recoveredFiles = [];
      for (const meta of payload.files || []) {
        const fileRes = await sharedCache.match(`./__shared/${meta.key}`);
        if (!fileRes) continue;
        const blob = await fileRes.blob();
        await sharedCache.delete(`./__shared/${meta.key}`);

        const file = new File([blob], meta.name || 'archivo_compartido', {
          type: meta.type || blob.type || 'application/octet-stream',
          lastModified: payload.timestamp || Date.now()
        });
        recoveredFiles.push(file);
      }

      if (recoveredFiles.length > 0) {
        await this.fileManager.importFiles(recoveredFiles, {
          source: 'Compartido (WhatsApp / Sistema)'
        });
      } else {
        this.ui.showToast('La compartición no incluyó archivos adjuntos.', 'info');
      }
    } catch (error) {
      console.error('Error recuperando archivos compartidos:', error);
      this.ui.showToast('Error al leer los archivos compartidos.', 'alert-circle');
    }
  }
}

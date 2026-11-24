/**
 * update-manager.js — Registro del Service Worker, detección de versiones y actualización segura
 */

export class UpdateManager {
  constructor(ui, isBusyFn) {
    this.ui = ui;
    this.isBusyFn = typeof isBusyFn === 'function' ? isBusyFn : () => false;
    this.registration = null;
    this.waitingWorker = null;
    this.reloading = false;
  }

  async init() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.reloading) return;
      this.reloading = true;
      window.location.reload();
    });

    try {
      this.registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });

      if (this.registration.waiting) {
        this.waitingWorker = this.registration.waiting;
        this.notifyUpdateAvailable();
      }

      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.waitingWorker = newWorker;
            this.notifyUpdateAvailable();
          }
        });
      });
    } catch (error) {
      console.warn('No se pudo registrar el Service Worker:', error);
    }
  }

  async checkForUpdates() {
    if (!this.registration) {
      this.ui.showToast('El Service Worker no está activo en este navegador.', 'info');
      return;
    }
    try {
      await this.registration.update();
      if (this.registration.waiting) {
        this.waitingWorker = this.registration.waiting;
        this.notifyUpdateAvailable();
      } else {
        this.ui.showToast('Ya tienes la versión más reciente de EXTRACT.', 'check-circle');
      }
    } catch (_) {
      this.ui.showToast('No se pudo comprobar actualizaciones en este momento.', 'alert-circle');
    }
  }

  notifyUpdateAvailable() {
    const existing = document.getElementById('update-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <div class="setting-info">
        <span class="setting-label">Nueva versión de EXTRACT disponible</span>
        <span class="setting-desc">Actualiza sin perder tus preferencias ni archivos locales.</span>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary btn-sm" type="button" id="btn-apply-update">Actualizar ahora</button>
      </div>
    `;

    const workspace = document.getElementById('main-workspace');
    workspace?.prepend(banner);

    banner.querySelector('#btn-apply-update')?.addEventListener('click', () => this.applyUpdate());
  }

  applyUpdate() {
    if (!this.waitingWorker) return;

    if (this.isBusyFn()) {
      this.ui.showToast('Hay una tarea en curso. Espera a que termine antes de actualizar.', 'clock');
      return;
    }

    this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }
}

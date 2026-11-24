/**
 * installation.js — Gestión de instalación PWA, beforeinstallprompt, iOS y regla de 7 días
 */

const STORAGE_DISMISSED_AT = 'extract_install_dismissed_at';
const STORAGE_INSTALLED = 'extract_pwa_installed';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class InstallationManager {
  constructor(ui) {
    this.ui = ui;
    this.deferredPrompt = null;
    this.shownThisSession = false;
  }

  init() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.maybeShowPrompt();
    });

    window.addEventListener('appinstalled', () => {
      localStorage.setItem(STORAGE_INSTALLED, '1');
      localStorage.removeItem(STORAGE_DISMISSED_AT);
      this.deferredPrompt = null;
      this.ui.closeModal();
      this.ui.showToast('EXTRACT se instaló correctamente en tu dispositivo.', 'check-circle');
    });

    // En iOS/Safari no se dispara beforeinstallprompt: evaluamos tras cargar sin bloquear la app
    if (this.isIOS() && !this.isStandalone()) {
      setTimeout(() => this.maybeShowPrompt(), 1200);
    }
  }

  isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      localStorage.getItem(STORAGE_INSTALLED) === '1'
    );
  }

  isIOS() {
    const ua = window.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  isWithinCooldown() {
    const raw = localStorage.getItem(STORAGE_DISMISSED_AT);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return (Date.now() - dismissedAt) < SEVEN_DAYS_MS;
  }

  canShowInvite() {
    if (this.shownThisSession) return false;
    if (this.isStandalone()) return false;
    if (this.isWithinCooldown()) return false;
    return Boolean(this.deferredPrompt) || this.isIOS();
  }

  maybeShowPrompt() {
    if (!this.canShowInvite()) return;
    this.shownThisSession = true;
    this.showInstallDialog();
  }

  dismissForSevenDays() {
    localStorage.setItem(STORAGE_DISMISSED_AT, String(Date.now()));
    this.ui.closeModal();
  }

  showInstallDialog({ manual = false } = {}) {
    const ios = this.isIOS();
    const canNativePrompt = Boolean(this.deferredPrompt);

    const iosInstructions = `
      <div class="ios-steps">
        <strong>Instrucciones para iOS / Safari:</strong>
        <span>1. Pulsa el icono <strong>Compartir</strong> en la barra de Safari.</span>
        <span>2. Selecciona <strong>Añadir a pantalla de inicio</strong>.</span>
        <span>3. Confirma pulsando <strong>Añadir</strong>.</span>
      </div>
    `;

    const genericInstructions = `
      <div class="ios-steps">
        <strong>Instalación desde el navegador:</strong>
        <span>Abre el menú de tu navegador y selecciona <strong>Instalar aplicación</strong> o <strong>Añadir a la pantalla de inicio</strong>.</span>
      </div>
    `;

    const bodyHtml = `
      <div class="install-hero">
        <div class="install-hero-icon"><i data-lucide="archive"></i></div>
        <div>
          <h3 class="block-title">Instala EXTRACT</h3>
          <p class="setting-desc">Accede a tus archivos y herramientas desde una aplicación independiente, rápida y gratuita.</p>
        </div>
      </div>
      ${ios ? iosInstructions : (!canNativePrompt ? genericInstructions : '')}
    `;

    const footerHtml = `
      <button class="btn btn-ghost" type="button" id="btn-install-later">Ahora no</button>
      ${canNativePrompt ? '<button class="btn btn-primary" type="button" id="btn-install-now">Instalar aplicación</button>' : '<button class="btn btn-primary" type="button" id="btn-install-ok">Entendido</button>'}
    `;

    const modal = this.ui.openModal({
      title: 'Instala EXTRACT',
      icon: 'download',
      bodyHtml,
      footerHtml
    });

    modal.querySelector('#btn-install-later')?.addEventListener('click', () => {
      if (!manual) {
        this.dismissForSevenDays();
      } else {
        this.dismissForSevenDays();
      }
    });

    modal.querySelector('#btn-install-ok')?.addEventListener('click', () => {
      this.dismissForSevenDays();
    });

    modal.querySelector('#btn-install-now')?.addEventListener('click', async () => {
      if (!this.deferredPrompt) return;
      try {
        await this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          localStorage.setItem(STORAGE_INSTALLED, '1');
          localStorage.removeItem(STORAGE_DISMISSED_AT);
        } else {
          this.dismissForSevenDays();
        }
      } catch (_) {
        this.dismissForSevenDays();
      } finally {
        this.deferredPrompt = null;
        this.ui.closeModal();
      }
    });
  }
}

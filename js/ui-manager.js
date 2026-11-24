/**
 * ui-manager.js — Renderizado de vistas, componentes, modales, menús y atajos
 */

import { ROUTES } from './router.js';

export class UIManager {
  constructor(appState, handlers) {
    this.state = appState;
    this.handlers = handlers;

    this.workspace = document.getElementById('main-workspace');
    this.topbarTitle = document.getElementById('topbar-title');
    this.sidebar = document.getElementById('sidebar');
    this.propertiesPanel = document.getElementById('properties-panel');
    this.propertiesBody = document.getElementById('properties-body');
    this.modalRoot = document.getElementById('modal-root');
    this.contextRoot = document.getElementById('context-menu-root');
    this.toastContainer = document.getElementById('toast-container');

    this.longPressTimer = null;
  }

  refreshIcons(root = document) {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ attrs: { class: 'lucide' }, nameAttr: 'data-lucide' });
    }
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / Math.pow(1024, exp);
    return `${val >= 10 || exp === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[exp]}`;
  }

  formatDate(ts) {
    if (!ts) return '—';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  }

  updateNavActive(route) {
    const effective = route === 'explorador' ? 'comprimidos' : route;
    document.querySelectorAll('.nav-item, .bottom-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === effective);
    });
    const info = ROUTES[route] || ROUTES.inicio;
    this.topbarTitle.textContent = info.title;
  }

  toggleSidebar(force) {
    const open = typeof force === 'boolean' ? force : !this.sidebar.classList.contains('mobile-open');
    this.sidebar.classList.toggle('mobile-open', open);
  }

  toggleProperties(force) {
    const currentlyCollapsed = this.propertiesPanel.classList.contains('collapsed');
    const shouldOpen = typeof force === 'boolean' ? force : currentlyCollapsed;
    this.propertiesPanel.classList.toggle('collapsed', !shouldOpen);
    document.getElementById('btn-toggle-properties')?.classList.toggle('active', shouldOpen);
  }

  renderRoute(route) {
    this.updateNavActive(route);
    this.closeContextMenu();

    switch (route) {
      case 'inicio':
        this.renderHome();
        break;
      case 'actividad':
        this.renderActivity();
        break;
      case 'configuracion':
        this.renderSettings();
        break;
      case 'explorador':
        this.renderExplorer();
        break;
      default:
        this.renderLibrarySection(route);
        break;
    }

    this.refreshIcons(this.workspace);
    this.renderProperties();
  }

  renderHome() {
    const totalFiles = this.state.items.length;
    const recentItems = this.getFilteredItems('recientes').slice(0, 6);

    this.workspace.innerHTML = `
      <section class="quick-actions-grid" aria-label="Acciones rápidas">
        <button class="action-tile" type="button" data-action="import-files">
          <div class="action-tile-icon"><i data-lucide="file-plus"></i></div>
          <div>
            <div class="action-tile-title">Importar archivos</div>
            <div class="action-tile-desc">ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ</div>
          </div>
        </button>

        <button class="action-tile" type="button" data-action="import-folder">
          <div class="action-tile-icon"><i data-lucide="folder-input"></i></div>
          <div>
            <div class="action-tile-title">Importar carpeta</div>
            <div class="action-tile-desc">Selecciona una carpeta compatible</div>
          </div>
        </button>

        <button class="action-tile" type="button" data-action="open-create-zip">
          <div class="action-tile-icon"><i data-lucide="folder-archive"></i></div>
          <div>
            <div class="action-tile-title">Crear archivo ZIP</div>
            <div class="action-tile-desc">Comprime archivos localmente</div>
          </div>
        </button>
      </section>

      <section>
        <div class="block-header">
          <h2 class="block-title">Recientes (${totalFiles})</h2>
          <button class="btn btn-ghost btn-sm" type="button" data-route-jump="biblioteca">
            <span>Ver biblioteca</span>
            <i data-lucide="arrow-right"></i>
          </button>
        </div>
        ${recentItems.length ? this.renderItemsCollection(recentItems) : this.renderEmptyState({
          icon: 'archive',
          title: 'Tu espacio de trabajo está listo',
          desc: 'Importa archivos comprimidos desde tu dispositivo, arrástralos aquí o compártelos desde WhatsApp en Android.',
          ctaLabel: 'Importar archivo',
          ctaAction: 'import-files'
        })}
      </section>
    `;

    this.bindWorkspaceEvents();
  }

  getFilteredItems(section) {
    const query = this.state.searchQuery.trim().toLowerCase();
    const extFilter = this.state.extFilter;
    let items = [...this.state.items];

    if (section === 'comprimidos') {
      items = items.filter((i) => i.category === 'archive');
    } else if (section === 'carpetas') {
      items = items.filter((i) => i.isFolder);
    } else if (section === 'favoritos') {
      items = items.filter((i) => i.favorite);
    } else if (section === 'extraidos') {
      items = items.filter((i) => i.category === 'extracted');
    } else if (section === 'recientes') {
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    if (extFilter && extFilter !== 'all') {
      items = items.filter((i) => (i.ext || '').toLowerCase() === extFilter);
    }

    if (query) {
      items = items.filter((i) => i.name.toLowerCase().includes(query));
    }

    const dir = this.state.sortDir === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      if (this.state.sortBy === 'size') return ((a.size || 0) - (b.size || 0)) * dir;
      if (this.state.sortBy === 'date') return ((a.updatedAt || 0) - (b.updatedAt || 0)) * dir;
      return a.name.localeCompare(b.name, 'es') * dir;
    });

    return items;
  }

  renderLibrarySection(section) {
    const items = this.getFilteredItems(section);
    const selectedCount = this.state.selectedIds.size;
    const formats = ['all', 'zip', 'rar', '7z', 'tar', 'gz', 'xz'];

    this.workspace.innerHTML = `
      <div class="section-toolbar">
        <div class="toolbar-left">
          ${section === 'carpetas' || section === 'biblioteca' ? `
            <button class="btn btn-secondary btn-sm" type="button" data-action="create-virtual-folder">
              <i data-lucide="folder-plus"></i>
              <span>Nueva carpeta</span>
            </button>
          ` : ''}
          <div class="chip-row" role="tablist" aria-label="Filtrar por formato">
            ${formats.map((fmt) => `
              <button class="chip ${this.state.extFilter === fmt ? 'active' : ''}" type="button" data-filter-ext="${fmt}">
                ${fmt === 'all' ? 'Todos' : fmt.toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="toolbar-right">
          <select class="select-control" id="sort-select" aria-label="Ordenar por">
            <option value="name:asc" ${this.state.sortBy === 'name' && this.state.sortDir === 'asc' ? 'selected' : ''}>Nombre (A–Z)</option>
            <option value="name:desc" ${this.state.sortBy === 'name' && this.state.sortDir === 'desc' ? 'selected' : ''}>Nombre (Z–A)</option>
            <option value="date:desc" ${this.state.sortBy === 'date' && this.state.sortDir === 'desc' ? 'selected' : ''}>Más recientes</option>
            <option value="size:desc" ${this.state.sortBy === 'size' && this.state.sortDir === 'desc' ? 'selected' : ''}>Mayor tamaño</option>
          </select>

          <div class="segmented" role="group" aria-label="Modo de vista">
            <button class="segmented-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" type="button" data-view-mode="grid" title="Vista de cuadrícula" aria-label="Vista de cuadrícula">
              <i data-lucide="layout-grid"></i>
            </button>
            <button class="segmented-btn ${this.state.viewMode === 'list' ? 'active' : ''}" type="button" data-view-mode="list" title="Vista de lista" aria-label="Vista de lista">
              <i data-lucide="list"></i>
            </button>
          </div>
        </div>
      </div>

      ${selectedCount > 0 ? `
        <div class="selection-bar">
          <span><strong>${selectedCount}</strong> ${selectedCount === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}</span>
          <div class="toolbar-right">
            <button class="btn btn-secondary btn-sm" type="button" data-action="clear-selection">Deseleccionar</button>
            <button class="btn btn-secondary btn-sm" type="button" data-action="extract-multiple-selected">Extraer archivos</button>
            <button class="btn btn-primary btn-sm" type="button" data-action="open-create-zip">Comprimir en ZIP</button>
          </div>
        </div>
      ` : ''}

      <section>
        ${items.length ? this.renderItemsCollection(items) : this.renderEmptyState({
          icon: ROUTES[section]?.icon || 'folder-open',
          title: 'No hay elementos en esta vista',
          desc: this.state.searchQuery
            ? 'Prueba con otro término de búsqueda o limpia los filtros activos.'
            : 'Importa archivos desde tu dispositivo para organizarlos y extraerlos localmente.',
          ctaLabel: 'Importar archivos',
          ctaAction: 'import-files'
        })}
      </section>
    `;

    this.bindWorkspaceEvents();
  }

  renderItemsCollection(items) {
    if (this.state.viewMode === 'list') {
      return `
        <div class="files-list" role="grid" aria-label="Lista de archivos">
          <div class="files-list-header">
            <span></span>
            <span>Nombre</span>
            <span>Formato</span>
            <span>Tamaño</span>
            <span>Fecha</span>
            <span>Acciones</span>
          </div>
          ${items.map((item) => {
            const isSelected = this.state.selectedIds.has(item.id);
            return `
              <div class="file-row ${isSelected ? 'selected' : ''}" data-item-id="${this.escapeHtml(item.id)}" tabindex="0">
                <input class="file-checkbox" type="checkbox" ${isSelected ? 'checked' : ''} data-select-id="${this.escapeHtml(item.id)}" aria-label="Seleccionar ${this.escapeHtml(item.name)}" />
                <div class="file-row-name">
                  <i data-lucide="${item.isFolder ? 'folder' : 'file-archive'}"></i>
                  <span class="truncate">${this.escapeHtml(item.name)}</span>
                </div>
                <span><span class="badge badge-muted">${this.escapeHtml((item.ext || 'DIR').toUpperCase())}</span></span>
                <span>${this.formatBytes(item.size)}</span>
                <span>${this.formatDate(item.updatedAt)}</span>
                <div class="file-card-actions">
                  <button class="icon-btn" type="button" data-fav-id="${this.escapeHtml(item.id)}" aria-label="Favorito">
                    <i data-lucide="star"></i>
                  </button>
                  <button class="icon-btn" type="button" data-menu-id="${this.escapeHtml(item.id)}" aria-label="Más opciones">
                    <i data-lucide="more-vertical"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="files-grid" role="grid" aria-label="Cuadrícula de archivos">
        ${items.map((item) => {
          const isSelected = this.state.selectedIds.has(item.id);
          return `
            <article class="file-card ${isSelected ? 'selected' : ''}" data-item-id="${this.escapeHtml(item.id)}" tabindex="0">
              <div class="file-card-top">
                <div class="file-icon-box ${item.isFolder ? 'is-folder' : ''}">
                  <i data-lucide="${item.isFolder ? 'folder' : 'file-archive'}"></i>
                </div>
                <div class="file-card-actions">
                  <input class="file-checkbox" type="checkbox" ${isSelected ? 'checked' : ''} data-select-id="${this.escapeHtml(item.id)}" aria-label="Seleccionar ${this.escapeHtml(item.name)}" />
                  <button class="icon-btn" type="button" data-menu-id="${this.escapeHtml(item.id)}" aria-label="Opciones">
                    <i data-lucide="more-vertical"></i>
                  </button>
                </div>
              </div>
              <div class="file-card-name" title="${this.escapeHtml(item.name)}">${this.escapeHtml(item.name)}</div>
              <div class="file-card-meta">
                <span class="badge badge-muted">${this.escapeHtml((item.ext || 'DIR').toUpperCase())}</span>
                <span>${this.formatBytes(item.size)}</span>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  renderExplorer() {
    const active = this.state.activeArchive;
    const pathParts = this.state.explorerPath || [];
    const prefix = pathParts.length ? `${pathParts.join('/')}/` : '';
    const selectedEntries = this.state.selectedArchiveEntries || new Set();

    let visibleNodes = [];
    if (active && Array.isArray(active.entries)) {
      const folderSet = new Set();
      const files = [];

      for (const entry of active.entries) {
        const clean = entry.safePath || '';
        if (!clean || (prefix && !clean.startsWith(prefix))) continue;
        const rest = clean.slice(prefix.length);
        if (!rest) continue;

        const slashIdx = rest.indexOf('/');
        if (slashIdx !== -1 || entry.isDirectory) {
          const folderName = slashIdx !== -1 ? rest.slice(0, slashIdx) : rest.replace(/\/$/, '');
          if (folderName && !folderSet.has(folderName)) {
            folderSet.add(folderName);
            visibleNodes.push({
              name: folderName,
              rawPath: `${prefix}${folderName}/`,
              isDirectory: true,
              size: 0
            });
          }
        } else {
          files.push({
            name: rest,
            rawPath: entry.rawPath,
            safePath: clean,
            isDirectory: false,
            size: entry.size || 0,
            encrypted: entry.encrypted,
            isSuspicious: entry.isSuspicious
          });
        }
      }

      visibleNodes.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      files.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      visibleNodes = [...visibleNodes, ...files];
    }

    this.workspace.innerHTML = `
      <div class="explorer-view">
        <div class="explorer-header">
          <div class="explorer-title-row">
            <div class="explorer-archive-info">
              <button class="icon-btn" type="button" data-route-jump="biblioteca" aria-label="Volver a biblioteca">
                <i data-lucide="arrow-left"></i>
              </button>
              <div>
                <h2 class="block-title">${active ? this.escapeHtml(active.name) : 'Explorador interno'}</h2>
                <span class="setting-desc">${active ? `${this.formatBytes(active.size)} · ${active.entries?.length || 0} elementos` : 'Ningún archivo comprimido abierto'}</span>
              </div>
            </div>
            <div class="explorer-actions">
              ${this.state.hasActiveTasks ? `
                <button class="btn btn-secondary btn-sm" type="button" data-action="cancel-task">
                  <i data-lucide="x-circle"></i>
                  <span>Cancelar</span>
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" type="button" data-action="extract-selected" ${active && selectedEntries.size > 0 ? '' : 'disabled'}>
                <i data-lucide="check-square"></i>
                <span>Extraer selección (${selectedEntries.size})</span>
              </button>
              <button class="btn btn-primary btn-sm" type="button" data-action="extract-all" ${active ? '' : 'disabled'}>
                <i data-lucide="package-open"></i>
                <span>Extraer todo</span>
              </button>
            </div>
          </div>

          <nav class="breadcrumbs" aria-label="Ruta interna">
            <button class="breadcrumb-btn ${pathParts.length === 0 ? 'current' : ''}" type="button" data-crumb="-1">
              <i data-lucide="hard-drive"></i>
              <span>Raíz</span>
            </button>
            ${pathParts.map((part, idx) => `
              <span class="breadcrumb-sep"><i data-lucide="chevron-right"></i></span>
              <button class="breadcrumb-btn ${idx === pathParts.length - 1 ? 'current' : ''}" type="button" data-crumb="${idx}">
                ${this.escapeHtml(part)}
              </button>
            `).join('')}
          </nav>
        </div>

        ${active ? (visibleNodes.length ? `
          <div class="files-list" role="grid" aria-label="Contenido del archivo comprimido">
            <div class="files-list-header">
              <span></span>
              <span>Nombre</span>
              <span>Tipo</span>
              <span>Tamaño</span>
              <span>Estado</span>
              <span>Acción</span>
            </div>
            ${visibleNodes.map((node) => {
              const checked = selectedEntries.has(node.rawPath);
              return `
                <div class="file-row ${checked ? 'selected' : ''}" ${node.isDirectory ? `data-exp-dir="${this.escapeHtml(node.name)}"` : `data-exp-file="${this.escapeHtml(node.rawPath)}"`}>
                  ${node.isDirectory ? '<span></span>' : `<input class="file-checkbox" type="checkbox" ${checked ? 'checked' : ''} data-exp-select="${this.escapeHtml(node.rawPath)}" aria-label="Seleccionar ${this.escapeHtml(node.name)}" />`}
                  <div class="file-row-name">
                    <i data-lucide="${node.isDirectory ? 'folder' : (node.isSuspicious ? 'shield-alert' : 'file')}"></i>
                    <span class="truncate">${this.escapeHtml(node.name)}</span>
                  </div>
                  <span><span class="badge badge-muted">${node.isDirectory ? 'CARPETA' : 'ARCHIVO'}</span></span>
                  <span>${node.isDirectory ? '—' : this.formatBytes(node.size)}</span>
                  <span>${node.encrypted ? '<span class="badge badge-accent">Cifrado</span>' : (node.isSuspicious ? '<span class="badge badge-muted">Ejecutable</span>' : 'Listo')}</span>
                  <div class="file-card-actions">
                    ${node.isDirectory ? '' : `
                      <button class="icon-btn" type="button" data-exp-preview="${this.escapeHtml(node.rawPath)}" title="Vista previa segura">
                        <i data-lucide="eye"></i>
                      </button>
                      <button class="icon-btn" type="button" data-exp-download="${this.escapeHtml(node.rawPath)}" title="Extraer y descargar">
                        <i data-lucide="download"></i>
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : this.renderEmptyState({
          icon: 'folder-open',
          title: 'Carpeta vacía',
          desc: 'No hay elementos en esta ruta interna del archivo.'
        })) : this.renderEmptyState({
          icon: 'package-open',
          title: 'Sin archivo comprimido abierto',
          desc: 'Importa o selecciona un archivo ZIP, RAR, 7Z, TAR, GZ, BZ2 o XZ para inspeccionar su contenido.',
          ctaLabel: 'Importar archivo',
          ctaAction: 'import-files'
        })}
      </div>
    `;

    this.bindWorkspaceEvents();
  }

  renderActivity() {
    const tasks = this.state.tasks || [];
    this.workspace.innerHTML = `
      <div class="section-toolbar">
        <div>
          <h2 class="block-title">Centro de actividad</h2>
          <p class="setting-desc">Seguimiento local de extracciones y compresiones.</p>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-action="clear-activity" ${tasks.length ? '' : 'disabled'}>
          <i data-lucide="trash-2"></i>
          <span>Limpiar historial</span>
        </button>
      </div>

      ${tasks.length ? `
        <div class="activity-list">
          ${tasks.map((t) => `
            <article class="activity-item">
              <div class="activity-head">
                <div class="activity-title">
                  <i data-lucide="${t.type === 'compress' ? 'folder-archive' : 'package-open'}"></i>
                  <span>${this.escapeHtml(t.name)}</span>
                </div>
                <span class="badge badge-accent">${this.escapeHtml(t.statusLabel)}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${t.progress || 0}%"></div></div>
              <div class="activity-meta">
                <span>${this.escapeHtml(t.detail || '')}</span>
                <span>${t.duration ? `${t.duration} ms` : ''}</span>
              </div>
            </article>
          `).join('')}
        </div>
      ` : this.renderEmptyState({
        icon: 'activity',
        title: 'No hay tareas registradas',
        desc: 'Aquí verás el progreso, estado y tiempo de procesamiento de tus extracciones y compresiones.'
      })}
    `;

    this.bindWorkspaceEvents();
  }

  renderSettings() {
    const maxMb = this.state.maxUncompressedMB || 512;
    const storageText = this.state.storageText || 'No disponible';

    this.workspace.innerHTML = `
      <div class="settings-grid">
        <section class="settings-card">
          <h2 class="settings-card-title">Seguridad y límites</h2>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Protección contra Zip Slip y rutas peligrosas</span>
              <span class="setting-desc">Valida y sanea rutas absolutas o secuencias ../ antes de extraer.</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked disabled />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Límite preventivo de descompresión</span>
              <span class="setting-desc">Detiene la operación si el contenido supera este umbral.</span>
            </div>
            <select class="select-control" id="setting-max-mb" aria-label="Límite preventivo de descompresión">
              <option value="256" ${maxMb === 256 ? 'selected' : ''}>256 MB</option>
              <option value="512" ${maxMb === 512 ? 'selected' : ''}>512 MB</option>
              <option value="1024" ${maxMb === 1024 ? 'selected' : ''}>1024 MB</option>
              <option value="2048" ${maxMb === 2048 ? 'selected' : ''}>2048 MB</option>
            </select>
          </div>
        </section>

        <section class="settings-card">
          <h2 class="settings-card-title">Almacenamiento local</h2>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Espacio utilizado en el dispositivo</span>
              <span class="setting-desc">Preferencias, historial y metadatos en IndexedDB y Cache.</span>
            </div>
            <span class="badge badge-muted" id="settings-storage-badge">${this.escapeHtml(storageText)}</span>
          </div>
          <div class="toolbar-left">
            <button class="btn btn-outline btn-sm" type="button" data-action="clear-history">
              <i data-lucide="history"></i>
              <span>Limpiar historial</span>
            </button>
            <button class="btn btn-outline btn-sm" type="button" data-action="clear-temp">
              <i data-lucide="eraser"></i>
              <span>Limpiar archivos temporales</span>
            </button>
            <button class="btn btn-outline btn-sm" type="button" data-action="clear-favorites">
              <i data-lucide="star-off"></i>
              <span>Eliminar favoritos</span>
            </button>
            <button class="btn btn-outline btn-sm" type="button" data-action="reset-settings">
              <i data-lucide="rotate-ccw"></i>
              <span>Restablecer preferencias</span>
            </button>
          </div>
        </section>

        <section class="settings-card">
          <h2 class="settings-card-title">Aplicación PWA</h2>
          <div class="toolbar-left">
            <button class="btn btn-outline btn-sm" type="button" data-action="show-install-preview">
              <i data-lucide="download"></i>
              <span>Instalar aplicación</span>
            </button>
            <button class="btn btn-outline btn-sm" type="button" data-action="check-updates">
              <i data-lucide="refresh-cw"></i>
              <span>Buscar actualizaciones</span>
            </button>
          </div>
          <p class="setting-desc">
            EXTRACT procesa todos los archivos localmente sin enviar datos a servidores externos.
          </p>
        </section>
      </div>
    `;

    this.bindWorkspaceEvents();
    const maxSelect = document.getElementById('setting-max-mb');
    maxSelect?.addEventListener('change', (e) => {
      this.handlers.onMaxMbChange?.(Number(e.target.value));
    });
  }

  renderEmptyState({ icon, title, desc, ctaLabel, ctaAction }) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="${icon}"></i></div>
        <h3 class="empty-state-title">${this.escapeHtml(title)}</h3>
        <p class="empty-state-desc">${this.escapeHtml(desc)}</p>
        ${ctaLabel ? `
          <button class="btn btn-primary" type="button" data-action="${ctaAction}">
            <i data-lucide="plus"></i>
            <span>${this.escapeHtml(ctaLabel)}</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  renderProperties() {
    const item = this.state.focusedItem;
    if (!item) {
      this.propertiesBody.innerHTML = `
        <div class="empty-state" style="min-height: 180px; padding: 1.25rem;">
          <div class="empty-state-icon"><i data-lucide="info"></i></div>
          <p class="empty-state-desc">Selecciona un archivo o carpeta para ver sus detalles.</p>
        </div>
      `;
      this.refreshIcons(this.propertiesBody);
      return;
    }

    this.propertiesBody.innerHTML = `
      <div class="prop-preview-box">
        <div class="prop-preview-icon"><i data-lucide="${item.isFolder ? 'folder' : 'file-archive'}"></i></div>
        <div class="file-card-name" style="max-width: 100%;">${this.escapeHtml(item.name)}</div>
        <span class="badge badge-accent">${this.escapeHtml((item.ext || 'DIR').toUpperCase())}</span>
      </div>
      <div class="prop-list">
        <div class="prop-row">
          <span class="prop-label">Tamaño</span>
          <span class="prop-value">${this.formatBytes(item.size)}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Modificado</span>
          <span class="prop-value">${this.formatDate(item.updatedAt)}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Origen</span>
          <span class="prop-value">${this.escapeHtml(item.source || 'Dispositivo local')}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Persistencia</span>
          <span class="prop-value">${item.savedInLibrary ? 'Guardado en biblioteca' : 'Solo sesión actual'}</span>
        </div>
      </div>
      ${!item.isFolder ? `
        <div class="sidebar-cta">
          ${item.category === 'archive' ? `
            <button class="btn btn-primary btn-sm btn-block" type="button" id="prop-btn-open">
              <i data-lucide="folder-open"></i><span>Abrir contenido</span>
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-sm btn-block" type="button" id="prop-btn-save">
            <i data-lucide="${item.savedInLibrary ? 'bookmark-minus' : 'bookmark-plus'}"></i>
            <span>${item.savedInLibrary ? 'Dejar de guardar' : 'Guardar en biblioteca'}</span>
          </button>
        </div>
      ` : ''}
    `;
    this.propertiesBody.querySelector('#prop-btn-open')?.addEventListener('click', () => this.handlers.onOpenItem?.(item.id));
    this.propertiesBody.querySelector('#prop-btn-save')?.addEventListener('click', () => this.handlers.onContextAction?.('toggle-save', item.id));
    this.refreshIcons(this.propertiesBody);
  }

  bindWorkspaceEvents() {
    this.workspace.querySelectorAll('[data-route-jump]').forEach((btn) => {
      btn.addEventListener('click', () => this.handlers.onNavigate(btn.dataset.routeJump));
    });

    this.workspace.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.handlers.onAction(btn.dataset.action));
    });

    this.workspace.querySelectorAll('[data-filter-ext]').forEach((btn) => {
      btn.addEventListener('click', () => this.handlers.onFilterExt(btn.dataset.filterExt));
    });

    this.workspace.querySelectorAll('[data-view-mode]').forEach((btn) => {
      btn.addEventListener('click', () => this.handlers.onViewMode(btn.dataset.viewMode));
    });

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const [by, dir] = e.target.value.split(':');
        this.handlers.onSortChange(by, dir);
      });
    }

    this.workspace.querySelectorAll('[data-select-id]').forEach((cb) => {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => this.handlers.onToggleSelect(cb.dataset.selectId));
    });

    this.workspace.querySelectorAll('[data-item-id]').forEach((el) => {
      const id = el.dataset.itemId;
      el.addEventListener('click', () => this.handlers.onFocusItem(id));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.openContextMenu(e.clientX, e.clientY, id);
      });
      el.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        this.longPressTimer = setTimeout(() => {
          this.openContextMenu(touch.clientX, touch.clientY, id);
        }, 520);
      }, { passive: true });
      el.addEventListener('touchend', () => clearTimeout(this.longPressTimer));
      el.addEventListener('touchmove', () => clearTimeout(this.longPressTimer));
    });

    this.workspace.querySelectorAll('[data-menu-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = btn.getBoundingClientRect();
        this.openContextMenu(rect.right - 180, rect.bottom + 6, btn.dataset.menuId);
      });
    });

    this.workspace.querySelectorAll('[data-crumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.crumb);
        this.handlers.onExplorerCrumb?.(idx);
      });
    });

    this.workspace.querySelectorAll('[data-exp-dir]').forEach((row) => {
      row.addEventListener('click', () => this.handlers.onExplorerEnterDir?.(row.dataset.expDir));
    });

    this.workspace.querySelectorAll('[data-exp-select]').forEach((cb) => {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => this.handlers.onExplorerToggleEntry?.(cb.dataset.expSelect));
    });

    this.workspace.querySelectorAll('[data-exp-download]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlers.onExplorerExtractSingle?.(btn.dataset.expDownload);
      });
    });

    this.workspace.querySelectorAll('[data-exp-preview]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlers.onExplorerPreviewSingle?.(btn.dataset.expPreview);
      });
    });

    this.workspace.querySelectorAll('[data-item-id]').forEach((el) => {
      el.addEventListener('dblclick', () => this.handlers.onOpenItem?.(el.dataset.itemId));
    });
  }

  openContextMenu(x, y, itemId) {
    this.closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    const clampedX = Math.min(x, window.innerWidth - 225);
    const clampedY = Math.min(y, window.innerHeight - 210);
    menu.style.left = `${Math.max(8, clampedX)}px`;
    menu.style.top = `${Math.max(8, clampedY)}px`;

    const target = this.state.items.find((i) => i.id === itemId);
    const isSaved = Boolean(target?.savedInLibrary);

    menu.innerHTML = `
      <button class="context-menu-item" type="button" data-ctx="open">
        <i data-lucide="folder-open"></i><span>Abrir</span>
      </button>
      <button class="context-menu-item" type="button" data-ctx="properties">
        <i data-lucide="info"></i><span>Propiedades</span>
      </button>
      ${target && !target.isFolder ? `
        <button class="context-menu-item" type="button" data-ctx="toggle-save">
          <i data-lucide="${isSaved ? 'bookmark-minus' : 'bookmark-plus'}"></i>
          <span>${isSaved ? 'Dejar de guardar' : 'Guardar en biblioteca'}</span>
        </button>
      ` : ''}
      <button class="context-menu-item" type="button" data-ctx="favorite">
        <i data-lucide="star"></i><span>Alternar favorito</span>
      </button>
      <div class="context-menu-sep"></div>
      <button class="context-menu-item" type="button" data-ctx="remove">
        <i data-lucide="trash-2"></i><span>Quitar de la lista</span>
      </button>
    `;

    menu.querySelectorAll('[data-ctx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closeContextMenu();
        this.handlers.onContextAction(btn.dataset.ctx, itemId);
      });
    });

    this.contextRoot.appendChild(menu);
    this.refreshIcons(menu);
  }

  closeContextMenu() {
    this.contextRoot.innerHTML = '';
  }

  openModal({ title, icon = 'info', bodyHtml, footerHtml }) {
    this.closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-label="${this.escapeHtml(title)}">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="modal-header">
          <h2 class="modal-title"><i data-lucide="${icon}"></i><span>${this.escapeHtml(title)}</span></h2>
          <button class="icon-btn" type="button" data-modal-close aria-label="Cerrar">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    backdrop.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal());
    });

    this.modalRoot.appendChild(backdrop);
    this.refreshIcons(backdrop);
    return backdrop;
  }

  closeModal() {
    this.modalRoot.innerHTML = '';
  }

  showToast(message, icon = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="${icon}"></i><span>${this.escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);
    this.refreshIcons(toast);
    setTimeout(() => toast.remove(), 3400);
  }
}

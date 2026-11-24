/**
 * router.js — Enrutador de secciones basado en hash y estado local
 */

export const ROUTES = {
  inicio: { id: 'inicio', title: 'Inicio', icon: 'home' },
  biblioteca: { id: 'biblioteca', title: 'Mi biblioteca', icon: 'library' },
  todos: { id: 'todos', title: 'Todos los archivos', icon: 'files' },
  comprimidos: { id: 'comprimidos', title: 'Comprimidos', icon: 'file-archive' },
  carpetas: { id: 'carpetas', title: 'Carpetas', icon: 'folder' },
  recientes: { id: 'recientes', title: 'Recientes', icon: 'clock' },
  favoritos: { id: 'favoritos', title: 'Favoritos', icon: 'star' },
  extraidos: { id: 'extraidos', title: 'Extraídos', icon: 'package-open' },
  actividad: { id: 'actividad', title: 'Actividad', icon: 'activity' },
  configuracion: { id: 'configuracion', title: 'Configuración', icon: 'settings' },
  explorador: { id: 'explorador', title: 'Explorador de archivo', icon: 'folder-open' }
};

export class Router {
  constructor(onRouteChange) {
    this.onRouteChange = onRouteChange;
    this.currentRoute = 'inicio';
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  init() {
    window.addEventListener('hashchange', this.handleHashChange);
    const initial = this.parseHash();
    this.navigate(initial, { replace: true });
  }

  parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '').trim();
    return ROUTES[raw] ? raw : 'inicio';
  }

  handleHashChange() {
    const route = this.parseHash();
    this.currentRoute = route;
    this.onRouteChange(route);
  }

  navigate(route, { replace = false } = {}) {
    const target = ROUTES[route] ? route : 'inicio';
    this.currentRoute = target;
    const nextHash = `#/${target}`;

    if (window.location.hash !== nextHash) {
      if (replace) {
        history.replaceState(null, '', nextHash);
      } else {
        window.location.hash = nextHash;
      }
    }

    this.onRouteChange(target);
  }

  destroy() {
    window.removeEventListener('hashchange', this.handleHashChange);
  }
}

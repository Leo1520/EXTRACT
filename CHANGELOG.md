# CHANGELOG.md — EXTRACT

## [1.0.0] - Fase 8: Preparación para GitHub Pages y Documentación Final
### Agregado
- Archivo `.nojekyll` en la raíz para compatibilidad directa con GitHub Pages.
- Documentación completa: `README.md`, `INSTALLATION.md`, `COMPATIBILITY.md` y `SECURITY.md`.
- Auditoría final de rutas relativas (`./`), manifiesto PWA y recursos de precaché del Service Worker.

## [0.7.0] - Fase 7: Seguridad y Rendimiento
### Mejorado
- Añadida resolución determinista de nombres duplicados (`resolveDuplicatePath`) en `js/security-manager.js`.
- Ejecutada batería de pruebas de seguridad y estrés: archivos pequeños, grandes, corruptos, protegidos con contraseña, carpetas anidadas, Unicode/caracteres especiales, Zip Slip, bombas de descompresión, duplicados y bloqueo de actualización durante tareas activas.

## [0.6.0] - Fase 6: Compresión ZIP y Funciones Adicionales
### Agregado
- `js/compression-manager.js` para creación local de archivos `.zip` (múltiples archivos y carpetas, nombre personalizado, progreso en Centro de Actividad y contraseña opcional AES-256).
- Extracción múltiple de archivos comprimidos seleccionados desde la biblioteca.
- Vista previa segura en el explorador para texto plano e imágenes (con bloqueo estricto de HTML, SVG, scripts y ejecutables).

## [0.5.0] - Fase 5: Biblioteca y Almacenamiento Local
### Agregado
- `js/storage-manager.js` con base de datos `IndexedDB` (`extract_db`) para metadatos de archivos, carpetas virtuales, historial de actividad y preferencias.
- Controles completos en Configuración: limpiar historial, limpiar temporales, eliminar favoritos, restablecer preferencias, límite de seguridad configurable y consulta real de almacenamiento (`navigator.storage.estimate()`).
- Creación de carpetas virtuales en Biblioteca y persistencia automática de estado entre sesiones.

## [0.4.0] - Fase 4: Motor de Extracción Real
### Agregado
- Librerías locales vendored para uso offline: `@zip.js/zip.js` (`lib/zip.js/zip.min.js`) y `7z-wasm` (`lib/7z-wasm/7zz.es6.js` + `7zz.wasm`).
- Web Workers dedicados: `workers/zip-worker.js` (ZIP con streaming y contraseñas AES-256/ZipCrypto) y `workers/archive-worker.js` (7z-wasm single-thread para 7Z, RAR4/5, TAR, GZ, BZ2, XZ, TAR.GZ, TAR.XZ).
- `js/security-manager.js` con protección anti Zip Slip, límites preventivos anti-bomba y detección de archivos ejecutables/sospechosos.
- `js/archive-manager.js` y `js/download-manager.js` con listado, extracción completa/selectiva, progreso, cancelación y descarga segura.
- Explorador interno funcional con navegación por carpetas, breadcrumbs, diálogo de contraseña y registro en Centro de Actividad.

## [0.3.0] - Fase 3: Recepción e Importación de Archivos
### Agregado
- Configuración `share_target` (`POST`, `multipart/form-data`) en `manifest.json` para recibir archivos compartidos desde Android/WhatsApp.
- Interceptor `POST` en `service-worker.js` (`/share-receiver`) que almacena temporalmente los archivos en `Cache Storage` (`extract-shared-inbox`) y redirige con `303` sin requerir backend.
- Módulo `js/share-target.js` para recuperar y limpiar automáticamente los archivos compartidos al abrir la app.
- Módulo `js/file-manager.js` con importación manual, selector de carpetas (`showDirectoryPicker` + fallback `webkitdirectory`), Drag & Drop recursivo con overlay visual y detección de formato por firma mágica (magic bytes) y extensión.

## [0.2.0] - Fase 2: Sistema PWA, Instalación y Actualizaciones
### Agregado
- Manifiesto PWA (`manifest.json`) con rutas relativas (`./`), modo `standalone` y colores oficiales.
- Iconos PNG generados en `assets/icons/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`).
- Service Worker (`service-worker.js`) con precaché de App Shell, soporte offline (`offline/offline.html`), limpieza segura de cachés antiguos y alcance compatible con subrutas de GitHub Pages.
- Gestor de instalación (`js/installation.js`) con `beforeinstallprompt`, regla exacta de ocultamiento de 7 días al elegir "Ahora no", no repetición en la misma sesión e instrucciones específicas para iOS/Safari.
- Gestor de actualizaciones (`js/update-manager.js`) que detecta nuevas versiones en segundo plano, muestra notificación con botón "Actualizar ahora" y bloquea el reinicio mientras haya tareas activas.

## [0.1.0] - Fase 1: Interfaz y Experiencia (UI/UX Shell)
### Agregado
- Shell principal responsive en `index.html` adaptado a escritorio, tablet y móvil.
- Sistema CSS modular (`css/variables.css`, `base.css`, `layout.css`, `components.css`, `library.css`, `explorer.css`, `dialogs.css`, `responsive.css`) con la paleta oficial (`#05161A`, `#072E33`, `#0C7075`, `#0F969C`, `#6DA5C0`, `#294D61`).
- Iconografía local mediante `lib/lucide/lucide.min.js` (sin emojis ni dependencias remotas).
- Enrutador de vistas por hash (`js/router.js`) para las 10 secciones: Inicio, Mi biblioteca, Todos los archivos, Comprimidos, Carpetas, Recientes, Favoritos, Extraídos, Actividad, Configuración y vista Explorador.
- Gestor de interfaz (`js/ui-manager.js`) con vistas cuadrícula/lista, búsqueda, ordenamiento, filtros por formato, panel de propiedades, menús contextuales (clic derecho y pulsación prolongada), modales/bottom sheets y atajos de teclado (`Ctrl+K`, `Alt+P`, `Escape`).

## [0.0.1] - Fase 0: Análisis y Planificación
### Agregado
- Documentación inicial de arquitectura y decisiones técnicas: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DEVELOPMENT_PLAN.md`, `TECHNICAL_DECISIONS.md`.

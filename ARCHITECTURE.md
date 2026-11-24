# ARCHITECTURE.md — EXTRACT

## 1. Principios arquitectónicos

- **Arquitectura modular Vanilla ES Modules:** Sin frameworks pesados ni dependencias de backend. Código limpio, desacoplado y compatible directamente con GitHub Pages.
- **Procesamiento 100 % en Web Workers:** Toda descompresión, compresión y análisis binario pesada ocurre fuera del hilo principal (`main thread`) para garantizar que la interfaz nunca se congele.
- **Rutas relativas estrictas:** Todo recurso (HTML, CSS, JS, WASM, iconos, `manifest.json`, `service-worker.js`) usa rutas relativas (`./`) para funcionar indistintamente en dominio raíz o en subruta de GitHub Pages (`https://usuario.github.io/EXTRACT/`).
- **Seguridad por diseño:** Validación de rutas (anti Zip Slip), límites de memoria y ratio de descompresión (anti bombas ZIP), aislamiento de vistas previas y limpieza explícita de recursos temporales.

## 2. Diagrama de arquitectura de alto nivel

```
+-------------------------------------------------------------------+
|                        CAPA DE PRESENTACIÓN                       |
|  index.html + CSS Modular (variables, layout, responsive, etc.)   |
|  UIManager | Router | Dialogs / Bottom Sheets | Lucide Icons      |
+---------------------------------+---------------------------------+
                                  |
+---------------------------------v---------------------------------+
|                      CAPA DE APLICACIÓN (JS)                      |
|  app.js (Bootstrap & Estado)                                      |
|  - InstallationManager (beforeinstallprompt + cooldown 7 días)    |
|  - UpdateManager (SW lifecycle + actualización segura sin corte)  |
|  - ShareTargetHandler (lectura de buzón compartido)               |
|  - FileManager (importación, biblioteca virtual, metadatos)       |
|  - SecurityManager (Zip Slip, límites, sanitización, extensiones) |
|  - StorageManager (IndexedDB + Cache Storage + cuota)             |
|  - DownloadManager (descarga individual y múltiple)               |
+-----------------+-------------------------------+-----------------+
                  |                               |
+-----------------v---------------+ +-------------v-----------------+
|     CAPA DE WORKERS (CPU)       | |      SERVICE WORKER (PWA)     |
|  - zip-worker.js (@zip.js)      | |  - Caché App Shell (offline)  |
|    Extracción + Creación ZIP    | |  - Interceptor POST           |
|    (Streaming + AES/ZipCrypto)  | |    /share-receiver -> IDB/CS  |
|  - archive-worker.js (7z-wasm)  | |  - Gestión de versiones       |
|    Extracción 7z, RAR4/5, TAR,  | |    y limpieza segura de caché |
|    GZ, BZ2, XZ, TAR.GZ, TAR.XZ  | +-------------------------------+
+---------------------------------+
```

## 3. Estructura de archivos y módulos

```text
extract/
├── index.html                  # Shell único de la aplicación
├── manifest.json               # Configuración PWA y share_target
├── service-worker.js           # Offline, actualizaciones e interceptor POST
├── assets/
│   ├── icons/                  # Iconos PWA (192, 512, maskable, apple-touch)
│   └── images/                 # Recursos gráficos propios (SVG si aplica)
├── css/
│   ├── variables.css           # Paleta oficial (#05161A..#294D61), tipografía, radios
│   ├── base.css                # Reset, scrollbars, accesibilidad, foco
│   ├── layout.css              # Shell escritorio (sidebar+topbar) y móvil (bottom nav)
│   ├── components.css          # Botones, badges, progress bars, toasts, menús
│   ├── library.css             # Grid/Lista de biblioteca, tarjetas, estados vacíos
│   ├── explorer.css            # Explorador interno de archivos comprimidos, breadcrumbs
│   ├── dialogs.css             # Modales escritorio, Bottom Sheets móvil, instalación
│   └── responsive.css          # Breakpoints móvil, tablet y escritorio
├── js/
│   ├── app.js                  # Punto de entrada, coordinación global
│   ├── router.js               # Navegación por hash/estado entre las 10 secciones
│   ├── installation.js         # Invitación PWA (regla 7 días) + guía iOS
│   ├── update-manager.js       # Detección de nueva versión SW y actualización segura
│   ├── share-target.js         # Recuperación de archivos recibidos vía SW POST
│   ├── file-manager.js         # Orquestación de biblioteca virtual e importación
│   ├── archive-manager.js      # Abstracción unificada sobre zip-worker y archive-worker
│   ├── compression-manager.js  # Creación de archivos ZIP (archivos/carpetas/contraseña)
│   ├── download-manager.js     # Descargas seguras vía Blob / ObjectURL
│   ├── storage-manager.js      # IndexedDB (biblioteca, favoritos, historial, prefs)
│   ├── security-manager.js     # Anti Zip Slip, bombas de descompresión, saneamiento
│   └── ui-manager.js           # Renderizado reactivo, menús contextuales, atajos
├── workers/
│   ├── zip-worker.js           # Web Worker para @zip.js/zip.js
│   └── archive-worker.js       # Web Worker para 7z-wasm (single-thread)
├── lib/                        # Dependencias locales vendored para uso 100% offline
│   ├── lucide/                 # Iconos Lucide locales
│   ├── zip.js/                 # @zip.js/zip.js local
│   └── 7z-wasm/                # 7zz.es6.js + 7zz.wasm local
└── offline/
    └── offline.html            # Página de respaldo si falla navegación sin caché
```

## 4. Flujo de datos principales

### 4.1 Recepción desde WhatsApp (Android) / Web Share Target
1. Usuario pulsa *Compartir* en WhatsApp → selecciona **EXTRACT**.
2. Android lanza la PWA con petición `POST` `multipart/form-data` a `./share-receiver`.
3. `service-worker.js` intercepta el `fetch` `POST`, extrae los `File` del `FormData`, los valida en tamaño básico y los almacena en un almacén temporal (`Cache Storage` `extract-shared-inbox` o `IndexedDB`).
4. `service-worker.js` responde con `Response.redirect('./index.html?shared=1', 303)`.
5. `share-target.js` detecta `?shared=1`, limpia la URL con `history.replaceState`, recupera los archivos del buzón temporal, los pasa por `SecurityManager` y los registra en `FileManager` para abrirlos inmediatamente en el explorador.

### 4.2 Flujo de extracción segura
1. Usuario abre un archivo comprimido desde la biblioteca o importación.
2. `ArchiveManager` inspecciona la firma mágica (magic bytes) y extensión del archivo para elegir el motor:
   - `.zip` → `zip-worker.js` (`@zip.js/zip.js`).
   - `.rar`, `.7z`, `.tar`, `.gz`, `.bz2`, `.xz`, `.tar.gz`, `.tar.xz` → `archive-worker.js` (`7z-wasm`).
3. El worker lista las entradas y devuelve metadatos sin descomprimir todo.
4. `SecurityManager.validateEntries()` verifica cada ruta interna contra traversal (`../`, rutas absolutas, caracteres nulos, nombres reservados) y calcula el ratio de compresión acumulado.
5. Si el archivo requiere contraseña, la UI solicita la clave mediante modal/bottom sheet y la reenvía al worker (nunca se persiste en disco).
6. Al extraer (todo o selección), el worker reporta progreso, valida límite de tamaño descomprimido (anti-bomba) y devuelve `Blob`s listos para descarga o vista previa restringida.

### 4.3 Modelo de almacenamiento en IndexedDB
Base de datos `extract_db` (versionada):
- `files`: Metadatos de archivos en biblioteca (id, nombre, tamaño, formato, fecha, carpetaVirtual, favorito, origen). *Nota: Los binarios grandes solo se persisten si el usuario importa a biblioteca local con consentimiento o en caché temporal limpiable.*
- `history`: Registro de actividad (extracciones, compresiones, errores, tiempos, estado).
- `settings`: Preferencias del usuario (límites de seguridad, vista grid/lista, ordenamiento, timestamp de "Ahora no" de instalación).
- `folders`: Estructura de carpetas virtuales de la biblioteca.

## 5. Estrategia de seguridad

- **Anti Zip Slip:** Normalización estricta de rutas; rechazo o saneamiento automático de segmentos `..`, barras iniciales `/`, `\`, letras de unidad `C:` y bytes nulos.
- **Protección contra bombas de descompresión:** Límite configurable de tamaño máximo descomprimido por archivo y total (ej. umbral de advertencia/bloqueo configurable, por defecto 512 MB / ratio sospechoso > 100:1 con confirmación).
- **Vista previa segura:** Prohibido inyectar HTML/SVG/JS extraído en el DOM principal. Las vistas previas de texto/código se renderizan como texto plano (`textContent`), imágenes vía `Blob` URL en `<img>` (sin scripts), y PDF/medios en contenedores restringidos. Archivos ejecutables (`.exe`, `.apk`, `.bat`, `.sh`, `.msi`, `.js`, etc.) muestran advertencia visual de seguridad.
- **Actualizaciones seguras:** `UpdateManager` consulta una bandera `hasActiveTasks` en `ArchiveManager`/`CompressionManager` antes de activar un nuevo Service Worker (`SKIP_WAITING`), evitando cortar una extracción en curso.

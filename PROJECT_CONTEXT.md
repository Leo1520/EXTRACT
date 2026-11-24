# PROJECT_CONTEXT.md — EXTRACT

## 1. Visión general del proyecto

**EXTRACT** es una Aplicación Web Progresiva (PWA) gratuita, sin publicidad, sin cuentas de usuario y 100 % local (client-side), diseñada para recibir, explorar, organizar, extraer y comprimir archivos directamente en el dispositivo del usuario.

El problema principal que resuelve es la fricción y el costo asociados a la apertura de archivos comprimidos recibidos por mensajería (especialmente **WhatsApp**), donde muchas aplicaciones móviles son de pago, incluyen publicidad intrusiva o requieren pasos manuales complejos.

## 2. Estado inicial del entorno de trabajo

- **Directorio de trabajo:** `c:\laragon\www\EXTRACT`
- **Estado verificado en Fase 0:** Directorio completamente vacío (sin archivos previos, sin dependencias instaladas, sin configuración previa de repositorio).
- **Destino de publicación:** GitHub Pages (alojamiento estático HTTPS, potencialmente bajo subruta `/<nombre-repo>/`).

## 3. Reglas innegociables y restricciones del proyecto

1. **Cero backend / Cero nube:** Sin servidores propios, sin PHP/Laravel, sin MySQL, sin Firebase, sin Supabase. Todo el procesamiento ocurre localmente en el navegador del usuario.
2. **Privacidad absoluta:** Ningún archivo del usuario se envía a servicios externos. Las únicas conexiones externas permitidas son la carga inicial de la propia aplicación estática y, si aplica, dependencias en tiempo de desarrollo/empaquetado (en producción offline, todo debe estar cacheado localmente en la PWA).
3. **Gratuita y limpia:** Sin anuncios, sin suscripciones, sin registro ni inicio de sesión.
4. **Identidad visual estricta:**
   - `#05161A` — Fondo principal.
   - `#072E33` — Superficies y paneles.
   - `#0C7075` — Elementos secundarios.
   - `#0F969C` — Acciones principales y elementos activos.
   - `#6DA5C0` — Detalles, iconos y elementos complementarios.
   - `#294D61` — Superficies secundarias.
   - Tema oscuro nativo, minimalista, bordes redondeados, sin emojis en la interfaz, iconografía exclusiva con **Lucide Icons**.
5. **Funcionalidad real:** Prohibido dejar botones decorativos o funciones simuladas presentadas como terminadas.
6. **Base de código única:** Una sola aplicación web responsive adaptable a móvil, tablet y escritorio.

## 4. Riesgos críticos analizados en Fase 0

### Riesgo 1: Recepción directa desde WhatsApp y ausencia de backend en GitHub Pages

- **Hallazgo técnico:**
  - La especificación **Web Share Target API** (`share_target` en `manifest.json` con `method: "POST"` y `enctype: "multipart/form-data"`) permite que una PWA instalada aparezca en la hoja de compartir nativa del sistema operativo.
  - **En Android (Chrome, Edge, Samsung Internet):** Funciona de forma nativa cuando la PWA está instalada (WebAPK). El usuario puede compartir un archivo desde WhatsApp y elegir EXTRACT.
  - **En GitHub Pages (hosting estático):** GitHub Pages **no acepta peticiones HTTP POST** (devuelve error `405 Method Not Allowed` si llega al servidor). Sin embargo, al estar registrado un **Service Worker**, el evento `fetch` del Service Worker intercepta la petición `POST` localmente *antes* de que salga a la red, lee el `FormData` (`event.request.formData()`), guarda temporalmente los archivos en Cache Storage / IndexedDB y responde con una redirección `303 See Other` hacia `./index.html?shared=true`.
  - **En iOS / iPadOS (Safari/WebKit) y Firefox (Android/Escritorio):** **No existe soporte** para `share_target`. Apple no implementa Web Share Target en Safari/WebKit ni permite registrar PWAs como receptoras en la hoja de compartir de iOS.
  - **En Escritorio (Windows/macOS con Chrome o Edge):** Soporta `share_target` solo si la PWA está instalada y se comparte desde aplicaciones compatibles con el menú compartir del SO (en Windows/macOS, WhatsApp Desktop generalmente no usa la hoja de compartir del SO para archivos hacia PWAs de la misma forma fluida que Android).
- **Mitigación y alternativas obligatorias:**
  - Implementar `share_target` + interceptor `POST` en Service Worker para Android/Chromium.
  - Implementar alternativas universales de primera clase: selector de archivos (`<input type="file">`), arrastrar y soltar (Drag & Drop), importación de carpetas (`webkitdirectory` / File System Access API donde exista soporte) y botón principal de importación siempre accesible.
  - Documentar con total transparencia la matriz de compatibilidad en `COMPATIBILITY.md`.

### Riesgo 2: Compatibilidad real de formatos, WebAssembly, contraseñas y rendimiento

- **Hallazgo técnico:**
  - **`libarchive.js` (WASM de libarchive, licencia MIT/BSD):** Soporta lectura de ZIP, RAR (v4/v5), 7z, TAR, GZ, BZ2, XZ, ISO, etc. **Limitación crítica:** Las compilaciones estándar WASM de `libarchive` carecen de backend criptográfico externo (OpenSSL/mbedTLS), por lo que **no soportan contraseñas en RAR ni en 7z** (solo en ZIP).
  - **`7z-wasm` (puerto oficial de 7-Zip `7zz` a WebAssembly, licencia GNU LGPL + restricción unRAR):** Soporta extracción de 7z, RAR (v4/v5), ZIP, TAR, GZ, BZ2, XZ, **incluyendo archivos RAR y 7z protegidos con contraseña** (incluso cabeceras cifradas `-mhe` en 7z). **Restricciones:** La licencia unRAR prohíbe crear archivos RAR o usar el código para ingeniería inversa de compresión RAR (solo extracción); además usa el sistema de archivos en memoria de Emscripten (MEMFS), lo que implica que el archivo completo y la salida temporal residen en memoria RAM del worker.
  - **`@zip.js/zip.js` (JavaScript puro + Web Workers + Streams nativos, licencia BSD-3-Clause):** Especializado en ZIP. Soporta lectura y **creación de ZIP** con streaming (bajo consumo de RAM), y soporta **contraseñas** tanto ZipCrypto como AES-128/192/256.
  - **`fflate` (JS puro, licencia MIT):** Muy rápido y ligero (~8 KB), pero **no soporta contraseñas** en ZIP.
  - **Restricción de `SharedArrayBuffer` en GitHub Pages:** GitHub Pages no permite configurar cabeceras HTTP `Cross-Origin-Opener-Policy` (COOP) ni `Cross-Origin-Embedder-Policy` (COEP), necesarias para `SharedArrayBuffer` / WASM `pthreads`. Por tanto, los motores deben ejecutarse en **modo single-thread dentro de Web Workers dedicados**, evitando la dependencia de `SharedArrayBuffer`.

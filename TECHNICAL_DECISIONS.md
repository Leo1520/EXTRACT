# TECHNICAL_DECISIONS.md — EXTRACT

## TD-01: Recepción de archivos desde WhatsApp sin backend (GitHub Pages)

### Problema
GitHub Pages solo sirve archivos estáticos y rechaza peticiones HTTP `POST` (devuelve `405`). Sin embargo, Web Share Target para recibir archivos requiere `method: "POST"` y `enctype: "multipart/form-data"`.

### Decisión
Configurar `share_target` en `manifest.json` con `"action": "./share-receiver"`, `"method": "POST"`, `"enctype": "multipart/form-data"`, e interceptar esa ruta en el evento `fetch` de `service-worker.js`. El Service Worker lee `event.request.formData()`, guarda los archivos recibidos en Cache Storage (`extract-shared-inbox`) y redirige mediante `Response.redirect('./index.html?shared=1', 303)` al cliente.

### Limitaciones conocidas y alternativas
- **Android (Chrome/Edge/Samsung Internet):** Compatible cuando la PWA está instalada. Permite recibir archivos directamente desde el menú Compartir de WhatsApp.
- **iOS / iPadOS (Safari/WebKit) y Firefox:** No implementan Web Share Target. No es posible aparecer en el menú Compartir de WhatsApp en iOS sin un contenedor nativo (Capacitor/Cordova), lo cual queda fuera del alcance web puro.
- **Alternativa universal:** Selector de archivos nativo, Drag & Drop en escritorio, e importación de carpetas. En iOS se documentará en la app/guía que el usuario debe guardar el archivo desde WhatsApp en "Archivos" e importarlo desde EXTRACT.

---

## TD-02: Selección de motores de extracción y compresión

### Evaluación comparada

| Criterio | `@zip.js/zip.js` | `7z-wasm` (`7zz`) | `libarchive.js` | `fflate` |
| :--- | :--- | :--- | :--- | :--- |
| **Formatos lectura** | ZIP | 7z, RAR4/5, ZIP, TAR, GZ, BZ2, XZ, etc. | ZIP, RAR4/5, 7z, TAR, GZ, BZ2, XZ, etc. | ZIP, GZ |
| **Creación de archivos** | ZIP (con streaming y contraseña) | 7z, ZIP, TAR, etc. (NO RAR) | Limitado según build | ZIP, GZ |
| **Contraseñas ZIP** | Sí (AES-256 y ZipCrypto) | Sí | Sí | **No** |
| **Contraseñas RAR / 7z** | N/A | **Sí** (incluye cabeceras `-mhe`) | **No** (sin OpenSSL/mbedTLS) | N/A |
| **Licencia** | BSD-3-Clause | GNU LGPL + restricción unRAR | MIT + BSD | MIT |
| **Uso de memoria** | Streaming (bajo) | Emscripten MEMFS (en RAM) | Emscripten MEMFS (en RAM) | En RAM / Stream |
| **Tamaño aproximado** | Ligero (~100 KB) | ~1.5–3 MB (WASM) | ~1–2 MB (WASM) | ~8 KB |

### Decisión
Arquitectura **híbrida de dos motores en Web Workers dedicados**:
1. **`@zip.js/zip.js` (`workers/zip-worker.js`)** para todo manejo de **ZIP** (lectura, extracción selectiva, contraseñas AES/ZipCrypto y creación de nuevos ZIP). Ventaja: streaming real de baja memoria y licencia BSD-3-Clause.
2. **`7z-wasm` (`workers/archive-worker.js`)** en modo single-thread para **RAR (v4/v5), 7Z, TAR, GZ, BZ2, XZ, TAR.GZ y TAR.XZ**, ya que es la única solución cliente capaz de extraer **RAR y 7z protegidos con contraseña** sin servidor.

### Restricciones asumidas
- Debido a la licencia unRAR incluida en `7z-wasm`, EXTRACT **nunca** ofrecerá compresión/creación de archivos `.rar` (solo extracción).
- Debido a que `7z-wasm` opera sobre Emscripten MEMFS, archivos muy grandes (por encima de varios cientos de MB en dispositivos móviles con RAM limitada) pueden agotar la memoria de la pestaña; se implementarán límites configurables y advertencias preventivas en `SecurityManager`.
- Se descarta `pthreads` / `SharedArrayBuffer` porque GitHub Pages no permite enviar cabeceras `COOP`/`COEP`. Ambos workers correrán sin `SharedArrayBuffer`.

---

## TD-03: Vanilla JS (ES Modules) sin framework ni bundler obligatorio

### Decisión
Desarrollar la aplicación en **HTML5 + CSS3 + JavaScript ES Modules nativos**, vendoring las librerías (`lucide`, `@zip.js/zip.js`, `7z-wasm`) dentro de `lib/` para garantizar funcionamiento 100 % offline y despliegue directo en GitHub Pages sin pasos de compilación complejos ni dependencia de CDNs en tiempo de ejecución.

### Justificación
- Cero fricción para auditar, mantener y publicar directamente la rama/carpeta en GitHub Pages.
- Control total sobre el Service Worker, rutas relativas (`./`) y precaché de archivos `.wasm`.

---

## TD-04: Gestión de subrutas en GitHub Pages

### Decisión
- Todas las referencias en `index.html`, `manifest.json` y `service-worker.js` utilizarán rutas relativas (`./`).
- El registro del Service Worker usará `navigator.serviceWorker.register('./service-worker.js', { scope: './' })`.
- No se usarán rutas absolutas con `/` inicial para evitar rupturas cuando el sitio se publique en `https://<usuario>.github.io/<repo>/`.

---

## TD-05: Almacenamiento local y consentimiento

### Decisión
- **IndexedDB** para metadatos de biblioteca, carpetas virtuales, favoritos, historial de actividad y preferencias.
- **Cache Storage** para App Shell, assets offline y buzón temporal de `share_target` (el cual se limpia tras procesar la recepción).
- No se almacenarán copias binarias permanentes de archivos pesados en IndexedDB sin acción explícita del usuario en su biblioteca local, evitando saturar la cuota del navegador.

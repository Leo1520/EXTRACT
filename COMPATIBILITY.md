# COMPATIBILITY.md — EXTRACT

## 1. Web Share Target (Recepción desde WhatsApp / Sistema)

| Plataforma / Navegador | Recepción directa desde WhatsApp | Alternativa integrada |
| :--- | :--- | :--- |
| **Android — Chrome / Edge / Samsung Internet** | **Compatible** (requiere PWA instalada) | Selector de archivos / carpetas |
| **iOS / iPadOS — Safari / WebKit** | **No compatible** (Apple no implementa `share_target`) | Guardar en "Archivos" + Importar en EXTRACT |
| **Firefox (Android y Escritorio)** | **No compatible** (Mozilla no implementa `share_target`) | Selector de archivos + Drag & Drop |
| **Windows / macOS — Chrome / Edge** | Parcial (según soporte de hoja compartir del SO) | Drag & Drop + Selector de archivos y carpetas |

## 2. Formatos comprimidos

| Formato | Extracción | Contraseña | Creación | Motor |
| :--- | :--- | :--- | :--- | :--- |
| **ZIP** | Sí (streaming) | Sí (AES-256 / ZipCrypto) | Sí (con contraseña opcional) | `@zip.js/zip.js` |
| **7Z** | Sí | Sí (incluye cabeceras `-mhe`) | No | `7z-wasm` |
| **RAR (v4 / v5)** | Sí (pendiente prueba con muestra `.rar`) | Sí (vía 7z-wasm) | No (restricción licencia unRAR) | `7z-wasm` |
| **TAR, GZ, BZ2, XZ, TAR.GZ, TAR.XZ** | Sí | N/A | No | `7z-wasm` |

## 3. Almacenamiento y WebAssembly

- **IndexedDB / Cache Storage / Web Workers:** Soportados en todos los navegadores modernos (Chrome, Edge, Safari, Firefox).
- **File System Access API (`showDirectoryPicker`):** Soportada en Chromium escritorio; en navegadores sin soporte se utiliza automáticamente `<input type="file" webkitdirectory>` o selector múltiple.
- **Sin `SharedArrayBuffer`:** Los motores WASM operan en modo *single-thread* dentro de Web Workers para funcionar en GitHub Pages sin cabeceras `COOP`/`COEP`.

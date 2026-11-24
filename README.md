# EXTRACT

**EXTRACT** es una Aplicación Web Progresiva (PWA) gratuita, sin publicidad, sin cuentas y 100 % local para recibir, explorar, organizar, extraer y comprimir archivos directamente en el dispositivo del usuario.

## Características principales

- **Procesamiento 100 % local:** Todos los archivos se procesan en el navegador mediante JavaScript y WebAssembly dentro de Web Workers. Ningún archivo se envía a servidores externos.
- **Recepción desde WhatsApp (Android):** Integración mediante Web Share Target API (`POST` interceptado localmente por el Service Worker, sin backend).
- **Motor multiformato:** Soporte de lectura y extracción para `ZIP`, `RAR` (v4/v5), `7Z`, `TAR`, `GZ`, `BZ2`, `XZ`, `TAR.GZ` y `TAR.XZ`, además de creación de archivos `ZIP` (con contraseña opcional AES-256).
- **Experiencia nativa multidispositivo:** Base de código única responsive para escritorio, tablet y móvil.
- **Instalable y offline:** Funciona sin conexión gracias al Service Worker y cuenta con actualizaciones seguras que no interrumpen extracciones en curso.

## Estado de funcionalidades

| Funcionalidad | Estado |
| :--- | :--- |
| Interfaz responsive multidispositivo (escritorio, tablet, móvil) | Implementada y probada (sintaxis y estructura CSS/HTML; verificación visual en navegador pendiente de usuario) |
| Manifiesto PWA, iconos PNG y Service Worker offline | Implementada y probada (validación de manifiesto y 39 recursos de precaché) |
| Invitación de instalación con regla de 7 días y guía iOS | Implementada pero pendiente de pruebas en dispositivo/navegador HTTPS |
| Actualizaciones seguras sin interrumpir tareas activas | Implementada y probada (prueba unitaria de bloqueo `applyUpdate` en tarea activa) |
| Recepción Web Share Target (`POST` en Service Worker) | Implementada pero pendiente de pruebas reales desde WhatsApp en Android |
| Importación manual, carpetas y Drag & Drop | Implementada y probada (validación de módulos; prueba interactiva en navegador pendiente) |
| Extracción ZIP (incluyendo AES-256), 7Z (incluyendo `-mhe=on`), TAR, GZ, BZ2, XZ, TAR.GZ, TAR.XZ | Implementada y probada con archivos reales |
| Extracción RAR (v4/v5) | Implementada pero pendiente de pruebas con archivo `.rar` real |
| Creación de archivos ZIP (carpetas anidadas y contraseña AES-256) | Implementada y probada con archivos reales |
| Biblioteca local en IndexedDB, favoritos, historial y cuota | Implementada pero pendiente de pruebas de persistencia en navegador |
| Protecciones de seguridad (Zip Slip, anti-bomba, duplicados, vista previa segura) | Implementada y probada |

## Publicación en GitHub Pages

1. Sube todo el contenido del proyecto a tu repositorio de GitHub.
2. En **Settings → Pages**, selecciona la rama principal (`main`) y la carpeta raíz (`/`).
3. El archivo `.nojekyll` incluido asegura que GitHub Pages sirva todos los módulos ES, Web Workers y binarios `.wasm` sin filtrado.
4. Accede a `https://<tu-usuario>.github.io/<tu-repo>/`. Todas las rutas son relativas (`./`) y funcionan en subrutas.

## Documentación

- [INSTALLATION.md](./INSTALLATION.md) — Guía de instalación PWA por plataforma y despliegue.
- [COMPATIBILITY.md](./COMPATIBILITY.md) — Matriz real de compatibilidad de navegadores, Share Target y formatos.
- [SECURITY.md](./SECURITY.md) — Arquitectura de seguridad y privacidad local.
- [CHANGELOG.md](./CHANGELOG.md) — Historial de fases y cambios.

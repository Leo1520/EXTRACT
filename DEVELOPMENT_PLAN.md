# DEVELOPMENT_PLAN.md — EXTRACT

## Metodología de desarrollo por fases

El proyecto se desarrollará de forma estrictamente secuencial. Cada fase concluye con pruebas verificables, actualización de documentación e informe de resultados antes de solicitar aprobación para la siguiente fase.

---

## FASE 0 — Análisis y Planificación *(Actual)*
- Inspección del entorno de trabajo (`c:\laragon\www\EXTRACT`).
- Investigación técnica de Web Share Target en Android/iOS/Escritorio y GitHub Pages.
- Evaluación de motores de extracción/compresión WASM y JS (`@zip.js/zip.js`, `7z-wasm`, `libarchive.js`, `fflate`).
- Definición de arquitectura, seguridad y estructura modular.
- **Entregables:** `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DEVELOPMENT_PLAN.md`, `TECHNICAL_DECISIONS.md`.

## FASE 1 — Interfaz y Experiencia (UI/UX Shell)
- Implementación de `index.html` y sistema CSS modular con la paleta oficial (`#05161A`, `#072E33`, `#0C7075`, `#0F969C`, `#6DA5C0`, `#294D61`).
- Integración local de Lucide Icons (sin emojis).
- Layout responsive en base única: Sidebar + Topbar + Panel de propiedades en escritorio; Bottom Navigation + FAB de importación + Bottom Sheets en móvil; vista intermedia en tablet.
- Vistas navegables de las 10 secciones: Inicio, Mi biblioteca, Todos los archivos, Comprimidos, Carpetas, Recientes, Favoritos, Extraídos, Actividad y Configuración.
- Maquetación funcional de explorador interno (breadcrumbs, grid/lista, selección múltiple, menús contextuales) y modales base.
- **Criterio de salida:** Navegación fluida en móvil, tablet y escritorio; cero errores de consola; cero elementos fuera de paleta.

## FASE 2 — Sistema PWA, Instalación y Actualizaciones
- Creación de `manifest.json` con rutas relativas y metadatos completos.
- Creación de iconos PWA (192x192, 512x512, maskable, Apple Touch Icon).
- Implementación de `service-worker.js` con precaché de App Shell, soporte offline (`offline/offline.html`) y alcance compatible con subrutas de GitHub Pages.
- Implementación de `installation.js`: captura de `beforeinstallprompt`, modal elegante de bienvenida ("Instala EXTRACT"), regla exacta de ocultamiento por 7 días al pulsar "Ahora no", no repetición en la misma sesión, e instrucciones específicas para iOS/Safari.
- Implementación de `update-manager.js`: detección en segundo plano, notificación no intrusiva con botón de actualizar, bloqueo de recarga si hay tareas activas y limpieza segura de cachés antiguos.
- **Criterio de salida:** Puntuación instalable PWA, funcionamiento offline verificado, prueba de regla de 7 días y flujo de actualización.

## FASE 3 — Recepción e Importación de Archivos
- Configuración de `share_target` (`POST`, `multipart/form-data`) en `manifest.json`.
- Implementación del interceptor `POST` en `service-worker.js` + `share-target.js` para recibir archivos sin backend.
- Implementación de importación manual (`<input type="file">`), Drag & Drop en escritorio, e importación de carpetas (`webkitdirectory` / File System Access API con fallback).
- Validación inicial de archivos recibidos y envío directo al flujo de biblioteca/explorador.
- **Criterio de salida:** Importación probada por selector, drag & drop y simulación/prueba de `POST` hacia el Service Worker.

## FASE 4 — Motor de Extracción Real
- Integración de `@zip.js/zip.js` en `workers/zip-worker.js` y `7z-wasm` en `workers/archive-worker.js`.
- Implementación de `archive-manager.js` con detección automática por firma binaria (magic bytes) y extensión.
- Pruebas reales con archivos reales de cada formato: **ZIP, RAR (v4/v5), 7Z, TAR, GZ, BZ2, XZ, TAR.GZ, TAR.XZ**.
- Soporte de contraseñas (ZIP, 7z, RAR), extracción completa, extracción selectiva, progreso en tiempo real, cancelación de tareas y manejo de archivos corruptos.
- **Criterio de salida:** Cada formato listado en `COMPATIBILITY.md` verificado mediante pruebas reales con archivos de muestra.

## FASE 5 — Biblioteca, Almacenamiento Local y Centro de Actividad
- Implementación completa de `storage-manager.js` con IndexedDB (`files`, `history`, `settings`, `folders`).
- Implementación de búsqueda, ordenamiento (nombre, fecha, tamaño), filtros por extensión, favoritos, recientes, carpetas virtuales y propiedades.
- Implementación del Centro de Actividad conectado a tareas reales (en espera, en curso, completadas, fallidas, tiempos).
- Implementación de controles en Configuración: limpiar historial, limpiar temporales, eliminar favoritos, restablecer preferencias y consulta de cuota (`navigator.storage.estimate()`).
- **Criterio de salida:** Persistencia verificada tras recarga y uso offline sin pérdida de datos.

## FASE 6 — Compresión ZIP y Funciones Adicionales
- Implementación de `compression-manager.js` usando `zip-worker.js` para crear archivos `.zip` a partir de múltiples archivos y carpetas compatibles.
- Soporte de nombre personalizado, progreso en tiempo real, contraseña opcional (AES-256) y descarga automática.
- Implementación de extracción múltiple y vista previa segura (imágenes y texto plano con restricciones de seguridad).
- **Criterio de salida:** ZIPs generados verificados abriéndolos nuevamente y en herramientas estándar.

## FASE 7 — Seguridad, Pruebas de Estrés y Rendimiento
- Implementación exhaustiva y auditoría de `security-manager.js`.
- Batería de pruebas documentada con: archivos pequeños, grandes, corruptos, protegidos con contraseña, carpetas anidadas, caracteres especiales/Unicode, rutas peligrosas (Zip Slip `../../`), bombas de descompresión, archivos duplicados, memoria limitada, pérdida de conexión y actualizaciones durante tareas.
- **Criterio de salida:** Cero fallos críticos de seguridad; manejo limpio de errores sin cuelgues de pestaña.

## FASE 8 — Preparación para GitHub Pages y Documentación Final
- Verificación final de rutas relativas y comportamiento en subruta (`/EXTRACT/`).
- Auditoría de `manifest.json`, `service-worker.js`, iconos, offline, instalación y actualizaciones.
- Entrega y actualización final de documentación: `README.md`, `INSTALLATION.md`, `COMPATIBILITY.md`, `SECURITY.md`, `CHANGELOG.md`, con matriz de funcionalidades en tres estados (*Implementada y probada*, *Implementada pero pendiente de pruebas*, *Pendiente*).

# SECURITY.md — EXTRACT

## Principios de seguridad y privacidad

1. **Procesamiento 100 % local:** EXTRACT no cuenta con backend, base de datos remota ni telemetría. Los archivos importados o compartidos nunca abandonan el dispositivo del usuario.
2. **Protección contra *Zip Slip*:** `SecurityManager.sanitizeEntryPath()` normaliza separadores, elimina letras de unidad y barras iniciales, rechaza bytes nulos y neutraliza cualquier secuencia `../` antes de exponer o descargar archivos.
3. **Protección contra bombas de descompresión:** Antes de extraer, se valida el tamaño total descomprimido (límite configurable, `512 MB` por defecto) y el ratio de compresión (alerta/bloqueo sobre `100:1` cuando supera `10 MB`).
4. **Resolución segura de duplicados:** Rutas repetidas dentro de un archivo reciben sufijos deterministas (`nombre (1).ext`) evitando sobrescrituras silenciosas.
5. **Aislamiento en vistas previas:** Prohibido renderizar HTML, SVG o scripts extraídos como contenido activo. Las vistas previas de texto usan `textContent` (con límite de 128 KB) y las imágenes seguras usan `Blob` URLs en `<img>`. Archivos ejecutables (`.exe`, `.apk`, `.bat`, `.sh`, `.ps1`, `.msi`, etc.) se marcan como de riesgo y bloquean su vista previa.
6. **Manejo de contraseñas:** Las contraseñas introducidas permanecen únicamente en memoria durante la operación activa y nunca se guardan en `IndexedDB` ni `localStorage`.
7. **Limpieza de temporales:** El buzón de `Cache Storage` de `share_target` (`extract-shared-inbox`) se limpia inmediatamente tras leer los archivos compartidos y puede purgarse manualmente desde Configuración.

/**
 * security-manager.js — Validación anti Zip Slip, límites anti-bomba y detección de archivos de riesgo
 */

const SUSPICIOUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'ps1', 'vbs', 'vbe', 'js', 'jse',
  'wsf', 'wsh', 'scr', 'pif', 'hta', 'cpl', 'dll', 'sys', 'sh', 'apk', 'app'
]);

export class SecurityManager {
  constructor({ maxUncompressedBytes = 512 * 1024 * 1024, maxCompressionRatio = 100 } = {}) {
    this.maxUncompressedBytes = maxUncompressedBytes;
    this.maxCompressionRatio = maxCompressionRatio;
  }

  /**
   * Normaliza y valida una ruta interna contra Zip Slip y rutas absolutas.
   */
  sanitizeEntryPath(rawPath) {
    const original = String(rawPath ?? '');
    if (!original || original.includes('\0')) {
      return { safePath: '', isUnsafe: true, reason: 'Ruta vacía o con byte nulo' };
    }

    let normalized = original.replace(/\\/g, '/').trim();
    const hadTraversal = normalized.includes('..');
    const hadAbsolute = normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized);

    normalized = normalized.replace(/^[a-zA-Z]:/, '').replace(/^\/+/, '');
    const parts = normalized.split('/').filter((seg) => seg && seg !== '.' && seg !== '..');
    const safePath = parts.join('/');

    return {
      safePath,
      isUnsafe: hadTraversal || hadAbsolute || !safePath,
      reason: hadTraversal ? 'Secuencia ../ detectada' : (hadAbsolute ? 'Ruta absoluta detectada' : '')
    };
  }

  isSuspiciousFile(filename) {
    const lower = String(filename || '').toLowerCase();
    const ext = lower.includes('.') ? lower.split('.').pop() : '';
    return SUSPICIOUS_EXTENSIONS.has(ext);
  }

  validateDecompressionMetrics({ totalUncompressed, totalCompressed }) {
    if (totalUncompressed > this.maxUncompressedBytes) {
      return {
        ok: false,
        reason: `El tamaño total descomprimido (${Math.round(totalUncompressed / (1024 * 1024))} MB) supera el límite preventivo de seguridad (${Math.round(this.maxUncompressedBytes / (1024 * 1024))} MB).`
      };
    }

    if (totalUncompressed > 10 * 1024 * 1024 && totalCompressed > 0) {
      const ratio = totalUncompressed / totalCompressed;
      if (ratio > this.maxCompressionRatio) {
        return {
          ok: false,
          reason: `Ratio de compresión inusual (${Math.round(ratio)}:1). Posible bomba de descompresión.`
        };
      }
    }

    return { ok: true };
  }

  /**
   * Genera un nombre único si ya existe en el conjunto de rutas vistas.
   */
  resolveDuplicatePath(safePath, seenSet) {
    if (!seenSet.has(safePath)) {
      seenSet.add(safePath);
      return safePath;
    }
    const lastSlash = safePath.lastIndexOf('/');
    const dir = lastSlash !== -1 ? safePath.slice(0, lastSlash + 1) : '';
    const base = lastSlash !== -1 ? safePath.slice(lastSlash + 1) : safePath;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';

    let counter = 1;
    let candidate = `${dir}${stem} (${counter})${ext}`;
    while (seenSet.has(candidate)) {
      counter += 1;
      candidate = `${dir}${stem} (${counter})${ext}`;
    }
    seenSet.add(candidate);
    return candidate;
  }
}

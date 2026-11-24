/**
 * download-manager.js — Descarga local segura mediante Blob y ObjectURL
 */

export class DownloadManager {
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'archivo_extraido';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async downloadMultiple(entries) {
    for (let i = 0; i < entries.length; i += 1) {
      const item = entries[i];
      this.downloadBlob(item.blob, item.filename);
      if (entries.length > 1) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }
  }
}

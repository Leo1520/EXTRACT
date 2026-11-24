/**
 * service-worker.js — Caché offline, actualizaciones seguras e interceptor Web Share Target POST
 * Compatible con subrutas de GitHub Pages mediante rutas relativas (./)
 */

const CACHE_VERSION = 'extract-shell-v1.0.2';
const SHARED_INBOX_CACHE = 'extract-shared-inbox';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline/offline.html',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/library.css',
  './css/explorer.css',
  './css/dialogs.css',
  './css/responsive.css',
  './js/app.js',
  './js/router.js',
  './js/ui-manager.js',
  './js/installation.js',
  './js/update-manager.js',
  './js/share-target.js',
  './js/file-manager.js',
  './js/security-manager.js',
  './js/archive-manager.js',
  './js/compression-manager.js',
  './js/download-manager.js',
  './js/storage-manager.js',
  './workers/zip-worker.js',
  './workers/archive-worker.js',
  './lib/lucide/lucide.min.js',
  './lib/zip.js/index.min.js',
  './lib/7z-wasm/7zz.es6.js',
  './lib/7z-wasm/7zz.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('extract-shell-') && key !== CACHE_VERSION)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function handleShareTargetPost(request) {
  try {
    const formData = await request.formData();
    const rawFiles = formData.getAll('files') || [];
    const files = rawFiles.filter((f) => f && typeof f.arrayBuffer === 'function' && f.size >= 0);

    const sharedCache = await caches.open(SHARED_INBOX_CACHE);
    const savedMeta = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const key = `shared_${Date.now()}_${i}`;
      await sharedCache.put(`./__shared/${key}`, new Response(file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' }
      }));
      savedMeta.push({
        key,
        name: file.name || `archivo_${i + 1}`,
        type: file.type || 'application/octet-stream',
        size: file.size || 0
      });
    }

    await sharedCache.put(
      './__shared/latest-share',
      new Response(JSON.stringify({
        timestamp: Date.now(),
        title: formData.get('title') || '',
        text: formData.get('text') || '',
        files: savedMeta
      }), { headers: { 'Content-Type': 'application/json' } })
    );

    return Response.redirect('./index.html?shared=1', 303);
  } catch (error) {
    console.error('Error procesando share_target POST:', error);
    return Response.redirect('./index.html?shared=error', 303);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Interceptor local para Web Share Target POST (sin backend en GitHub Pages)
  if (request.method === 'POST' && url.pathname.endsWith('/share-receiver')) {
    event.respondWith(handleShareTargetPost(request));
    return;
  }

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put('./index.html', networkResponse.clone());
          return networkResponse;
        }
      } catch (_) {
        // Sin red, continuar con caché local
      }

      const cachedIndex = await caches.match('./index.html');
      if (cachedIndex) return cachedIndex;

      const offlineFallback = await caches.match('./offline/offline.html');
      return offlineFallback || new Response('Sin conexión', { status: 503 });
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

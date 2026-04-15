const CACHE_NAME = 'ivas-admin-cache-v2';

self.addEventListener('install', event => {
  // Force the new service worker to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Clear any old caches (like v1) that are causing the blank screen bug
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('SW: Deletando cache antigo', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Usar Network Only (pass-through).
  // Apenas ter o evento 'fetch' já satisfaz o requisito de instalabilidade do PWA.
  // Isso evita o problema de tela branca causado por um index.html em cache 
  // que tenta buscar arquivos JS deletados do servidor após um novo deploy.
  event.respondWith(fetch(event.request));
});

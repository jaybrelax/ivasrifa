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
  // Ignorar pedidos de navegação (HTML) para evitar telas brancas por desencontro de hash.
  // O Navegador deve SEMPRE ir na rede buscar o index.html atualizado.
  if (event.request.mode === 'navigate') {
    return;
  }

  // Para outros recursos (imagens, apis, etc), apenas passar direto.
  // Ter o evento fetch habilitado permite a instalação como PWA.
  event.respondWith(fetch(event.request));
});

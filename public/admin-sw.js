const CACHE_NAME = 'ivas-admin-cache-v1';
const urlsToCache = [
  '/admin',
  '/admin/login'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Try to cache essential urls, don't fail if they can't be cached yet
        return cache.addAll(urlsToCache).catch(err => console.log('Cache addAll failed:', err));
      })
  );
});

self.addEventListener('fetch', event => {
  // Pass-through fetch handler just to satisfy PWA installability requirements
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

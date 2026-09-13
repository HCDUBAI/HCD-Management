const CACHE_NAME = 'hc-dubai-v11-refactor-20260913';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './hc_dubai_logo.jpg',
  './hc_dubai_logo_highres.jpg',
  './js/config.js',
  './js/utils.js',
  './js/auth.js',
  './js/players.js',
  './js/events.js',
  './js/finance.js',
  './js/merchandise.js',
  './js/admin.js',
  './js/management.js',
  './js/main.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Do not cache external requests, including Supabase.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => {
            if (cached) return cached;

            // Offline fallback for app navigation.
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }

            return Response.error();
          })
      )
  );
});

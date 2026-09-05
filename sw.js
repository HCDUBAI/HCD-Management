const CACHE_NAME = 'hc-dubai-v5-final-20260905';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './hc_dubai_logo.jpg',
  './hc_dubai_logo_highres.jpg'
];

// Install the final service worker and pre-cache core app files.
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

// Remove all previous HC Dubai caches and take control immediately.
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

// Network-first for same-origin GET requests, with cache fallback.
// External API/Supabase requests are never stored in the PWA cache.
self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy))
            .catch(() => {});
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }

        throw new Error('Offline and resource not cached');
      })
  );
});

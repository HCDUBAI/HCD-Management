const CACHE='hc-dubai-v2'; const ASSETS=['./','./index.html','./manifest.json','./hc_dubai_logo.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));

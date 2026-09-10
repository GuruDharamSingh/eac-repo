// Signal Watch service worker: caches the app shell so it opens with no connection.
// Connection probes (?probe=) are never served from cache.
const CACHE = 'signalwatch-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Probes and anything cross-origin go straight to the network (and fail honestly when there is none).
  if (url.origin !== self.location.origin || url.searchParams.has('probe')) return;
  if (event.request.method !== 'GET') return;

  // App shell: serve from cache, refresh in the background when possible.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    if (list.length) return list[0].focus();
    return self.clients.openWindow('./');
  }));
});

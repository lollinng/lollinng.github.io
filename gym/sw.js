// Offline support: network first (3 s), then the cached copy.
// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = 'gym-v6';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'plan.js', 'meals.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first so a deploy shows up on the next open; cache after 3 s or when offline (gym basements).
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const net = fetch(e.request, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    net.catch(() => {});
    const timeout = new Promise((r) => setTimeout(r, 3000));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch (err) { /* offline */ }
    const hit = await cache.match(e.request, { ignoreSearch: true });
    return hit || net;
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./#train'))));
});

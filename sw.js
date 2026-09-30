/* Offline-Speicher der App. Version hochzählen, wenn eine neue Fassung hochgeladen wird.
   Die erfassten Daten liegen NICHT hier, sondern im Gerätespeicher der App (IndexedDB). */
const VERSION = 'regal-v3';
const DATEIEN = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k.indexOf('regal-') === 0 && k !== VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const schrift = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !schrift) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: !schrift }).then(treffer => {
      const netz = fetch(e.request).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const k = r.clone(); caches.open(VERSION).then(c => c.put(e.request, k)); }
        return r;
      });
      if (treffer) { netz.catch(() => {}); return treffer; }
      return netz.catch(() => schrift ? new Response('', { status: 504 }) : caches.match('./index.html'));
    })
  );
});

/* Offline-Speicher der App.
   WICHTIG bei jedem Update: VERSION hier UND APP_V in index.html gleich hochzählen.
   Die erfassten Daten liegen NICHT hier, sondern im Gerätespeicher der App (IndexedDB) – ein Update löscht sie nie. */
const VERSION = 'regal-v5';
const DATEIEN = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  /* cache:'reload' holt die Dateien frisch vom Server, nicht aus dem Browser-Zwischenspeicher */
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k.indexOf('regal-') === 0 && k !== VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
function speichern(req, r) {
  if (r && (r.ok || r.type === 'opaque')) { const k = r.clone(); caches.open(VERSION).then(c => c.put(req, k)); }
  return r;
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const schrift = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !schrift) return;
  const seite = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (seite) {
    /* App-Seite: zuerst Netz (max. 4 s), damit ein Update sofort ankommt; ohne Netz die Offline-Kopie */
    e.respondWith(new Promise(resolve => {
      let fertig = false;
      const ausCache = () => caches.match('./index.html').then(t => t || caches.match('./'));
      const timer = setTimeout(() => { ausCache().then(t => { if (t && !fertig) { fertig = true; resolve(t); } }); }, 4000);
      fetch(new Request(e.request, { cache: 'no-cache' })).then(r => {
        speichern(new Request('./index.html'), r.clone());
        if (!fertig) { fertig = true; clearTimeout(timer); resolve(r); }
      }).catch(() => {
        clearTimeout(timer);
        ausCache().then(t => { if (!fertig) { fertig = true; resolve(t || Response.error()); } });
      });
    }));
    return;
  }
  /* Übrige Dateien: Offline-Kopie sofort, im Hintergrund auffrischen */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: !schrift }).then(treffer => {
      const netz = fetch(e.request).then(r => speichern(e.request, r));
      if (treffer) { netz.catch(() => {}); return treffer; }
      return netz.catch(() => schrift ? new Response('', { status: 504 }) : caches.match('./index.html'));
    })
  );
});

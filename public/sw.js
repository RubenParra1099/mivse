// Service worker de la App de Campo (Módulo 1): permite abrir /captura sin señal.
// Las capturas se guardan en el dispositivo (localStorage) y la propia página las sincroniza al volver la conexión.
const CACHE = 'mivse-campo-v1';
const BASE = ['/captura', '/manifest.webmanifest', '/icono-campo.svg', '/data/red-vial.txt', '/data/estados.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// La página envía los recursos que ya cargó para dejarlos disponibles sin conexión
self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'precache' && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.add(u).catch(() => {})))));
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Recursos versionados de Next y datos del mapa: primero caché
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/data/') || url.pathname.startsWith('/_next/image')) {
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Páginas y demás: primero red; sin señal, lo último guardado (y /captura como respaldo)
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname === '/captura')) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('/captura') : Response.error()))),
  );
});

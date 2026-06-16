const CACHE = 'monitech-v95';

const STATIC = [
  '/system/system.html',
  '/system/css/system.css',
  '/system/js/system.js',
  '/assets/css/shared/variables.css',
  '/assets/css/shared/theme-toggle.css',
  '/assets/css/shared/icons.css',
  '/assets/css/shared/profile-photo-styles.css',
  '/assets/js/shared/profile-photo-manager.js',
  '/assets/js/shared/magnific-icons-loader.js',
  '/assets/js/shared/theme-toggle.js',
  '/assets/js/shared/theme-loader.js',
  '/assets/js/vendor/lucide.min.js',
  '/assets/images/logo.svg',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API: network-only (dados sempre frescos)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ sucesso: false, offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // CDN e fontes externas: network-first, cache como fallback
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Assets locais: cache-first, atualiza em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
      return cached || network;
    })
  );
});

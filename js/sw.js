/* CTY Service Worker */
const SW_VERSION = 'cty-v1.0.0';
const PRECACHE = `precache-${SW_VERSION}`;
const RUNTIME = `runtime-${SW_VERSION}`;

const PRECACHE_URLS = [
  '/',  
  '/index.html',             // optional if you have an index; otherwise remove
  '/dashboard.html',
  '/css/style.css',
  '/js/firebase-config.js',
  '/dashboard-files/content.js',
  '/offline.html',
  '/dashboard-files/content-4-6.json',
  '/dashboard-files/content-7-10.json',
  '/dashboard-files/content-11-13.json',
  '/dashboard-files/content-14-17.json',
   
  '/manifest.webmanifest'
];

// Install: pre-cache the app shell + JSON
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches + enable navigation preload
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    const names = await caches.keys();
    await Promise.all(names.map((n) => {
      if (n !== PRECACHE && n !== RUNTIME) return caches.delete(n);
    }));
    await self.clients.claim();
  })());
});

// Fetch strategy:
// - HTML navigations: network-first → offline.html fallback
// - /data JSON: stale-while-revalidate
// - CSS/JS/icons: cache-first
const HTML_HEADER = 'text/html';
function isHTML(resp) {
  const ct = resp.headers.get('content-type') || '';
  return ct.includes(HTML_HEADER);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // HTML navigations (dashboard, offline, etc.)
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const net = await fetch(req, { cache: 'no-store' });
        if (net && isHTML(net.clone())) {
          const cache = await caches.open(RUNTIME);
          cache.put(req, net.clone());
        }
        return net;
      } catch {
        const cache = await caches.open(PRECACHE);
        return (await cache.match('/offline.html')) || Response.error();
      }
    })());
    return;
  }

  // JSON content (stale-while-revalidate)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await fetchPromise) || new Response('[]', { headers: { 'Content-Type': 'application/json' }});
    })());
    return;
  }

  // Static assets (cache-first)
  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(PRECACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }
});

// Support "skip waiting"
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
// Note: To trigger an update, call:



// PWA: register service worker + update UX
(function registerSW(){
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('js/sw.js').then(function(reg) {
      // Listen for updates
      if (reg.waiting) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(nw); // new version available
          }
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }).catch(function (e) {
      console.warn('[SW]', e);
    });
  });

  function promptUpdate(worker){
    // minimal UX: confirm. You can swap with your toast.
    if (confirm('A new version is ready. Update now?')) {
      worker.postMessage('SKIP_WAITING');
    }
  }
})();
// End of PWA SW + update code
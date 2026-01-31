/* CTY Service Worker - Corrected Version */

// Only disable console in production (not localhost)
if (self.location.hostname !== 'localhost' && self.location.hostname !== '127.0.0.1') {
  console.log = function() {};
  console.warn = function() {};
  console.error = function() {};
  console.info = function() {};
}

const SW_VERSION = 'cty-v1.0.1';
const PRECACHE = `precache-${SW_VERSION}`;
const RUNTIME = `runtime-${SW_VERSION}`;

// Only include files that actually exist
const PRECACHE_URLS = [
  '/frontend/',  
  '/frontend/index.html',
  '/frontend/about.html',
  '/frontend/dashboard-files/dashboard.html',
  '/frontend/authentication/signup.html',
  '/frontend/authentication/login.html',
  '/frontend/css/style.css',
  '/frontend/css/dashboard.css',
  '/frontend/dashboard-files/content.js',
  '/frontend/js/pwa-install.js',
  '/frontend/offline.html',
  '/frontend/dashboard-files/content-4-6.json',
  '/frontend/dashboard-files/content-7-10.json',
  '/frontend/dashboard-files/content-11-13.json',
  '/frontend/dashboard-files/content-14-17.json',
  '/frontend/manifest.json',
  '/frontend/assets/icons/icon-192x192.png',
  '/frontend/assets/icons/icon-512x512.png',
  '/frontend/assets/images/official-logo.svg'
  // Add other critical assets here
];

// Install: pre-cache the app shell + critical assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// Activate: clean old caches + enable navigation preload
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil((async () => {
    // Enable navigation preload if available
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    
    // Delete old caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== PRECACHE && cacheName !== RUNTIME) {
          console.log('Service Worker: Deleting old cache', cacheName);
          return caches.delete(cacheName);
        }
      })
    );
    
    // Claim clients immediately
    await self.clients.claim();
    console.log('Service Worker: Activated');
  })());
});

// Helper function to check if response is HTML
function isHTML(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Strategy 1: HTML navigations - Network first with offline fallback
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        // Try preload response first
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          console.log('Service Worker: Using preload response for', url.pathname);
          return preloadResponse;
        }
        
        // Fetch from network
        const networkResponse = await fetch(req, { cache: 'no-store' });
        
        // Cache HTML pages for offline use
        if (networkResponse && isHTML(networkResponse.clone())) {
          const cache = await caches.open(RUNTIME);
          cache.put(req, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        console.log('Service Worker: Network failed, trying cache for', url.pathname);
        
        // Try cache first
        const cachedResponse = await caches.match(req);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Fall back to offline page
        const cache = await caches.open(PRECACHE);
        const offlinePage = await cache.match('/frontend/offline.html');
        return offlinePage || Response.error();
      }
    })());
    return;
  }

  // Strategy 2: JSON content - Stale-while-revalidate
  if (url.pathname.includes('.json') || url.pathname.startsWith('/data/')) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cachedResponse = await cache.match(req);
      
      const fetchPromise = fetch(req)
        .then((response) => {
          if (response && response.ok) {
            cache.put(req, response.clone());
          }
          return response;
        })
        .catch(() => null);
      
      // Return cached version immediately, update in background
      return cachedResponse || (await fetchPromise) || 
        new Response('[]', { headers: { 'Content-Type': 'application/json' }});
    })());
    return;
  }

  // Strategy 3: Static assets (CSS, JS, images, fonts) - Cache first
  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(PRECACHE);
      const cachedResponse = await cache.match(req);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      try {
        const networkResponse = await fetch(req);
        if (networkResponse && networkResponse.ok) {
          // Cache new assets for future use
          cache.put(req, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.error('Service Worker: Failed to fetch', url.pathname, error);
        return Response.error();
      }
    })());
    return;
  }
});

// Support "skip waiting" message
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
/* CTY Service Worker - Corrected Version */

// Only disable console in production (not localhost)
if (self.location.hostname !== 'localhost' && self.location.hostname !== '127.0.0.1') {
  console.log = function() {};
  console.warn = function() {};
  console.error = function() {};
  console.info = function() {};
}

const SW_VERSION = 'cty-v1.0.19'; // Update this version string with each release to force clients to update their service worker
const PRECACHE = `precache-${SW_VERSION}`;
const RUNTIME = `runtime-${SW_VERSION}`;

// Only include files that actually exist
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/about.html',
  '/offline.html',
  '/manifest.json',

  // Auth
  '/authentication/signup.html',
  '/authentication/login.html',

  // Dashboard pages
  '/dashboard-files/dashboard.html',
  '/dashboard-files/profile.html',
  '/dashboard-files/leaderboard.html',
  '/dashboard-files/todaysverse.html',

  // Core assets
  '/css/style.css',
  '/css/dashboard.css',
  '/dashboard-files/dashboard.js',
  '/js/pwa-install.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/images/official-logo.svg'
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
        const offlinePage = await cache.match('/offline.html');
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

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = JSON.parse(event.data.text());
    } catch {
      data = { body: event.data.text() };
    }
  }

  // Silent push: midday verse-read-check from sync-read-state cron
  if (data.type === 'verse-read-check') {
    event.waitUntil(handleVerseReadSync(data));
    return;
  }

  // Regular visible notification
  const title = data.title || 'Tenderoots 📖';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Your daily verse is ready!',
      icon: data.icon || '/assets/icons/icon-192x192.png',
      badge: data.badge || '/assets/icons/monochrome.png',
      data: { url: data.url || '/dashboard-files/dashboard.html' },
      vibrate: [200, 100, 200]
    })
  );
});

/**
 * Handles the silent noon verse-read-check push.
 * 1. Reads verse-read state from Cache API (written by checkbox.js).
 * 2. Reports state back to /api/push/report-read so send-afternoon has fresh data.
 * 3. Shows a silent fallback notification only if no window is open
 *    (browsers require showNotification when no clients are active).
 */
async function handleVerseReadSync(data) {
  const { uid, date } = data;

  // Read verse-read state from Cache API (shared between window and SW)
  let isRead = false;
  try {
    const cache = await caches.open('cty-read-state');
    const resp = await cache.match('/verse-read-state');
    if (resp) {
      const state = await resp.json();
      isRead = !!(state && state.date === date && state.read === true);
    }
  } catch (_) {}

  // Get API base URL from config cache (written by firebase-config.js on page load)
  let apiBase = 'https://cty-7cyi.onrender.com';
  try {
    const configCache = await caches.open('cty-config');
    const configResp = await configCache.match('/api-base');
    if (configResp) {
      const config = await configResp.json();
      if (config && typeof config.url === 'string') apiBase = config.url;
    }
  } catch (_) {}

  // Report read state back to server
  try {
    await fetch(`${apiBase}/api/push/report-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, date, read: isRead, token: data.token || '' })
    });
  } catch (_) {}

  // Browsers require at least one showNotification call when no window is open.
  // Show a silent, non-intrusive notification as a fallback.
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windowClients.length === 0) {
    await self.registration.showNotification('Tenderoots', {
      body: 'Syncing your progress...',
      silent: true,
      badge: '/assets/icons/monochrome.png',
      tag: 'cty-sync',       // replaces any previous sync notification
      renotify: false
    });
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/dashboard-files/dashboard.html';

  // Only allow same-origin URLs — prevents open redirect via malicious push payload
  let targetUrl;
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    targetUrl = parsed.origin === self.location.origin
      ? parsed.href
      : '/dashboard-files/dashboard.html';
  } catch (_) {
    targetUrl = '/dashboard-files/dashboard.html';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if one is already open
      for (const client of windowClients) {
        if (client.url.includes('dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
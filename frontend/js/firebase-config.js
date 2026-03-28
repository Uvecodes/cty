// Firebase initialization - ONLY declares API_BASE and initializes Firebase
// Other scripts will use window.auth, window.db, window.API_BASE

window.API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://cty-7cyi.onrender.com';

// Store API_BASE in Cache API so the service worker can read it
// for authenticated background fetch calls (e.g. report-read endpoint)
if ('caches' in window) {
  caches.open('cty-config').then(function (cache) {
    cache.put('/api-base', new Response(
      JSON.stringify({ url: window.API_BASE }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
  }).catch(function () {});
}

console.log('🔥 firebase-config.js loading... API_BASE:', window.API_BASE);

function initFirebaseFromAPI() {
  if (firebase.apps.length) {
    console.log('✅ Firebase already initialized');
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    // Ensure LOCAL persistence is set (migrates any existing session) before signalling ready
    return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
      window.dispatchEvent(new CustomEvent('firebase-ready'));
    });
  }

  console.log('📡 Fetching Firebase config from:', `${window.API_BASE}/api/firebase-config`);

  return fetch(`${window.API_BASE}/api/firebase-config`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch Firebase config: ${res.status}`);
      return res.json();
    })
    .then((config) => {
      console.log('✅ Firebase config received, initializing...');
      firebase.initializeApp(config);
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      // Set LOCAL persistence before dispatching ready so all subsequent auth operations use it
      return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    })
    .then(() => {
      // Check if Firebase already has an auth session restored from IndexedDB
      return new Promise((resolve) => {
        const unsub = firebase.auth().onAuthStateChanged((user) => {
          unsub();
          resolve(user);
        });
      });
    })
    .then(async (user) => {
      // No active session — try silent re-auth via session cookie
      if (!user) {
        try {
          const resp = await fetch(`${window.API_BASE}/api/auth/silent-refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (resp.ok) {
            const data = await resp.json();
            await firebase.auth().signInWithCustomToken(data.token);
            console.log('✅ Session silently restored via cookie');
          }
        } catch (_e) {
          // No cookie or network error — user will be redirected to login as normal
        }
      }
      window.dispatchEvent(new CustomEvent('firebase-ready'));
      console.log('✅ Firebase ready');
    })
    .catch((error) => {
      console.error('❌ Firebase initialization failed:', error);
      throw error;
    });
}

// Initialize immediately
window.firebaseReady = initFirebaseFromAPI();
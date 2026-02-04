// Firebase initialization - ONLY declares API_BASE and initializes Firebase
// Other scripts will use window.auth, window.db, window.API_BASE

window.API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://cty-7cyi.onrender.com';

console.log('🔥 firebase-config.js loading... API_BASE:', window.API_BASE);

function initFirebaseFromAPI() {
  if (firebase.apps.length) {
    console.log('✅ Firebase already initialized');
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.dispatchEvent(new CustomEvent('firebase-ready'));
    return Promise.resolve();
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
      window.dispatchEvent(new CustomEvent('firebase-ready'));
      console.log('✅ Firebase initialized - auth and db available globally');
    })
    .catch((error) => {
      console.error('❌ Firebase initialization failed:', error);
      throw error;
    });
}

// Initialize immediately
window.firebaseReady = initFirebaseFromAPI();
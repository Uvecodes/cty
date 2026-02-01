// Firebase v8 Namespaced SDK - Init from backend API
// No hardcoded config; dependent scripts wait on window.firebaseReady

const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://cty-7cyi.onrender.com';

function initFirebaseFromAPI() {
  if (firebase.apps.length) {
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.analytics = firebase.analytics();
    window.messaging = firebase.messaging();
    return Promise.resolve();
  }
  return fetch(`${API_BASE}/api/firebase-config`)
    .then((res) => {
      if (!res.ok) throw new Error('Failed to fetch Firebase config');
      return res.json();
    })
    .then((config) => {
      firebase.initializeApp(config);
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      window.analytics = firebase.analytics();
      window.messaging = firebase.messaging();
    });
}

window.firebaseReady = initFirebaseFromAPI();

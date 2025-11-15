// console.log() redec;laration to avoid errors in some environments
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};


// Firebase v8 Namespaced SDK - Browser Compatible
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRjTTx_FOCFybP5Dhp2Bz82NQN1n-9fJ4",
  authDomain: "catch-them-young-16da5.firebaseapp.com",
  projectId: "catch-them-young-16da5",
  storageBucket: "catch-them-young-16da5.firebasestorage.app",
  messagingSenderId: "777589364823",
  appId: "1:777589364823:web:ee9f214c01c7d9779aab12",
  measurementId: "G-H517ECEK72"
};

// Initialize Firebase app (only if not already initialized)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();
const messaging = firebase.messaging();
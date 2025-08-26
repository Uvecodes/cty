// Firebase v8 Namespaced SDK
const firebase = require('firebase/app');
require('firebase/auth');
require('firebase/firestore');
require('firebase/analytics');
require('firebase/messaging');

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

// Initialize Firebase app
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();
const messaging = firebase.messaging();

// Export Firebase instances
module.exports = { app, auth, db, analytics, messaging };
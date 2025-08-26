// Firebase v9+ Modular SDK Configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging } from 'firebase/messaging';

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
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const messaging = getMessaging(app);

// Export Firebase instances
export { app, auth, db, analytics, messaging }; 
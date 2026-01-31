const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin SDK
let adminInitialized = false;

function initializeFirebaseAdmin() {
  if (adminInitialized) {
    return;
  }

  try {
    // Option 1: Service account key from environment variable (JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized from environment variable');
    }
    // Option 2: Service account file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized from service account file');
    }
    // Option 3: Default service account (for Google Cloud environments)
    else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log('✅ Firebase Admin initialized with application default credentials');
    }

    adminInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
}

// Initialize on module load
initializeFirebaseAdmin();

// Export admin instances
const auth = admin.auth();
const db = admin.firestore();

module.exports = {
  admin,
  auth,
  db
};

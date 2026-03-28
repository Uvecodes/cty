const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin SDK
let adminInitialized = false;

function initializeFirebaseAdmin() {
  if (adminInitialized) {
    console.log('ℹ️  Firebase Admin already initialized');
    return;
  }

  try {
    // Option 1: Service account key from environment variable (JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('📋 Attempting to parse FIREBASE_SERVICE_ACCOUNT_KEY...');
      
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError.message);
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
      }

      // Fix common issue: \n in private key gets escaped as \\n
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('✅ Firebase Admin initialized from environment variable');
    }
    // Option 2: Service account file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      console.log('📋 Loading service account from file...');
      const serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('✅ Firebase Admin initialized from service account file');
      console.log(`   File: ${serviceAccountPath}`);
    }
    // Option 3: Default service account (for Google Cloud environments)
    else {
      console.log('⚠️  No FIREBASE_SERVICE_ACCOUNT_KEY or path found');
      console.log('   Falling back to application default credentials');
      
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      
      console.log('✅ Firebase Admin initialized with application default credentials');
    }

    adminInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.error('   Stack:', error.stack);
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
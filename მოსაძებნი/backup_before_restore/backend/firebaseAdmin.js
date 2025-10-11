const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
let firebaseApp;

try {
  if (admin.apps.length === 0) {
    // Check if we have Firebase Service Account Key as JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || "bakhmaro-cottages"
        });

        console.log('✅ Firebase Admin SDK initialized with Service Account Key');
      } catch (parseError) {
        console.error('❌ Firebase Service Account Key parse error:', parseError.message);
        throw new Error('Invalid Firebase Service Account Key JSON format');
      }
    }
    // Fallback: Check if we have individual environment variables
    else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID || "bakhmaro-cottages",
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
      };

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || "bakhmaro-cottages"
      });

      console.log('✅ Firebase Admin SDK initialized with individual keys');
    } else {
      throw new Error('Missing Firebase Admin credentials - need either FIREBASE_SERVICE_ACCOUNT_KEY or individual keys');
    }
  } else {
    firebaseApp = admin.apps[0];
    console.log('✅ Using existing Firebase Admin app');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin initialization failed, using mock:', error.message);
  // Create a mock admin for development
  firebaseApp = {
    auth: () => ({
      createCustomToken: async (uid, claims) => {
        console.warn('🔧 Mock Firebase Admin - createCustomToken called');
        return `mock_custom_token_${uid}_${Date.now()}`;
      }
    })
  };
}

module.exports = firebaseApp;
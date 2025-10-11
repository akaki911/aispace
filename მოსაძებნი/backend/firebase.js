const admin = require('firebase-admin');
const runtimeConfig = require('./config/runtimeConfig');

const createDisabledAdminStub = () => {
  const message = 'Firebase Admin is disabled (fb_admin=disabled)';
  const thrower = () => {
    throw new Error(message);
  };

  return {
    disabled: true,
    apps: [],
    initializeApp: thrower,
    firestore: thrower,
    auth: thrower,
    credential: {
      cert: thrower,
    },
  };
};

if (!runtimeConfig.integrations.firebase.enabled) {
  console.warn('⚠️ [Firebase] Skipping Firebase Admin bootstrap — fb_admin=disabled');
  module.exports = createDisabledAdminStub();
} else {
  // Initialize Firebase Admin only once
  if (!admin.apps.length) {
    try {
      const { credential: serviceAccount, stringValue, source } = runtimeConfig.firebaseAccount;

      if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing or invalid');
      }

      // Ensure other modules can reuse the resolved JSON string
      if (stringValue) {
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = stringValue;
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages',
      });

      const sourceSuffix = source ? ` [${source}]` : '';
      console.log(`✅ Firebase Admin initialized successfully${sourceSuffix}`);
    } catch (error) {
      console.error('❌ Firebase Admin initialization failed:', error.message);

      // Fallback initialization with minimal config
      try {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages',
        });
        console.log('✅ Firebase Admin initialized with minimal config');
      } catch (fallbackError) {
        console.error('❌ Fallback Firebase Admin initialization failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  }

  // Export the initialized admin instance
  module.exports = admin;
}

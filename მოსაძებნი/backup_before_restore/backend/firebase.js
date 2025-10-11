
const admin = require('firebase-admin');

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    // Get service account from environment variable
    const serviceAccountKey = process.env.FIREBASE_ADMIN_KEY;
    
    if (!serviceAccountKey) {
      throw new Error('FIREBASE_ADMIN_KEY environment variable is missing');
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch (parseError) {
      throw new Error('FIREBASE_ADMIN_KEY is not valid JSON');
    }

    // Fix escaped newlines in private_key
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'bakhmaro-cottages'
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    
    // Fallback initialization with minimal config
    try {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages'
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

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork } from 'firebase/firestore';
import { getStorage } from "firebase/storage";

// Debug all available environment variables for Firebase
console.log("🔍 All import.meta.env variables:", Object.keys(import.meta.env));
console.log("🔍 All Firebase-related env vars:", 
  Object.keys(import.meta.env).filter(key => key.includes('FIREBASE'))
);

// Use actual values for Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBH0-yeuoUIWOiO1ZXGDcuJ7_vP6BkugBw",
  authDomain: "bakhmaro-cottages.firebaseapp.com",
  projectId: "bakhmaro-cottages",
  storageBucket: "bakhmaro-cottages.firebasestorage.app",
  messagingSenderId: "815060315119",
  appId: "1:815060315119:web:a1f33d920bcd52e536a41a",
  measurementId: "G-NT97B9E4YL"
};

// Validate required environment variables for reference
const requiredEnvVars = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId
};

const missingVars = Object.entries(requiredEnvVars).filter(([key, value]) => !value).map(([key]) => key);

if (missingVars.length > 0) {
  console.error("❌ Missing required Firebase environment variables:", missingVars);
  console.error("❌ Available environment variables:", Object.keys(import.meta.env));
  console.error("❌ Please ensure these are set in your Replit Secrets:");
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  
  // Provide helpful debugging information
  console.error("💡 Debug info:");
  console.error("   - Check if variables are prefixed with VITE_");
  console.error("   - Verify they are added to Replit Secrets tab");
  console.error("   - Restart the development server after adding secrets");
  
  throw new Error(`Missing Firebase configuration: ${missingVars.join(', ')}`);
}

// Firebase config is already defined above

// Debug Firebase config
console.log("🔧 Firebase Config Debug:", {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : "MISSING",
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'server',
  fullConfig: firebaseConfig
});

// Validate API key format
if (!firebaseConfig.apiKey || !firebaseConfig.apiKey.startsWith('AIza')) {
  console.error("❌ Invalid Firebase API Key format!");
  console.error("❌ Current API Key:", firebaseConfig.apiKey);
}

// Validate auth domain
if (!firebaseConfig.authDomain || !firebaseConfig.authDomain.includes('firebase')) {
  console.error("❌ Invalid Firebase Auth Domain!");
  console.error("❌ Current Auth Domain:", firebaseConfig.authDomain);
}

// Connection timeout configuration with network recovery
const CONNECTION_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 3;
const FIREBASE_OFFLINE_MODE = false;

// Network error recovery helper
const handleFirebaseNetworkError = (error: any) => {
  console.error('🔥 Firebase network error detected:', error);
  
  if (error.code === 'unavailable' || error.message?.includes('ERR_CONNECTION_CLOSED')) {
    console.warn('⚠️ Firebase unavailable - switching to offline mode');
    return true; // Indicates offline mode should be used
  }
  
  return false;
};

// Check environment variables
console.log("🔍 Environment Variables Check:", {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY ? "SET" : "MISSING",
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? "SET" : "MISSING",
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID ? "SET" : "MISSING",
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID ? "SET" : "MISSING",
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? "SET" : "USING_DEFAULT",
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? "SET" : "MISSING",
  VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ? "SET" : "MISSING"
});

// Initialize Firebase app (only once)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
console.log("✅ Firebase app initialized successfully");

// Initialize Firebase services
let authInstance: Auth;
try {
  // Try to get existing
  authInstance = getAuth(app);
} catch {
  // If not existing, init
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
}
export const auth: Auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);

// Export the app instance for additional configuration if needed
export default app;
export { handleFirebaseNetworkError };

console.log("✅ Firebase services initialized and exported");

const { getFirestore } = require("firebase-admin/firestore");
const fs = require('fs').promises;
const path = require('path');

let db;
let useLocalStorage = false;
let connectionRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Firebase initialization
const admin = require('firebase-admin');

// Initialize Firebase Admin
async function initializeFirebaseAdmin() {
  // Security check for production environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️ Running Firebase Admin in non-production mode');
  }

  if (!admin.apps.length) {
    try {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: "2f32b400a05e8de074ee5b7a88afa348c1b428d3",
        private_key: process.env.FIREBASE_PRIVATE_KEY,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: "105883465823765072647",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      // Enhanced logging based on environment
      if (process.env.NODE_ENV === 'production') {
        console.log('✅ Firebase Admin initialized for PRODUCTION');
      } else {
        console.log('✅ Firebase Admin initialized successfully in memory_controller [DEV MODE]');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Firebase Admin initialization error:', error.message);
      return false;
    }
  }
  return true;
}

// Initialize Firebase
async function initializeFirebase() {
  try {
    const initialized = await initializeFirebaseAdmin();
    if (initialized) {
      db = getFirestore();
      console.log('🧠 Enhanced Memory Controller: Firebase initialized successfully');
    } else {
      throw new Error('Firebase initialization failed');
    }
  } catch (error) {
    console.log('🧠 Enhanced Memory Controller: Firebase not available, using local file storage');
    useLocalStorage = true;
  }
}

// Call initialization
initializeFirebase();

const MEMORY_DIR = path.join(__dirname, 'memory_data');
const FACTS_DIR = path.join(__dirname, 'memory_facts');
const GRAMMAR_DIR = path.join(__dirname, 'grammar_data');

async function ensureDirectories() {
  try {
    await Promise.all([
      fs.mkdir(MEMORY_DIR, { recursive: true }),
      fs.mkdir(FACTS_DIR, { recursive: true }),
      fs.mkdir(GRAMMAR_DIR, { recursive: true })
    ]);
  } catch (error) {
    console.error('🧠 Directory creation failed:', error);
  }
}

// Enhanced Firebase connection health check
async function checkFirebaseHealth() {
  console.log('🧠 [Health Check] Starting Firebase health check...');
  console.log('🧠 [Health Check] useLocalStorage:', useLocalStorage);
  console.log('🧠 [Health Check] db exists:', !!db);

  if (useLocalStorage || !db) {
    console.log('🧠 [Health Check] Using local storage or no db instance');
    return { 
      status: 'local_storage', 
      available: false, 
      reason: useLocalStorage ? 'Using local storage' : 'No database instance' 
    };
  }

  try {
    console.log('🧠 [Health Check] Attempting Firebase connection test...');

    // Simple health check with timeout
    const healthPromise = db.collection('health_check').doc('test').get();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firebase health check timeout')), 5000)
    );

    const result = await Promise.race([healthPromise, timeoutPromise]);
    console.log('🧠 [Health Check] Firebase health check passed');

    return { 
      status: 'connected', 
      available: true, 
      latency: Date.now(),
      docExists: result.exists 
    };
  } catch (error) {
    console.error('🧠 [Health Check] Firebase health check failed:', error);
    return { 
      status: 'failed', 
      available: false, 
      error: error.message,
      code: error.code || 'unknown'
    };
  }
}

// Enhanced file operations with atomic writes
async function writeFileAtomic(filePath, data) {
  const tempPath = filePath + '.tmp';
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
    return true;
  } catch (error) {
    // Cleanup temp file on error
    try {
      await fs.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

async function getUserMemoryFile(userId) {
  await ensureDirectories();
  return path.join(MEMORY_DIR, `${userId}.json`);
}

async function readUserMemory(userId) {
  const userFile = await getUserMemoryFile(userId);
  try {
    await fs.access(userFile);
    const data = await fs.readFile(userFile, 'utf8');
    return JSON.parse(data);
  } catch {
    // Create default structure with enhanced metadata
    const defaultData = {
      userId: userId,
      data: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      timestamp: Date.now(),
      version: '2.0',
      enhanced: true
    };
    await writeFileAtomic(userFile, defaultData);
    return defaultData;
  }
}

async function writeUserMemory(userId, memoryData) {
  const userFile = await getUserMemoryFile(userId);
  const dataWithTimestamp = {
    userId: userId,
    data: memoryData,
    updatedAt: new Date().toISOString(),
    timestamp: Date.now(),
    version: '2.0',
    enhanced: true,
    lastSyncAttempt: new Date().toISOString()
  };
  await writeFileAtomic(userFile, dataWithTimestamp);
}

// Enhanced memory storage with retry logic
async function rememberFact(userId, fact, retryCount = 0) {
  try {
    const isFirebaseHealthy = await checkFirebaseHealth();

    if (!useLocalStorage && db && isFirebaseHealthy) {
      const ref = db.collection("memory").doc(userId);
      await ref.set(
        {
          data: fact,
          updatedAt: new Date().toISOString(),
          timestamp: Date.now(),
          enhanced: true,
          version: '2.0'
        },
        { merge: true }
      );
      console.log(`🧠 Enhanced memory stored in Firebase for user ${userId}`);
      return { success: true, storage: 'firebase' };
    } else {
      // Enhanced local storage fallback
      await writeUserMemory(userId, fact);
      console.log(`🧠 Enhanced memory stored locally for user ${userId}`);
      return { success: true, storage: 'local' };
    }
  } catch (error) {
    console.error(`🧠 Memory storage error (attempt ${retryCount + 1}):`, error.message);

    // Retry logic for transient failures
    if (retryCount < MAX_RETRY_ATTEMPTS && !error.message.includes('permissions')) {
      console.log(`🧠 Retrying memory storage (${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return rememberFact(userId, fact, retryCount + 1);
    }

    // Final fallback to local storage
    try {
      await writeUserMemory(userId, fact);
      console.log(`🧠 Enhanced memory stored locally (final fallback) for user ${userId}`);
      return { success: true, storage: 'local_fallback', originalError: error.message };
    } catch (fallbackError) {
      console.error('🧠 All memory storage methods failed:', fallbackError);
      throw new Error(`Memory storage failed: ${error.message}`);
    }
  }
}

async function getMemory(userId) {
  try {
    const isFirebaseHealthy = await checkFirebaseHealth();

    if (!useLocalStorage && db && isFirebaseHealthy) {
      const doc = await db.collection("memory").doc(userId).get();
      if (!doc.exists) {
        console.log(`🧠 No enhanced memory found in Firebase for user ${userId}`);
        // Try local fallback
        return await readUserMemory(userId);
      }
      const data = doc.data();
      console.log(`🧠 Enhanced memory retrieved from Firebase for user ${userId}`);
      return data;
    } else {
      // Enhanced local storage retrieval
      const userData = await readUserMemory(userId);
      if (!userData || !userData.data) {
        console.log(`🧠 No enhanced memory found locally for user ${userId}`);
        return null;
      }
      console.log(`🧠 Enhanced memory retrieved locally for user ${userId}:`, {
        dataLength: userData.data?.length || 0,
        updatedAt: userData.updatedAt,
        version: userData.version
      });
      return userData;
    }
  } catch (error) {
    console.error('🧠 Enhanced memory retrieval error:', error);

    // Always try local fallback
    try {
      const userData = await readUserMemory(userId);
      if (!userData || !userData.data) {
        console.log(`🧠 No enhanced memory found locally (fallback) for user ${userId}`);
        return null;
      }
      console.log(`🧠 Enhanced memory retrieved locally (fallback) for user ${userId}`);
      return userData;
    } catch (fallbackError) {
      console.error('🧠 Enhanced local memory fallback failed:', fallbackError);
      return null;
    }
  }
}

async function addToMemory(userId, newFact) {
  try {
    const existing = await getMemory(userId);
    let combinedData;

    if (existing && existing.data) {
      // Enhanced memory consolidation with timestamps
      const timestamp = new Date().toISOString();
      combinedData = `${existing.data}\n\n[${timestamp}] ${newFact}`;
    } else {
      const timestamp = new Date().toISOString();
      combinedData = `[${timestamp}] ${newFact}`;
    }

    const result = await rememberFact(userId, combinedData);
    return result;
  } catch (error) {
    console.error('🧠 Enhanced memory addition error:', error);
    throw error;
  }
}

// Enhanced grammar corrections with better organization
async function getGrammarFixes(userId) {
  try {
    const isFirebaseHealthy = await checkFirebaseHealth();

    if (!useLocalStorage && db && isFirebaseHealthy) {
      const grammarQuery = await db.collection('grammar_corrections')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(15) // Increased limit for better context
        .get();

      const fixes = [];
      grammarQuery.forEach(doc => {
        const data = doc.data();
        fixes.push(`არა "${data.original}", არამედ "${data.corrected}"`);
      });

      return fixes;
    } else {
      // Enhanced local grammar storage
      const grammarFile = path.join(GRAMMAR_DIR, `${userId}_grammar.json`);
      try {
        await fs.access(grammarFile);
        const grammarData = await fs.readFile(grammarFile, 'utf8');
        const corrections = JSON.parse(grammarData);

        return corrections.slice(-15).map(correction => 
          `არა "${correction.original}", არამედ "${correction.corrected}"`
        );
      } catch {
        return [];
      }
    }
  } catch (error) {
    console.error('🇬🇪 Enhanced grammar fixes retrieval error:', error);
    return [];
  }
}

async function storeGrammarCorrection(userId, original, corrected) {
  try {
    const isFirebaseHealthy = await checkFirebaseHealth();

    if (!useLocalStorage && db && isFirebaseHealthy) {
      const grammarRef = db.collection('grammar_corrections').doc();

      await grammarRef.set({
        userId: userId,
        original: original,
        corrected: corrected,
        timestamp: new Date(),
        learned: false,
        enhanced: true,
        version: '2.0'
      });

      console.log(`🇬🇪 Enhanced grammar correction stored in Firebase for user ${userId}`);
      return { success: true, storage: 'firebase' };
    } else {
      // Enhanced local grammar storage
      const grammarFile = path.join(GRAMMAR_DIR, `${userId}_grammar.json`);

      let grammarData = [];
      try {
        await fs.access(grammarFile);
        const existingData = await fs.readFile(grammarFile, 'utf8');
        grammarData = JSON.parse(existingData);
      } catch {
        // File doesn't exist, start with empty array
      }

      grammarData.push({
        original,
        corrected,
        timestamp: new Date().toISOString(),
        learned: false,
        enhanced: true,
        version: '2.0'
      });

      // Keep only recent corrections to avoid bloat
      if (grammarData.length > 50) {
        grammarData = grammarData.slice(-50);
      }

      await writeFileAtomic(grammarFile, grammarData);
      console.log(`🇬🇪 Enhanced grammar correction stored locally for user ${userId}`);
      return { success: true, storage: 'local' };
    }
  } catch (error) {
    console.error('🇬🇪 Enhanced grammar correction storage error:', error);
    return { success: false, error: error.message };
  }
}

// Enhanced Firebase sync with better error handling
async function syncMemoryToFirebase(userId) {
  if (useLocalStorage || !db) {
    console.log('🧠 Firebase not available for enhanced sync');
    return { success: false, reason: 'Firebase unavailable' };
  }

  const isHealthy = await checkFirebaseHealth();
  if (!isHealthy) {
    console.log('🧠 Firebase unhealthy, skipping sync');
    return { success: false, reason: 'Firebase unhealthy' };
  }

  try {
    const syncResults = [];

    // Enhanced main memory sync
    const localMemory = await readUserMemory(userId);
    if (localMemory && localMemory.data) {
      await db.collection("memory").doc(userId).set({
        data: localMemory.data,
        updatedAt: new Date().toISOString(),
        timestamp: Date.now(),
        syncedFromLocal: true,
        syncTimestamp: new Date().toISOString(),
        enhanced: true,
        version: '2.0'
      }, { merge: true });
      syncResults.push('main_memory');
      console.log(`🧠 Enhanced memory synced to Firebase for user ${userId}`);
    }

    // Enhanced facts sync
    const factsFile = path.join(FACTS_DIR, `${userId}.json`);
    try {
      await fs.access(factsFile);
      const factsData = await fs.readFile(factsFile, 'utf8');
      const factsJson = JSON.parse(factsData);

      if (factsJson.facts && factsJson.facts.length > 0) {
        const memoryRef = db.collection('memory').doc(userId);
        await memoryRef.set({
          facts: factsJson.facts,
          totalFacts: factsJson.totalFacts,
          lastUpdated: new Date().toISOString(),
          syncedFromLocal: true,
          enhanced: true,
          version: '2.0'
        }, { merge: true });
        syncResults.push('facts');
        console.log(`🧠 Enhanced facts synced to Firebase for user ${userId}: ${factsJson.facts.length} facts`);
      }
    } catch (factsError) {
      console.log(`🧠 No local facts to sync for user ${userId}`);
    }

    // Enhanced grammar corrections sync
    const grammarFile = path.join(GRAMMAR_DIR, `${userId}_grammar.json`);
    try {
      await fs.access(grammarFile);
      const grammarData = await fs.readFile(grammarFile, 'utf8');
      const grammarJson = JSON.parse(grammarData);

      if (grammarJson.length > 0) {
        // Batch write with enhanced metadata
        const batch = db.batch();
        grammarJson.forEach(correction => {
          const correctionRef = db.collection('grammar_corrections').doc();
          batch.set(correctionRef, {
            userId: userId,
            original: correction.original,
            corrected: correction.corrected,
            timestamp: new Date(correction.timestamp),
            learned: correction.learned || false,
            syncedFromLocal: true,
            enhanced: true,
            version: '2.0'
          });
        });
        await batch.commit();
        syncResults.push('grammar');
        console.log(`🇬🇪 Enhanced grammar corrections synced to Firebase for user ${userId}: ${grammarJson.length} corrections`);
      }
    } catch (grammarError) {
      console.log(`🇬🇪 No local grammar corrections to sync for user ${userId}`);
    }

    return { 
      success: true, 
      synced: true, 
      components: syncResults,
      enhanced: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('🧠 Enhanced Firebase sync failed:', error);
    return { success: false, error: error.message, enhanced: true };
  }
}

// Enhanced auto-sync with connection monitoring
async function attemptFirebaseSync(userId) {
  if (useLocalStorage || !db) {
    return { success: false, reason: 'Firebase not available', enhanced: true };
  }

  try {
    console.log('🧠 Attempting enhanced Firebase sync recovery...');
    const syncResult = await syncMemoryToFirebase(userId);
    if (syncResult.success) {
      console.log('🧠 Enhanced Firebase sync recovery successful');
      connectionRetryCount = 0; // Reset retry count on success
    }
    return syncResult;
  } catch (error) {
    connectionRetryCount++;
    console.log(`🧠 Enhanced Firebase sync recovery failed (attempt ${connectionRetryCount}):`, error.message);

    // Implement exponential backoff for retries
    if (connectionRetryCount < MAX_RETRY_ATTEMPTS) {
      setTimeout(() => attemptFirebaseSync(userId), 1000 * Math.pow(2, connectionRetryCount));
    }

    return { success: false, error: error.message, retryCount: connectionRetryCount, enhanced: true };
  }
}

// Enhanced periodic sync with health monitoring
async function periodicSyncCheck(userId) {
  if (useLocalStorage) return { success: false, reason: 'Using local storage', enhanced: true };

  try {
    const isHealthy = await checkFirebaseHealth();
    if (isHealthy) {
      console.log('🧠 Enhanced Firebase connection restored, attempting sync...');
      return await syncMemoryToFirebase(userId);
    } else {
      console.log('🧠 Enhanced Firebase still unavailable for sync');
      return { success: false, reason: 'Firebase unhealthy', enhanced: true };
    }
  } catch (error) {
    console.log('🧠 Enhanced periodic sync check failed:', error.message);
    return { success: false, reason: 'Sync check failed', error: error.message, enhanced: true };
  }
}

// Import facts functionality
async function getStoredFacts(userId) {
  try {
    const factsFile = path.join(FACTS_DIR, `${userId}.json`);
    await fs.access(factsFile);
    const factsData = await fs.readFile(factsFile, 'utf8');
    const factsJson = JSON.parse(factsData);
    return factsJson.facts || [];
  } catch {
    return [];
  }
}

module.exports = { 
  rememberFact, 
  getMemory, 
  addToMemory, 
  storeGrammarCorrection,
  getGrammarFixes,
  syncMemoryToFirebase,
  attemptFirebaseSync,
  periodicSyncCheck,
  getStoredFacts,
  checkFirebaseHealth
};

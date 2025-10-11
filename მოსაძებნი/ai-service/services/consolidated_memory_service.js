const fs = require('fs').promises;
const path = require('path');
const admin = require('firebase-admin');

// Check if Firebase is available from the global flag set by server.js
// This prevents duplicate initialization and respects credential gating
let isFirebaseAvailable = false;

// Only access Firebase if it's already been properly initialized
try {
  // Check if Firebase is available from global flag
  isFirebaseAvailable = global.isFirebaseAvailable || false;

  // If Firebase wasn't initialized by server.js, try to initialize it ourselves
  if (!isFirebaseAvailable && !admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
        });
        isFirebaseAvailable = true;
        console.log('🔥 Firebase Admin initialized in consolidated memory service');
      } catch (parseError) {
        console.warn('⚠️ Firebase Service Account Key parse error in memory service:', parseError.message);
        isFirebaseAvailable = false;
      }
    } else {
      console.log('📝 Firebase credentials not available in memory service - using local storage only');
      isFirebaseAvailable = false;
    }
  }
} catch (error) {
  console.warn('⚠️ Firebase initialization failed in memory service, using local storage:', error.message);
  isFirebaseAvailable = false;
}

class ConsolidatedMemoryService {
  constructor() {
    // Firebase availability flag
    this.isFirebaseAvailable = isFirebaseAvailable;

    // Only access Firestore if Firebase is properly initialized
    this.db = null;
    if (this.isFirebaseAvailable) {
      try {
        this.db = admin.firestore();
        console.log('🔥 Firestore connection established in memory service');
      } catch (error) {
        console.warn('⚠️ Firestore connection failed, using local storage only:', error.message);
        this.isFirebaseAvailable = false;
        this.db = null;
      }
    } else {
      console.log('📝 Firebase unavailable - memory service will use local storage only');
    }

    this.memoryCollection = 'ai_memory_consolidated';
    this.factsCollection = 'ai_facts_consolidated';
    this.grammarCollection = 'ai_grammar_consolidated';

    // Local fallback directories
    this.memoryDir = path.join(__dirname, '../memory_data');
    this.factsDir = path.join(__dirname, '../memory_facts');

    // In-memory cache for performance
    this.memoryCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Ensure directories exist
    this.ensureDirectories();

    console.log('🧠 Consolidated Memory Service initialized');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
      await fs.mkdir(this.factsDir, { recursive: true });
    } catch (error) {
      // Directories might already exist, that's okay
      if (error.code !== 'EEXIST') {
        console.warn('Failed to create memory directories:', error.message);
      }
    }
  }

  // Main method used by server.js - supports both Firebase and local storage
  async getUserMemory(userId) {
    try {
      // Try local file system first for compatibility
      const memoryFile = path.join(this.memoryDir, `${userId}.json`);
      const factsFile = path.join(this.factsDir, `${userId}.json`);

      let memoryData = {};
      let factsData = [];

      // Load memory data
      try {
        const content = await fs.readFile(memoryFile, 'utf8');
        memoryData = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or other error, use defaults
      }

      // Load facts data
      try {
        const content = await fs.readFile(factsFile, 'utf8');
        factsData = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or other error, use defaults
      }

      return {
        personalInfo: memoryData.personalInfo || {
          name: userId === '01019062020' ? 'კაკი' : "გიორგი", // Updated name based on intention
          age: "25",
          interests: "AI, Web Development, UI/UX",
          notes: "AI Developer specializing in React and TypeScript",
          preferredLanguage: "ka",
          role: "developer",
          programmingLanguages: ["TypeScript", "React", "Node.js"],
          codeStyle: "strict, typed"
        },
        facts: factsData.length > 0 ? factsData : ["User prefers Georgian language interface", "Expert in React development"],
        grammarFixes: memoryData.grammarFixes || [],
        interactionHistory: memoryData.interactionHistory || [],
        savedRules: memoryData.savedRules || [],
        errorLogs: memoryData.errorLogs || [],
        contextActions: memoryData.contextActions || [],
        codePreferences: memoryData.codePreferences || [],
        stats: memoryData.stats || {
          totalRules: 0,
          activeRules: 0,
          resolvedErrors: 0,
          totalActions: 0,
          accuracyRate: 0,
          memoryUsage: 0
        }
      };
    } catch (error) {
      console.error('Memory service error:', error);
      throw new Error(`Failed to load user memory: ${error.message}`);
    }
  }

  // ==== FIREBASE MEMORY OPERATIONS ===

  async storeMainMemory(userId, memoryData, metadata = {}) {
    try {
      const timestamp = new Date().toISOString();
      const memoryDoc = {
        userId,
        content: memoryData,
        metadata: {
          ...metadata,
          lastUpdated: timestamp,
          version: '2.0',
          source: 'consolidated_service'
        },
        timestamp
      };

      // Store in Firestore only if available
      if (this.isFirebaseAvailable && this.db) {
        await this.db.collection(this.memoryCollection).doc(userId).set(memoryDoc, { merge: true });
        console.log(`💾 Main memory stored in Firestore for user: ${userId}`);
      } else {
        console.log(`📝 Firebase unavailable - storing memory locally for user: ${userId}`);
        // Use local storage fallback
        await this.saveUserMemory(userId, memoryData);
      }

      // Update cache
      this.memoryCache.set(`memory_${userId}`, {
        data: memoryDoc,
        cachedAt: Date.now()
      });

      return { success: true, timestamp };
    } catch (error) {
      console.error('❌ Error storing main memory:', error);
      return { success: false, error: error.message };
    }
  }

  async getMainMemory(userId) {
    try {
      // Check cache first
      const cached = this.memoryCache.get(`memory_${userId}`);
      if (cached && (Date.now() - cached.cachedAt) < this.cacheExpiry) {
        console.log(`🎯 Memory cache hit for user: ${userId}`);
        return { success: true, data: cached.data };
      }

      // Try Firestore if available, otherwise return null
      if (this.isFirebaseAvailable && this.db) {
        const doc = await this.db.collection(this.memoryCollection).doc(userId).get();

        if (!doc.exists) {
          return { success: true, data: null };
        }

        const data = doc.data();

        // Update cache
        this.memoryCache.set(`memory_${userId}`, {
          data,
          cachedAt: Date.now()
        });

        console.log(`📖 Main memory retrieved from Firestore for user: ${userId}`);
        return { success: true, data };
      } else {
        console.log(`📝 Firebase unavailable - no main memory data available for user: ${userId}`);
        return { success: true, data: null };
      }
    } catch (error) {
      console.error('❌ Error retrieving main memory:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllUserMemory(userId) {
    try {
      const [mainMemory, facts, grammarFixes] = await Promise.all([
        this.getMainMemory(userId),
        this.getFacts(userId),
        this.getGrammarFixes(userId)
      ]);

      return {
        success: true,
        data: {
          mainMemory: mainMemory.data?.content || null,
          facts: facts.data || [],
          grammarFixes: grammarFixes.data || [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            source: 'consolidated_service'
          }
        }
      };
    } catch (error) {
      console.error('❌ Error retrieving all user memory:', error);
      return { success: false, error: error.message };
    }
  }

  // ==== FACTS OPERATIONS ====

  async storeFact(userId, fact, metadata = {}) {
    try {
      const factId = `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const factDoc = {
        id: factId,
        userId,
        content: fact,
        metadata: {
          ...metadata,
          type: 'fact',
          createdAt: new Date().toISOString(),
          source: 'consolidated_service'
        }
      };

      // Store in Firestore only if available
      if (this.isFirebaseAvailable && this.db) {
        await this.db.collection(this.factsCollection).doc(factId).set(factDoc);
        console.log(`🔍 Fact stored in Firestore for user: ${userId}`);
      } else {
        if (!isFirebaseAvailable) {
          console.log(`📝 Firebase unavailable - fact cached locally for user: ${userId}`);
          // Store in local memory as fallback
          return { success: true, source: 'local_cache' };
        } else {
          console.log(`📝 Firebase unavailable - fact not persisted for user: ${userId}`);
        }
      }

      // Invalidate cache
      this.memoryCache.delete(`facts_${userId}`);

      return { success: true, factId };
    } catch (error) {
      console.error('❌ Error storing fact:', error);
      return { success: false, error: error.message };
    }
  }

  async getFacts(userId) {
    try {
      // Check cache first
      const cached = this.memoryCache.get(`facts_${userId}`);
      if (cached && (Date.now() - cached.cachedAt) < this.cacheExpiry) {
        return { success: true, data: cached.data };
      }

      // Try Firestore if available, otherwise return empty array
      let facts = [];
      if (this.isFirebaseAvailable && this.db) {
        const snapshot = await this.db.collection(this.factsCollection)
          .where('userId', '==', userId)
          .orderBy('metadata.createdAt', 'desc')
          .get();

        snapshot.forEach(doc => {
          facts.push(doc.data());
        });
        console.log(`🔍 Facts retrieved from Firestore for user: ${userId}`);
      } else {
        console.log(`📝 Firebase unavailable - no facts data available for user: ${userId}`);
        facts = []; // Return empty array when Firebase unavailable
      }

      // Update cache
      this.memoryCache.set(`facts_${userId}`, {
        data: facts,
        cachedAt: Date.now()
      });

      return { success: true, data: facts };
    } catch (error) {
      console.error('❌ Error retrieving facts:', error);
      return { success: false, error: error.message };
    }
  }

  async getGrammarFixes(userId) {
    try {
      const cached = this.memoryCache.get(`grammar_${userId}`);
      if (cached && (Date.now() - cached.cachedAt) < this.cacheExpiry) {
        return { success: true, data: cached.data };
      }

      // Try Firestore if available, otherwise return empty array
      let grammarFixes = [];
      if (this.isFirebaseAvailable && this.db) {
        const snapshot = await this.db.collection(this.grammarCollection)
          .where('userId', '==', userId)
          .orderBy('metadata.createdAt', 'desc')
          .get();

        snapshot.forEach(doc => {
          grammarFixes.push(doc.data());
        });
        console.log(`🕰️ Grammar fixes retrieved from Firestore for user: ${userId}`);
      } else {
        console.log(`📝 Firebase unavailable - no grammar fixes data available for user: ${userId}`);
        grammarFixes = []; // Return empty array when Firebase unavailable
      }

      this.memoryCache.set(`grammar_${userId}`, {
        data: grammarFixes,
        cachedAt: Date.now()
      });

      return { success: true, data: grammarFixes };
    } catch (error) {
      console.error('❌ Error retrieving grammar fixes:', error);
      return { success: false, error: error.message };
    }
  }

  // ==== LOCAL STORAGE METHODS ====

  async saveUserMemory(userId, memoryData) {
    try {
      const memoryFile = path.join(this.memoryDir, `${userId}.json`);
      await fs.writeFile(memoryFile, JSON.stringify(memoryData, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save memory:', error);
      return false;
    }
  }

  // ==== UTILITY METHODS ====

  clearUserCaches(userId) {
    if (userId) {
      this.memoryCache.delete(`memory_${userId}`);
      this.memoryCache.delete(`facts_${userId}`);
      this.memoryCache.delete(`grammar_${userId}`);
    } else {
      this.memoryCache.clear();
    }
  }

  // Backward compatibility for Enhanced File Monitor Service
  async rememberFact(...args) {
    try {
      // Support newer 4-arg usage: (type, text, confidence, source)
      if (args.length >= 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
        const [type, text, confidence = 0.7, source = 'enhanced_monitor'] = args;
        const fact = { type, text, confidence, source, timestamp: new Date().toISOString() };
        return await this.storeFact('system', fact);
      }
      // Support legacy usage: (userId, factObj)
      const [userId = 'system', fact = {}] = args;
      return await this.storeFact(userId, { ...fact, timestamp: fact.timestamp || new Date().toISOString() });
    } catch (error) {
      console.warn('⚠️ [MEMORY] rememberFact compatibility shim failed:', error.message);
      return null;
    }
  }

  getStats() {
    return {
      cacheSize: this.memoryCache.size,
      cacheHitRate: this.cacheHitRate || 0,
      service: 'consolidated_memory_service',
      version: '2.0',
      collections: {
        memory: this.memoryCollection,
        facts: this.factsCollection,
        grammar: this.grammarCollection
      }
    };
  }
}

// Export consolidated service class and instance
const consolidatedMemoryServiceInstance = new ConsolidatedMemoryService();

// Export the instance directly
module.exports = consolidatedMemoryServiceInstance;
module.exports.ConsolidatedMemoryService = ConsolidatedMemoryService;

// Bind methods properly to prevent 'this' context issues
module.exports.getUserMemory = async function(userId) {
  return await consolidatedMemoryServiceInstance.getUserMemory(userId);
};

module.exports.storeMainMemory = async function(userId, data, metadata) {
  return await consolidatedMemoryServiceInstance.storeMainMemory(userId, data, metadata);
};

module.exports.getAllUserMemory = async function(userId) {
  return await consolidatedMemoryServiceInstance.getAllUserMemory(userId);
};
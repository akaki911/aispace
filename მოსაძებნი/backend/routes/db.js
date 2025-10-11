
const admin = require('firebase-admin');
const path = require('path');

// Database manager with enhanced error handling
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.db = null;
    this.connectionAttempts = 0;
    this.maxAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async initialize() {
    if (this.connectionAttempts >= this.maxAttempts) {
      console.log('❌ Max database connection attempts reached');
      return false;
    }

    this.connectionAttempts++;
    
    try {
      if (!admin.apps.length) {
        console.log(`🔄 Database connection attempt ${this.connectionAttempts}/${this.maxAttempts}`);
        
        // Try service account first
        const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
        
        try {
          const serviceAccount = require(serviceAccountPath);
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://bakhmaro-cottages-default-rtdb.firebaseio.com"
          });
          
          console.log('🔥 Firebase Admin initialized with service account');
        } catch (serviceError) {
          console.log('⚠️ Service account not found, using environment config');
          
          admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages',
          });
          
          console.log('🔥 Firebase Admin initialized with environment');
        }
      }

      this.db = admin.firestore();
      
      // Test the connection
      await this.testConnection();
      
      this.isConnected = true;
      console.info('✅ Database connection established successfully');
      
      return true;
    } catch (error) {
      console.error(`❌ Database initialization failed (attempt ${this.connectionAttempts}):`, error.message);
      this.isConnected = false;
      
      // Retry if we haven't reached max attempts
      if (this.connectionAttempts < this.maxAttempts) {
        console.log(`🔄 Retrying database connection in ${this.retryDelay/1000} seconds...`);
        setTimeout(() => this.initialize(), this.retryDelay);
      }
      
      return false;
    }
  }

  async testConnection() {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // Simple test query with timeout
      const testPromise = this.db.collection('_test').limit(1).get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      await Promise.race([testPromise, timeoutPromise]);
      
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  getDB() {
    if (!this.isConnected || !this.db) {
      console.warn('⚠️ Database accessed while not connected');
      return null;
    }
    return this.db;
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      hasDB: !!this.db,
      timestamp: new Date().toISOString()
    };
  }

  // Reset connection attempts (for manual retry)
  resetAttempts() {
    this.connectionAttempts = 0;
    console.log('🔄 Database connection attempts reset');
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Auto-initialize on load
dbManager.initialize().catch(error => {
  console.error('❌ Auto-initialization failed:', error);
});

module.exports = {
  dbManager,
  // Export functions for backward compatibility
  getDB: () => dbManager.getDB(),
  testConnection: () => dbManager.testConnection(),
  getStatus: () => dbManager.getStatus(),
  resetConnection: () => {
    dbManager.resetAttempts();
    return dbManager.initialize();
  }
};

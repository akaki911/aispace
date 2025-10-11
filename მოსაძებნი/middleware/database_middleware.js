const admin = require('firebase-admin');
const path = require('path');

// Database manager singleton
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.db = null;
    this.connectionAttempts = 0;
    this.maxAttempts = 3;
  }

  async initialize() {
    try {
      if (!admin.apps.length) {
        // Try to initialize Firebase Admin
        const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

        try {
          const serviceAccount = require(serviceAccountPath);

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://bakhmaro-cottages-default-rtdb.firebaseio.com"
          });

          console.log('🔥 Firebase Admin initialized with service account');
        } catch (serviceError) {
          // Fallback to environment variables
          admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages',
          });

          console.log('🔥 Firebase Admin initialized with environment');
        }
      }

      this.db = admin.firestore();
      this.isConnected = true;
      console.log('✅ Database connection established');

      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  async testConnection() {
    try {
      if (!this.db) {
        await this.initialize();
      }

      // Simple test query
      await this.db.collection('_test').limit(1).get();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  getDB() {
    return this.db;
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Middleware to ensure database connection
const ensureDatabase = async (req, res, next) => {
  try {
    if (!dbManager.isConnected) {
      console.log('🔄 Initializing database connection...');
      await dbManager.initialize();
    }

    // Attach db to request for use in routes
    req.db = dbManager.getDB();
    next();
  } catch (error) {
    console.error('❌ Database middleware error:', error);
    res.status(503).json({
      error: 'Database unavailable',
      message: 'მონაცემთა ბაზა ამჟამად მიუწვდომელია'
    });
  }
};

// Health check endpoint
const healthCheck = async (req, res) => {
  try {
    const isHealthy = await dbManager.testConnection();

    if (isHealthy) {
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  ensureDatabase,
  healthCheck,
  dbManager
};
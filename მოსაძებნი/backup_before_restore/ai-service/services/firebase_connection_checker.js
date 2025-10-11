
class FirebaseConnectionChecker {
  constructor() {
    this.connectionStatus = 'unknown';
    this.lastCheckTime = null;
    this.errorCount = 0;
  }

  async checkConnection() {
    console.log('🔍 [Firebase Checker] Starting connection diagnostic...');
    
    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      credentials: this.checkCredentials(),
      connectionTest: await this.testConnection(),
      recommendations: []
    };

    console.log('📊 [Firebase Diagnostic]:', JSON.stringify(results, null, 2));
    
    if (!results.credentials.valid) {
      results.recommendations.push('Configure Firebase credentials in Secrets');
    }
    
    if (!results.connectionTest.success) {
      results.recommendations.push('Check network connectivity to Firebase');
    }

    return results;
  }

  checkCredentials() {
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const hasIndividualKeys = !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL);
    
    return {
      valid: hasServiceAccount || hasIndividualKeys,
      type: hasServiceAccount ? 'service_account_json' : hasIndividualKeys ? 'individual_keys' : 'none',
      details: {
        FIREBASE_SERVICE_ACCOUNT_KEY: hasServiceAccount ? 'SET' : 'MISSING',
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'NOT_SET',
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING',
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || 'NOT_SET'
      }
    };
  }

  async testConnection() {
    try {
      const admin = require('firebase-admin');
      
      if (admin.apps.length === 0) {
        return { success: false, error: 'No Firebase app initialized' };
      }

      const db = admin.firestore();
      await db.collection('health_check').doc('test').get();
      
      return { success: true, message: 'Firebase connection successful' };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        code: error.code || 'unknown'
      };
    }
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      lastCheck: this.lastCheckTime,
      errorCount: this.errorCount
    };
  }
}

module.exports = new FirebaseConnectionChecker();

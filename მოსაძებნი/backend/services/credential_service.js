// WebAuthn Credentials Management Service
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

// Ensure Firebase Admin is properly initialized before using this service
let firebaseReady = false;
try {
  const admin = require('firebase-admin');
  firebaseReady = admin.apps.length > 0;
  if (!firebaseReady) {
    console.warn('⚠️ [CREDENTIAL] Firebase Admin not yet initialized - service will initialize lazily');
  }
} catch (error) {
  console.error('❌ [CREDENTIAL] Firebase Admin module not available:', error.message);
}

class CredentialService {
  constructor() {
    // Lazy initialization to ensure Firebase Admin is ready
    this._db = null;
  }

  get db() {
    if (!this._db) {
      try {
        // Check if Firebase Admin is initialized
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
          throw new Error('Firebase Admin not initialized - please ensure Firebase is properly configured');
        }
        this._db = getFirestore();
      } catch (error) {
        console.error('❌ [CREDENTIAL] Firebase initialization error:', error.message);
        throw new Error(`Firebase not available: ${error.message}`);
      }
    }
    return this._db;
  }

  // Store WebAuthn credential
  async storeCredential({ credentialId, userId, publicKey, counter, aaguid, transports }) {
    try {
      const credIdHash = crypto.createHash('sha256')
        .update(credentialId, 'base64url')
        .digest('hex');

      const credentialData = {
        credIdHash,
        credentialId,
        userId,
        publicKey,
        counter,
        aaguid,
        transports: transports || ['internal', 'hybrid'],
        type: 'webauthn',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await this.db.collection('authCredentials').doc(credIdHash).set(credentialData, { merge: true });
      console.log(`🔐 [CREDENTIAL] Stored credential for user ${userId}`);
      return credIdHash;
    } catch (error) {
      console.error('❌ [CREDENTIAL] Store error:', error);
      throw error;
    }
  }

  // Get credential by ID hash
  async getCredential(credIdHash) {
    try {
      const credDoc = await this.db.collection('authCredentials').doc(credIdHash).get();
      if (!credDoc.exists) {
        return null;
      }
      return { id: credDoc.id, ...credDoc.data() };
    } catch (error) {
      console.error('❌ [CREDENTIAL] Get credential error:', error);
      throw error;
    }
  }

  // Find credential by original credential ID
  async findByCredentialId(credentialId) {
    try {
      const credIdHash = crypto.createHash('sha256')
        .update(credentialId, 'base64url')
        .digest('hex');
      
      return await this.getCredential(credIdHash);
    } catch (error) {
      console.error('❌ [CREDENTIAL] Find by credential ID error:', error);
      throw error;
    }
  }

  // Get all credentials for user
  async getUserCredentials(userId) {
    try {
      const snapshot = await this.db.collection('authCredentials')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ [CREDENTIAL] Get user credentials error:', error);
      throw error;
    }
  }

  // Update credential counter
  async updateCounter(credIdHash, counter) {
    try {
      await this.db.collection('authCredentials').doc(credIdHash).update({
        counter,
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log(`🔐 [CREDENTIAL] Updated counter for ${credIdHash}`);
    } catch (error) {
      console.error('❌ [CREDENTIAL] Update counter error:', error);
      throw error;
    }
  }

  // Get all credentials (for authentication options)
  async getAllCredentials() {
    try {
      // Check if Firebase is available before proceeding
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        console.warn('⚠️ [CREDENTIAL] Firebase not initialized - returning empty credentials list');
        return [];
      }

      const snapshot = await this.db.collection('authCredentials')
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ [CREDENTIAL] Get all credentials error:', error);
      
      // Return empty array instead of throwing for graceful degradation
      if (error.message.includes('Firebase app does not exist')) {
        console.warn('⚠️ [CREDENTIAL] Firebase not available - returning empty credentials list');
        return [];
      }
      
      throw error;
    }
  }

  // Remove credential
  async removeCredential(credIdHash) {
    try {
      await this.db.collection('authCredentials').doc(credIdHash).delete();
      console.log(`🔐 [CREDENTIAL] Removed credential ${credIdHash}`);
    } catch (error) {
      console.error('❌ [CREDENTIAL] Remove credential error:', error);
      throw error;
    }
  }
}

module.exports = new CredentialService();
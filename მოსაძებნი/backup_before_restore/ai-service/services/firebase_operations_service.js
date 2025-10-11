const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

class FirebaseOperationsService {
  constructor() {
    this.db = null;
    this.initializeFirebase();
  }

  async initializeFirebase() {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages',
        });
      }
      this.db = getFirestore();
      console.log('🔥 Firebase Operations Service initialized');
    } catch (error) {
      console.error('❌ Firebase Operations initialization failed:', error);
    }
  }

  // Real database operations that AI can perform
  async createCollection(collectionName, data) {
    try {
      const docRef = await this.db.collection(collectionName).add({
        ...data,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: 'AI_Assistant'
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error(`❌ Failed to create document in ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async updateDocument(collectionName, docId, updates) {
    try {
      await this.db.collection(collectionName).doc(docId).update({
        ...updates,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: 'AI_Assistant'
      });
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update document ${docId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteDocument(collectionName, docId) {
    try {
      await this.db.collection(collectionName).doc(docId).delete();
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to delete document ${docId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async queryCollection(collectionName, filters = []) {
    try {
      let query = this.db.collection(collectionName);

      filters.forEach(filter => {
        query = query.where(filter.field, filter.operator, filter.value);
      });

      const snapshot = await query.get();
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: documents };
    } catch (error) {
      console.error(`❌ Failed to query ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Batch operations for efficiency
  async batchOperation(operations) {
    try {
      const batch = this.db.batch();

      operations.forEach(op => {
        const ref = this.db.collection(op.collection).doc(op.id);
        switch (op.type) {
          case 'set':
            batch.set(ref, op.data);
            break;
          case 'update':
            batch.update(ref, op.data);
            break;
          case 'delete':
            batch.delete(ref);
            break;
        }
      });

      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('❌ Batch operation failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Index management
  async createIndex(collectionName, fields) {
    try {
      // This would typically be done through Firebase CLI
      // But we can log the required index for manual creation
      console.log(`📋 Index needed for ${collectionName}:`, fields);
      return { 
        success: true, 
        message: `Index configuration logged for ${collectionName}`,
        indexConfig: { collection: collectionName, fields }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new FirebaseOperationsService();
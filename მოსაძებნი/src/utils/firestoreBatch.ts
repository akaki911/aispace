
import { getFirestore, writeBatch, doc, collection, DocumentReference } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Firestore Batch Write Utility
 * ეს ხელსაწყო ამცირებს ზედმეტ pending mutations-ს
 */
export class FirestoreBatchManager {
  private batch = writeBatch(db);
  private operationCount = 0;
  private readonly maxBatchSize = 500; // Firestore limit

  /**
   * Add document to batch
   */
  setDoc(docRef: DocumentReference, data: any) {
    if (this.operationCount >= this.maxBatchSize) {
      throw new Error('Batch size exceeded. Commit current batch first.');
    }
    this.batch.set(docRef, data);
    this.operationCount++;
  }

  /**
   * Update document in batch
   */
  updateDoc(docRef: DocumentReference, data: any) {
    if (this.operationCount >= this.maxBatchSize) {
      throw new Error('Batch size exceeded. Commit current batch first.');
    }
    this.batch.update(docRef, data);
    this.operationCount++;
  }

  /**
   * Delete document in batch
   */
  deleteDoc(docRef: DocumentReference) {
    if (this.operationCount >= this.maxBatchSize) {
      throw new Error('Batch size exceeded. Commit current batch first.');
    }
    this.batch.delete(docRef);
    this.operationCount++;
  }

  /**
   * Commit all batched operations
   */
  async commit() {
    if (this.operationCount === 0) {
      console.warn('No operations to commit');
      return;
    }

    try {
      await this.batch.commit();
      console.log(`✅ Batch committed: ${this.operationCount} operations`);
      this.reset();
    } catch (error) {
      console.error('❌ Batch commit failed:', error);
      throw error;
    }
  }

  /**
   * Reset batch for reuse
   */
  private reset() {
    this.batch = writeBatch(db);
    this.operationCount = 0;
  }

  /**
   * Get current operation count
   */
  getOperationCount() {
    return this.operationCount;
  }
}

/**
 * Quick batch write helper function
 */
export async function batchWrite(operations: Array<{
  type: 'set' | 'update' | 'delete';
  ref: DocumentReference;
  data?: any;
}>) {
  const batchManager = new FirestoreBatchManager();

  operations.forEach(op => {
    switch (op.type) {
      case 'set':
        batchManager.setDoc(op.ref, op.data);
        break;
      case 'update':
        batchManager.updateDoc(op.ref, op.data);
        break;
      case 'delete':
        batchManager.deleteDoc(op.ref);
        break;
    }
  });

  await batchManager.commit();
}

export default FirestoreBatchManager;

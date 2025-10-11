
// Firebase Quota Management Utility
export class FirebaseQuotaManager {
  private static instance: FirebaseQuotaManager;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private minInterval = 1000; // Minimum 1 second between requests

  static getInstance(): FirebaseQuotaManager {
    if (!FirebaseQuotaManager.instance) {
      FirebaseQuotaManager.instance = new FirebaseQuotaManager();
    }
    return FirebaseQuotaManager.instance;
  }

  async executeWithThrottle<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      // Ensure minimum interval between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minInterval - timeSinceLastRequest)
        );
      }

      const operation = this.requestQueue.shift();
      if (operation) {
        try {
          this.lastRequestTime = Date.now();
          await operation();
        } catch (error) {
          console.error('Firebase operation failed:', error);
          // If quota exceeded, increase interval
          if (error instanceof Error && (error as any).code === 'resource-exhausted') {
            this.minInterval = Math.min(this.minInterval * 2, 10000); // Max 10 seconds
            console.warn(`Firebase quota exceeded. Increasing interval to ${this.minInterval}ms`);
          }
        }
      }
    }

    this.isProcessing = false;
  }

  resetInterval() {
    this.minInterval = 1000;
  }
}

export const firebaseQuotaManager = FirebaseQuotaManager.getInstance();

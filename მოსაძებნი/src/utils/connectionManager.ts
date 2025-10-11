
export class ConnectionManager {
  private static retryAttempts = 0;
  private static maxRetries = 3;
  private static retryDelay = 2000;

  static async retryOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      const result = await operation();
      this.retryAttempts = 0; // Reset on success
      return result;
    } catch (error: any) {
      console.warn(`🔄 ${context} failed, attempt ${this.retryAttempts + 1}:`, error);
      
      if (this.retryAttempts < this.maxRetries && this.isRetriableError(error)) {
        this.retryAttempts++;
        await this.delay(this.retryDelay * this.retryAttempts);
        return this.retryOperation(operation, context);
      }
      
      this.retryAttempts = 0;
      throw error;
    }
  }

  private static isRetriableError(error: any): boolean {
    const retriableCodes = [
      'unavailable',
      'ERR_CONNECTION_CLOSED',
      'ERR_NETWORK',
      'timeout'
    ];
    
    return retriableCodes.some(code => 
      error.code?.includes(code) || 
      error.message?.includes(code)
    );
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  static onConnectionChange(callback: (isOnline: boolean) => void) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  }
}

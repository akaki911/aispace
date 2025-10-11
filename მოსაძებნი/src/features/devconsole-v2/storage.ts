
// Simple IndexedDB wrapper for large log buffers
class ConsoleLogDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'OURANOS_DEVCONSOLE_V2_LOGS';
  private readonly version = 1;
  private readonly storeName = 'logs';

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'ts');
          store.createIndex('source', 'source');
          store.createIndex('level', 'level');
        }
      };
    });
  }

  async storeLogs(logs: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Clear existing logs first
      store.clear();
      
      // Add new logs
      logs.forEach(log => store.add(log));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async retrieveLogs(limit = 50000): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const request = index.getAll();
      
      request.onsuccess = () => {
        const logs = request.result
          .sort((a, b) => b.ts - a.ts)
          .slice(0, limit)
          .reverse();
        resolve(logs);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clearLogs(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const consoleLogDB = new ConsoleLogDB();

// localStorage utilities with prefixed keys
const STORAGE_PREFIX = 'OURANOS_DEVCONSOLE_V2_';

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const storage = {
  setItem: (key: string, value: any) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  },
  
  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return defaultValue;
    }
  },
  
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  },
  
  clear: () => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  },

  // Cache methods with timestamp validation
  setCachedData: <T>(key: string, data: T) => {
    try {
      const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_PREFIX + 'CACHE_' + key, JSON.stringify(cachedData));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  },

  getCachedData: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + 'CACHE_' + key);
      if (!item) return defaultValue;

      const cachedData: CachedData<T> = JSON.parse(item);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - cachedData.timestamp > CACHE_DURATION) {
        localStorage.removeItem(STORAGE_PREFIX + 'CACHE_' + key);
        return defaultValue;
      }

      return cachedData.data;
    } catch (error) {
      console.warn('Failed to read cached data:', error);
      return defaultValue;
    }
  },

  clearCache: (key?: string) => {
    try {
      if (key) {
        localStorage.removeItem(STORAGE_PREFIX + 'CACHE_' + key);
      } else {
        // Clear all cache entries
        Object.keys(localStorage)
          .filter(storageKey => storageKey.startsWith(STORAGE_PREFIX + 'CACHE_'))
          .forEach(storageKey => localStorage.removeItem(storageKey));
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  },

  isCacheValid: (key: string): boolean => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + 'CACHE_' + key);
      if (!item) return false;

      const cachedData: CachedData<any> = JSON.parse(item);
      const now = Date.now();
      
      return (now - cachedData.timestamp) <= CACHE_DURATION;
    } catch (error) {
      return false;
    }
  }
};

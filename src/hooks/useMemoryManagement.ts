
import { useCallback, useEffect, useRef } from 'react';

export interface MemoryCleanupConfig {
  maxChatMessages: number;
  maxConsoleLogs: number;
  maxLocalStorageSize: number; // in KB
  cleanupInterval: number; // in milliseconds
}

const DEFAULT_CONFIG: MemoryCleanupConfig = {
  maxChatMessages: 30,
  maxConsoleLogs: 50,
  maxLocalStorageSize: 100, // 100KB
  cleanupInterval: 300000 // 5 minutes
};

export const useMemoryManagement = (config: Partial<MemoryCleanupConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getLocalStorageSize = useCallback(() => {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return Math.round(total / 1024); // Convert to KB
  }, []);

  const cleanupLocalStorage = useCallback((keys: string[]) => {
    try {
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) {
              // Keep only recent items
              const limited = parsed.slice(-Math.floor(finalConfig.maxChatMessages / 2));
              localStorage.setItem(key, JSON.stringify(limited));
            }
          } catch {
            // If not JSON, remove if too large
            if (item.length > 10000) {
              localStorage.removeItem(key);
            }
          }
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup localStorage:', error);
    }
  }, [finalConfig.maxChatMessages]);

  const performCleanup = useCallback(() => {
    const currentSize = getLocalStorageSize();
    
    if (currentSize > finalConfig.maxLocalStorageSize) {
      console.log(`🧹 Memory cleanup triggered (${currentSize}KB > ${finalConfig.maxLocalStorageSize}KB)`);
      
      // Clean AI dev panel specific items
      cleanupLocalStorage([
        'ai-dev-chat-history',
        'dev-console-logs',
        'dev-shell-logs',
        'dev-debugger-logs'
      ]);
      
      // Remove old cached items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('_cache_') || key.includes('_temp_')) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const parsed = JSON.parse(item);
              if (parsed.timestamp && (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000)) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      });
      
      const newSize = getLocalStorageSize();
      console.log(`✅ Cleanup completed: ${currentSize}KB → ${newSize}KB`);
    }
  }, [finalConfig.maxLocalStorageSize, getLocalStorageSize, cleanupLocalStorage]);

  useEffect(() => {
    // Initial cleanup
    performCleanup();
    
    // Set up periodic cleanup
    intervalRef.current = setInterval(performCleanup, finalConfig.cleanupInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [performCleanup, finalConfig.cleanupInterval]);

  const forceCleanup = useCallback(() => {
    performCleanup();
  }, [performCleanup]);

  const getMemoryStats = useCallback(() => {
    return {
      localStorageSize: getLocalStorageSize(),
      maxSize: finalConfig.maxLocalStorageSize,
      utilizationPercent: Math.round((getLocalStorageSize() / finalConfig.maxLocalStorageSize) * 100)
    };
  }, [getLocalStorageSize, finalConfig.maxLocalStorageSize]);

  return {
    forceCleanup,
    getMemoryStats,
    performCleanup
  };
};

export default useMemoryManagement;

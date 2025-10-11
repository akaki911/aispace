
import { devLog } from '../utils/devLogger';

interface CleanupStats {
  filesDeleted: number;
  cachesCleared: number;
  spaceSaved: string;
  timestamp: string;
}

class SystemCleanerService {
  private cleaningEnabled: boolean = true;
  private intervalId: number | null = null;
  private readonly HOUR_MS = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.loadSettings();
    this.startPeriodicCleaning();
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('systemCleaner_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.cleaningEnabled = settings.enabled ?? true;
      }
    } catch (error) {
      console.warn('🧹 Failed to load cleaner settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('systemCleaner_settings', JSON.stringify({
        enabled: this.cleaningEnabled,
        lastSaved: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('🧹 Failed to save cleaner settings:', error);
    }
  }

  public async performManualCleanup(): Promise<CleanupStats> {
    devLog.info('🧹 Starting manual system cleanup...');
    
    const stats: CleanupStats = {
      filesDeleted: 0,
      cachesCleared: 0,
      spaceSaved: '0 KB',
      timestamp: new Date().toISOString()
    };

    try {
      // Clear Firebase cache entries
      stats.cachesCleared += this.clearFirebaseCache();
      
      // Clear browser cache-related items
      stats.cachesCleared += this.clearBrowserCache();
      
      // Clear old temporary data
      stats.filesDeleted += this.clearTemporaryData();
      
      // Log cleanup summary
      this.logCleanupSummary(stats);
      
      // Save last cleanup time
      localStorage.setItem('systemCleaner_lastRun', stats.timestamp);
      
      console.log('✅ Cleanup finished successfully');
      return stats;
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  private clearFirebaseCache(): number {
    let cleared = 0;
    
    try {
      // Clear Firebase-related localStorage entries
      const keys = Object.keys(localStorage);
      const firebaseKeys = keys.filter(key => 
        key.startsWith('firestore_') || 
        key.startsWith('firebase_') ||
        key.includes('_firestore_')
      );
      
      firebaseKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          cleared++;
        } catch (error) {
          console.warn(`Failed to clear ${key}:`, error);
        }
      });
      
      devLog.info(`🧹 Cleared ${cleared} Firebase cache entries`);
      
    } catch (error) {
      console.warn('Failed to clear Firebase cache:', error);
    }
    
    return cleared;
  }

  private clearBrowserCache(): number {
    let cleared = 0;
    
    try {
      // Clear development-related cache entries
      const devKeys = [
        'vite_dev_cache',
        'webpack_cache',
        'dev_tools_cache',
        'hot_reload_cache'
      ];
      
      devKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          cleared++;
        }
      });
      
      // Clear old query cache if exists
      const keys = Object.keys(localStorage);
      const queryKeys = keys.filter(key => 
        key.includes('query_cache_') || 
        key.includes('_cache_') && 
        key !== 'systemCleaner_lastRun'
      );
      
      queryKeys.forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            // Remove cache entries older than 1 day
            const itemTime = new Date(parsed.timestamp || 0).getTime();
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            
            if (itemTime < oneDayAgo) {
              localStorage.removeItem(key);
              cleared++;
            }
          }
        } catch (error) {
          // If parsing fails, remove the item
          localStorage.removeItem(key);
          cleared++;
        }
      });
      
    } catch (error) {
      console.warn('Failed to clear browser cache:', error);
    }
    
    return cleared;
  }

  private clearTemporaryData(): number {
    let cleared = 0;
    
    try {
      // Clear old debug logs
      const keys = Object.keys(localStorage);
      const debugKeys = keys.filter(key => 
        key.startsWith('debug_') || 
        key.startsWith('log_') ||
        key.startsWith('temp_')
      );
      
      debugKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          cleared++;
        } catch (error) {
          console.warn(`Failed to clear ${key}:`, error);
        }
      });
      
    } catch (error) {
      console.warn('Failed to clear temporary data:', error);
    }
    
    return cleared;
  }

  private logCleanupSummary(stats: CleanupStats): void {
    const summary = {
      timestamp: stats.timestamp,
      filesDeleted: stats.filesDeleted,
      cachesCleared: stats.cachesCleared,
      totalItems: stats.filesDeleted + stats.cachesCleared
    };
    
    // Save to localStorage for history
    try {
      const history = JSON.parse(localStorage.getItem('systemCleaner_history') || '[]');
      history.unshift(summary);
      
      // Keep only last 10 cleanup records
      if (history.length > 10) {
        history.splice(10);
      }
      
      localStorage.setItem('systemCleaner_history', JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save cleanup history:', error);
    }
    
    devLog.info('🧹 Cleanup Summary:', summary);
  }

  public startPeriodicCleaning(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    if (this.cleaningEnabled) {
      this.intervalId = window.setInterval(() => {
        this.performManualCleanup().catch(error => {
          console.error('🧹 Scheduled cleanup failed:', error);
        });
      }, this.HOUR_MS);
      
      devLog.info('🧹 Periodic cleaning started (every 1 hour)');
    }
  }

  public stopPeriodicCleaning(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      devLog.info('🧹 Periodic cleaning stopped');
    }
  }

  public setCleaningEnabled(enabled: boolean): void {
    this.cleaningEnabled = enabled;
    this.saveSettings();
    
    if (enabled) {
      this.startPeriodicCleaning();
    } else {
      this.stopPeriodicCleaning();
    }
  }

  public isCleaningEnabled(): boolean {
    return this.cleaningEnabled;
  }

  public getLastCleanupTime(): string | null {
    return localStorage.getItem('systemCleaner_lastRun');
  }

  public getCleanupHistory(): any[] {
    try {
      return JSON.parse(localStorage.getItem('systemCleaner_history') || '[]');
    } catch (error) {
      return [];
    }
  }
}

// Export singleton instance
export const systemCleanerService = new SystemCleanerService();

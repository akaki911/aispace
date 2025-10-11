/**
 * System Verification Utility
 * Comprehensive testing of all system endpoints
 */

import GitHubEndpointsVerifier from './githubVerification';

export class SystemVerifier {

  static async verifyGitHubIntegration(): Promise<void> {
    console.group('🔍 GitHub Integration System Verification');
    console.log('🎯 Goal: All endpoints should return 200 status codes');
    console.log('📋 Testing GitHub endpoints...');

    try {
      const verifier = new GitHubEndpointsVerifier();
      const results = await verifier.verifyAllEndpoints();

      // Check specific requirements
      const criticalEndpoints = [
        '/api/ai/github/status',
        '/api/ai/github/stats',
        '/api/ai/github/commits',
        '/api/ai/github/branches/status'
      ];

      console.group('🎯 Critical Endpoints Status Check');
      let allCriticalPassed = true;

      criticalEndpoints.forEach(endpoint => {
        const result = results.find(r => r.endpoint === endpoint);
        const status = result?.status || 0;
        const passed = status === 200;
        const icon = passed ? '✅' : '❌';

        console.log(`${icon} ${endpoint}: ${status}`);
        if (!passed) allCriticalPassed = false;
      });

      if (allCriticalPassed) {
        console.log('🎉 ALL CRITICAL ENDPOINTS RETURNING 200 - VERIFICATION PASSED!');
      } else {
        console.error('❌ SOME CRITICAL ENDPOINTS NOT RETURNING 200 - VERIFICATION FAILED!');
      }
      console.groupEnd();

    } catch (error) {
      console.error('💥 Verification process failed:', error);
    }

    console.groupEnd();
  }

  // Make verification and cache clearing available globally for browser console
  static setupGlobalUtilities(): void {
    (window as any).verifySystem = SystemVerifier.verifyGitHubIntegration;
    (window as any).clearAllCaches = SystemVerifier.clearAllCaches; // Added clearAllCaches
    console.log('🧪 System verification available: Run verifySystem() in console');
    console.log('🧹 Cache clearing available: Run clearAllCaches() in console'); // Updated message
  }

  // Comprehensive cache clearing function
  static async clearAllCaches(): Promise<void> {
    console.log('🧹 Starting comprehensive cache clearing...');

    try {
      // Clear localStorage
      const localStorageKeys = Object.keys(localStorage);
      console.log(`📦 Clearing ${localStorageKeys.length} localStorage items`);
      
      // Keep essential items
      const essentialKeys = ['bakhmaro_client_id', 'i18nextLng', 'theme'];
      const itemsToKeep: Record<string, string> = {};
      
      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          itemsToKeep[key] = value;
        }
      });
      
      localStorage.clear();
      
      // Restore essential items
      Object.entries(itemsToKeep).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      // Clear sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      console.log(`📦 Clearing ${sessionStorageKeys.length} sessionStorage items`);
      sessionStorage.clear();

      // Clear IndexedDB if available
      if ('indexedDB' in window) {
        console.log('🗃️ Clearing IndexedDB...');
        try {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map(db => {
              if (db.name) {
                return new Promise<void>((resolve, reject) => {
                  const deleteReq = indexedDB.deleteDatabase(db.name!);
                  deleteReq.onsuccess = () => resolve();
                  deleteReq.onerror = () => reject(deleteReq.error);
                });
              }
              return Promise.resolve();
            })
          );
          console.log(`🗃️ Cleared ${databases.length} IndexedDB databases`);
        } catch (idbError) {
          console.warn('⚠️ IndexedDB clearing failed:', idbError);
        }
      }

      // Clear service worker caches if available
      if ('serviceWorker' in navigator && 'caches' in window) {
        console.log('🗂️ Clearing Service Worker caches...');
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
          console.log(`🗂️ Cleared ${cacheKeys.length} Service Worker caches.`);
        } catch (swError) {
          console.warn('⚠️ Service Worker cache clearing failed:', swError);
        }
      }

      console.log('✅ Cache clearing completed');
      console.log('🔄 Please refresh the page now');

    } catch (error) {
      console.error('❌ Cache clearing failed:', error);
    }
  }
}

// Auto-setup when module loads
SystemVerifier.setupGlobalUtilities();

export const clearAllCaches = () => SystemVerifier.clearAllCaches();

export default SystemVerifier;
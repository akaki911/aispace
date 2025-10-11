// Firebase Cleanup Utility
// Firebase-ის გასუფთავების ხელსაწყო

export const cleanupFirebaseCache = async () => {
  try {
    // Clear localStorage Firebase entries with more aggressive approach
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('firestore_mutations') ||
        key.includes('firestore_clients') ||
        key.includes('firestore_zombie') ||
        key.includes('firestore_targets') ||
        key.includes('firestore_sequence_number') ||
        key.includes('firestore_online_state')
      )) {
        // Check if entry is old or invalid
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.updateTimeMs && (Date.now() - data.updateTimeMs > 60000)) { // 1 minute old
            keysToRemove.push(key);
          } else if (!data.updateTimeMs) {
            keysToRemove.push(key); // Invalid data
          }
        } catch {
          keysToRemove.push(key); // Corrupted data
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🧹 Cleaned ${keysToRemove.length} Firebase cache entries`);

    return true;
  } catch (error) {
    console.error('❌ Firebase cleanup failed:', error);
    return false;
  }
};

export const periodicCleanup = () => {
  // Run cleanup every 10 minutes for more aggressive maintenance
  setInterval(cleanupFirebaseCache, 10 * 60 * 1000);

  // Also run immediate cleanup
  setTimeout(cleanupFirebaseCache, 5000);
};

export const cleanupFirebaseMutations = () => {
  console.log('🧹 Starting aggressive Firebase cleanup...');

  // Clean up pending mutations
  const keysToClean = Object.keys(localStorage).filter(key => 
    key.includes('firestore_mutations') && 
    key.includes('pending')
  );

  console.log(`🗑️ Found ${keysToClean.length} pending mutations to clean`);

  keysToClean.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`✅ Cleaned: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to clean ${key}:`, error);
    }
  });

  // Clean up zombie clients
  const zombieKeys = Object.keys(localStorage).filter(key => 
    key.includes('firestore_zombie')
  );

  zombieKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🧟 Removed zombie client: ${key}`);
  });

  console.log('✅ Firebase cleanup completed');
};
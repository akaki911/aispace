
class MemorySyncService {
  constructor() {
    this.syncQueue = new Map();
    this.isProcessing = false;
    this.config = {
      syncInterval: 30000, // 30 seconds
      maxRetries: 3,
      backupInterval: 300000 // 5 minutes
    };
    
    this.startSyncProcess();
    console.log('🔄 Memory Sync Service initialized');
  }

  // Add memory change to sync queue
  queueSync(userId, data, type = 'update') {
    const syncItem = {
      userId,
      data,
      type,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.syncQueue.set(`${userId}_${Date.now()}`, syncItem);
    console.log(`📝 Queued memory sync for user: ${userId}, type: ${type}`);
  }

  // Process sync queue
  async processSyncQueue() {
    if (this.isProcessing || this.syncQueue.size === 0) return;
    
    this.isProcessing = true;
    console.log(`🔄 Processing ${this.syncQueue.size} memory sync items`);
    
    const completed = [];
    const failed = [];
    
    for (const [key, item] of this.syncQueue.entries()) {
      try {
        await this.syncMemoryData(item);
        completed.push(key);
        console.log(`✅ Memory synced for user: ${item.userId}`);
      } catch (error) {
        item.retries++;
        if (item.retries >= this.config.maxRetries) {
          failed.push(key);
          console.error(`❌ Memory sync failed permanently for user: ${item.userId}`, error);
        } else {
          console.warn(`⚠️ Memory sync retry ${item.retries}/${this.config.maxRetries} for user: ${item.userId}`);
        }
      }
    }
    
    // Clean up completed and failed items
    completed.forEach(key => this.syncQueue.delete(key));
    failed.forEach(key => this.syncQueue.delete(key));
    
    this.isProcessing = false;
    console.log(`📊 Sync completed: ${completed.length} success, ${failed.length} failed`);
  }

  // Sync memory data between ai-service and backend
  async syncMemoryData(item) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Create absolute paths to avoid path resolution issues
    const projectRoot = path.resolve(__dirname, '../../..');
    const aiServicePath = path.join(projectRoot, 'ai-service/memory_data', `${item.userId}.json`);
    const backendPath = path.join(projectRoot, 'backend/memory_data', `${item.userId}.json`);
    
    try {
      // Validate data integrity before sync
      if (!this.validateMemoryData(item.data)) {
        console.warn(`⚠️ Invalid memory data for user ${item.userId}, using fallback`);
        // Use fallback data instead of throwing error
        item.data = this.getFallbackMemoryData(item.userId);
      }
      
      // Ensure directories exist
      await fs.mkdir(path.dirname(aiServicePath), { recursive: true });
      await fs.mkdir(path.dirname(backendPath), { recursive: true });
      
      // Write to both locations with atomic operations and fallback handling
      const dataString = JSON.stringify(item.data, null, 2);
      const tempAiPath = `${aiServicePath}.tmp`;
      const tempBackendPath = `${backendPath}.tmp`;
      
      try {
        // Try to write to both locations
        await Promise.all([
          fs.writeFile(tempAiPath, dataString),
          fs.writeFile(tempBackendPath, dataString)
        ]);
        
        await Promise.all([
          fs.rename(tempAiPath, aiServicePath),
          fs.rename(tempBackendPath, backendPath)
        ]);
        
        console.log(`💾 Memory data synced to both locations for user: ${item.userId}`);
      } catch (writeError) {
        console.warn(`⚠️ Failed to write to both locations, attempting partial sync for user: ${item.userId}`);
        
        // Try to save to at least one location
        try {
          await fs.writeFile(tempAiPath, dataString);
          await fs.rename(tempAiPath, aiServicePath);
          console.log(`💾 Memory data synced to AI service location for user: ${item.userId}`);
        } catch (aiError) {
          console.error(`❌ Failed to sync to AI service location: ${aiError.message}`);
          
          // Last resort: try backend only
          try {
            await fs.writeFile(tempBackendPath, dataString);
            await fs.rename(tempBackendPath, backendPath);
            console.log(`💾 Memory data synced to backend location only for user: ${item.userId}`);
          } catch (backendError) {
            console.error(`❌ Complete sync failure for user: ${item.userId}`);
            throw new Error(`სინქრონიზაციის შეცდომა: ${backendError.message}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Memory sync failed for user: ${item.userId}:`, error);
      
      // More descriptive Georgian error messages
      const georgianErrorMap = {
        'ENOENT': 'ფაილი ან დირექტორია ვერ მოიძებნა',
        'EACCES': 'წვდომა აკრძალულია',
        'ENOSPC': 'ადგილი არ არის საკმარისი',
        'corruption': 'მეხსიერების დაზიანება აღმოჩენილია',
        'network': 'ქსელის კავშირის პრობლემა'
      };
      
      let georgianError = 'მეხსიერების სინქრონიზაციის შეცდომა';
      for (const [key, value] of Object.entries(georgianErrorMap)) {
        if (error.message.toLowerCase().includes(key.toLowerCase())) {
          georgianError = value;
          break;
        }
      }
      
      // Log with Georgian message
      console.error(`🚨 ${georgianError} for user: ${item.userId}`);
      
      throw new Error(georgianError);
    }
  }

  // Get fallback memory data
  getFallbackMemoryData(userId) {
    console.log(`🛡️ Generating fallback memory data for user: ${userId}`);
    return {
      personalInfo: {
        name: "აკაკი ცინცაძე",
        age: "25",
        interests: "AI Development, React, TypeScript",
        notes: "AI Developer Assistant - Fallback data used due to sync issues",
        preferredLanguage: "ka",
        role: "developer"
      },
      facts: [],
      grammarFixes: [],
      interactionHistory: [],
      savedRules: [],
      errorLogs: [],
      contextActions: [],
      codePreferences: [],
      stats: {
        totalRules: 0,
        activeRules: 0,
        resolvedErrors: 0,
        totalActions: 0,
        accuracyRate: 0,
        memoryUsage: 0
      },
      lastSync: new Date().toISOString(),
      fallbackUsed: true
    };
  }

  // Validate memory data structure
  validateMemoryData(data) {
    try {
      if (!data || typeof data !== 'object') {
        console.warn('Memory data is not an object');
        return false;
      }
      
      // Validate contextActions if present
      if (data.contextActions && Array.isArray(data.contextActions)) {
        for (const action of data.contextActions) {
          if (!action.id || !action.action || !action.description) {
            console.warn('Invalid contextAction structure detected');
            return false;
          }
          // Check for truncated descriptions
          if (action.description && action.description.length < 5) {
            console.warn('Suspicious short description in contextAction');
            return false;
          }
        }
      }
      
      // More flexible validation - accept various data structures
      const hasValidStructure = (
        data.personalInfo || 
        data.facts || 
        data.data || 
        data.contextActions ||
        typeof data === 'string'
      );
      
      if (!hasValidStructure) {
        console.warn('Memory data lacks required structure');
        return false;
      }
      
      // Check for circular references
      try {
        JSON.stringify(data);
      } catch (circularError) {
        console.warn('Memory data contains circular references');
        return false;
      }
      
      // Additional size check
      const dataSize = JSON.stringify(data).length;
      if (dataSize > 5 * 1024 * 1024) { // 5MB limit
        console.warn(`Memory data too large: ${dataSize} bytes`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Memory data validation error:', error);
      return false;
    }
  }

  // Start automatic sync process
  startSyncProcess() {
    setInterval(() => {
      this.processSyncQueue();
    }, this.config.syncInterval);
    
    console.log(`⏰ Memory sync process started with ${this.config.syncInterval}ms interval`);
  }

  // Get sync statistics
  getSyncStats() {
    return {
      queueSize: this.syncQueue.size,
      isProcessing: this.isProcessing,
      config: this.config
    };
  }
}

module.exports = new MemorySyncService();

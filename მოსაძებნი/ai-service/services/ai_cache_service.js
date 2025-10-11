
const crypto = require('crypto');

class AICacheService {
  constructor() {
    // Two-level cache system
    this.responseCache = new Map(); // Full responses
    this.conversationCache = new Map(); // Conversation summaries
    
    this.config = {
      maxResponseCacheSize: 1000,
      maxConversationCacheSize: 500,
      responseCacheTTL: 3600000, // 1 hour
      conversationCacheTTL: 7200000, // 2 hours
      cleanupInterval: 300000 // 5 minutes
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      cleanups: 0
    };
    
    this.startCleanupTimer();
    console.log('🧠 AI Cache Service initialized with two-level caching');
  }

  // Generate cache key (single implementation)
  generateCacheKey(message, userId, options = {}) {
    const keyData = {
      message: message.toLowerCase().trim(),
      userId: userId || 'anonymous',
      model: options.model || 'default',
      type: options.type || 'chat'
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  }

  // Cache response with metadata
  cacheResponse(key, response, metadata = {}) {
    try {
      if (!key || !response) {
        console.warn('⚠️ Invalid cache parameters');
        return false;
      }

      const cacheEntry = {
        response,
        metadata: {
          timestamp: Date.now(),
          userId: metadata.userId,
          service: metadata.service || 'unknown',
          model: metadata.model || 'default',
          ...metadata
        },
        accessCount: 0,
        lastAccessed: Date.now()
      };

      // Check cache size limits
      if (this.responseCache.size >= this.config.maxResponseCacheSize) {
        this.evictOldestResponse();
      }

      this.responseCache.set(key, cacheEntry);
      this.stats.sets++;
      
      console.log(`💾 Cached response: ${key} (size: ${response.length})`);
      return true;
      
    } catch (error) {
      console.error('❌ Error caching response:', error.message);
      return false;
    }
  }

  // Get cached response
  getCachedResponse(key) {
    try {
      const entry = this.responseCache.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check TTL
      const age = Date.now() - entry.metadata.timestamp;
      if (age > this.config.responseCacheTTL) {
        this.responseCache.delete(key);
        this.stats.misses++;
        console.log(`⏰ Cache entry expired: ${key}`);
        return null;
      }

      // Update access info
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      
      this.stats.hits++;
      console.log(`🎯 Cache hit: ${key} (accessed ${entry.accessCount} times)`);
      
      return {
        response: entry.response,
        metadata: entry.metadata,
        fromCache: true,
        cacheAge: age
      };
      
    } catch (error) {
      console.error('❌ Error retrieving from cache:', error.message);
      this.stats.misses++;
      return null;
    }
  }

  // Cache conversation summary
  cacheConversationSummary(userId, summary, context = {}) {
    try {
      const key = `conv_${userId}`;
      
      const cacheEntry = {
        summary,
        context,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        messageCount: context.messageCount || 1
      };

      // Check conversation cache size
      if (this.conversationCache.size >= this.config.maxConversationCacheSize) {
        this.evictOldestConversation();
      }

      this.conversationCache.set(key, cacheEntry);
      console.log(`💬 Cached conversation summary for user: ${userId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error caching conversation:', error.message);
      return false;
    }
  }

  // Get conversation summary
  getConversationSummary(userId) {
    try {
      const key = `conv_${userId}`;
      const entry = this.conversationCache.get(key);
      
      if (!entry) {
        return null;
      }

      // Check TTL
      const age = Date.now() - entry.timestamp;
      if (age > this.config.conversationCacheTTL) {
        this.conversationCache.delete(key);
        console.log(`⏰ Conversation cache expired for user: ${userId}`);
        return null;
      }

      return {
        summary: entry.summary,
        context: entry.context,
        age,
        messageCount: entry.messageCount
      };
      
    } catch (error) {
      console.error('❌ Error retrieving conversation:', error.message);
      return null;
    }
  }

  // Evict oldest response entry
  evictOldestResponse() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.responseCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.responseCache.delete(oldestKey);
      console.log(`🗑️ Evicted oldest response: ${oldestKey}`);
    }
  }

  // Evict oldest conversation entry
  evictOldestConversation() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.conversationCache.entries()) {
      if (entry.lastUpdated < oldestTime) {
        oldestTime = entry.lastUpdated;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.conversationCache.delete(oldestKey);
      console.log(`🗑️ Evicted oldest conversation: ${oldestKey}`);
    }
  }

  // Start cleanup timer
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    let cleanedResponses = 0;
    let cleanedConversations = 0;

    // Clean response cache
    for (const [key, entry] of this.responseCache.entries()) {
      const age = now - entry.metadata.timestamp;
      if (age > this.config.responseCacheTTL) {
        this.responseCache.delete(key);
        cleanedResponses++;
      }
    }

    // Clean conversation cache
    for (const [key, entry] of this.conversationCache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.config.conversationCacheTTL) {
        this.conversationCache.delete(key);
        cleanedConversations++;
      }
    }

    if (cleanedResponses > 0 || cleanedConversations > 0) {
      this.stats.cleanups++;
      console.log(`🧹 Cache cleanup: ${cleanedResponses} responses, ${cleanedConversations} conversations`);
    }
  }

  // Clear all cache
  clearCache() {
    const responseCount = this.responseCache.size;
    const conversationCount = this.conversationCache.size;
    
    this.responseCache.clear();
    this.conversationCache.clear();
    
    console.log(`🧹 Cleared all cache: ${responseCount} responses, ${conversationCount} conversations`);
    return { responseCount, conversationCount };
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.stats,
      responseCache: {
        size: this.responseCache.size,
        maxSize: this.config.maxResponseCacheSize
      },
      conversationCache: {
        size: this.conversationCache.size,
        maxSize: this.config.maxConversationCacheSize
      },
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100) 
        : 0,
      config: this.config
    };
  }

  // Configure cache settings
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Cache service configured:', this.config);
  }

  // Get cache entry details
  getCacheDetails(key) {
    const response = this.responseCache.get(key);
    if (response) {
      return {
        type: 'response',
        entry: response,
        age: Date.now() - response.metadata.timestamp,
        accessCount: response.accessCount
      };
    }
    return null;
  }
}

module.exports = new AICacheService();

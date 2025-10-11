class AICacheService {
  constructor() {
    this.responseCache = new Map();
    this.conversationCache = new Map();
    this.maxCacheSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
    this.cacheTTL = parseInt(process.env.CACHE_TTL) || 3600000; // 1 hour
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalRequestTime = 0;
  }

  // Get cache statistics
  getCacheStats() {
    return {
      responseCache: {
        keys: this.responseCache.size,
        stats: {
          size: this.responseCache.size,
          maxSize: this.maxCacheSize
        }
      },
      conversationCache: {
        keys: this.conversationCache.size,
        stats: {
          size: this.conversationCache.size,
          maxSize: this.maxCacheSize
        }
      },
      memory: {
        total: this.responseCache.size + this.conversationCache.size,
        limit: this.maxCacheSize * 2
      }
    };
  }

  // Clear user cache
  clearUserCache(userId) {
    try {
      let cleared = 0;

      // Clear response cache for user
      for (const [key, value] of this.responseCache.entries()) {
        if (key.includes(userId)) {
          this.responseCache.delete(key);
          cleared++;
        }
      }

      // Clear conversation cache for user
      for (const [key, value] of this.conversationCache.entries()) {
        if (key.includes(userId)) {
          this.conversationCache.delete(key);
          cleared++;
        }
      }

      console.log(`🗑️ Cleared ${cleared} cache entries for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  // Set cache entry
  set(key, value, ttl = this.cacheTTL) {
    if (this.responseCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }

    this.responseCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  // Get cache entry
  get(key) {
    const startTime = Date.now();
    const entry = this.responseCache.get(key);
    if (!entry) {
      this.cacheMisses++;
      console.debug('Cache miss for', key);
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.responseCache.delete(key);
      this.cacheMisses++;
      console.debug('Cache expired for', key);
      return null;
    }

    this.cacheHits++;
    this.totalRequestTime += Date.now() - startTime;
    console.info('Cache hit for user data', key);
    return entry.value;
  }

  // Clear all cache
  clearAll() {
    this.responseCache.clear();
    this.conversationCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalRequestTime = 0;
    console.info('🗑️ All cache cleared');
  }

  // Get performance statistics
  getPerformanceStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      hitRate: totalRequests > 0 ? ((this.cacheHits / totalRequests) * 100).toFixed(1) + '%' : '0%',
      totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      averageResponseTime: totalRequests > 0 ? Math.round(this.totalRequestTime / totalRequests) + 'ms' : '0ms',
      cacheSize: this.responseCache.size,
      maxSize: this.maxCacheSize
    };
  }
}

const aiCacheService = new AICacheService();
module.exports = aiCacheService;
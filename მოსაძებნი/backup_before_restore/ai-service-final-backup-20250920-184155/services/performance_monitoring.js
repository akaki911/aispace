
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: [],
      responses: [],
      errors: [],
      memory: [],
      cache: [],
      system: []
    };
    
    this.maxHistorySize = 1000;
    this.startTime = Date.now();
    
    // Configurable settings
    this.MEMORY_CHECK_INTERVAL = parseInt(process.env.MEMORY_CHECK_INTERVAL_MS) || 30000; // Default 30 seconds
    this.DEBUG_MODE = process.env.DEBUG_MODE === 'true';
    this.VERBOSE_LOGGING = process.env.VERBOSE_PERFORMANCE_LOGS === 'true';
    this.MEMORY_WARNING_THRESHOLD = parseInt(process.env.MEMORY_WARNING_MB) || 500; // Default 500MB
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    console.log(`📊 Performance Monitor initialized - Debug: ${this.DEBUG_MODE}, Memory Check: ${this.MEMORY_CHECK_INTERVAL}ms`);
  }

  // Record AI request
  recordRequest(requestId, personalId, message, metadata = {}) {
    const record = {
      id: requestId,
      personalId: personalId,
      messageLength: message.length,
      timestamp: Date.now(),
      metadata: metadata
    };

    this.addRecord('requests', record);
    
    // Only log in debug mode
    if (this.DEBUG_MODE || this.VERBOSE_LOGGING) {
      console.log(`📊 Request recorded: ${requestId}`);
    }
  }

  // Record AI response
  recordResponse(requestId, response, model, processingTime, metadata = {}) {
    const record = {
      id: requestId,
      responseLength: response.length,
      model: model,
      processingTime: processingTime,
      timestamp: Date.now(),
      metadata: metadata
    };

    this.addRecord('responses', record);
    
    // Only log in debug mode or for slow responses
    if (this.DEBUG_MODE || this.VERBOSE_LOGGING || processingTime > 5000) {
      console.log(`📊 Response recorded: ${requestId}, ${processingTime}ms`);
    }
  }

  // Record error
  recordError(requestId, error, context = {}) {
    const record = {
      id: requestId,
      error: error.message,
      stack: error.stack,
      context: context,
      timestamp: Date.now()
    };

    this.addRecord('errors', record);
    console.error(`📊 Error recorded: ${requestId}`, error.message);
  }

  // Add record with history limit
  addRecord(type, record) {
    this.metrics[type].push(record);
    
    // Keep only recent records
    if (this.metrics[type].length > this.maxHistorySize) {
      this.metrics[type] = this.metrics[type].slice(-this.maxHistorySize);
    }
  }

  // Start memory monitoring with cleanup and automatic GC
  startMemoryMonitoring() {
    this.memoryInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const record = {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        timestamp: Date.now()
      };

      this.addRecord('memory', record);

      // Warning for high memory usage
      const memoryMB = memUsage.heapUsed / 1024 / 1024;
      if (memoryMB > this.MEMORY_WARNING_THRESHOLD) {
        console.warn(`⚠️ High memory usage: ${memoryMB.toFixed(2)}MB (threshold: ${this.MEMORY_WARNING_THRESHOLD}MB)`);
        
        // Trigger garbage collection if available and memory is very high
        if (global.gc && memoryMB > this.MEMORY_WARNING_THRESHOLD * 1.5) {
          console.log('🗑️ Triggering garbage collection due to high memory usage');
          global.gc();
        }
      }
      
      // Only log detailed memory info in debug mode
      if (this.DEBUG_MODE && this.VERBOSE_LOGGING) {
        console.log(`📊 Memory Check - Heap: ${memoryMB.toFixed(2)}MB, RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`);
      }

      // Auto-cleanup old records if memory gets too high
      if (memoryMB > this.MEMORY_WARNING_THRESHOLD * 0.8) {
        this.cleanupOldRecords();
      }
    }, this.MEMORY_CHECK_INTERVAL);
  }

  // Add cleanup method
  cleanupOldRecords() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    Object.keys(this.metrics).forEach(type => {
      const originalLength = this.metrics[type].length;
      this.metrics[type] = this.metrics[type].filter(record => record.timestamp > cutoffTime);
      
      if (this.metrics[type].length < originalLength) {
        console.log(`🧹 Cleaned up ${originalLength - this.metrics[type].length} old ${type} records`);
      }
    });
  }

  // Add method to stop monitoring
  stopMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
      console.log('📊 Performance monitoring stopped');
    }
  }

  // Get performance statistics
  getStats(timeframe = 3600000) { // Default: last hour
    const now = Date.now();
    const cutoff = now - timeframe;

    const recentRequests = this.metrics.requests.filter(r => r.timestamp >= cutoff);
    const recentResponses = this.metrics.responses.filter(r => r.timestamp >= cutoff);
    const recentErrors = this.metrics.errors.filter(r => r.timestamp >= cutoff);
    const recentMemory = this.metrics.memory.filter(r => r.timestamp >= cutoff);

    return {
      timeframe: {
        duration: timeframe,
        from: new Date(cutoff).toISOString(),
        to: new Date(now).toISOString()
      },
      requests: {
        total: recentRequests.length,
        averageMessageLength: this.average(recentRequests.map(r => r.messageLength)),
        uniqueUsers: new Set(recentRequests.map(r => r.personalId)).size
      },
      responses: {
        total: recentResponses.length,
        averageResponseTime: this.average(recentResponses.map(r => r.processingTime)),
        averageResponseLength: this.average(recentResponses.map(r => r.responseLength)),
        modelUsage: this.groupBy(recentResponses, 'model')
      },
      errors: {
        total: recentErrors.length,
        errorTypes: this.groupBy(recentErrors, 'error'),
        errorRate: recentErrors.length / Math.max(recentRequests.length, 1) * 100
      },
      memory: {
        current: recentMemory.length > 0 ? recentMemory[recentMemory.length - 1] : null,
        peak: recentMemory.length > 0 ? Math.max(...recentMemory.map(m => m.heapUsed)) : 0,
        average: this.average(recentMemory.map(m => m.heapUsed))
      },
      uptime: now - this.startTime
    };
  }

  // Helper: calculate average
  average(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  // Helper: group by field
  groupBy(array, field) {
    return array.reduce((groups, item) => {
      const key = item[field];
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  // Get real-time metrics
  getRealTimeMetrics() {
    const recent = this.getStats(300000); // Last 5 minutes
    
    return {
      isHealthy: recent.errors.errorRate < 5, // Less than 5% error rate
      responseTime: recent.responses.averageResponseTime,
      memoryUsage: recent.memory.current,
      requestRate: recent.requests.total / 5, // Per minute
      timestamp: new Date().toISOString()
    };
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      summary: this.getStats(),
      raw: {
        requests: this.metrics.requests.slice(-100), // Last 100
        responses: this.metrics.responses.slice(-100),
        errors: this.metrics.errors.slice(-50),
        memory: this.metrics.memory.slice(-20)
      },
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = new PerformanceMonitor();

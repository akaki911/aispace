
// AI System Performance Monitor
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      averageResponseTime: 0,
      errors: 0,
      memoryUsage: []
    };
    
    // Configurable settings
    this.LOG_INTERVAL_MS = parseInt(process.env.PERFORMANCE_LOG_INTERVAL_MS) || 60000; // Default 60 seconds
    this.DEBUG_MODE = process.env.DEBUG_MODE === 'true';
    this.VERBOSE_LOGGING = process.env.VERBOSE_PERFORMANCE_LOGS === 'true';
    
    console.log(`📊 Performance Monitor initialized - Debug: ${this.DEBUG_MODE}, Interval: ${this.LOG_INTERVAL_MS}ms`);
  }

  startRequest(requestId) {
    return {
      id: requestId,
      startTime: Date.now(),
      memoryBefore: process.memoryUsage()
    };
  }

  endRequest(requestData, success = true) {
    const endTime = Date.now();
    const duration = endTime - requestData.startTime;
    const memoryAfter = process.memoryUsage();

    this.metrics.requests++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.requests - 1) + duration) / this.metrics.requests;

    if (!success) {
      this.metrics.errors++;
    }

    // Only log detailed performance metrics in debug mode or for errors
    if (this.DEBUG_MODE || this.VERBOSE_LOGGING || !success) {
      console.log(`⚡ AI Performance - Request ${requestData.id}:`, {
        duration: `${duration}ms`,
        memoryUsed: `${Math.round((memoryAfter.heapUsed - requestData.memoryBefore.heapUsed) / 1024 / 1024)}MB`,
        success,
        totalRequests: this.metrics.requests,
        averageTime: `${Math.round(this.metrics.averageResponseTime)}ms`,
        errorRate: `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%`
      });
    }

    return {
      duration,
      memoryDelta: memoryAfter.heapUsed - requestData.memoryBefore.heapUsed,
      success
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: (this.metrics.errors / this.metrics.requests) * 100,
      currentMemory: process.memoryUsage()
    };
  }

  // Method to log summary metrics periodically
  startPeriodicLogging() {
    if (this.DEBUG_MODE || this.VERBOSE_LOGGING) {
      setInterval(() => {
        const metrics = this.getMetrics();
        const memoryMB = Math.round(metrics.currentMemory.heapUsed / 1024 / 1024);
        
        console.log(`📊 Performance Summary - Requests: ${metrics.requests}, Avg Response: ${Math.round(metrics.averageResponseTime)}ms, Memory: ${memoryMB}MB, Errors: ${metrics.errors}`);
      }, this.LOG_INTERVAL_MS);
    }
  }

  // Method to force log current metrics (for debugging)
  logCurrentMetrics() {
    const metrics = this.getMetrics();
    const memoryMB = Math.round(metrics.currentMemory.heapUsed / 1024 / 1024);
    
    console.log(`📊 Current Performance Metrics:`, {
      totalRequests: metrics.requests,
      averageResponseTime: `${Math.round(metrics.averageResponseTime)}ms`,
      memoryUsage: `${memoryMB}MB`,
      errorRate: `${metrics.errorRate.toFixed(2)}%`,
      timestamp: new Date().toISOString()
    });
  }
}

const performanceMonitor = new PerformanceMonitor();

// Start periodic logging if enabled
performanceMonitor.startPeriodicLogging();

module.exports = performanceMonitor;

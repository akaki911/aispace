class PerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requests = 0;
    this.errors = 0;
    this.responseTimes = [];
    this.maxResponseTimes = 1000; // Keep last 1000 response times
    this.isRunning = false;
    this.intervalId = null;
  }

  // Start monitoring with periodic cleanup
  start() {
    if (this.isRunning) return;

    this.isRunning = true;

    // Start periodic cleanup every hour
    this.intervalId = setInterval(() => {
      this.performMaintenance();
    }, 60 * 60 * 1000); // 1 hour

    console.log('📊 Performance Monitor started with automatic maintenance');
  }

  // Add maintenance method
  performMaintenance() {
    const beforeCount = this.responseTimes.length;

    // Keep only last 500 response times if we have too many
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes = this.responseTimes.slice(-500);
    }

    // Force garbage collection if available
    if (global.gc && this.responseTimes.length > 800) {
      global.gc();
    }

    const afterCount = this.responseTimes.length;
    if (beforeCount !== afterCount) {
      console.debug(`🧹 Performance Monitor: Cleaned up ${beforeCount - afterCount} old response times`);
    }
  }

  // Stop monitoring
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.info('📊 Performance Monitor stopped');
  }

  // Record a request
  recordRequest(responseTime = 0, isError = false) {
    this.requests++;

    if (isError) {
      this.errors++;
    }

    if (responseTime > 0) {
      this.responseTimes.push(responseTime);

      // Keep only the most recent response times
      if (this.responseTimes.length > this.maxResponseTimes) {
        this.responseTimes = this.responseTimes.slice(-this.maxResponseTimes);
      }
    }
  }

  // Get real-time metrics
  getRealTimeMetrics() {
    const uptime = Date.now() - this.startTime;
    const memUsage = process.memoryUsage();

    return {
      uptime: uptime,
      requests: this.requests,
      errors: this.errors,
      errorRate: this.requests > 0 ? (this.errors / this.requests) * 100 : 0,
      averageResponseTime: this.getAverageResponseTime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
      },
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString()
    };
  }

  // Get statistics
  getStats(timeframe = 3600000) { // Default 1 hour
    const metrics = this.getRealTimeMetrics();

    return {
      summary: {
        totalRequests: this.requests,
        totalErrors: this.errors,
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.averageResponseTime,
        uptime: metrics.uptime
      },
      memory: metrics.memory,
      cpu: metrics.cpu,
      responseTimeDistribution: this.getResponseTimeDistribution(),
      timestamp: metrics.timestamp
    };
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      performance: this.getStats(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      exportedAt: new Date().toISOString()
    };
  }

  // Get average response time
  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return 0;

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.responseTimes.length * 100) / 100;
  }

  // Get response time distribution
  getResponseTimeDistribution() {
    if (this.responseTimes.length === 0) {
      return { fast: 0, medium: 0, slow: 0 };
    }

    const fast = this.responseTimes.filter(t => t < 200).length;
    const medium = this.responseTimes.filter(t => t >= 200 && t < 1000).length;
    const slow = this.responseTimes.filter(t => t >= 1000).length;

    return {
      fast: Math.round(fast / this.responseTimes.length * 100),
      medium: Math.round(medium / this.responseTimes.length * 100),
      slow: Math.round(slow / this.responseTimes.length * 100)
    };
  }

  getPercentileResponseTime(percentile = 95) {
    if (this.responseTimes.length === 0) {
      return 0;
    }

    const clamped = Math.min(Math.max(percentile, 0), 100);
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((clamped / 100) * sorted.length) - 1));
    return Math.round(sorted[index] * 100) / 100;
  }

  // Start periodic logging
  startPeriodicLogging() {
    if (process.env.NODE_ENV === 'development') {
      console.debug('📊 Performance monitoring enabled in development mode');
    }
  }

  // Log current metrics (for debugging)
  logCurrentMetrics() {
    const metrics = this.getRealTimeMetrics();

    console.log('📊 Current Performance Metrics:', {
      requests: metrics.requests,
      errors: metrics.errors,
      errorRate: `${metrics.errorRate.toFixed(2)}%`,
      avgResponseTime: `${metrics.averageResponseTime}ms`,
      memoryMB: `${metrics.memory.heapUsed}MB`,
      uptime: `${Math.round(metrics.uptime / 1000)}s`
    });
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-start monitoring
performanceMonitor.start();

module.exports = performanceMonitor;
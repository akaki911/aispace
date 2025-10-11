
// AI System Performance Monitor
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      averageResponseTime: 0,
      errors: 0,
      memoryUsage: []
    };
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

    // Log performance metrics
    console.log(`⚡ AI Performance - Request ${requestData.id}:`, {
      duration: `${duration}ms`,
      memoryUsed: `${Math.round((memoryAfter.heapUsed - requestData.memoryBefore.heapUsed) / 1024 / 1024)}MB`,
      success,
      totalRequests: this.metrics.requests,
      averageTime: `${Math.round(this.metrics.averageResponseTime)}ms`,
      errorRate: `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%`
    });

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
}

module.exports = new PerformanceMonitor();

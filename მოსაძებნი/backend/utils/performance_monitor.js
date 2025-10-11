
// AI System Performance Monitor
const MAX_MEMORY_SAMPLES = 50;

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      errors: 0,
      memoryUsage: [],
      peakMemoryDelta: 0,
      lastRequest: null
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

    this.metrics.requests += 1;
    this.metrics.totalResponseTime += duration;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requests;

    if (!success) {
      this.metrics.errors += 1;
    }

    const memoryDelta = Math.max(0, memoryAfter.heapUsed - requestData.memoryBefore.heapUsed);
    this.metrics.memoryUsage.push({
      timestamp: endTime,
      memoryDelta
    });
    if (this.metrics.memoryUsage.length > MAX_MEMORY_SAMPLES) {
      this.metrics.memoryUsage.shift();
    }
    this.metrics.peakMemoryDelta = Math.max(this.metrics.peakMemoryDelta, memoryDelta);
    this.metrics.lastRequest = {
      id: requestData.id,
      duration,
      success,
      memoryDelta
    };

    // Log performance metrics
    console.log(`⚡ AI Performance - Request ${requestData.id}:`, {
      duration: `${duration}ms`,
      memoryUsed: `${Math.round(memoryDelta / 1024 / 1024)}MB`,
      success,
      totalRequests: this.metrics.requests,
      averageTime: `${Math.round(this.metrics.averageResponseTime)}ms`,
      errorRate: `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%`
    });

    return {
      duration,
      memoryDelta,
      success
    };
  }

  getMetrics() {
    const { requests, errors } = this.metrics;
    const errorRate = requests === 0 ? 0 : (errors / requests) * 100;

    return {
      ...this.metrics,
      errorRate,
      currentMemory: process.memoryUsage()
    };
  }
}

module.exports = new PerformanceMonitor();

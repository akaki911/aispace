
const os = require('os');
const cluster = require('cluster');

class ResourceOptimizer {
  constructor() {
    this.cpuCount = os.cpus().length;
    this.memoryThreshold = 0.85; // 85% memory threshold
    this.cpuThreshold = 0.80; // 80% CPU threshold
    this.resourceMetrics = {
      cpu: [],
      memory: [],
      requests: []
    };
    
    this.startResourceMonitoring();
    console.log(`⚡ Resource Optimizer initialized for ${this.cpuCount} CPU cores`);
  }

  startResourceMonitoring() {
    // Monitor every 10 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 10000);

    // Cleanup old metrics every minute
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000);
  }

  collectResourceMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    
    const memoryUtilization = (memTotal - memFree) / memTotal;
    const timestamp = Date.now();

    this.resourceMetrics.memory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      systemMemory: memoryUtilization
    });

    this.resourceMetrics.cpu.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system,
      utilization: this.calculateCpuUtilization()
    });

    // Warning for high resource usage
    if (memoryUtilization > this.memoryThreshold) {
      console.warn(`⚠️ High memory usage: ${(memoryUtilization * 100).toFixed(1)}%`);
      this.triggerMemoryOptimization();
    }
  }

  calculateCpuUtilization() {
    const loadAvg = os.loadavg();
    return loadAvg[0] / this.cpuCount; // 1-minute load average
  }

  triggerMemoryOptimization() {
    console.log('🧹 Triggering memory optimization...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 Forced garbage collection completed');
    }

    // Clear old cached responses (older than 30 minutes)
    try {
      const cacheService = require('./ai_cache_service');
      cacheService.clearOldCache(30 * 60 * 1000); // 30 minutes
      console.log('🧹 Old cache entries cleared');
    } catch (error) {
      console.warn('🧹 Cache cleanup failed:', error.message);
    }
  }

  // Optimize request processing based on current load
  getOptimalProcessingStrategy() {
    const currentMemory = this.getCurrentMemoryUsage();
    const currentCpu = this.getCurrentCpuUsage();
    
    if (currentMemory > this.memoryThreshold || currentCpu > this.cpuThreshold) {
      return {
        strategy: 'conservative',
        maxConcurrentRequests: 2,
        useConnectionPooling: true,
        enableStreaming: true,
        cacheAggressive: true,
        reason: 'High resource usage detected'
      };
    }
    
    if (currentMemory < 0.5 && currentCpu < 0.5) {
      return {
        strategy: 'aggressive',
        maxConcurrentRequests: 5,
        useConnectionPooling: true,
        enableStreaming: true,
        cacheAggressive: false,
        reason: 'Low resource usage - can handle more load'
      };
    }
    
    return {
      strategy: 'balanced',
      maxConcurrentRequests: 3,
      useConnectionPooling: true,
      enableStreaming: true,
      cacheAggressive: false,
      reason: 'Normal resource usage'
    };
  }

  getCurrentMemoryUsage() {
    const recent = this.resourceMetrics.memory.slice(-5);
    if (recent.length === 0) return 0;
    
    const avgSystemMemory = recent.reduce((sum, m) => sum + m.systemMemory, 0) / recent.length;
    return avgSystemMemory;
  }

  getCurrentCpuUsage() {
    const recent = this.resourceMetrics.cpu.slice(-5);
    if (recent.length === 0) return 0;
    
    const avgCpuUtilization = recent.reduce((sum, c) => sum + c.utilization, 0) / recent.length;
    return avgCpuUtilization;
  }

  // Enable cluster mode for better CPU utilization
  enableClusterMode() {
    if (cluster.isMaster && this.cpuCount > 1) {
      console.log(`⚡ Starting ${this.cpuCount} workers for optimal CPU usage`);
      
      for (let i = 0; i < this.cpuCount; i++) {
        cluster.fork();
      }
      
      cluster.on('exit', (worker, code, signal) => {
        console.log(`⚡ Worker ${worker.process.pid} died, restarting...`);
        cluster.fork();
      });
      
      return true;
    }
    return false;
  }

  // Process requests in batches to optimize resource usage
  async optimizeBatchProcessing(requests, processor) {
    const strategy = this.getOptimalProcessingStrategy();
    const batchSize = strategy.maxConcurrentRequests;
    
    console.log(`⚡ Processing ${requests.length} requests with ${strategy.strategy} strategy (batch size: ${batchSize})`);
    
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchStartTime = Date.now();
      const batchResults = await Promise.allSettled(
        batch.map(request => processor(request))
      );
      const batchLatency = Date.now() - batchStartTime;
      
      results.push(...batchResults);
      
      // Log batch performance
      console.log(`⚡ Batch ${Math.floor(i/batchSize) + 1} completed in ${batchLatency}ms`);
      
      // Add small delay between batches if resources are strained
      if (strategy.strategy === 'conservative' && i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - (10 * 60 * 1000); // Keep last 10 minutes
    
    this.resourceMetrics.memory = this.resourceMetrics.memory.filter(m => m.timestamp > cutoff);
    this.resourceMetrics.cpu = this.resourceMetrics.cpu.filter(c => c.timestamp > cutoff);
    this.resourceMetrics.requests = this.resourceMetrics.requests.filter(r => r.timestamp > cutoff);
  }

  // Get resource optimization recommendations
  getOptimizationRecommendations() {
    const strategy = this.getOptimalProcessingStrategy();
    const memUsage = this.getCurrentMemoryUsage();
    const cpuUsage = this.getCurrentCpuUsage();
    
    const recommendations = [];
    
    if (memUsage > 0.8) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        action: 'Increase cache cleanup frequency',
        reason: `Memory usage at ${(memUsage * 100).toFixed(1)}%`
      });
    }
    
    if (cpuUsage > 0.8) {
      recommendations.push({
        type: 'cpu',
        priority: 'high', 
        action: 'Reduce concurrent request processing',
        reason: `CPU usage at ${(cpuUsage * 100).toFixed(1)}%`
      });
    }
    
    if (this.cpuCount > 1 && !cluster.isWorker) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        action: 'Consider enabling cluster mode',
        reason: `${this.cpuCount} cores available but not clustered`
      });
    }
    
    return {
      currentStrategy: strategy,
      resourceUsage: {
        memory: memUsage,
        cpu: cpuUsage,
        cores: this.cpuCount
      },
      recommendations
    };
  }

  getResourceStats() {
    return {
      memory: this.resourceMetrics.memory.slice(-10),
      cpu: this.resourceMetrics.cpu.slice(-10),
      currentStrategy: this.getOptimalProcessingStrategy(),
      systemInfo: {
        cpuCount: this.cpuCount,
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      }
    };
  }
}

module.exports = new ResourceOptimizer();

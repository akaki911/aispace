const os = require('os');
const cluster = require('cluster');

class ResourceOptimizer {
  constructor() {
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      loadAverage: 0,
      timestamp: Date.now()
    };

    // Configurable parameters
    this.config = {
      cpuThreshold: 80, // CPU threshold percentage
      memoryThreshold: 85, // Memory threshold percentage
      monitorInterval: 5000, // Monitor every 5 seconds
      batchSize: 100, // Request batch size
      cleanupThreshold: 90, // Cache cleanup threshold
      maxWorkers: os.cpus().length
    };

    this.cache = new Map();
    this.requestQueue = [];
    this.isClusterEnabled = false;
    this.monitoringInterval = null;

    this.startMonitoring();
    console.log('📊 Resource Optimizer initialized');
  }

  // Start system monitoring
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.optimizeResources();
    }, this.config.monitorInterval);
  }

  // Calculate momentaneous CPU usage instead of relying on os.loadavg()
  async calculateCPUUsage() {
    const startTime = process.hrtime();
    const startUsage = process.cpuUsage();

    // Wait a short period to measure
    await new Promise(resolve => setTimeout(resolve, 100));

    const endTime = process.hrtime(startTime);
    const endUsage = process.cpuUsage(startUsage);

    // Calculate CPU usage percentage
    const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
    const totalCPUTime = endUsage.user + endUsage.system; // microseconds

    return Math.min(100, (totalCPUTime / totalTime) * 100);
  }

  // Update system metrics
  async updateMetrics() {
    try {
      // Calculate real-time CPU usage
      this.metrics.cpuUsage = await this.calculateCPUUsage();

      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      this.metrics.memoryUsage = (memUsage.heapUsed / totalMemory) * 100;

      // Load average (backup metric)
      this.metrics.loadAverage = os.loadavg()[0];
      this.metrics.timestamp = Date.now();

      console.log(`📊 Metrics - CPU: ${this.metrics.cpuUsage.toFixed(2)}%, Memory: ${this.metrics.memoryUsage.toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Error updating metrics:', error.message);
    }
  }

  // Optimize resources based on current metrics
  optimizeResources() {
    const { cpuUsage, memoryUsage } = this.metrics;

    // Handle high CPU usage
    if (cpuUsage > this.config.cpuThreshold) {
      console.log(`⚠️ High CPU usage detected: ${cpuUsage.toFixed(2)}%`);
      this.handleHighCPU();
    }

    // Handle high memory usage
    if (memoryUsage > this.config.memoryThreshold) {
      console.log(`⚠️ High memory usage detected: ${memoryUsage.toFixed(2)}%`);
      this.cleanupCache();
    }

    // Auto-scale based on thresholds
    if (cpuUsage > this.config.cpuThreshold && !this.isClusterEnabled) {
      this.enableClusterMode();
    }
  }

  // Handle high CPU usage
  handleHighCPU() {
    // Use CPU thresholds for request balancing
    if (this.requestQueue.length > 0) {
      // Process requests in smaller batches
      const reducedBatchSize = Math.max(1, Math.floor(this.config.batchSize / 2));
      console.log(`🔄 Reducing batch size to ${reducedBatchSize} due to high CPU`);

      // Process reduced batch
      const batch = this.requestQueue.splice(0, reducedBatchSize);
      this.processBatch(batch);
    }
  }

  // Process request batch
  processBatch(batch) {
    batch.forEach((request, index) => {
      setTimeout(() => {
        this.processRequest(request);
      }, index * 10); // Stagger requests by 10ms
    });
  }

  // Process individual request
  processRequest(request) {
    // Placeholder for request processing logic
    console.log(`🔄 Processing request: ${request.id}`);
  }

  // Enable cluster mode (only once)
  enableClusterMode() {
    if (this.isClusterEnabled || cluster.isWorker) {
      return; // Already enabled or we're in a worker
    }

    console.log('🚀 Enabling cluster mode for better performance');
    this.isClusterEnabled = true;

    const numWorkers = Math.min(this.config.maxWorkers, os.cpus().length);

    if (cluster.isMaster) {
      console.log(`🚀 Master process starting ${numWorkers} workers`);

      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`👷 Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
      });
    }
  }

  // Clean up cache when memory is high
  cleanupCache() {
    const cacheSize = this.cache.size;
    if (cacheSize === 0) return;

    console.log(`🧹 Cleaning up cache (${cacheSize} items)`);

    // Remove oldest 25% of cache entries
    const entriesToRemove = Math.floor(cacheSize * 0.25);
    const entries = Array.from(this.cache.entries());

    // Sort by timestamp (assuming cache values have timestamp)
    entries.sort((a, b) => {
      const aTime = a[1].timestamp || 0;
      const bTime = b[1].timestamp || 0;
      return aTime - bTime;
    });

    // Remove oldest entries
    for (let i = 0; i < entriesToRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`🧹 Removed ${entriesToRemove} cache entries`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 Forced garbage collection');
    }
  }

  // Configure optimizer parameters
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Resource optimizer configured:', this.config);

    // Restart monitoring with new interval
    this.startMonitoring();
  }

  // Add request to queue
  addRequest(request) {
    this.requestQueue.push({
      id: request.id || Date.now(),
      timestamp: Date.now(),
      ...request
    });

    // Process queue if not under high load
    if (this.metrics.cpuUsage < this.config.cpuThreshold) {
      this.processQueue();
    }
  }

  // Process request queue
  processQueue() {
    if (this.requestQueue.length === 0) return;

    const batchSize = this.metrics.cpuUsage > this.config.cpuThreshold * 0.8 
      ? Math.floor(this.config.batchSize / 2) 
      : this.config.batchSize;

    const batch = this.requestQueue.splice(0, batchSize);
    this.processBatch(batch);
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.requestQueue.length,
      cacheSize: this.cache.size,
      isClusterEnabled: this.isClusterEnabled,
      config: this.config
    };
  }

  // Get comprehensive resource statistics
  getResourceStats() {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    
    return {
      cpuUsage: this.metrics.cpuUsage,
      memoryUsage: this.metrics.memoryUsage,
      heapUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      loadAverage: this.metrics.loadAverage,
      queueLength: this.requestQueue.length,
      cacheSize: this.cache.size,
      uptime: process.uptime(),
      nodeMemory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      },
      systemMemory: {
        total: Math.round(totalMemory / 1024 / 1024 / 1024), // GB
        free: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
        used: Math.round((totalMemory - os.freemem()) / 1024 / 1024 / 1024) // GB
      },
      timestamp: this.metrics.timestamp
    };
  }

  // Calculate performance grade based on resource usage
  calculatePerformanceGrade(stats) {
    let score = 100;
    
    // CPU penalty
    if (stats.cpuUsage > 80) score -= 30;
    else if (stats.cpuUsage > 60) score -= 15;
    else if (stats.cpuUsage > 40) score -= 5;
    
    // Memory penalty
    if (stats.memoryUsage > 90) score -= 25;
    else if (stats.memoryUsage > 70) score -= 10;
    else if (stats.memoryUsage > 50) score -= 3;
    
    // Heap penalty
    if (stats.heapUsage > 85) score -= 20;
    else if (stats.heapUsage > 70) score -= 8;
    
    // Queue length penalty
    if (stats.queueLength > 100) score -= 15;
    else if (stats.queueLength > 50) score -= 5;
    
    score = Math.max(0, Math.min(100, score));
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  getOptimizationRecommendations() {
    const stats = this.getResourceStats();
    const recommendations = [];

    if (stats.cpuUsage > 80) {
      recommendations.push('High CPU usage detected - consider reducing concurrent operations');
    }

    if (stats.memoryUsage > 90) {
      recommendations.push('High memory usage - consider implementing memory cleanup');
    }

    if (stats.heapUsage > 85) {
      recommendations.push('High heap usage - possible memory leak detected');
    }

    return {
      critical: recommendations.filter(r => r.includes('High')),
      suggestions: recommendations,
      performanceGrade: this.calculatePerformanceGrade(stats)
    };
  }

  getOptimalProcessingStrategy() {
    const stats = this.getResourceStats();

    // Determine optimal processing strategy based on current resource usage
    if (stats.cpuUsage > 70) {
      return {
        strategy: 'reduce_parallelism',
        maxConcurrentOperations: 2,
        priority: 'cpu_optimization'
      };
    }

    if (stats.memoryUsage > 80) {
      return {
        strategy: 'memory_conservation',
        maxConcurrentOperations: 3,
        priority: 'memory_optimization'
      };
    }

    return {
      strategy: 'balanced',
      maxConcurrentOperations: 5,
      priority: 'performance'
    };
  }

  // Stop monitoring
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('📊 Resource monitoring stopped');
  }
}

module.exports = new ResourceOptimizer();
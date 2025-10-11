
const fs = require('fs').promises;
const path = require('path');

class ModelAnalytics {
  constructor() {
    // Dynamic model mapping for easy expansion
    this.modelConfig = new Map([
      ['llama-3.3-70b-versatile', {
        name: 'LLaMA 3.3 70B Versatile',
        category: 'large',
        expectedLatency: 2000,
        maxTokens: 8192
      }],
      ['llama-3.1-8b-instant', {
        name: 'LLaMA 3.1 8B Instant',
        category: 'fast',
        expectedLatency: 800,
        maxTokens: 4096
      }],
      ['mixtral-8x7b-32768', {
        name: 'Mixtral 8x7B',
        category: 'balanced',
        expectedLatency: 1500,
        maxTokens: 32768
      }]
    ]);

    this.analytics = new Map();
    this.reportInterval = 10; // Report every 10 requests
    this.dataFile = path.join(__dirname, '../data/model_analytics.json');
    
    this.initializeAnalytics();
    console.log('📊 Model Analytics initialized with dynamic mapping');
  }

  // Initialize analytics for all configured models
  initializeAnalytics() {
    this.modelConfig.forEach((config, modelId) => {
      this.analytics.set(modelId, {
        requestCount: 0,
        totalLatency: 0,
        errorCount: 0,
        lastUsed: null,
        latencyHistory: [],
        errorHistory: [],
        performance: {
          averageLatency: 0,
          errorRate: 0,
          successRate: 100,
          efficiency: 0
        }
      });
    });
  }

  // Add new model dynamically
  addModel(modelId, config) {
    this.modelConfig.set(modelId, {
      name: config.name || modelId,
      category: config.category || 'unknown',
      expectedLatency: config.expectedLatency || 2000,
      maxTokens: config.maxTokens || 4096
    });

    this.analytics.set(modelId, {
      requestCount: 0,
      totalLatency: 0,
      errorCount: 0,
      lastUsed: null,
      latencyHistory: [],
      errorHistory: [],
      performance: {
        averageLatency: 0,
        errorRate: 0,
        successRate: 100,
        efficiency: 0
      }
    });

    console.log(`🆕 Added new model to analytics: ${config.name}`);
  }

  // Record successful request
  recordRequest(modelId, latency, tokenCount = 0) {
    if (!this.analytics.has(modelId)) {
      console.warn(`⚠️ Unknown model: ${modelId}, adding dynamically`);
      this.addModel(modelId, { name: modelId });
    }

    const stats = this.analytics.get(modelId);
    stats.requestCount++;
    stats.totalLatency += latency;
    stats.lastUsed = new Date().toISOString();
    
    // Keep last 100 latency records
    stats.latencyHistory.push({
      latency,
      tokenCount,
      timestamp: new Date().toISOString()
    });
    
    if (stats.latencyHistory.length > 100) {
      stats.latencyHistory.shift();
    }

    this.updatePerformanceMetrics(modelId);
    this.checkReportingThreshold(modelId);
  }

  // Record error
  recordError(modelId, error, context = {}) {
    if (!this.analytics.has(modelId)) {
      console.warn(`⚠️ Unknown model: ${modelId}, adding dynamically`);
      this.addModel(modelId, { name: modelId });
    }

    const stats = this.analytics.get(modelId);
    stats.errorCount++;
    stats.lastUsed = new Date().toISOString();
    
    // Keep last 50 error records
    stats.errorHistory.push({
      error: error.message || error,
      context,
      timestamp: new Date().toISOString()
    });
    
    if (stats.errorHistory.length > 50) {
      stats.errorHistory.shift();
    }

    this.updatePerformanceMetrics(modelId);
    console.error(`❌ Model ${modelId} error recorded:`, error.message || error);
  }

  // Calculate average latency (extracted as separate function)
  calculateAverageLatency(latencyHistory) {
    if (latencyHistory.length === 0) return 0;
    
    const totalLatency = latencyHistory.reduce((sum, record) => sum + record.latency, 0);
    return Math.round(totalLatency / latencyHistory.length);
  }

  // Update performance metrics
  updatePerformanceMetrics(modelId) {
    const stats = this.analytics.get(modelId);
    const config = this.modelConfig.get(modelId);
    
    // Avoid division by zero
    const totalRequests = stats.requestCount + stats.errorCount;
    if (totalRequests === 0) return;

    // Calculate metrics
    stats.performance.averageLatency = this.calculateAverageLatency(stats.latencyHistory);
    stats.performance.errorRate = Math.round((stats.errorCount / totalRequests) * 100);
    stats.performance.successRate = 100 - stats.performance.errorRate;
    
    // Calculate efficiency (performance vs expected latency)
    if (config && config.expectedLatency > 0) {
      const latencyRatio = stats.performance.averageLatency / config.expectedLatency;
      stats.performance.efficiency = Math.max(0, Math.round((2 - latencyRatio) * 50));
    }
  }

  // Check if reporting threshold is reached
  checkReportingThreshold(modelId) {
    const stats = this.analytics.get(modelId);
    const totalRequests = stats.requestCount + stats.errorCount;
    
    if (totalRequests % this.reportInterval === 0) {
      this.generateModelReport(modelId);
    }
  }

  // Generate report for specific model
  generateModelReport(modelId) {
    const stats = this.analytics.get(modelId);
    const config = this.modelConfig.get(modelId) || { name: modelId };
    
    console.log(`\n📊 Model Report: ${config.name}`);
    console.log(`  📈 Requests: ${stats.requestCount}`);
    console.log(`  ❌ Errors: ${stats.errorCount}`);
    console.log(`  ⚡ Avg Latency: ${stats.performance.averageLatency}ms`);
    console.log(`  📊 Success Rate: ${stats.performance.successRate}%`);
    console.log(`  🎯 Efficiency: ${stats.performance.efficiency}%`);
  }

  // Get analytics for specific model
  getModelAnalytics(modelId) {
    if (!this.analytics.has(modelId)) {
      return null;
    }

    const stats = this.analytics.get(modelId);
    const config = this.modelConfig.get(modelId);
    
    return {
      modelId,
      config,
      stats: {
        ...stats,
        performance: { ...stats.performance }
      }
    };
  }

  // Get comparative analytics for all models
  getComparativeAnalytics() {
    const comparison = [];
    
    this.analytics.forEach((stats, modelId) => {
      const config = this.modelConfig.get(modelId);
      comparison.push({
        modelId,
        name: config?.name || modelId,
        category: config?.category || 'unknown',
        requestCount: stats.requestCount,
        errorCount: stats.errorCount,
        performance: { ...stats.performance },
        lastUsed: stats.lastUsed
      });
    });
    
    // Sort by request count
    return comparison.sort((a, b) => b.requestCount - a.requestCount);
  }

  // Get best performing model by category
  getBestModel(category = null, criteria = 'efficiency') {
    let candidates = [];
    
    this.analytics.forEach((stats, modelId) => {
      const config = this.modelConfig.get(modelId);
      
      if (!category || config?.category === category) {
        candidates.push({
          modelId,
          name: config?.name || modelId,
          category: config?.category || 'unknown',
          score: stats.performance[criteria] || 0,
          requestCount: stats.requestCount
        });
      }
    });
    
    // Filter models with at least some usage
    candidates = candidates.filter(c => c.requestCount > 0);
    
    if (candidates.length === 0) return null;
    
    // Sort by criteria score
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates[0];
  }

  // Save analytics to file
  async saveAnalytics() {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        models: Object.fromEntries(this.analytics),
        config: Object.fromEntries(this.modelConfig)
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
      console.log('💾 Analytics saved to file');
    } catch (error) {
      console.error('❌ Error saving analytics:', error.message);
    }
  }

  // Load analytics from file
  async loadAnalytics() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      
      this.analytics = new Map(Object.entries(parsed.models || {}));
      
      if (parsed.config) {
        this.modelConfig = new Map(Object.entries(parsed.config));
      }
      
      console.log('📂 Analytics loaded from file');
    } catch (error) {
      console.warn('⚠️ Could not load analytics file, starting fresh');
    }
  }

  // Reset analytics for specific model
  resetModelAnalytics(modelId) {
    if (this.analytics.has(modelId)) {
      this.initializeAnalytics();
      console.log(`🔄 Reset analytics for model: ${modelId}`);
    }
  }

  // Get efficiency trends
  getEfficiencyTrends(modelId, period = 24) {
    const stats = this.analytics.get(modelId);
    if (!stats) return null;
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - (period * 60 * 60 * 1000));
    
    const recentRequests = stats.latencyHistory.filter(record => 
      new Date(record.timestamp) > cutoff
    );
    
    if (recentRequests.length === 0) return null;
    
    const avgLatency = this.calculateAverageLatency(recentRequests);
    const config = this.modelConfig.get(modelId);
    
    return {
      period: `${period}h`,
      requestCount: recentRequests.length,
      averageLatency: avgLatency,
      trend: config?.expectedLatency ? 
        (avgLatency < config.expectedLatency ? 'improving' : 'declining') : 
        'unknown'
    };
  }
}

module.exports = new ModelAnalytics();

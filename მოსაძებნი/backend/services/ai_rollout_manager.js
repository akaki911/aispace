
const { aiServiceClient } = require('./ai_client');

class AIRolloutManager {
  constructor() {
    this.instances = {
      blue: {
        url: 'http://127.0.0.1:5001',
        version: 'stable',
        weight: 100
      },
      green: {
        url: 'http://127.0.0.1:5003', // Green instance port
        version: 'canary',
        weight: 0
      },
      canary: {
        url: 'http://127.0.0.1:5004', // Canary instance port
        version: 'experimental',
        weight: 0
      }
    };
    
    this.rolloutConfig = {
      strategy: process.env.AI_ROLLOUT || 'blue',
      percentage: parseInt(process.env.AI_ROLLOUT_PERCENTAGE) || 100,
      userGroups: process.env.AI_ROLLOUT_USER_GROUPS?.split(',') || []
    };
    
    this.metrics = {
      requests: { blue: 0, green: 0, canary: 0 },
      errors: { blue: 0, green: 0, canary: 0 },
      latency: { blue: [], green: [], canary: [] }
    };
  }

  /**
   * Determine which AI instance to use based on rollout strategy
   */
  selectInstance(userId = null, userRole = null) {
    const strategy = this.rolloutConfig.strategy;
    
    // Force specific instance for testing
    if (strategy === 'blue') return 'blue';
    if (strategy === 'green') return 'green';
    if (strategy === 'canary') return 'canary';
    
    // Percentage-based rollout
    if (strategy === 'gradual') {
      const percentage = this.rolloutConfig.percentage;
      const hash = this.getUserHash(userId);
      
      if (hash <= percentage) {
        return 'green';
      }
      return 'blue';
    }
    
    // User group-based rollout
    if (strategy === 'user-groups' && userRole) {
      if (this.rolloutConfig.userGroups.includes(userRole)) {
        return 'green';
      }
      return 'blue';
    }
    
    // Default to blue (stable)
    return 'blue';
  }

  /**
   * Get consistent hash for user (0-100)
   */
  getUserHash(userId) {
    if (!userId) return Math.floor(Math.random() * 100);
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Route AI request to selected instance
   */
  async routeRequest(operation, payload, userId = null, userRole = null) {
    const instance = this.selectInstance(userId, userRole);
    const startTime = Date.now();
    
    console.log(`🔄 [AI Rollout] Routing ${operation} to ${instance} (${this.instances[instance].version})`);
    
    try {
      // Update request metrics
      this.metrics.requests[instance]++;
      
      // Create instance-specific client
      const instanceClient = this.createInstanceClient(instance);
      
      let result;
      switch (operation) {
        case 'chat':
          result = await instanceClient.chat(payload);
          break;
        case 'getModels':
          result = await instanceClient.getModels();
          break;
        case 'getProposals':
          result = await instanceClient.getProposals(payload);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      // Record latency
      const latency = Date.now() - startTime;
      this.metrics.latency[instance].push(latency);
      
      // Keep only last 100 latency measurements
      if (this.metrics.latency[instance].length > 100) {
        this.metrics.latency[instance].shift();
      }
      
      console.log(`✅ [AI Rollout] ${operation} completed via ${instance} in ${latency}ms`);
      
      return {
        ...result,
        _rollout: {
          instance,
          version: this.instances[instance].version,
          latency
        }
      };
      
    } catch (error) {
      this.metrics.errors[instance]++;
      console.error(`❌ [AI Rollout] ${operation} failed on ${instance}:`, error.message);
      
      // Check if it's a connection error (service down)
      const isConnectionError = error.code === 'ECONNREFUSED' || 
                               error.message.includes('ECONNREFUSED') ||
                               error.message.includes('connect ECONNREFUSED');
      
      // Fallback to blue if other instance fails AND it's not already blue
      if (instance !== 'blue' && isConnectionError) {
        console.log(`🔄 [AI Rollout] Connection failed, falling back to blue instance`);
        try {
          return await this.routeRequest(operation, payload, userId, 'blue');
        } catch (fallbackError) {
          console.error(`❌ [AI Rollout] Fallback to blue also failed:`, fallbackError.message);
          // Return proper error response instead of throwing
          return {
            success: false,
            error: 'AI_SERVICE_UNAVAILABLE',
            message: 'All AI service instances are currently unavailable',
            timestamp: new Date().toISOString(),
            details: {
              primary: error.message,
              fallback: fallbackError.message
            }
          };
        }
      }
      
      // For non-connection errors or blue instance failures, return structured error
      return {
        success: false,
        error: 'AI_SERVICE_ERROR',
        message: error.message || 'AI service request failed',
        timestamp: new Date().toISOString(),
        instance,
        operation
      };
    }
  }

  /**
   * Create instance-specific AI client
   */
  createInstanceClient(instance) {
    const instanceConfig = this.instances[instance];
    
    // Create new AI client with instance-specific URL
    const { AIServiceClient } = require('./ai_client');
    return new AIServiceClient({
      baseURL: instanceConfig.url
    });
  }

  /**
   * Update rollout configuration
   */
  updateRollout(strategy, percentage = null, userGroups = null) {
    console.log(`🔧 [AI Rollout] Updating strategy: ${strategy}`);
    
    this.rolloutConfig.strategy = strategy;
    
    if (percentage !== null) {
      this.rolloutConfig.percentage = Math.max(0, Math.min(100, percentage));
    }
    
    if (userGroups) {
      this.rolloutConfig.userGroups = userGroups;
    }
    
    // Update environment variables
    process.env.AI_ROLLOUT = strategy;
    if (percentage !== null) {
      process.env.AI_ROLLOUT_PERCENTAGE = percentage.toString();
    }
    
    console.log(`✅ [AI Rollout] Configuration updated:`, this.rolloutConfig);
  }

  /**
   * Get rollout metrics
   */
  getMetrics() {
    const calculateAverage = (arr) => {
      if (arr.length === 0) return 0;
      return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    };
    
    return {
      config: this.rolloutConfig,
      instances: Object.keys(this.instances).map(key => ({
        name: key,
        ...this.instances[key],
        requests: this.metrics.requests[key],
        errors: this.metrics.errors[key],
        errorRate: this.metrics.requests[key] > 0 
          ? (this.metrics.errors[key] / this.metrics.requests[key] * 100).toFixed(2)
          : 0,
        avgLatency: calculateAverage(this.metrics.latency[key]).toFixed(0)
      })),
      total: {
        requests: Object.values(this.metrics.requests).reduce((sum, val) => sum + val, 0),
        errors: Object.values(this.metrics.errors).reduce((sum, val) => sum + val, 0)
      }
    };
  }

  /**
   * Health check for all instances
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, config] of Object.entries(this.instances)) {
      try {
        const client = this.createInstanceClient(name);
        const start = Date.now();
        await client.healthCheck();
        results[name] = {
          status: 'healthy',
          latency: Date.now() - start,
          version: config.version
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          version: config.version
        };
      }
    }
    
    return results;
  }
}

// Singleton instance
const aiRolloutManager = new AIRolloutManager();

module.exports = aiRolloutManager;

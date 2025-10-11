
const axios = require('axios');

class GroqConnectionManager {
  constructor() {
    this.warmConnections = new Map();
    this.healthCheckInterval = null;
    this.connectionPool = {
      active: 0,
      idle: 0,
      maxConnections: 5,
      warmUpConnections: 2
    };
    
    console.log('🔥 Groq Connection Manager initialized');
    this.startWarmupRoutine();
  }

  // Keep connections warm with periodic health checks
  startWarmupRoutine() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Pre-warm connections every 3 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.maintainWarmConnections();
    }, 180000); // 3 minutes

    // Initial warmup
    setTimeout(() => {
      this.maintainWarmConnections();
    }, 5000); // 5 seconds after startup
  }

  async maintainWarmConnections() {
    if (!process.env.GROQ_API_KEY) {
      console.log('🔥 Skipping warmup - no API key');
      return;
    }

    console.log('🔥 Maintaining warm Groq connections...');
    
    try {
      // Create parallel warmup requests
      const warmupPromises = [];
      
      for (let i = 0; i < this.connectionPool.warmUpConnections; i++) {
        warmupPromises.push(this.createWarmConnection(i));
      }

      const results = await Promise.allSettled(warmupPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`🔥 Warmup completed: ${successful}/${this.connectionPool.warmUpConnections} connections ready`);
      
      // Update connection pool stats
      this.connectionPool.active = successful;
      this.connectionPool.idle = this.connectionPool.warmUpConnections - successful;
      
    } catch (error) {
      console.warn('🔥 Warmup routine error:', error.message);
    }
  }

  async createWarmConnection(connectionId) {
    const connectionKey = `warm_${connectionId}`;
    
    try {
      const client = axios.create({
        baseURL: 'https://api.groq.com/openai/v1',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        // Keep connection alive
        httpAgent: new (require('http').Agent)({ 
          keepAlive: true,
          maxSockets: 2
        }),
        httpsAgent: new (require('https').Agent)({ 
          keepAlive: true,
          maxSockets: 2
        })
      });

      // Lightweight ping to warm up connection
      const pingResponse = await client.post('/chat/completions', {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        temperature: 0.1
      });

      if (pingResponse.data) {
        this.warmConnections.set(connectionKey, {
          client: client,
          lastUsed: Date.now(),
          responseTime: Date.now(),
          isWarm: true
        });
        
        console.log(`🔥 Connection ${connectionId} warmed successfully`);
        return true;
      }
    } catch (error) {
      console.warn(`🔥 Failed to warm connection ${connectionId}:`, error.message);
      return false;
    }
  }

  // Get a warm connection or create new one
  async getOptimalConnection() {
    // Try to get an existing warm connection
    for (const [key, connection] of this.warmConnections.entries()) {
      const age = Date.now() - connection.lastUsed;
      
      // Use connection if it's less than 5 minutes old
      if (age < 300000 && connection.isWarm) {
        connection.lastUsed = Date.now();
        console.log(`🔥 Using warm connection: ${key}`);
        return connection.client;
      }
    }

    // Create new connection if no warm ones available
    console.log('🔥 Creating new connection (no warm available)');
    return this.createFreshConnection();
  }

  createFreshConnection() {
    return axios.create({
      baseURL: 'https://api.groq.com/openai/v1',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      httpAgent: new (require('http').Agent)({ 
        keepAlive: true,
        maxSockets: 3
      }),
      httpsAgent: new (require('https').Agent)({ 
        keepAlive: true,
        maxSockets: 3
      })
    });
  }

  // Batch processing for multiple requests
  async processBatchRequests(requests) {
    console.log(`🔥 Processing batch of ${requests.length} requests`);
    
    const batchPromises = requests.map(async (request, index) => {
      try {
        const connection = await this.getOptimalConnection();
        const startTime = Date.now();
        
        const response = await connection.post('/chat/completions', request.payload);
        const latency = Date.now() - startTime;
        
        return {
          index: index,
          success: true,
          response: response.data,
          latency: latency,
          requestId: request.id
        };
      } catch (error) {
        return {
          index: index,
          success: false,
          error: error.message,
          requestId: request.id
        };
      }
    });

    const results = await Promise.allSettled(batchPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`🔥 Batch completed: ${successful}/${requests.length} successful`);
    
    return results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
  }

  // Get connection pool statistics
  getPoolStats() {
    const warmConnectionsCount = this.warmConnections.size;
    const activeConnections = Array.from(this.warmConnections.values())
      .filter(conn => Date.now() - conn.lastUsed < 60000).length;
    
    return {
      warmConnections: warmConnectionsCount,
      activeConnections: activeConnections,
      poolCapacity: this.connectionPool.maxConnections,
      warmupTarget: this.connectionPool.warmUpConnections,
      isHealthy: warmConnectionsCount >= 1,
      uptime: this.healthCheckInterval ? 'Running' : 'Stopped'
    };
  }

  // Pre-warm specific models
  async preWarmModels(models = ['llama3-8b-8192', 'llama3-70b-8192']) {
    console.log(`🔥 Pre-warming models: ${models.join(', ')}`);
    
    const warmupPromises = models.map(async (model) => {
      try {
        const connection = await this.getOptimalConnection();
        
        await connection.post('/chat/completions', {
          model: model,
          messages: [{ role: 'user', content: 'warmup' }],
          max_tokens: 3,
          temperature: 0.1
        });
        
        console.log(`🔥 Model ${model} pre-warmed`);
        return { model, success: true };
      } catch (error) {
        console.warn(`🔥 Failed to pre-warm ${model}:`, error.message);
        return { model, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(warmupPromises);
    return results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
  }

  // Cleanup connections
  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.warmConnections.clear();
    console.log('🔥 Groq Connection Manager cleaned up');
  }
}

module.exports = new GroqConnectionManager();

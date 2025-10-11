const axios = require('axios');

class GroqConnectionManager {
  constructor() {
    this.connections = new Map();
    this.connectionPool = [];
    this.activeConnections = 0;
    this.maxConnections = 15; // Increased for better throughput
    this.maxPoolSize = 5; // Connection pool size
    this.connectionTimeout = 25000; // Reduced timeout
    this.retryAttempts = 3;
    this.retryDelay = 1000;

    // Circuit breaker implementation
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      lastFailureTime: null,
      successCount: 0,
      halfOpenMaxRequests: 3
    };

    // Resource optimization
    this.resourceLimits = {
      maxConcurrentRequests: 10,
      currentRequests: 0,
      requestQueue: [],
      maxQueueSize: 50
    };

    console.log('🔗 Enhanced Groq Connection Manager initialized with connection pooling');
  }

  // Circuit breaker check
  canMakeRequest() {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'OPEN':
        if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.circuitBreaker.successCount = 0;
          console.log('🔄 Circuit breaker switching to HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return this.circuitBreaker.successCount < this.circuitBreaker.halfOpenMaxRequests;

      case 'CLOSED':
      default:
        return true;
    }
  }

  // Record successful request
  recordSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.successCount++;
      if (this.circuitBreaker.successCount >= this.circuitBreaker.halfOpenMaxRequests) {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failureCount = 0;
        console.log('✅ Circuit breaker reset to CLOSED state');
      }
    } else if (this.circuitBreaker.state === 'CLOSED') {
      this.circuitBreaker.failureCount = Math.max(0, this.circuitBreaker.failureCount - 1);
    }
  }

  // Record failed request
  recordFailure() {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      console.log('⚠️ Circuit breaker opened due to failures');
    }
  }

  // Enhanced connection creation with pooling
  async createConnection() {
    // Check if we can reuse a connection from pool
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop();
      console.log('♻️ Reusing connection from pool');
      return connection;
    }

    // Check circuit breaker
    if (!this.canMakeRequest()) {
      throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
    }

    // Check resource limits
    if (this.resourceLimits.currentRequests >= this.resourceLimits.maxConcurrentRequests) {
      if (this.resourceLimits.requestQueue.length >= this.resourceLimits.maxQueueSize) {
        throw new Error('Request queue is full - system overloaded');
      }

      // Queue the request
      return new Promise((resolve, reject) => {
        this.resourceLimits.requestQueue.push({ resolve, reject });
        setTimeout(() => reject(new Error('Request timeout in queue')), this.connectionTimeout);
      });
    }

    try {
      this.resourceLimits.currentRequests++;

      const connection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
        requestCount: 0
      };

      this.activeConnections++;
      this.connections.set(connection.id, connection);
      this.recordSuccess();

      console.log(`🔗 Created new Groq connection: ${connection.id}`);
      return connection;

    } catch (error) {
      this.recordFailure();
      this.resourceLimits.currentRequests--;
      throw error;
    }
  }

  // Enhanced connection release with pooling
  releaseConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastUsed = Date.now();
    connection.isActive = false;

    // Add to pool if pool is not full
    if (this.connectionPool.length < this.maxPoolSize) {
      this.connectionPool.push(connection);
      console.log(`♻️ Added connection ${connectionId} to pool`);
    } else {
      // Remove from active connections
      this.connections.delete(connectionId);
      this.activeConnections--;
      console.log(`🗑️ Released connection ${connectionId}`);
    }

    this.resourceLimits.currentRequests--;

    // Process queued requests
    if (this.resourceLimits.requestQueue.length > 0) {
      const queued = this.resourceLimits.requestQueue.shift();
      this.createConnection()
        .then(queued.resolve)
        .catch(queued.reject);
    }
  }

  // Connection cleanup with pool management
  cleanupConnections() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    let cleaned = 0;

    // Clean old connections from pool
    this.connectionPool = this.connectionPool.filter(conn => {
      if (now - conn.lastUsed > maxAge) {
        cleaned++;
        return false;
      }
      return true;
    });

    // Clean old active connections
    for (const [id, connection] of this.connections.entries()) {
      if (!connection.isActive && (now - connection.lastUsed > maxAge)) {
        this.connections.delete(id);
        this.activeConnections--;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old connections`);
    }

    return cleaned;
  }

  // Enhanced stats with circuit breaker and pooling info
  getConnectionStats() {
    return {
      activeConnections: this.activeConnections,
      pooledConnections: this.connectionPool.length,
      totalConnections: this.connections.size,
      maxConnections: this.maxConnections,
      connectionTimeout: this.connectionTimeout,
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount,
        failureThreshold: this.circuitBreaker.failureThreshold
      },
      resourceLimits: {
        currentRequests: this.resourceLimits.currentRequests,
        maxConcurrentRequests: this.resourceLimits.maxConcurrentRequests,
        queuedRequests: this.resourceLimits.requestQueue.length,
        maxQueueSize: this.resourceLimits.maxQueueSize
      }
    };
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

      for (let i = 0; i < this.connectionPool.maxPoolSize; i++) {
        warmupPromises.push(this.createWarmConnection(i));
      }

      const results = await Promise.allSettled(warmupPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log(`🔥 Warmup completed: ${successful}/${this.connectionPool.maxPoolSize} connections ready`);

      // Update connection pool stats
      this.activeConnections = successful;
      this.idleConnections = this.connectionPool.maxPoolSize - successful;

    } catch (error) {
      console.warn('🔥 Warmup routine error:', error.message);
    }
  }

  async createWarmConnection(connectionId) {
    try {
      const connection = axios.create({
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
      const pingResponse = await connection.post('/chat/completions', {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        temperature: 0.1
      });

      if (pingResponse.data) {
        const connectionKey = `warm_connection_${connectionId}`;
        this.connections.set(connectionKey, {
          client: connection,
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
    for (const [key, connection] of this.connections.entries()) {
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

    this.connections.clear();
    console.log('🔥 Groq Connection Manager cleaned up');
  }
}

module.exports = new GroqConnectionManager();
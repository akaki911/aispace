const axios = require('axios');
const { createServiceToken, getServiceAuthConfigs } = require('../../shared/serviceToken');
const { generateFallbackResponse } = require('./fallbackResponder');

/**
 * AI Service Client - JavaScript version
 * Communicates with AI Microservice on port 5001
 */

class AIServiceClient {
  constructor(config = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.AI_SERVICE_URL || 'http://localhost:5001',
      timeout: config.timeout || 5000, // 5s timeout as specified
      retries: config.retries || 2, // max 2 retries as specified
      circuitBreakerThreshold: config.circuitBreakerThreshold || 3, // Lower threshold for faster circuit breaking
      circuitBreakerTimeout: config.circuitBreakerTimeout || 30000, // 30s circuit breaker timeout
      maxRetryDelay: config.maxRetryDelay || 8000, // Exponential backoff cap
      initialRetryDelay: config.initialRetryDelay || 1000 // 1s initial delay
    };

    this.serviceToken = null;
    this.tokenExpiry = 0;
    this.serviceAuthConfig = getServiceAuthConfigs()[0] || null;

    if (this.serviceAuthConfig?.isFallback) {
      console.warn('⚠️ [AI Client] Using fallback service auth secret. Configure AI_SERVICE_SHARED_SECRET for production environments.');
    }

    this.circuitBreaker = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    };

    this.serviceUnavailableUntil = 0;

    this.client = axios.create({
      baseURL: `${this.config.baseURL}/v1`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Backend-AI-Client/1.0.0',
        'X-Service-Route': 'backend-to-ai-microservice'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const correlationId = `backend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        config.headers['X-Correlation-ID'] = correlationId;

        await this.ensureValidToken();
        if (this.serviceToken) {
          config.headers['Authorization'] = `Bearer ${this.serviceToken}`;
        }

        console.log(`🔄 [AI Client] ${config.method?.toUpperCase()} ${config.url}`, {
          correlationId,
          timeout: this.config.timeout,
          hasAuth: !!this.serviceToken
        });

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor with enhanced auth error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ [AI Client] Response: ${response.status} ${response.config.url}`, {
          correlationId: response.config.headers['X-Correlation-ID']
        });
        this.onSuccess(); // Reset circuit breaker on success
        return response;
      },
      (error) => {
        const correlationId = error.config?.headers?.['X-Correlation-ID'] || 'unknown';
        const status = error.response?.status;
        
        console.error(`❌ [AI Client] Error: ${error.config?.url}`, {
          correlationId,
          status,
          message: error.message
        });

        // Handle authentication errors specifically
        if (status === 401 || status === 403) {
          console.error('🚫 [AI Client] Authentication failed - token may be invalid or expired');
          // Clear cached token to force regeneration
          this.serviceToken = null;
          this.tokenExpiry = 0;
        }

        const transformedError = this.transformError(error);

        // Circuit breaker logic - auth errors don't trigger circuit breaker
        if (status === 401 || status === 403) {
          // Auth errors are client-side issues, don't open circuit
          console.warn('⚠️ [AI Client] Auth error - not triggering circuit breaker');
        } else if (transformedError.status === 503 || transformedError.code === 'SERVICE_UNAVAILABLE' || 
                   transformedError.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED' || 
                   transformedError.message.includes('timeout')) {
          this.onFailure();
        } else {
          this.onSuccess();
        }

        return Promise.reject(transformedError);
      }
    );
  }

  async chat(request) {
    const correlationId = `chat_${Date.now()}`;

    try {
      console.log('🤖 [AI Client] Chat request started', {
        correlationId,
        hasMessage: !!request.message,
        personalId: request.personalId
      });

      const response = await this.resilientOperation(async () => {
        return await this.client.post('/ai/chat', request);
      }, 'chat');

      const result = response.data;
      console.log('✅ [AI Client] Chat request completed', {
        correlationId,
        success: result.success
      });

      return result;
    } catch (error) {
      console.error('❌ [AI Client] Chat request failed', {
        correlationId,
        error: error.message
      });

      if (this.isServiceUnavailableError(error)) {
        this.scheduleServiceCooldown(error.message || 'chat-error');
        return this.buildChatFallbackResponse(request, error);
      }

      throw error;
    }
  }

  async getModels() {
    try {
      console.log('🔍 [AI Client] Getting models');

      const response = await this.resilientOperation(async () => {
        return await this.client.get('/ai/models');
      }, 'getModels');

      const result = response.data;
      console.log('✅ [AI Client] Models retrieved', {
        modelsCount: result.models?.length || 0
      });

      return result;
    } catch (error) {
      console.error('❌ [AI Client] Failed to get models:', error.message);

      if (this.isServiceUnavailableError(error)) {
        this.scheduleServiceCooldown(error.message || 'models-error');
        return this.buildModelFallbackResponse(error);
      }

      throw error;
    }
  }

  async healthCheck() {
    try {
      console.log('🏥 [AI Client] Health check started');

      const response = await this.resilientOperation(async () => {
        // Ensure health check endpoint is called correctly, adjust path if needed
        return await this.client.get('/health');
      }, 'healthCheck');

      const result = response.data;
      console.log('✅ [AI Client] Health check completed', {
        status: result.status
      });

      return result;
    } catch (error) {
      console.error('❌ [AI Client] Health check failed:', error.message);

      if (this.isServiceUnavailableError(error)) {
        this.scheduleServiceCooldown(error.message || 'health-error');
        return this.buildHealthFallbackResponse(error);
      }

      throw error;
    }
  }

  getExecutionPermission() {
    const now = Date.now();

    if (now < this.serviceUnavailableUntil) {
      return {
        allowed: false,
        reason: 'cooldown',
        waitTime: this.serviceUnavailableUntil - now
      };
    }

    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return { allowed: true };
      case 'OPEN':
        if (now >= this.circuitBreaker.nextAttemptTime) {
          this.circuitBreaker.state = 'HALF_OPEN';
          console.log('🔄 [Circuit Breaker] Moving to HALF_OPEN state');
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'circuit',
          waitTime: this.circuitBreaker.nextAttemptTime - now
        };
      case 'HALF_OPEN':
        return { allowed: true };
      default:
        return {
          allowed: false,
          reason: 'unknown',
          waitTime: this.config.circuitBreakerTimeout
        };
    }
  }

  onSuccess() {
    if (this.circuitBreaker.state !== 'CLOSED') {
      console.log('✅ [Circuit Breaker] Resetting to CLOSED state');
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
    }
  }

  onFailure() {
    const now = Date.now();
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = now;

    if (this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttemptTime = now + this.config.circuitBreakerTimeout;

      console.error(`🔴 [Circuit Breaker] OPEN - ${this.circuitBreaker.failureCount} failures in ${this.config.circuitBreakerTimeout}ms window`);
      console.error(`🔴 [Circuit Breaker] Next attempt allowed at: ${new Date(this.circuitBreaker.nextAttemptTime).toISOString()}`);
    }
  }

  // Record Groq-specific failures
  recordGroqFailure(errorType, statusCode) {
    console.error(`🚨 [Groq Failure] Type: ${errorType}, Status: ${statusCode}`);
    
    // Different handling for different error types
    if (statusCode === 429) {
      // Rate limiting - more aggressive circuit breaking
      this.circuitBreaker.failureCount += 2; // Count rate limits as double failures
      console.warn(`⚠️ [Rate Limit] Counting as double failure due to 429 status`);
    } else if (statusCode >= 500) {
      // Server errors
      this.circuitBreaker.failureCount += 1;
      console.warn(`⚠️ [Server Error] Groq API server error: ${statusCode}`);
    }
    
    this.onFailure();
  }

  async resilientOperation(operation, operationName) {
    // Circuit breaker check
    const permission = this.getExecutionPermission();
    if (!permission.allowed) {
      const waitTime = permission.waitTime || 0;
      let errorMsg;

      if (permission.reason === 'cooldown') {
        errorMsg = `⏳ AI service offline fallback active. Next retry in ${Math.ceil(waitTime / 1000)}s.`;
      } else if (permission.reason === 'circuit') {
        errorMsg = `🔴 Circuit breaker OPEN for ${operationName}. Wait ${Math.ceil(waitTime / 1000)}s (Groq API protection)`;
      } else {
        errorMsg = 'AI service temporarily unavailable';
      }

      console.error(errorMsg);
      const guardError = new Error(errorMsg);
      guardError.status = 503;
      guardError.code = 'SERVICE_UNAVAILABLE';
      throw guardError;
    }

    let lastError;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      try {
        console.log(`🔄 [Groq Client] ${operationName} attempt ${attempt}/${this.config.retries + 1} started`);
        
        // Create timeout promise with Groq-specific timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`GROQ_TIMEOUT: Operation ${operationName} timed out after ${this.config.timeout}ms`));
          }, this.config.timeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        const duration = Date.now() - startTime;

        // Success - reset circuit breaker
        this.onSuccess();
        console.log(`✅ [Groq Client] ${operationName} succeeded in ${duration}ms on attempt ${attempt}`);
        return result;

      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;

        // Log specific error details
        console.error(`❌ [Groq Client] ${operationName} failed (attempt ${attempt}, ${duration}ms):`, {
          error: error.message,
          status: error.response?.status || error.status,
          code: error.code,
          isTimeout: error.message?.includes('GROQ_TIMEOUT')
        });

        // Handle Groq-specific errors
        const status = error.response?.status || error.status;
        if (status === 429) {
          console.warn(`🚨 [Rate Limit] Groq API rate limit hit - attempt ${attempt}`);
          this.recordGroqFailure('RATE_LIMIT', 429);
        } else if (status >= 500) {
          console.warn(`🚨 [Server Error] Groq API server error ${status} - attempt ${attempt}`);
          this.recordGroqFailure('SERVER_ERROR', status);
        } else if (error.message?.includes('GROQ_TIMEOUT')) {
          console.warn(`🚨 [Timeout] Groq API timeout - attempt ${attempt}`);
          this.recordGroqFailure('TIMEOUT', 'TIMEOUT');
        }

        // Don't retry on the last attempt
        if (attempt > this.config.retries) {
          console.error(`💥 [Groq Client] ${operationName} failed after ${this.config.retries + 1} attempts`);
          break;
        }

        // Enhanced exponential backoff with Groq-specific delays
        let baseDelay;
        if (status === 429) {
          // Rate limit: longer delays
          baseDelay = Math.min(this.config.initialRetryDelay * Math.pow(3, attempt - 1), 15000);
        } else {
          // Other errors: standard exponential backoff
          baseDelay = Math.min(this.config.initialRetryDelay * Math.pow(2, attempt - 1), this.config.maxRetryDelay);
        }

        const jitter = Math.random() * 0.2 * baseDelay; // 20% jitter
        const delay = Math.ceil(baseDelay + jitter);

        console.warn(`⏳ [Groq Client] Retrying ${operationName} in ${delay}ms (exponential backoff)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed - record failure in circuit breaker
    const totalDuration = Date.now() - startTime;
    console.error(`💀 [Groq Client] ${operationName} permanently failed after ${totalDuration}ms`);
    
    // Record failure but don't double-count if already recorded
    if (!lastError.message?.includes('Circuit breaker')) {
      this.onFailure();
    }
    
    throw this.enhanceGroqError(lastError, operationName);
  }

  // Enhance Groq errors with helpful hints
  enhanceGroqError(error, operationName) {
    const status = error.response?.status || error.status;
    let enhancedMessage = error.message;
    let hint = '';

    if (status === 429) {
      hint = '💡 Rate limit exceeded. Try reducing request frequency or upgrading Groq plan.';
      enhancedMessage = `GROQ_RATE_LIMIT: ${operationName} rate limited`;
    } else if (status === 401) {
      hint = '💡 Check GROQ_API_KEY environment variable and API key validity.';
      enhancedMessage = `GROQ_AUTH_ERROR: Invalid API key for ${operationName}`;
    } else if (status === 403) {
      hint = '💡 API key lacks necessary permissions for this operation.';
      enhancedMessage = `GROQ_PERMISSION_ERROR: Insufficient permissions for ${operationName}`;
    } else if (status >= 500) {
      hint = '💡 Groq API server issue. Check https://status.groq.com for outages.';
      enhancedMessage = `GROQ_SERVER_ERROR: Server error ${status} for ${operationName}`;
    } else if (error.message?.includes('GROQ_TIMEOUT')) {
      hint = '💡 Request timed out. Try simpler prompts or check network connectivity.';
      enhancedMessage = `GROQ_TIMEOUT: ${operationName} exceeded ${this.config.timeout}ms limit`;
    } else if (error.code === 'ECONNREFUSED') {
      hint = '💡 Cannot connect to AI Service. Check if service is running on correct port.';
      enhancedMessage = `GROQ_CONNECTION_ERROR: AI Service unavailable for ${operationName}`;
    }

    const enhancedError = new Error(`${enhancedMessage}${hint ? ' | ' + hint : ''}`);
    enhancedError.originalError = error;
    enhancedError.status = status;
    enhancedError.hint = hint;
    enhancedError.operationName = operationName;
    
    return enhancedError;
  }

  transformError(error) {
    if (error.response?.data) {
      const errorData = error.response.data;
      const transformedError = new Error(errorData.message || error.message);
      transformedError.status = error.response.status;
      transformedError.code = errorData.error;
      transformedError.correlationId = errorData.correlationId;
      return transformedError;
    }

    if (error.code === 'ECONNREFUSED') {
      const connectionError = new Error('AI Service is not available');
      connectionError.status = 503;
      connectionError.code = 'SERVICE_UNAVAILABLE';
      return connectionError;
    }

    if (error.message && error.message.includes('timeout')) { // Check if error.message exists before calling includes
      const timeoutError = new Error('AI Service request timed out');
      timeoutError.status = 504;
      timeoutError.code = 'TIMEOUT';
      return timeoutError;
    }

    const genericError = new Error(error.message || 'An unexpected error occurred');
    genericError.status = error.response?.status || 500;
    genericError.code = error.code || 'UNEXPECTED_ERROR';
    return genericError;
  }

  isServiceUnavailableError(error) {
    if (!error) {
      return false;
    }

    const message = error.message || '';
    return error.code === 'ECONNREFUSED' ||
      error.code === 'SERVICE_UNAVAILABLE' ||
      error.status === 503 ||
      message.includes('ECONNREFUSED') ||
      message.includes('Circuit breaker') ||
      message.includes('offline fallback');
  }

  scheduleServiceCooldown(reason = 'unknown') {
    const cooldownMs = this.config.circuitBreakerTimeout;
    this.serviceUnavailableUntil = Date.now() + cooldownMs;
    if (this.circuitBreaker.state !== 'OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttemptTime = this.serviceUnavailableUntil;
    }

    console.warn(`⏳ [AI Client] Service marked unavailable (${reason}). Cooldown ${Math.ceil(cooldownMs / 1000)}s`);
  }

  async buildChatFallbackResponse(request, originalError) {
    const prompt = request?.message || '';
    const fallbackMessage = generateFallbackResponse
      ? generateFallbackResponse(prompt)
      : '🤖 AI სერვისი დროებით მიუწვდომელია. გთხოვთ, კიდევ სცადოთ მოგვიანებით.';

    return {
      success: true,
      response: fallbackMessage,
      fallback: true,
      service: 'backend-fallback',
      model: 'offline-fallback',
      timestamp: new Date().toISOString(),
      meta: {
        degraded: true,
        reason: originalError?.message || 'AI service unavailable'
      }
    };
  }

  buildModelFallbackResponse(originalError) {
    const models = [
      {
        id: 'llama-3.1-8b-instant',
        label: 'LLaMA 3.1 8B (სწრაფი)',
        category: 'small',
        description: 'უსწრაფესი მოდელი მარტივი ამოცანებისთვის',
        tokens: '8K context'
      },
      {
        id: 'llama-3.3-70b-versatile',
        label: 'LLaMA 3.3 70B (ძლიერი)',
        category: 'large',
        description: 'ძლიერი მოდელი რთული ამოცანებისთვის',
        tokens: '128K context'
      }
    ];

    return {
      success: true,
      models,
      fallback: true,
      timestamp: new Date().toISOString(),
      service: 'backend-fallback',
      meta: {
        degraded: true,
        reason: originalError?.message || 'AI service unavailable'
      }
    };
  }

  buildHealthFallbackResponse(originalError) {
    return {
      status: 'DEGRADED',
      ok: false,
      service: 'backend-fallback',
      timestamp: new Date().toISOString(),
      degraded: true,
      reason: originalError?.message || 'AI service unavailable'
    };
  }

  // Generate service JWT token with proper error handling
  generateServiceToken(permissions = ['chat', 'models', 'proposals']) {
    try {
      this.serviceAuthConfig = getServiceAuthConfigs()[0] || this.serviceAuthConfig || null;

      const token = createServiceToken({
        svc: 'backend',
        service: 'backend',
        permissions,
        role: 'SYSTEM_BOT'
      });

      const configuredTtlSeconds = (this.serviceAuthConfig && this.serviceAuthConfig.ttlSeconds) || 120;
      const safeTtlSeconds = Math.max(30, configuredTtlSeconds);
      const refreshWindowSeconds = Math.min(10, Math.floor(safeTtlSeconds / 3));
      const refreshDelaySeconds = Math.max(5, safeTtlSeconds - refreshWindowSeconds);

      this.serviceToken = token;
      this.tokenExpiry = Date.now() + refreshDelaySeconds * 1000;

      console.log('🔑 [AI Client] Service token generated successfully', {
        ttlSeconds: safeTtlSeconds,
        refreshInSeconds: refreshDelaySeconds
      });

      return token;
    } catch (error) {
      console.error('❌ [AI Client] Token generation failed:', error.message);
      this.serviceToken = null;
      this.tokenExpiry = 0;
      return null;
    }
  }

  async ensureValidToken() {
    const now = Date.now();

    if (!this.serviceToken || now >= this.tokenExpiry) {
      console.log('🔄 [AI Client] Refreshing service token...');
      this.serviceToken = this.generateServiceToken();
      if (!this.serviceToken) {
        this.tokenExpiry = 0;
      }
    }
  }

  getCircuitBreakerStatus() {
    const now = Date.now();
    const isHealthy = this.circuitBreaker.state === 'CLOSED';
    const healthScore = isHealthy ? 1.0 : Math.max(0, 1 - (this.circuitBreaker.failureCount / this.config.circuitBreakerThreshold));

    return {
      ...this.circuitBreaker,
      healthScore,
      isHealthy,
      nextAttemptIn: this.circuitBreaker.state === 'OPEN' ?
        Math.max(0, this.circuitBreaker.nextAttemptTime - now) : undefined
    };
  }

  async testConnection() {
    try {
      await this.healthCheck();
      console.log('✅ [AI Client] Connection test successful');
      return true;
    } catch (error) {
      console.error('❌ [AI Client] Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
const aiServiceClient = new AIServiceClient();

module.exports = {
  aiServiceClient,
  AIServiceClient
};
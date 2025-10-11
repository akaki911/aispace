import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CorrelationId } from '../../src/utils/correlationId';
import { traceAIServiceCall, aiServiceCallsCounter, logger } from '../middleware/telemetry_middleware';
import type { ServiceAuthConfig } from '../../shared/serviceToken.js';
import { createServiceToken, getServiceAuthConfigs } from '../../shared/serviceToken.js';

/**
 * AI Service Client - Thin layer for Backend to communicate with AI Microservice
 * Only this layer knows about port 5001 - Frontend never calls AI Service directly
 */

interface AIClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  maxRetryDelay?: number;
  initialRetryDelay?: number;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

interface ChatRequest {
  message: string;
  personalId?: string;
  context?: {
    fileContext?: string[];
    projectInfo?: object;
  };
}

interface ChatResponse {
  success: boolean;
  response: string;
  timestamp: string;
  personalId?: string;
  model?: string;
  usage?: {
    tokens: number;
    cost: number;
  };
}

interface AIModel {
  id: string;
  label: string;
  category: 'small' | 'medium' | 'large';
  description: string;
  tokens: string;
  pricing?: {
    input: number;
    output: number;
  };
}

interface ModelsResponse {
  success: boolean;
  models: AIModel[];
  timestamp: string;
}

interface ProposalSummary {
  id: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  risk?: 'low' | 'medium' | 'high';
}

interface ProposalsResponse {
  success: boolean;
  proposals: ProposalSummary[];
  total?: number;
  page?: number;
  timestamp: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies?: {
    groq: boolean;
    firebase: boolean;
    memory: boolean;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: object;
  timestamp: string;
  correlationId?: string;
}

export class AIServiceClient {
  private client: AxiosInstance;
  private config: Required<AIClientConfig>;
  private serviceToken: string | null = null;
  private tokenExpiry: number = 0;
  private circuitBreaker: CircuitBreakerState;
  private serviceAuthConfig: ServiceAuthConfig | null;

  constructor(config: AIClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.AI_SERVICE_URL || 'http://localhost:5001',
      timeout: config.timeout || 5000, // 5s timeout as specified
      retries: config.retries || 2, // max 2 retries as specified  
      circuitBreakerThreshold: config.circuitBreakerThreshold || 3, // Lower threshold for Groq stability
      circuitBreakerTimeout: config.circuitBreakerTimeout || 30000, // 30s circuit breaker timeout
      maxRetryDelay: config.maxRetryDelay || 8000, // Exponential backoff cap
      initialRetryDelay: config.initialRetryDelay || 1000 // 1s initial delay
    };

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

    this.client = axios.create({
      baseURL: `${this.config.baseURL}/v1`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Backend-AI-Client/1.0.0',
        'X-Service-Route': 'backend-to-ai-microservice'
      }
    });

    // Add request interceptor for correlation IDs and authentication
    this.client.interceptors.request.use(
      async (config) => {
        const correlationId = `backend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        config.headers['X-Correlation-ID'] = correlationId;

        // Add service authentication
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

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ [AI Client] Response: ${response.status} ${response.config.url}`, {
          correlationId: response.config.headers['X-Correlation-ID']
        });
        return response;
      },
      (error) => {
        const correlationId = error.config?.headers?.['X-Correlation-ID'] || 'unknown';
        const status = error.response?.status;
        
        console.error(`❌ [AI Client] Error: ${error.config?.url}`, {
          correlationId,
          status,
          message: error.message,
          details: error.response?.data
        });

        // Handle authentication errors specifically
        if (status === 401 || status === 403) {
          console.error('🚫 [AI Client] Authentication failed - token may be invalid or expired');
          // Clear cached token to force regeneration
          this.serviceToken = null;
          this.tokenExpiry = 0;
        }

        // Transform error to consistent format
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * Send chat message to AI Service
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const correlationId = CorrelationId.generate();
    const span = traceAIServiceCall('chat', {
      'ai.personal_id': request.personalId,
      'ai.message_length': request.message?.length || 0,
      'correlation.id': correlationId
    });

    try {
      // Record AI service call metric
      aiServiceCallsCounter.add(1, {
        operation: 'chat',
        personal_id: request.personalId
      });

      logger.info('AI service chat request started', {
        correlationId,
        hasMessage: !!request.message,
        personalId: request.personalId,
        messageLength: request.message?.length || 0
      });

      const response = await this.resilientOperation(async () => {
        return await this.client.post<ChatResponse>('/ai/chat', request, {
          headers: {
            'traceparent': span.spanContext() ?
              `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01` :
              undefined
          }
        });
      }, 'chat');

      span.setAttributes({
        'http.status_code': response.status,
        'http.method': 'POST',
        'http.url': `${this.config.baseURL}/v1/ai/chat`
      });

      // The original code had a check for `response.ok` here which is typical for Node.js `fetch` but not Axios.
      // Axios throws an error for non-2xx status codes by default, so we'll rely on the catch block.
      const result = response.data;
      span.setStatus({ code: 1 });
      span.setAttributes({
        'ai.response_length': result.response?.length || 0,
        'ai.success': result.success
      });

      logger.info('AI service chat request completed', {
        correlationId,
        success: result.success,
        hasResponse: !!result.response,
        responseLength: result.response?.length || 0
      });

      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });

      logger.error('AI service chat request failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get available AI models
   */
  async getModels(): Promise<ModelsResponse> {
    const correlationId = CorrelationId.generate();
    const span = traceAIServiceCall('getModels', { 'correlation.id': correlationId });

    try {
      aiServiceCallsCounter.add(1, { operation: 'getModels' });
      logger.info('AI service getModels request started', { correlationId });

      const response = await this.resilientOperation(async () => {
        return await this.client.get<ModelsResponse>('/ai/models', {
          headers: {
            'traceparent': span.spanContext() ?
              `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01` :
              undefined
          }
        });
      }, 'getModels');

      span.setAttributes({
        'http.status_code': response.status,
        'http.method': 'GET',
        'http.url': `${this.config.baseURL}/v1/ai/models`
      });

      const result = response.data;
      span.setStatus({ code: 1 });
      span.setAttributes({ 'ai.models_count': result.models?.length || 0 });
      logger.info('AI service getModels request completed', { correlationId, modelsCount: result.models?.length || 0 });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      logger.error('AI service getModels request failed', { correlationId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get auto-improve proposals
   */
  async getProposals(params?: {
    status?: string;
    limit?: number;
  }): Promise<ProposalsResponse> {
    const correlationId = CorrelationId.generate();
    const span = traceAIServiceCall('getProposals', { ...params, 'correlation.id': correlationId });

    try {
      aiServiceCallsCounter.add(1, { operation: 'getProposals' });
      logger.info('AI service getProposals request started', { correlationId, params });

      // Using resilientOperation to include circuit breaker and retry logic
      const response = await this.resilientOperation(async () => {
        return await this.client.get<ProposalsResponse>('/ai/proposals', {
          params,
          headers: {
            'traceparent': span.spanContext() ?
              `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01` :
              undefined
          }
        });
      }, 'getProposals');

      span.setAttributes({
        'http.status_code': response.status,
        'http.method': 'GET',
        'http.url': `${this.config.baseURL}/v1/ai/proposals`
      });

      const result = response.data;
      span.setStatus({ code: 1 });
      span.setAttributes({ 'ai.proposals_count': result.proposals?.length || 0 });
      logger.info('AI service getProposals request completed', { correlationId, proposalsCount: result.proposals?.length || 0 });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      logger.error('AI service getProposals request failed', { correlationId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create new auto-improve proposal
   */
  async createProposal(proposal: {
    title: string;
    description: string;
    changes: Array<{
      file: string;
      action: 'create' | 'update' | 'delete';
      content: string;
    }>;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<{ success: boolean; proposal: ProposalSummary; timestamp: string }> {
    const correlationId = CorrelationId.generate();
    const span = traceAIServiceCall('createProposal', { title: proposal.title, 'correlation.id': correlationId });

    try {
      aiServiceCallsCounter.add(1, { operation: 'createProposal' });
      logger.info('AI service createProposal request started', { correlationId, title: proposal.title });

      const response = await this.resilientOperation(async () => {
        return await this.client.post('/ai/proposals', proposal, {
          headers: {
            'traceparent': span.spanContext() ?
              `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01` :
              undefined
          }
        });
      }, 'createProposal');

      span.setAttributes({
        'http.status_code': response.status,
        'http.method': 'POST',
        'http.url': `${this.config.baseURL}/v1/ai/proposals`
      });

      const result = response.data;
      span.setStatus({ code: 1 });
      span.setAttributes({ 'ai.proposal_id': result.proposal.id });
      logger.info('AI service createProposal request completed', { correlationId, proposalId: result.proposal.id });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      logger.error('AI service createProposal request failed', { correlationId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Approve and apply proposal
   */
  async approveProposal(proposalId: string, options?: {
    comment?: string;
    skipTests?: boolean;
  }): Promise<{
    success: boolean;
    proposalId: string;
    status: string;
    appliedFiles: string[];
    rollbackId?: string;
    timestamp: string;
  }> {
    const correlationId = CorrelationId.generate();
    const span = traceAIServiceCall('approveProposal', { proposalId, 'correlation.id': correlationId });

    try {
      aiServiceCallsCounter.add(1, { operation: 'approveProposal' });
      logger.info('AI service approveProposal request started', { correlationId, proposalId });

      const response = await this.resilientOperation(async () => {
        return await this.client.post(`/ai/proposals/${proposalId}/approve`, options, {
          headers: {
            'traceparent': span.spanContext() ?
              `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01` :
              undefined
          }
        });
      }, 'approveProposal');

      span.setAttributes({
        'http.status_code': response.status,
        'http.method': 'POST',
        'http.url': `${this.config.baseURL}/v1/ai/proposals/${proposalId}/approve`
      });

      const result = response.data;
      span.setStatus({ code: 1 });
      span.setAttributes({ 'ai.proposal_status': result.status });
      logger.info('AI service approveProposal request completed', { correlationId, proposalId, status: result.status });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      logger.error('AI service approveProposal request failed', { correlationId, proposalId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Check AI Service health
   */
  async healthCheck(): Promise<HealthResponse> {
    const correlationId = CorrelationId.generate();
    const span = traceAIServiceCall('healthCheck', { 'correlation.id': correlationId });

    try {
      // No metric for health check, but we can log its start
      logger.info('AI service healthCheck request started', { correlationId });

      // Using resilientOperation for health check as well, though retries might be less critical here.
      const response = await this.resilientOperation(async () => {
        return await this.client.get<HealthResponse>(`/health`, {
          headers: {
            'traceparent': span.spanContext() ?
              `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01` :
              undefined
          }
        });
      }, 'healthCheck');

      span.setAttributes({
        'http.status_code': response.status,
        'http.method': 'GET',
        'http.url': `${this.config.baseURL}/health`
      });

      const result = response.data;
      span.setStatus({ code: 1 });
      span.setAttributes({ 'ai.service_status': result.status });
      logger.info('AI service healthCheck request completed', { correlationId, status: result.status });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      logger.error('AI service healthCheck request failed', { correlationId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Circuit breaker check
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (now >= this.circuitBreaker.nextAttemptTime) {
          this.circuitBreaker.state = 'HALF_OPEN';
          console.log('🔄 [Circuit Breaker] Moving to HALF_OPEN state');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return false;
    }
  }

  /**
   * Record circuit breaker success
   */
  private onSuccess(): void {
    if (this.circuitBreaker.state !== 'CLOSED') {
      console.log('✅ [Circuit Breaker] Resetting to CLOSED state');
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
    }
  }

  /**
   * Record circuit breaker failure
   */
  private onFailure(): void {
    const now = Date.now();
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = now;

    if (this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttemptTime = now + this.config.circuitBreakerTimeout;

      console.error(`🔴 [Circuit Breaker] OPEN - ${this.circuitBreaker.failureCount} failures, next attempt in ${this.config.circuitBreakerTimeout}ms`);
    }
  }

  /**
   * Resilient operation with circuit breaker, timeout, and exponential backoff
   */
  private async resilientOperation<T>(
    operation: () => Promise<AxiosResponse<T>>,
    operationName: string
  ): Promise<AxiosResponse<T>> {
    // Circuit breaker check
    if (!this.canExecute()) {
      const waitTime = this.circuitBreaker.nextAttemptTime - Date.now();
      const errorMsg = `🔴 Circuit breaker OPEN for ${operationName}. Wait ${Math.ceil(waitTime/1000)}s (Groq API protection)`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    let lastError: any;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      try {
        console.log(`🔄 [Groq Client TS] ${operationName} attempt ${attempt}/${this.config.retries + 1} started`);
        
        // Create timeout promise with Groq-specific timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`GROQ_TIMEOUT: Operation ${operationName} timed out after ${this.config.timeout}ms`));
          }, this.config.timeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        const duration = Date.now() - startTime;

        // Success - reset circuit breaker
        this.onSuccess();
        console.log(`✅ [Groq Client TS] ${operationName} succeeded in ${duration}ms on attempt ${attempt}`);
        return result;

      } catch (error: any) {
        lastError = error;
        const duration = Date.now() - startTime;

        // Log specific error details
        console.error(`❌ [Groq Client TS] ${operationName} failed (attempt ${attempt}, ${duration}ms):`, {
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
          console.error(`💥 [Groq Client TS] ${operationName} failed after ${this.config.retries + 1} attempts`);
          break;
        }

        // Enhanced exponential backoff with Groq-specific delays
        let baseDelay: number;
        if (status === 429) {
          // Rate limit: longer delays
          baseDelay = Math.min((this.config.initialRetryDelay || 1000) * Math.pow(3, attempt - 1), 15000);
        } else {
          // Other errors: standard exponential backoff
          baseDelay = Math.min((this.config.initialRetryDelay || 1000) * Math.pow(2, attempt - 1), this.config.maxRetryDelay);
        }

        const jitter = Math.random() * 0.2 * baseDelay; // 20% jitter
        const delay = Math.ceil(baseDelay + jitter);

        console.warn(`⏳ [Groq Client TS] Retrying ${operationName} in ${delay}ms (exponential backoff)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed - record failure in circuit breaker
    const totalDuration = Date.now() - startTime;
    console.error(`💀 [Groq Client TS] ${operationName} permanently failed after ${totalDuration}ms`);
    
    // Record failure but don't double-count if already recorded
    if (!lastError.message?.includes('Circuit breaker')) {
      this.onFailure();
    }
    
    throw this.enhanceGroqError(lastError, operationName);
  }

  // Record Groq-specific failures
  private recordGroqFailure(errorType: string, statusCode: number | string): void {
    console.error(`🚨 [Groq Failure TS] Type: ${errorType}, Status: ${statusCode}`);
    
    // Different handling for different error types
    if (statusCode === 429) {
      // Rate limiting - more aggressive circuit breaking
      this.circuitBreaker.failureCount += 2; // Count rate limits as double failures
      console.warn(`⚠️ [Rate Limit] Counting as double failure due to 429 status`);
    } else if (typeof statusCode === 'number' && statusCode >= 500) {
      // Server errors
      this.circuitBreaker.failureCount += 1;
      console.warn(`⚠️ [Server Error] Groq API server error: ${statusCode}`);
    }
    
    this.onFailure();
  }

  // Enhance Groq errors with helpful hints
  private enhanceGroqError(error: any, operationName: string): Error {
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
    (enhancedError as any).originalError = error;
    (enhancedError as any).status = status;
    (enhancedError as any).hint = hint;
    (enhancedError as any).operationName = operationName;
    
    return enhancedError;
  }

  /**
   * Transform axios error to consistent format
   */
  private transformError(error: any): Error {
    if (error.response?.data) {
      const errorData = error.response.data as ErrorResponse;
      const transformedError = new Error(errorData.message || error.message);
      (transformedError as any).status = error.response.status;
      (transformedError as any).code = errorData.error;
      (transformedError as any).correlationId = errorData.correlationId;
      return transformedError;
    }

    if (error.code === 'ECONNREFUSED') {
      const connectionError = new Error('AI Service is not available');
      (connectionError as any).status = 503;
      (connectionError as any).code = 'SERVICE_UNAVAILABLE';
      return connectionError;
    }

    // Handle timeout errors specifically if they weren't caught by Promise.race
    if (error.message.includes('timeout')) {
      const timeoutError = new Error('AI Service request timed out');
      (timeoutError as any).status = 504; // Gateway Timeout
      (timeoutError as any).code = 'TIMEOUT';
      return timeoutError;
    }

    // If it's a generic error, return it as is or with a default status
    const genericError = new Error(error.message || 'An unexpected error occurred');
    (genericError as any).status = error.response?.status || 500;
    (genericError as any).code = error.code || 'UNEXPECTED_ERROR';
    return genericError;
  }

  /**
   * Generate and cache service JWT token
   */
  private async generateServiceToken(permissions: string[] = ['chat', 'models']): Promise<string> {
    try {
      this.serviceAuthConfig = getServiceAuthConfigs()[0] || this.serviceAuthConfig || null;

      const token = createServiceToken({
        svc: 'backend',
        service: 'backend',
        permissions,
        role: 'SYSTEM_BOT'
      });

      const configuredTtlSeconds = this.serviceAuthConfig?.ttlSeconds ?? 120;
      const safeTtlSeconds = Math.max(30, configuredTtlSeconds);
      const refreshWindowSeconds = Math.min(10, Math.floor(safeTtlSeconds / 3));
      const refreshDelaySeconds = Math.max(5, safeTtlSeconds - refreshWindowSeconds);

      this.serviceToken = token;
      this.tokenExpiry = Date.now() + refreshDelaySeconds * 1000;

      console.log('🔑 [AI Client] Service token generated and cached', {
        ttlSeconds: safeTtlSeconds,
        refreshInSeconds: refreshDelaySeconds
      });

      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error('❌ [AI Client] Failed to generate service token:', message);
      this.serviceToken = null;
      this.tokenExpiry = 0;
      return '';
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureValidToken(): Promise<void> {
    const now = Date.now();

    // Generate new token if we don't have one or it's expired
    if (!this.serviceToken || now >= this.tokenExpiry) {
      console.log('🔄 [AI Client] Refreshing service token...');
      await this.generateServiceToken(); // Permissions are defaulted in generateServiceToken
    }
  }

  /**
   * Check if user has SUPER_ADMIN role
   * This is a placeholder and should ideally be replaced with a proper role check from the user's context.
   */
  private isSuperAdmin(personalId?: string): boolean {
    // Replace '01019062020' with the actual SUPER_ADMIN personalId or a more robust role checking mechanism.
    return personalId === '01019062020';
  }

  /**
   * Helper to make requests to the AI service, incorporating resilientOperation.
   * This centralizes the logic for making requests that need resilience.
   */
  private async makeRequest(
    endpoint: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }
  ): Promise<any> {
    const operationName = endpoint.split('/')[0] || 'request'; // Simple way to get an operation name

    const axiosConfig = {
      url: `/v1/${endpoint}`,
      method: options.method,
      headers: {
        ...options.headers,
        'X-Correlation-ID': CorrelationId.generate(), // Ensure correlation ID for each request
        // Traceparent will be added by the interceptor or explicitly if needed
      },
      data: options.body ? JSON.parse(options.body) : undefined, // Axios uses 'data' for request body
      timeout: options.timeout || this.config.timeout, // Use provided timeout or default
    };

    // Ensure we have a valid token before making the request if Authorization header is expected
    if (!axiosConfig.headers?.['Authorization'] && this.serviceToken) {
      axiosConfig.headers['Authorization'] = `Bearer ${this.serviceToken}`;
    }

    const response = await this.resilientOperation(async () => {
      return await this.client(axiosConfig);
    }, operationName);

    return response.data; // Return only the data part of the response
  }

  /**
   * Auto-Improve operations - SUPER_ADMIN only
   */
  async autoImprove(operation: string, data: any, personalId?: string): Promise<any> {
    // RBAC check: Ensure the user making the call has the SUPER_ADMIN role.
    if (!this.isSuperAdmin(personalId)) {
      logger.warn('RBAC Denied: Auto-Improve operation attempted by non-SUPER_ADMIN user', { personalId });
      throw new Error('RBAC_DENIED: Auto-Improve requires SUPER_ADMIN role');
    }

    try {
      logger.info('🤖 [AI CLIENT] Auto-Improve operation started', { operation, personalId });

      // Generate a service token with specific permissions for auto-improve operations.
      const token = await this.generateServiceToken(['chat', 'models', 'auto_improve']);
      if (!token) {
        throw new Error('Failed to generate service token for auto-improve');
      }

      // Construct the request options, including authorization and the specific operation data.
      const requestOptions = {
        method: 'POST', // Assuming auto-improve operations are typically POST requests
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Personal-ID': personalId, // Pass personalId for context/auditing if needed by AI service
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        timeout: this.config.timeout * 2 // Allow a longer timeout for potentially complex auto-improve tasks
      };

      // Use the centralized makeRequest method for resilience.
      const response = await this.makeRequest(`auto-improve/${operation}`, requestOptions);

      logger.info('✅ [AI CLIENT] Auto-Improve operation completed successfully', { operation, personalId });
      return response;

    } catch (error) {
      logger.error('❌ [AI CLIENT] Auto-Improve operation failed', { operation, personalId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Get client configuration
   */
  getConfig(): Readonly<AIClientConfig> {
    // Return a copy to prevent external modification
    return { ...this.config };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerState & {
    healthScore: number;
    isHealthy: boolean;
    nextAttemptIn?: number;
  } {
    const now = Date.now();
    const isHealthy = this.circuitBreaker.state === 'CLOSED';
    // Calculate health score based on failure count relative to threshold
    const healthScore = isHealthy ? 1.0 : Math.max(0, 1 - (this.circuitBreaker.failureCount / this.config.circuitBreakerThreshold));

    return {
      ...this.circuitBreaker,
      healthScore,
      isHealthy,
      // Calculate time until next attempt if the circuit is OPEN
      nextAttemptIn: this.circuitBreaker.state === 'OPEN' ?
        Math.max(0, this.circuitBreaker.nextAttemptTime - now) : undefined
    };
  }

  /**
   * Test connection to AI Service by calling healthCheck
   */
  async testConnection(): Promise<boolean> {
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

// Singleton instance for use across Backend
export const aiServiceClient = new AIServiceClient();

// Export types for use in other Backend modules
export type {
  ChatRequest,
  ChatResponse,
  AIModel,
  ModelsResponse,
  ProposalSummary,
  ProposalsResponse,
  HealthResponse,
  ErrorResponse
};
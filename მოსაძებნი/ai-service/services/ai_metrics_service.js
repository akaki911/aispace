
const client = require('prom-client');

class AIMetricsService {
  constructor() {
    // Create a Registry to register the metrics
    this.register = new client.Registry();
    
    // Add default Node.js metrics
    client.collectDefaultMetrics({ register: this.register });
    
    // AI Service specific metrics
    this.aiRequestsTotal = new client.Counter({
      name: 'ai_requests_total',
      help: 'Total number of AI requests',
      labelNames: ['model', 'operation', 'status', 'user_id'],
      registers: [this.register]
    });
    
    this.aiRequestDuration = new client.Histogram({
      name: 'ai_request_duration_seconds',
      help: 'Duration of AI requests in seconds',
      labelNames: ['model', 'operation'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.register]
    });
    
    this.aiTokensConsumed = new client.Counter({
      name: 'ai_tokens_consumed_total',
      help: 'Total number of tokens consumed',
      labelNames: ['model', 'type'],
      registers: [this.register]
    });
    
    this.aiModelLatency = new client.Histogram({
      name: 'ai_model_latency_seconds',
      help: 'AI model response latency',
      labelNames: ['model'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });
    
    this.aiErrors = new client.Counter({
      name: 'ai_errors_total',
      help: 'Total number of AI errors',
      labelNames: ['error_type', 'model', 'operation'],
      registers: [this.register]
    });
    
    this.aiMemoryOperations = new client.Counter({
      name: 'ai_memory_operations_total',
      help: 'Total number of memory operations',
      labelNames: ['operation', 'user_id'],
      registers: [this.register]
    });
    
    this.aiFileOperations = new client.Counter({
      name: 'ai_file_operations_total',
      help: 'Total number of file operations',
      labelNames: ['operation', 'file_type'],
      registers: [this.register]
    });
    
    // HTTP metrics for AI service
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'status_code', 'route', 'service'],
      registers: [this.register]
    });
    
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'status_code', 'route', 'service'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });
    
    // Initialize tracking variables
    this.serviceName = 'ai-service';
    this.requestCount = 0;
    this.errorCount = 0;
    
    // Start periodic collection
    this.startPeriodicCollection();
  }
  
  // Record AI chat request
  recordAIChatRequest(model, duration, tokens, status = 'success', userId = 'anonymous') {
    this.aiRequestsTotal.inc({ model, operation: 'chat', status, user_id: userId });
    this.aiRequestDuration.observe({ model, operation: 'chat' }, duration / 1000);
    this.aiModelLatency.observe({ model }, duration / 1000);
    
    if (tokens) {
      this.aiTokensConsumed.inc({ model, type: 'input' }, tokens.input || 0);
      this.aiTokensConsumed.inc({ model, type: 'output' }, tokens.output || 0);
    }
    
    if (status === 'error') {
      this.aiErrors.inc({ error_type: 'chat_error', model, operation: 'chat' });
      this.errorCount++;
    }
    
    this.requestCount++;
  }
  
  // Record memory operation
  recordMemoryOperation(operation, userId = 'anonymous') {
    this.aiMemoryOperations.inc({ operation, user_id: userId });
  }
  
  // Record file operation
  recordFileOperation(operation, fileType = 'unknown') {
    this.aiFileOperations.inc({ operation, file_type: fileType });
  }
  
  // Record HTTP request
  recordHttpRequest(req, res, duration) {
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    const service = this.serviceName;
    
    this.httpRequestsTotal.inc({ method, status_code: statusCode, route, service });
    this.httpRequestDuration.observe({ method, status_code: statusCode, route, service }, duration / 1000);
    
    if (res.statusCode >= 400) {
      this.errorCount++;
    }
  }
  
  // Record AI error
  recordAIError(errorType, model = 'unknown', operation = 'unknown') {
    this.aiErrors.inc({ error_type: errorType, model, operation });
    this.errorCount++;
  }
  
  // Get metrics summary
  getMetricsSummary() {
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%' : '0%'
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      uptime: Math.round(process.uptime()),
      ai_specific: {
        models_active: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
        avg_tokens_per_request: 'calculated_from_counters',
        p95_model_latency: 'calculated_from_histogram'
      }
    };
  }
  
  // Start periodic collection
  startPeriodicCollection() {
    setInterval(() => {
      // Update system metrics
      const memUsage = process.memoryUsage();
      
      // Log periodic metrics
      const systemLog = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'ai-service',
        event: 'system_metrics',
        memory_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        requests_total: this.requestCount,
        errors_total: this.errorCount,
        uptime_seconds: Math.round(process.uptime())
      };
      
      console.log(JSON.stringify(systemLog));
      
    }, 30000); // Every 30 seconds
  }
  
  // Get Prometheus metrics
  async getPrometheusMetrics() {
    return await this.register.metrics();
  }
}

module.exports = new AIMetricsService();

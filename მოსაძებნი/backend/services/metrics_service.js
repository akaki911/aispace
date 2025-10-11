
const client = require('prom-client');

class MetricsService {
  constructor() {
    // Create a Registry to register the metrics
    this.register = new client.Registry();
    
    // Add default Node.js metrics
    client.collectDefaultMetrics({ register: this.register });
    
    // Custom metrics
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
    
    this.httpRequestSizeBytes = new client.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route', 'service'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register]
    });
    
    this.httpResponseSizeBytes = new client.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'status_code', 'route', 'service'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register]
    });
    
    this.activeConnections = new client.Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      labelNames: ['service'],
      registers: [this.register]
    });
    
    this.errorRate = new client.Counter({
      name: 'http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'status_code', 'route', 'error_type', 'service'],
      registers: [this.register]
    });
    
    // AI Service specific metrics
    this.aiRequestsTotal = new client.Counter({
      name: 'ai_requests_total',
      help: 'Total number of AI service requests',
      labelNames: ['model', 'operation', 'status'],
      registers: [this.register]
    });
    
    this.aiRequestDuration = new client.Histogram({
      name: 'ai_request_duration_seconds',
      help: 'Duration of AI requests in seconds',
      labelNames: ['model', 'operation'],
      buckets: [1, 5, 10, 30, 60, 120],
      registers: [this.register]
    });
    
    this.aiTokensConsumed = new client.Counter({
      name: 'ai_tokens_consumed_total',
      help: 'Total number of AI tokens consumed',
      labelNames: ['model', 'type'],
      registers: [this.register]
    });
    
    // Memory and performance metrics
    this.memoryUsage = new client.Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Node.js memory usage in bytes',
      labelNames: ['type', 'service'],
      registers: [this.register]
    });
    
    this.cpuUsage = new client.Gauge({
      name: 'nodejs_cpu_usage_percent',
      help: 'Node.js CPU usage percentage',
      labelNames: ['service'],
      registers: [this.register]
    });
    
    // Initialize counters
    this.requestCount = 0;
    this.errorCount = 0;
    this.serviceName = 'backend';
    
    // Start periodic collection
    this.startPeriodicCollection();
  }
  
  // Record HTTP request metrics
  recordHttpRequest(req, res, duration) {
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    const service = this.serviceName;
    
    // Increment request counter
    this.httpRequestsTotal.inc({ method, status_code: statusCode, route, service });
    
    // Record request duration
    this.httpRequestDuration.observe({ method, status_code: statusCode, route, service }, duration / 1000);
    
    // Record request size
    const requestSize = parseInt(req.headers['content-length'] || '0');
    if (requestSize > 0) {
      this.httpRequestSizeBytes.observe({ method, route, service }, requestSize);
    }
    
    // Record response size
    const responseSize = parseInt(res.get('content-length') || '0', 10) || 0;
    if (responseSize > 0) {
      this.httpResponseSizeBytes.observe({ method, status_code: statusCode, route, service }, responseSize);
    }
    
    // Record errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      this.errorRate.inc({ method, status_code: statusCode, route, error_type: errorType, service });
    }
    
    this.requestCount++;
  }
  
  // Record AI service metrics
  recordAIRequest(model, operation, duration, tokens, status = 'success') {
    this.aiRequestsTotal.inc({ model, operation, status });
    this.aiRequestDuration.observe({ model, operation }, duration / 1000);
    
    if (tokens) {
      this.aiTokensConsumed.inc({ model, type: 'input' }, tokens.input || 0);
      this.aiTokensConsumed.inc({ model, type: 'output' }, tokens.output || 0);
    }
  }
  
  // Get current metrics summary
  getMetricsSummary() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
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
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime())
    };
  }
  
  // Start periodic collection of system metrics
  startPeriodicCollection() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const service = this.serviceName;
      
      this.memoryUsage.set({ type: 'rss', service }, memUsage.rss);
      this.memoryUsage.set({ type: 'heap_used', service }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heap_total', service }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'external', service }, memUsage.external);
      
      // Update active connections
      this.activeConnections.set({ service }, this.requestCount);
      
    }, 10000); // Every 10 seconds
  }
  
  // Get Prometheus formatted metrics
  async getPrometheusMetrics() {
    return await this.register.metrics();
  }
  
  // Clear all metrics (for testing)
  clearMetrics() {
    this.register.clear();
  }
}

module.exports = new MetricsService();

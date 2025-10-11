
const metricsService = require('../services/metrics_service');

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Record metrics
    metricsService.recordHttpRequest(req, res, duration);
    
    // Log structured metrics
    const metricsLog = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'backend',
      correlationId: req.correlationId,
      traceId: req.traceId,
      spanId: req.spanId,
      event: 'request_metrics',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration_ms: duration,
      contentLength: parseInt(req.headers['content-length'] || '0'),
      responseSize: res.get('content-length') || 0,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    };
    
    console.log(JSON.stringify(metricsLog));
    
    // Call original end
    originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = { metricsMiddleware };

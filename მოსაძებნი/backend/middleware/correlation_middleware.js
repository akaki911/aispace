
const { v4: uuidv4 } = require('uuid');

// Correlation ID middleware
const correlationMiddleware = (req, res, next) => {
  // Get correlation ID from header or generate new one
  let correlationId = req.headers['x-correlation-id'];
  
  if (!correlationId) {
    correlationId = generateCorrelationId();
  }
  
  // Parse W3C traceparent header
  const traceparent = req.headers.traceparent;
  let traceId, spanId, parentSpanId;
  
  if (traceparent && traceparent.match(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/)) {
    const parts = traceparent.split('-');
    traceId = parts[1];
    parentSpanId = parts[2];
    spanId = generateSpanId();
  } else {
    traceId = generateTraceId();
    spanId = generateSpanId();
  }
  
  // Store in request object
  req.correlationId = correlationId;
  req.traceId = traceId;
  req.spanId = spanId;
  req.parentSpanId = parentSpanId;
  req.startTime = Date.now();
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('traceparent', `00-${traceId}-${spanId}-01`);
  
  // Structured JSON logging for request start
  const requestLog = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    service: 'backend',
    correlationId,
    traceId,
    spanId,
    parentSpanId,
    event: 'request_start',
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    contentLength: req.headers['content-length'],
    contentType: req.headers['content-type']
  };
  console.log(JSON.stringify(requestLog));
  
  // Override console methods to include correlation ID
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };
  
  // Inject correlation ID into all console outputs during this request
  const wrapConsoleMethod = (method) => {
    return (...args) => {
      const formattedArgs = args.map(arg => 
        typeof arg === 'string' && !arg.includes(`[${correlationId}]`) 
          ? `[${correlationId}] ${arg}`
          : arg
      );
      originalConsole[method](...formattedArgs);
    };
  };
  
  // Temporarily override console methods
  console.log = wrapConsoleMethod('log');
  console.error = wrapConsoleMethod('error');
  console.warn = wrapConsoleMethod('warn');
  console.info = wrapConsoleMethod('info');
  console.debug = wrapConsoleMethod('debug');
  
  // Restore console methods after response
  const originalSend = res.send;
  res.send = function(body) {
    let responseSize = 0;
    try {
      if (body) {
        if (typeof body === 'string') {
          responseSize = Buffer.byteLength(body, 'utf8');
        } else if (Buffer.isBuffer(body)) {
          responseSize = body.length;
        } else {
          responseSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
        }
      }
    } catch (err) {
      responseSize = 0; // Fallback in case of error
    }

    const responseLog = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 400 ? 'ERROR' : 'INFO',
      service: 'backend',
      correlationId,
      traceId,
      spanId,
      parentSpanId,
      event: 'request_complete',
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseSize,
      duration: Date.now() - req.startTime
    };
    console.log(JSON.stringify(responseLog));
    
    // Restore original console methods
    Object.assign(console, originalConsole);
    
    return originalSend.call(this, body);
  };
  
  // Handle errors
  const originalJson = res.json;
  res.json = function(body) {
    if (res.statusCode >= 400) {
      console.error(`[❌ ${correlationId}] ${req.method} ${req.path} - Error response`, {
        correlationId,
        statusCode: res.statusCode,
        error: body,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalJson.call(this, body);
  };
  
  next();
};

// Generate correlation ID
function generateCorrelationId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `be-${timestamp}-${random}`;
}

// Generate trace ID (32 hex chars)
function generateTraceId() {
  return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Generate span ID (16 hex chars)
function generateSpanId() {
  return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Utility to get current correlation ID from request
function getCurrentCorrelationId(req) {
  return req?.correlationId || 'unknown';
}

// Enhanced logging function with correlation ID
function logWithCorrelation(req, level, component, message, details = {}) {
  const correlationId = getCurrentCorrelationId(req);
  const logData = {
    correlationId,
    component,
    level,
    message,
    ...details,
    timestamp: new Date().toISOString()
  };
  
  const logMessage = `[${level.toUpperCase()}] [${correlationId}] [${component}] ${message}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage, logData);
      break;
    case 'warn':
      console.warn(logMessage, logData);
      break;
    case 'info':
      console.info(logMessage, logData);
      break;
    case 'debug':
      console.debug(logMessage, logData);
      break;
    default:
      console.log(logMessage, logData);
  }
}

module.exports = {
  correlationMiddleware,
  getCurrentCorrelationId,
  logWithCorrelation,
  generateCorrelationId
};

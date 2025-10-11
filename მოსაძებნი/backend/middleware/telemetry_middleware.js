
const { trace, SpanStatusCode, SpanKind } = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { MeterProvider } = require('@opentelemetry/sdk-metrics');
const { metrics } = require('@opentelemetry/api');

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'backend-gateway',
    [SemanticResourceAttributes.SERVICE_VERSION]: '3.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  }),
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
  })
});

// Initialize metrics
const meterProvider = new MeterProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'backend-gateway'
  }),
  readers: [new PrometheusExporter({
    port: parseInt(process.env.BACKEND_METRICS_PORT) || 9092
  })]
});

metrics.setGlobalMeterProvider(meterProvider);
const meter = metrics.getMeter('backend-gateway', '3.0');

// Metrics
const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests'
});

const responseTimeHistogram = meter.createHistogram('http_request_duration_ms', {
  description: 'Duration of HTTP requests in milliseconds'
});

const errorCounter = meter.createCounter('http_errors_total', {
  description: 'Total number of HTTP errors'
});

const aiServiceCallsCounter = meter.createCounter('ai_service_calls_total', {
  description: 'Total number of calls to AI service'
});

// Start SDK
sdk.start();

// Structured logger
class StructuredLogger {
  constructor(serviceName = 'backend-gateway', options = {}) {
    this.serviceName = serviceName;
    this.format = (options.format || process.env.LOG_FORMAT || 'pretty').toLowerCase();
  }

  static #SENSITIVE_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /authorization/i,
    /cookie/i,
    /credential/i,
    /session/i
  ];

  #maskValue(value) {
    if (value == null) {
      return value;
    }

    if (typeof value !== 'string') {
      return '[masked]';
    }

    if (value.length <= 4) {
      return `${value[0] || '*'}***${value.slice(-1) || '*'}`;
    }

    return `${value.slice(0, 3)}…${value.slice(-3)}`;
  }

  #shouldMask(keyPath) {
    return StructuredLogger.#SENSITIVE_PATTERNS.some((pattern) =>
      keyPath.some((key) => pattern.test(key))
    );
  }

  #sanitizeValue(value, keyPath = []) {
    if (value === undefined) {
      return undefined;
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    if (value === '[redacted]' || value === '[REDACTED]') {
      return value;
    }

    if (this.#shouldMask(keyPath)) {
      return this.#maskValue(typeof value === 'string' ? value : JSON.stringify(value));
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => this.#sanitizeValue(item, [...keyPath, String(index)]));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, val]) => {
        const sanitized = this.#sanitizeValue(val, [...keyPath, key]);
        if (sanitized !== undefined) {
          acc[key] = sanitized;
        }
        return acc;
      }, {});
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    return JSON.stringify(value);
  }

  #sanitizeMetadata(metadata = {}) {
    if (!metadata || typeof metadata !== 'object') {
      return metadata;
    }

    return this.#sanitizeValue(metadata);
  }

  #formatStructured(logEntry) {
    return JSON.stringify(logEntry);
  }

  #formatPretty(logEntry) {
    const { timestamp, level, service, message, ...context } = logEntry;
    const contextPairs = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        if (typeof value === 'object') {
          try {
            return `${key}=${JSON.stringify(value)}`;
          } catch (error) {
            return `${key}=[unserializable]`;
          }
        }
        return `${key}=${value}`;
      });

    const contextString = contextPairs.length ? ` | ${contextPairs.join(' ')}` : '';
    return `[${timestamp}] ${level} ${service} :: ${message}${contextString}`;
  }

  log(level, message, metadata = {}) {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();

    const sanitizedMetadata = this.#sanitizeMetadata(metadata) || {};

    const logEntry = Object.entries({
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level: level.toUpperCase(),
      message,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      ...sanitizedMetadata
    }).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const formatted = this.format === 'json'
      ? this.#formatStructured(logEntry)
      : this.#formatPretty(logEntry);

    console.log(formatted);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }
}

const logger = new StructuredLogger();

// Telemetry middleware
const telemetryMiddleware = (req, res, next) => {
  const tracer = trace.getTracer('backend-gateway');
  
  // Extract or generate trace context
  const traceparent = req.headers.traceparent;
  const correlationId = req.headers['x-correlation-id'] || req.correlationId;
  
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'user.agent': req.headers['user-agent'],
      'correlation.id': correlationId,
      'session.id': req.sessionID
    }
  });

  // Add tracing headers to response
  const spanContext = span.spanContext();
  res.setHeader('traceparent', `00-${spanContext.traceId}-${spanContext.spanId}-01`);
  res.setHeader('x-correlation-id', correlationId);

  // Record request metrics
  const startTime = Date.now();
  requestCounter.add(1, {
    method: req.method,
    route: req.route?.path || req.path,
    service: 'backend-gateway'
  });

  // Attach logger and span to request
  req.logger = logger;
  req.span = span;
  req.tracer = tracer;

  logger.info('Request started', {
    correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    sessionId: req.sessionID
  });

  // Override response methods to capture metrics
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    // Record metrics
    responseTimeHistogram.record(duration, {
      method: req.method,
      status_code: res.statusCode.toString(),
      route: req.route?.path || req.path,
      service: 'backend-gateway'
    });

    if (res.statusCode >= 400) {
      errorCounter.add(1, {
        method: req.method,
        status_code: res.statusCode.toString(),
        route: req.route?.path || req.path,
        service: 'backend-gateway'
      });
    }

    // Update span
    let bodySize = 0;
    try {
      if (body) {
        if (typeof body === 'string') {
          bodySize = Buffer.byteLength(body, 'utf8');
        } else if (Buffer.isBuffer(body)) {
          bodySize = body.length;
        } else {
          bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');
        }
      }
    } catch (err) {
      bodySize = 0; // Fallback in case of error
    }
    
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response.size': bodySize
    });

    if (res.statusCode >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      logger.error('Request failed', {
        correlationId,
        statusCode: res.statusCode,
        duration,
        error: body
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('Request completed', {
        correlationId,
        statusCode: res.statusCode,
        duration
      });
    }

    span.end();
    return originalSend.call(this, body);
  };

  next();
};

// AI Service call tracer
const traceAIServiceCall = (operation, metadata = {}) => {
  const tracer = trace.getTracer('backend-gateway');
  return tracer.startSpan(`ai-service.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'service.name': 'ai-service',
      'operation.name': operation,
      ...metadata
    }
  });
};

// Export utilities
module.exports = {
  telemetryMiddleware,
  logger,
  tracer: trace.getTracer('backend-gateway'),
  meter,
  traceAIServiceCall,
  aiServiceCallsCounter,
  sdk
};


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
    [SemanticResourceAttributes.SERVICE_NAME]: 'ai-service',
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
    [SemanticResourceAttributes.SERVICE_NAME]: 'ai-service'
  }),
  readers: [new PrometheusExporter({
    port: parseInt(process.env.METRICS_PORT) || 9091
  })]
});

metrics.setGlobalMeterProvider(meterProvider);
const meter = metrics.getMeter('ai-service', '3.0');

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

// Start SDK
sdk.start();

// Structured logger
class StructuredLogger {
  constructor(serviceName = 'ai-service') {
    this.serviceName = serviceName;
  }

  log(level, message, metadata = {}) {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level: level.toUpperCase(),
      message,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      correlationId: metadata.correlationId,
      ...metadata
    };

    console.log(JSON.stringify(logEntry));
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
  const tracer = trace.getTracer('ai-service');
  
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
      'correlation.id': correlationId
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
    route: req.route?.path || req.path
  });

  // Attach logger and span to request
  req.logger = logger;
  req.span = span;

  logger.info('Request started', {
    correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Override response methods to capture metrics
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    // Record metrics
    responseTimeHistogram.record(duration, {
      method: req.method,
      status_code: res.statusCode.toString(),
      route: req.route?.path || req.path
    });

    if (res.statusCode >= 400) {
      errorCounter.add(1, {
        method: req.method,
        status_code: res.statusCode.toString(),
        route: req.route?.path || req.path
      });
    }

    // Update span
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response.size': Buffer.byteLength(body || '', 'utf8')
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

// Export utilities
module.exports = {
  telemetryMiddleware,
  logger,
  tracer: trace.getTracer('ai-service'),
  meter,
  sdk
};

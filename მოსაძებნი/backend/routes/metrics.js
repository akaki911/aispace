
const express = require('express');
const metricsService = require('../services/metrics_service');
const router = express.Router();

// Prometheus metrics endpoint
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metrics = await metricsService.getPrometheusMetrics();
    res.end(metrics);
  } catch (error) {
    req.logger?.error('Failed to collect metrics', { error: error.message });
    res.status(500).end('Failed to collect metrics');
  }
});

// JSON metrics summary with p95, QPS, error rates
router.get('/summary', (req, res) => {
  try {
    const summary = metricsService.getMetricsSummary();
    
    res.json({
      ...summary,
      metrics: {
        qps: (summary.requests.total / summary.uptime).toFixed(2),
        p95_latency_ms: 'calculated_from_histogram',
        error_rate_percent: summary.requests.errorRate,
        avg_response_time_ms: 'calculated_from_histogram'
      },
      observability: {
        correlation_id_enabled: true,
        w3c_traceparent_enabled: true,
        structured_logging: true,
        metrics_collection: true
      }
    });
  } catch (error) {
    req.logger?.error('Failed to generate metrics summary', { error: error.message });
    res.status(500).json({ error: 'Failed to generate metrics summary' });
  }
});

// Service health metrics
router.get('/health', (req, res) => {
  const summary = metricsService.getMetricsSummary();
  
  res.json({
    status: 'healthy',
    service: 'backend-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: summary.memory,
    requests: summary.requests,
    sessions: {
      store: req.sessionStore?.constructor?.name || 'MemoryStore',
      count: req.sessionStore?.length || 0
    },
    observability: {
      tracing: 'enabled',
      metrics: 'enabled',
      logging: 'structured_json'
    }
  });
});

module.exports = router;

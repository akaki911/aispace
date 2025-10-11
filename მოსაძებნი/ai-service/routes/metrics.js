
const express = require('express');
const aiMetricsService = require('../services/ai_metrics_service');
const router = express.Router();

// Prometheus metrics endpoint
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metrics = await aiMetricsService.getPrometheusMetrics();
    res.end(metrics);
  } catch (error) {
    req.logger?.error('Failed to collect AI metrics', { error: error.message });
    res.status(500).end('Failed to collect AI metrics');
  }
});

// JSON metrics summary for AI service
router.get('/summary', (req, res) => {
  try {
    const summary = aiMetricsService.getMetricsSummary();
    
    res.json({
      ...summary,
      metrics: {
        qps: (summary.requests.total / summary.uptime).toFixed(2),
        ai_p95_latency_ms: 'calculated_from_histogram',
        error_rate_percent: summary.requests.errorRate,
        avg_model_response_time_ms: 'calculated_from_histogram',
        tokens_per_second: 'calculated_from_counters'
      },
      observability: {
        correlation_id_enabled: true,
        w3c_traceparent_enabled: true,
        structured_logging: true,
        ai_metrics_collection: true
      }
    });
  } catch (error) {
    req.logger?.error('Failed to generate AI metrics summary', { error: error.message });
    res.status(500).json({ error: 'Failed to generate AI metrics summary' });
  }
});

// AI service health with metrics
router.get('/health', (req, res) => {
  const summary = aiMetricsService.getMetricsSummary();
  
  res.json({
    status: 'healthy',
    service: 'ai-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: summary.memory,
    requests: summary.requests,
    ai_status: {
      models_available: summary.ai_specific.models_active,
      groq_connected: !!process.env.GROQ_API_KEY,
      memory_service: 'active'
    },
    observability: {
      tracing: 'enabled',
      metrics: 'enabled',
      logging: 'structured_json'
    }
  });
});

module.exports = router;

const express = require('express');
const fetch = global.fetch || require('node-fetch');
const { requireSuperAdmin } = require('../middleware/admin_guards');
const connectionManager = require('../services/groq_connection_manager');
const performanceMonitor = require('../services/performance_monitoring');
const streamingService = require('../services/streaming_service');
const { getVersionInfo } = require('../utils/versionInfo');
const { createServiceToken, getServiceAuthConfigs } = require('../../shared/serviceToken');

let logBuffer;
try {
  ({ logBuffer } = require('./dev_console'));
} catch (error) {
  console.warn('⚠️ [AI DIAGNOSTICS] Unable to attach dev console log buffer:', error.message);
  logBuffer = { entries: [] };
}

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';
const SERVICE_PERMISSIONS = ['diagnostics', 'status', 'metrics', 'chat'];
const SERVICE_AUTH_CONFIG = getServiceAuthConfigs()[0] || null;

if (SERVICE_AUTH_CONFIG?.isFallback) {
  console.warn('⚠️ [AI DIAGNOSTICS] Using fallback service auth secret. Configure AI_SERVICE_SHARED_SECRET for secure diagnostics.');
}

const getServiceToken = () => {
  try {
    return createServiceToken({
      svc: 'backend-diagnostics',
      service: 'backend-diagnostics',
      role: 'SYSTEM_BOT',
      permissions: SERVICE_PERMISSIONS,
    });
  } catch (error) {
    console.error('❌ [AI DIAGNOSTICS] Failed to issue service token', { message: error.message });
    return null;
  }
};

const fetchFromAiService = async (path) => {
  const token = getServiceToken();
  const headers = {
    'User-Agent': 'Bakhmaro-Backend-Diagnostics',
    'X-Service-Name': 'backend-diagnostics',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`AI service responded with ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const formatRecentErrors = (limit = 15) => {
  if (!logBuffer?.entries) {
    return [];
  }

  return logBuffer.entries
    .filter((entry) => entry.level === 'error')
    .slice(-limit)
    .reverse()
    .map((entry) => ({
      timestamp: entry.ts || entry.timestamp || Date.now(),
      source: entry.source || 'unknown',
      level: entry.level || 'error',
      message: entry.message,
      meta: entry.meta || null,
    }));
};

const buildRateLimitSnapshot = (connectionStats) => {
  if (!connectionStats) {
    return null;
  }

  const saturation = connectionStats.poolCapacity
    ? connectionStats.activeConnections / connectionStats.poolCapacity
    : 0;

  return {
    status: saturation >= 1 ? 'limited' : saturation > 0.7 ? 'watch' : 'normal',
    saturation,
    details: {
      activeConnections: connectionStats.activeConnections,
      poolCapacity: connectionStats.poolCapacity,
      warmConnections: connectionStats.warmConnections,
      warmupTarget: connectionStats.warmupTarget,
    },
  };
};

router.use(requireSuperAdmin);

router.get('/diagnostics', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `diag-${Date.now().toString(36)}`;

  const result = {
    success: true,
    fetchedAt: new Date().toISOString(),
    correlationId,
    aiStatus: null,
    aiHealth: null,
    aiMetrics: null,
    backendPerformance: performanceMonitor.getRealTimeMetrics(),
    streamStats: streamingService.getStreamStats(),
    connectionStats: connectionManager.getPoolStats(),
    rateLimit: null,
    recentErrors: formatRecentErrors(),
    version: getVersionInfo(),
    warnings: [],
  };

  result.rateLimit = buildRateLimitSnapshot(result.connectionStats);

  try {
    const [aiStatus, aiHealth, aiMetrics] = await Promise.allSettled([
      fetchFromAiService('/api/ai/status'),
      fetchFromAiService('/api/ai/health'),
      fetchFromAiService('/metrics/summary'),
    ]);

    if (aiStatus.status === 'fulfilled') {
      result.aiStatus = aiStatus.value;
    } else {
      result.warnings.push('Unable to fetch AI status');
    }

    if (aiHealth.status === 'fulfilled') {
      result.aiHealth = aiHealth.value;
    } else {
      result.warnings.push('Unable to fetch AI health');
    }

    if (aiMetrics.status === 'fulfilled') {
      result.aiMetrics = aiMetrics.value;
    } else {
      result.warnings.push('Unable to fetch AI metrics summary');
    }
  } catch (error) {
    console.error('❌ [AI DIAGNOSTICS] Failed to gather AI metrics:', error);
    result.warnings.push('Failed to gather AI diagnostics');
  }

  if (typeof performanceMonitor.getPercentileResponseTime === 'function') {
    result.backendPerformance.latencyPercentiles = {
      p50: performanceMonitor.getPercentileResponseTime(50),
      p95: performanceMonitor.getPercentileResponseTime(95),
      p99: performanceMonitor.getPercentileResponseTime(99),
    };
  }

  res.json(result);
});

module.exports = router;

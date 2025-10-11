const express = require('express');
const router = express.Router();

// Liveness probe - basic service availability
router.get('/health/live', (req, res) => {
  console.log('🏥 [LIVENESS] Probe requested');
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'ai-service',
    version: '3.0'
  });
});

// Readiness probe - service ready to handle requests
router.get('/health/ready', async (req, res) => {
  console.log('🏥 [READINESS] Probe requested');

  const checks = {
    groq: false,
    memory: false,
    firebase: false
  };

  let overallReady = true;
  const errors = [];

  try {
    // Check Groq API availability
    if (process.env.GROQ_API_KEY) {
      checks.groq = true;
    } else {
      errors.push('GROQ_API_KEY missing');
      overallReady = false;
    }

    // Check memory system
    try {
      const fs = require('fs');
      const path = require('path');
      const memoryPath = path.join(__dirname, '../memory_data');
      fs.accessSync(memoryPath);
      checks.memory = true;
    } catch (error) {
      errors.push('Memory system not accessible');
      overallReady = false;
    }

    // Check Firebase availability (if configured)
    try {
      checks.firebase = global.isFirebaseAvailable || false;
    } catch (error) {
      checks.firebase = false;
    }

  } catch (error) {
    console.error('❌ [READINESS] Check failed:', error);
    overallReady = false;
    errors.push(error.message);
  }

  const statusCode = overallReady ? 200 : 503;

  res.status(statusCode).json({
    status: overallReady ? 'READY' : 'NOT_READY',
    timestamp: new Date().toISOString(),
    service: 'ai-service',
    version: '3.0',
    checks,
    errors: errors.length > 0 ? errors : undefined,
    uptime: process.uptime()
  });
});

const isFirebaseAvailable = () => {
  if (typeof global.isFirebaseAvailable === 'boolean') {
    return global.isFirebaseAvailable;
  }
  return Boolean(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_CONFIG ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
};

const buildCoreHealth = (overrides = {}) => {
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const firebaseAvailable = isFirebaseAvailable();
  const degradedDependencies = !groqConfigured || !firebaseAvailable;
  const base = {
    service: 'AI Microservice',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3000,
    uptime: process.uptime(),
    dependencies: {
      groqConfigured,
      firebaseAvailable,
    },
  };
  const merged = { ...base, ...overrides };
  const degraded =
    Boolean(overrides.degraded) ||
    degradedDependencies ||
    (typeof overrides.ready === 'boolean' && overrides.ready === false);
  return {
    ok: !degraded,
    degraded,
    ...merged,
  };
};

// Consolidated health endpoint with consistent response format
const healthResponse = (req, res) => {
  console.log(`🏥 AI Health check requested at ${req.path}`);
  const payload = buildCoreHealth({
    status: 'HEALTHY',
    message: 'AI Service is running',
    endpoints: {
      health: '/health',
      liveness: '/health/live',
      readiness: '/health/ready',
      api_health: '/api/health',
      chat: '/api/ai/chat',
      file_search: '/api/fs/search',
    },
    version: '3.0',
  });

  if (payload.degraded) {
    payload.status = 'DEGRADED';
  }

  res.status(200).json(payload);
};

// Apply to both endpoints for backward compatibility
router.get('/health', async (req, res) => {
  try {
    console.log('🔍 [HEALTH] Health check requested');

    // Check model configuration loading
    let modelsStatus = 'unknown';
    let enabledModelsCount = 0;

    try {
      const { readEnabledModels } = require('../services/modelConfigService');
      const enabledModels = await readEnabledModels();
      enabledModelsCount = enabledModels.length;
      modelsStatus = enabledModelsCount > 0 ? 'loaded' : 'empty';
      console.log(`🔍 [HEALTH] Models check: ${enabledModelsCount} models loaded`);
    } catch (error) {
      console.error('🔍 [HEALTH] Models check failed:', error.message);
      modelsStatus = 'error';
    }

    // Check Groq service health
    let groqStatus = 'unknown';
    try {
      const { checkGroqHealth } = require('../services/groq_service');
      const groqHealth = await checkGroqHealth();
      groqStatus = groqHealth.available ? 'connected' : 'disconnected';
    } catch (error) {
      console.error('🔍 [HEALTH] Groq check failed:', error.message);
      groqStatus = 'error';
    }

    const ready = modelsStatus === 'loaded' && groqStatus === 'connected';
    const healthData = buildCoreHealth({
      status: ready ? 'ok' : 'degraded',
      service: 'ai-service',
      port: process.env.PORT || 5001,
      models: modelsStatus,
      enabledModels: enabledModelsCount,
      groq: groqStatus,
      ready,
    });

    if (healthData.degraded && healthData.status === 'ok') {
      healthData.status = 'degraded';
    }

    res.status(200).json(healthData);
  } catch (error) {
    console.error('❌ [HEALTH] Overall health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
router.get('/api/health', healthResponse);

// The original /health endpoint is replaced by the new /health and /api/health endpoints.
// The original /health/system-status endpoint is now covered by the /health/ready endpoint's comprehensive checks.

module.exports = router;
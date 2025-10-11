const express = require('express');
const router = express.Router();

// Enhanced health endpoint with AI service model status
router.get('/health', async (req, res) => {
  try {
    // Check AI service model status
    let aiModelStatus = 'unknown';
    try {
      const fetch = (await import('node-fetch')).default;
      const aiHealthResponse = await fetch('http://localhost:5001/health');
      if (aiHealthResponse.ok) {
        const aiHealth = await aiHealthResponse.json();
        aiModelStatus = aiHealth.models || 'loaded';
      }
    } catch (error) {
      console.warn('Could not check AI service health:', error.message);
      aiModelStatus = 'service_unavailable';
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
      port: process.env.PORT || 5002,
      aiService: {
        status: aiModelStatus,
        modelsLoaded: aiModelStatus === 'loaded' || aiModelStatus === 'ready'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/', (req, res) => {
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
      port: process.env.PORT || 5002,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      session: {
        hasStore: !!req.sessionStore,
        sessionID: req.sessionID || 'none'
      }
    };

    console.log('🔍 [HEALTH] Check requested:', healthData);
    res.json(healthData);
  } catch (error) {
    console.error('❌ [HEALTH] Error during health check:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System status endpoint with AI readiness check
router.get('/system-status', async (req, res) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';

    // Check AI service health with circuit breaker status
    let aiServiceHealth = {
      live: false,
      ready: false,
      circuitBreaker: null
    };

    try {
      const fetch = (await import('node-fetch')).default;

      // Check liveness
      const liveResponse = await fetch(`${aiServiceUrl}/health/live`, {
        timeout: 2000,
        headers: { 'Content-Type': 'application/json' }
      });
      aiServiceHealth.live = liveResponse.ok;

      // Check readiness
      const readyResponse = await fetch(`${aiServiceUrl}/health/ready`, {
        timeout: 2000,
        headers: { 'Content-Type': 'application/json' }
      });
      aiServiceHealth.ready = readyResponse.ok;

      if (readyResponse.ok) {
        const readyData = await readyResponse.json();
        console.log('✅ [HEALTH] AI Service ready:', readyData.status);
      } else {
        console.warn('⚠️ [HEALTH] AI Service not ready:', readyResponse.status);
      }

    } catch (error) {
      console.warn('AI service health check failed:', error.message);
    }

    // Get circuit breaker status from AI client
    let circuitBreakerStatus = null;
    try {
      const { aiServiceClient } = require('../services/ai_client');
      circuitBreakerStatus = aiServiceClient.getCircuitBreakerStatus();
    } catch (error) {
      console.warn('Failed to get circuit breaker status:', error.message);
    }

    const systemStatus = {
      health: {
        backend: true,
        aiService: {
          live: aiServiceHealth.live,
          ready: aiServiceHealth.ready,
          circuitBreaker: circuitBreakerStatus
        }
      },
      errors: {
        aiConnectionLost: aiServiceHealth.live ? 0 : 1,
        aiNotReady: aiServiceHealth.ready ? 0 : 1,
        circuitBreakerOpen: circuitBreakerStatus?.state === 'OPEN' ? 1 : 0
      },
      alerts: [],
      overallStatus: (aiServiceHealth.live && aiServiceHealth.ready &&
                     circuitBreakerStatus?.isHealthy !== false) ? 'HEALTHY' : 'DEGRADED'
    };

    if (!aiServiceHealth.live) {
      systemStatus.alerts.push({
        type: 'AI_SERVICE_DOWN',
        message: 'AI სერვისი მიუწვდომელია',
        severity: 'CRITICAL',
        timestamp: new Date().toISOString()
      });
    }

    if (!aiServiceHealth.ready) {
      systemStatus.alerts.push({
        type: 'AI_SERVICE_NOT_READY',
        message: 'AI სერვისი არ არის მზად მოთხოვნების მისაღებად',
        severity: 'HIGH',
        timestamp: new Date().toISOString()
      });
    }

    if (circuitBreakerStatus?.state === 'OPEN') {
      systemStatus.alerts.push({
        type: 'CIRCUIT_BREAKER_OPEN',
        message: `AI სერვისის Circuit Breaker ღიაა. შემდეგი მცდელობა: ${Math.ceil((circuitBreakerStatus.nextAttemptIn || 0) / 1000)}წმ`,
        severity: 'HIGH',
        timestamp: new Date().toISOString()
      });
    } else if (circuitBreakerStatus?.state === 'HALF_OPEN') {
      systemStatus.alerts.push({
        type: 'CIRCUIT_BREAKER_TESTING',
        message: 'AI სერვისის Circuit Breaker ტესტდება',
        severity: 'MEDIUM',
        timestamp: new Date().toISOString()
      });
    }

    res.json(systemStatus);
  } catch (error) {
    console.error('System status check failed:', error);
    res.status(500).json({
      error: 'System status check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
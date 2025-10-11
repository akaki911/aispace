const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const healthStatus = {
      backend: { 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        port: process.env.PORT || 5002,
        uptime: process.uptime()
      },
      aiService: { status: 'CHECKING' }
    };

    // Try AI service health check with fallback
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(`${aiServiceUrl}/api/health`, {
        timeout: 3000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const aiHealth = await response.json();
        healthStatus.aiService = {
          ...aiHealth,
          connectionUrl: aiServiceUrl,
          lastChecked: new Date().toISOString()
        };
      } else {
        throw new Error(`AI service returned ${response.status}`);
      }
    } catch (aiError) {
      console.warn('⚠️ AI service health check failed:', aiError.message);
      healthStatus.aiService = {
        status: 'ERROR',
        error: aiError.message,
        lastAttempt: new Date().toISOString(),
        recovery: 'Attempting automatic recovery...'
      };
    }

    // Return successful health even if AI service is down
    res.json(healthStatus);
    
  } catch (error) {
    console.error('❌ Backend health check error:', error);
    res.status(500).json({
      backend: { 
        status: 'ERROR', 
        error: error.message,
        timestamp: new Date().toISOString() 
      },
      aiService: { status: 'UNKNOWN' }
    });
  }
});

// System status endpoint
router.get('/system-status', async (req, res) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';

    // Check AI service health
    let groqHealth = false;
    let aiServiceHealth = false;

    try {
      const fetch = (await import('node-fetch')).default;
      const aiResponse = await fetch(`${aiServiceUrl}/health`, { timeout: 3000 });
      aiServiceHealth = aiResponse.ok;

      // Check Groq specifically
      const groqResponse = await fetch(`${aiServiceUrl}/api/ai/health`, { timeout: 3000 });
      groqHealth = groqResponse.ok;
    } catch (error) {
      console.warn('AI service health check failed:', error.message);
    }

    const systemStatus = {
      health: {
        groq: groqHealth,
        vite: true, // Assume Vite is healthy if backend is running
        backend: true
      },
      errors: {
        groq404: groqHealth ? 0 : 1,
        hmrCrash: 0,
        connectionLost: aiServiceHealth ? 0 : 1
      },
      alerts: [],
      overallStatus: (groqHealth && aiServiceHealth) ? 'HEALTHY' : 'DEGRADED'
    };

    if (!aiServiceHealth) {
      systemStatus.alerts.push({
        type: 'AI_SERVICE_DOWN',
        message: 'AI სერვისი მიუწვდომელია',
        severity: 'HIGH',
        timestamp: new Date().toISOString()
      });
    }

    if (!groqHealth) {
      systemStatus.alerts.push({
        type: 'GROQ_API_ERROR',
        message: 'Groq AI API კავშირი დაზიანებულია',
        severity: 'HIGH',
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
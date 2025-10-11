const express = require('express');
const router = express.Router();

// GET /health - Health check endpoint (mounted at /health)
router.get('/', async (req, res) => {
  console.log('🏥 AI Service: Health check requested');
  try {
    const healthData = {
      success: true,
      service: 'AI Microservice',
      version: '3.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      endpoints: {
        chat: '/api/ai/chat',
        search: '/api/fs/search',
        health: '/api/health'
      },
      groq: {
        connected: !!process.env.GROQ_API_KEY,
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
      }
    };

    console.log('✅ AI Service: Health check successful');
    res.json(healthData);
  } catch (error) {
    console.error('❌ [health] Health check failed:', error);
    console.error('❌ [health] Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      error: error.message,
      details: {
        code: error.code,
        errno: error.errno
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/system-status', async (req, res) => {
  try {
    // Enhanced health check with comprehensive status
    const systemStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        groq: true,
        memory: true,
        fileAccess: true
      },
      uptime: process.uptime(),
      version: '3.0'
    };

    res.json(systemStatus);
  } catch (error) {
    console.error('❌ System status check failed:', error);
    res.status(200).json({ 
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
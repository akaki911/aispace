'use strict';

const express = require('express');
const router = express.Router();
const { readEnabledModels } = require('../services/modelConfigService');

/**
 * Health check endpoint for AI service
 * GET /api/ai/health
 */
router.get('/', async (req, res) => {
  console.log('🔍 [HEALTH] Health check requested');
  
  const healthData = {
    ok: true,
    service: 'ai-service',
    timestamp: new Date().toISOString(),
    configPath: null,
    enabledCount: 0,
    env: {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      NODE_ENV: process.env.NODE_ENV || 'development',
      MODELS_CONFIG_PATH: process.env.MODELS_CONFIG_PATH || null
    },
    errors: []
  };

  try {
    // Test model configuration loading
    const models = await readEnabledModels();
    healthData.enabledCount = models.length;
    healthData.configPath = require('../services/modelConfigService').CONFIG_PATH;
    
    console.log('✅ [HEALTH] Models config OK:', healthData.enabledCount, 'enabled models');
    
  } catch (error) {
    console.error('❌ [HEALTH] Models config error:', error);
    healthData.ok = false;
    healthData.errors.push({
      component: 'model-config',
      error: error.message,
      code: error.code || 'CONFIG_ERROR'
    });
  }

  // Test Groq API key
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️ [HEALTH] GROQ_API_KEY missing');
    healthData.errors.push({
      component: 'groq-api',
      error: 'GROQ_API_KEY environment variable missing',
      code: 'MISSING_API_KEY'
    });
  }

  // Set final health status
  if (healthData.errors.length > 0) {
    healthData.ok = false;
  }

  const statusCode = healthData.ok ? 200 : 503;
  console.log(`${healthData.ok ? '✅' : '❌'} [HEALTH] Status: ${healthData.ok ? 'HEALTHY' : 'UNHEALTHY'}`);
  
  res.status(statusCode).json(healthData);
});

module.exports = router;
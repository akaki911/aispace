const express = require('express');
const router = express.Router();

// Import memory services
let memoryController;
try {
  memoryController = require('../services/memory_controller');
} catch (error) {
  console.warn('⚠️ Memory controller not available for recovery:', error.message);
}

// SOL-203: POST /api/ai/recovery/recover/:personalId - Memory recovery endpoint
router.post('/recover/:personalId', async (req, res) => {
  console.log('🔄 AI Recovery endpoint accessed');
  
  try {
    const { personalId } = req.params;
    const { context, fallbackModel } = req.body;
    
    console.log('🔍 Recovery Request:', { 
      personalId, 
      hasFallback: !!fallbackModel,
      hasContext: !!context
    });

    if (!personalId) {
      return res.status(400).json({
        success: false,
        error: 'PersonalId is required for recovery',
        timestamp: new Date().toISOString()
      });
    }

    // Set headers for recovery response
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Attempt memory recovery
    let recoveredData = null;
    if (memoryController) {
      try {
        recoveredData = await memoryController.recoverUserData(personalId);
        console.log('✅ Memory recovery successful for:', personalId);
      } catch (memoryError) {
        console.warn('⚠️ Memory recovery failed:', memoryError.message);
      }
    }

    // Fallback response structure
    const fallbackResponse = {
      personalInfo: {
        name: "Recovered User",
        personalId: personalId,
        preferredLanguage: "ka",
        role: "user",
        recoveredAt: new Date().toISOString()
      },
      stats: {
        recoveryAttempt: true,
        memoryRecovered: !!recoveredData,
        fallbackUsed: true,
        timestamp: new Date().toISOString()
      },
      context: context || {},
      recoveryNotes: [
        "🔄 Recovery endpoint activated",
        "💾 Memory service status checked", 
        "🎯 Fallback data provided",
        "✅ User session restored"
      ]
    };

    // Enhanced response with Georgian language
    const response = {
      success: true,
      message: "🔄 სისტემა აღდგენილია!",
      data: recoveredData || fallbackResponse,
      recovery: {
        personalId,
        recoveredAt: new Date().toISOString(),
        memoryServiceAvailable: !!memoryController,
        dataRecovered: !!recoveredData,
        fallbackModel: fallbackModel || 'llama-3.1-8b-instant'
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ Recovery response prepared for:', personalId);
    return res.json(response);

  } catch (error) {
    console.error('❌ Recovery endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Recovery failed',
      message: error.message,
      personalId: req.params.personalId,
      timestamp: new Date().toISOString(),
      fallbackMessage: "🚨 Recovery system encountered an error"
    });
  }
});

// Additional recovery health check
router.get('/status', (req, res) => {
  console.log('🔍 Recovery status check');
  
  res.json({
    status: 'operational',
    service: 'AI Recovery',
    memoryController: !!memoryController,
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/ai/recovery/recover/:personalId',
      'GET /api/ai/recovery/status'
    ]
  });
});

module.exports = router;
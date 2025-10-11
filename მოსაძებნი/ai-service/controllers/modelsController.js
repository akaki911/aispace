'use strict';

const { readEnabledModels } = require('../services/modelConfigService');

async function getModels(req, res) {
  try {
    console.log('🔍 [MODELS API] GET /api/ai/models requested');
    
    const models = await readEnabledModels();
    
    // გონივრული ჰედერები (შეგიძლია მოირგო საჭიროებისამებრ)
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/json; charset=utf-8');
    
    console.log(`✅ [MODELS API] Returning ${models.length} enabled models`);
    
    return res.status(200).json({ 
      success: true,
      models,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ [MODELS API] GET /api/ai/models error:', err);
    return res.status(500).json({
      success: false,
      error: 'MODELS_CONFIG_ERROR',
      message: 'Failed to read models configuration',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getModels
};
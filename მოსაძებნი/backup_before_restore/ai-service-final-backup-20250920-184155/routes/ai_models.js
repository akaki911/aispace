
'use strict';

const express = require('express');
const router = express.Router();

// NOTE: ეს არის public-readonly endpoint (auth არაა საჭირო)
router.get('/models', async (req, res) => {
  try {
    console.log('🔍 [MODELS] GET /api/ai/models requested');
    
    // Return all available Groq models with proper categorization
    const models = [
      {
        id: 'llama-3.1-8b-instant',
        label: 'LLaMA 3.1 8B (სწრაფი)',
        category: 'small',
        description: 'უსწრაფესი მოდელი მარტივი ამოცანებისთვის',
        tokens: '8K context'
      },
      {
        id: 'llama-3.1-70b-versatile', 
        label: 'LLaMA 3.1 70B (ძლიერი)',
        category: 'large',
        description: 'ძლიერი მოდელი რთული ამოცანებისთვის',
        tokens: '128K context'
      },
      {
        id: 'llama-3.3-70b-versatile',
        label: 'LLaMA 3.3 70B (ყველაზე ძლიერი)',
        category: 'large', 
        description: 'უძლიერესი მოდელი კომპლექსური ანალიზისთვის',
        tokens: '128K context'
      },
      {
        id: 'mixtral-8x7b-32768',
        label: 'Mixtral 8x7B (მრავალენოვანი)',
        category: 'large',
        description: 'მრავალენოვანი ექსპერტთა მოდელი',
        tokens: '32K context'
      }
    ];
    
    console.log(`✅ [MODELS] Returning ${models.length} models`);
    
    return res.status(200).json({
      success: true,
      models: models,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [MODELS] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load models',
      message: error.message
    });
  }
});

module.exports = router;

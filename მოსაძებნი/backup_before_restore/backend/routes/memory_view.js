
const express = require('express');
const { getMemory, getGrammarFixes } = require('../memory_controller');
const { getStoredFacts } = require('../utils/memory_extractor');
const router = express.Router();

// Memory view endpoint
router.post('/view', async (req, res) => {
  try {
    const { personalId } = req.body;

    if (personalId !== '01019062020') {
      return res.status(403).json({ error: 'არ გაქვთ ამ ფუნქციის გამოყენების უფლება' });
    }

    // Load all memory components
    const memory = await getMemory(personalId);
    const facts = await getStoredFacts(personalId);
    const grammarFixes = await getGrammarFixes(personalId);

    const response = {
      success: true,
      mainMemory: memory?.data || null,
      facts: facts || [],
      grammarFixes: grammarFixes || [],
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Memory view error:', error);
    res.status(500).json({ 
      error: 'მეხსიერების ჩვენებაში შეცდომა',
      details: error.message 
    });
  }
});

module.exports = router;

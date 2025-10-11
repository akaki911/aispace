
const express = require('express');
const memoryRecovery = require('../utils/memory_recovery');
const router = express.Router();

// Memory recovery endpoint
router.post('/recover/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId !== '01019062020') {
      return res.status(403).json({ 
        error: 'არ გაქვთ ამ ფუნქციის გამოყენების უფლება',
        success: false 
      });
    }

    console.log(`🔧 Memory recovery requested for user: ${userId}`);
    
    const result = await memoryRecovery.recoverContextActions(userId);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `მეხსიერება წარმატებით აღდგა - ${result.recovered} ქმედება` 
        : `აღდგენა ვერ მოხერხდა: ${result.error}`,
      recovered: result.recovered || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Memory recovery endpoint error:', error);
    res.status(500).json({ 
      success: false,
      error: 'მეხსიერების აღდგენაში შეცდომა',
      details: error.message
    });
  }
});

module.exports = router;

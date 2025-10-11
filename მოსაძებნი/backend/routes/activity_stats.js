
const express = require('express');
const router = express.Router();
const store = require('../utils/activity_store');

router.get('/', (req, res) => {
  try {
    const stats = store.stats();
    res.json({ 
      success: true,
      ...stats,
      lastId: store.lastId(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

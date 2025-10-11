const express = require('express');
const router = express.Router();
const memoryController = require('../services/memory_controller'); // Fix missing import

// Memory synchronization endpoint
router.post('/sync-memory', async (req, res) => {
  try {
    const { userId, memories } = req.body;

    if (!userId || !Array.isArray(memories)) {
      return res.status(400).json({
        success: false,
        error: 'userId და memories array აუცილებელია'
      });
    }

    const results = [];

    for (const memory of memories) {
      try {
        await memoryController.addToMemory(userId, memory);
        results.push({ memory, status: 'success' });
      } catch (error) {
        console.error(`❌ Memory sync error for ${userId}:`, error);
        results.push({ memory, status: 'error', error: error.message });
      }
    }

    res.json({
      success: true,
      results,
      synchronized: results.filter(r => r.status === 'success').length,
      total: memories.length
    });

  } catch (error) {
    console.error('❌ Memory sync endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'მეხსიერების სინქრონიზაცია ვერ მოხერხდა'
    });
  }
});

// Bulk memory update endpoint
router.post('/bulk-update', async (req, res) => {
  try {
    const { userId, operation, data } = req.body;

    if (!userId || !operation) {
      return res.status(400).json({
        success: false,
        error: 'userId და operation აუცილებელია'
      });
    }

    let result;

    switch (operation) {
      case 'add':
        if (!data || !data.content) {
          return res.status(400).json({
            success: false,
            error: 'content აუცილებელია add ოპერაციისთვის'
          });
        }
        result = await memoryController.addToMemory(userId, data.content);
        break;

      case 'clear':
        result = await memoryController.clearMemory(userId);
        break;

      case 'backup':
        result = await memoryController.backupMemory(userId);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `უცნობი ოპერაცია: ${operation}`
        });
    }

    res.json({
      success: true,
      operation,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Bulk memory update error:', error);
    res.status(500).json({
      success: false,
      error: 'მეხსიერების განახლება ვერ მოხერხდა'
    });
  }
});

// Memory validation endpoint
router.post('/validate-memory', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId აუცილებელია'
      });
    }

    const memory = await memoryController.getMemory(userId);
    const validation = {
      exists: !!memory,
      size: memory ? JSON.stringify(memory).length : 0,
      lastUpdated: memory?.timestamp || null,
      isValid: true,
      issues: []
    };

    // Validate memory structure
    if (memory) {
      if (!memory.data) {
        validation.isValid = false;
        validation.issues.push('Missing data field');
      }

      if (validation.size > 1000000) { // 1MB limit
        validation.isValid = false;
        validation.issues.push('Memory size exceeds limit');
      }
    }

    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Memory validation error:', error);
    res.status(500).json({
      success: false,
      error: 'მეხსიერების ვალიდაცია ვერ მოხერხდა'
    });
  }
});

// Memory statistics endpoint
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const memory = await memoryController.getMemory(userId);

    if (!memory) {
      return res.json({
        success: true,
        stats: {
          exists: false,
          size: 0,
          entries: 0,
          lastUpdated: null
        }
      });
    }

    const memoryString = JSON.stringify(memory);
    const entries = memory.data ? memory.data.split('\n').filter(line => line.trim()).length : 0;

    const stats = {
      exists: true,
      size: memoryString.length,
      entries,
      lastUpdated: memory.timestamp,
      sizeInKB: Math.round(memoryString.length / 1024),
      avgEntrySize: entries > 0 ? Math.round(memoryString.length / entries) : 0
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Memory stats error:', error);
    res.status(500).json({
      success: false,
      error: 'სტატისტიკის მიღება ვერ მოხერხდა'
    });
  }
});

module.exports = router;
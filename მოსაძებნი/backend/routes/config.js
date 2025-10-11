const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();

const planModeService = require('../services/planModeService');

router.get('/planMode', (req, res) => {
  try {
    const state = planModeService.readState();
    return res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error('❌ [ConfigRoutes] Failed to load plan mode', { errorId, message: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_LOAD_PLAN_MODE',
      message: 'Unable to load plan mode configuration',
      errorId,
    });
  }
});

router.post('/planMode', (req, res) => {
  try {
    const state = planModeService.updateState(req.body || {});
    return res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    if (error.message === 'INVALID_MODE') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_MODE',
        message: 'Plan mode must be either "plan" or "build"',
      });
    }

    const errorId = randomUUID();
    console.error('❌ [ConfigRoutes] Failed to persist plan mode', { errorId, message: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_SAVE_PLAN_MODE',
      message: 'Unable to save plan mode configuration',
      errorId,
    });
  }
});

module.exports = router;

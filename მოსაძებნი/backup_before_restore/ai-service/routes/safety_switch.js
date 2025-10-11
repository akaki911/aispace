/**
 * Phase 3: Safety Switch API Routes
 * 
 * REST API endpoints for the Safety Switch system, providing secure
 * communication between frontend UI and backend action confirmation service.
 */

'use strict';

const express = require('express');
const { safetySwitchService } = require('../services/safety_switch_service');

const router = express.Router();

/**
 * GET /api/safety-switch/status
 * Get current safety switch status and configuration
 */
router.get('/status', async (req, res) => {
  try {
    const status = safetySwitchService.getStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [SAFETY SWITCH API] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/safety-switch/pending
 * Get all pending actions waiting for confirmation
 */
router.get('/pending', async (req, res) => {
  try {
    const pendingActions = safetySwitchService.getPendingActions();
    
    res.json({
      success: true,
      pendingActions,
      count: pendingActions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [SAFETY SWITCH API] Error getting pending actions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/safety-switch/confirm/:actionId
 * Confirm a pending action for execution
 */
router.post('/confirm/:actionId', async (req, res) => {
  try {
    const { actionId } = req.params;
    const { userId, confirmation } = req.body;
    
    // Validate action ID
    if (!actionId || typeof actionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid action ID provided',
        timestamp: new Date().toISOString()
      });
    }

    // For high-risk actions, require explicit confirmation text
    const pendingActions = safetySwitchService.getPendingActions();
    const action = pendingActions.find(a => a.id === actionId);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found or already processed',
        timestamp: new Date().toISOString()
      });
    }

    // Check if high-risk action requires confirmation text
    if ((action.severity === 'high' || action.severity === 'critical') && 
        confirmation !== 'CONFIRM') {
      return res.status(400).json({
        success: false,
        error: 'High-risk actions require explicit confirmation text "CONFIRM"',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔒 [SAFETY SWITCH API] Processing action confirmation:', {
      actionId,
      userId,
      severity: action.severity,
      tool: action.toolCall?.tool_name
    });

    const success = safetySwitchService.confirmAction(actionId, userId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Action confirmed successfully',
        actionId,
        confirmedBy: userId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to confirm action',
        actionId,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ [SAFETY SWITCH API] Error confirming action:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/safety-switch/cancel/:actionId
 * Cancel a pending action
 */
router.post('/cancel/:actionId', async (req, res) => {
  try {
    const { actionId } = req.params;
    const { userId, reason } = req.body;
    
    // Validate action ID
    if (!actionId || typeof actionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid action ID provided',
        timestamp: new Date().toISOString()
      });
    }

    console.log('❌ [SAFETY SWITCH API] Processing action cancellation:', {
      actionId,
      userId,
      reason: reason || 'No reason provided'
    });

    const success = safetySwitchService.cancelAction(
      actionId, 
      userId, 
      reason || 'Cancelled by user via API'
    );
    
    if (success) {
      res.json({
        success: true,
        message: 'Action cancelled successfully',
        actionId,
        cancelledBy: userId,
        reason: reason || 'Cancelled by user via API',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to cancel action',
        actionId,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ [SAFETY SWITCH API] Error cancelling action:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/safety-switch/toggle
 * Enable/disable the safety switch
 */
router.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid enabled value. Must be boolean.',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔄 [SAFETY SWITCH API] Toggling safety switch:', enabled ? 'ENABLE' : 'DISABLE');

    safetySwitchService.setSafetySwitch(enabled);
    
    res.json({
      success: true,
      message: `Safety switch ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [SAFETY SWITCH API] Error toggling safety switch:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/safety-switch/clear
 * Clear all pending actions (emergency endpoint)
 */
router.delete('/clear', async (req, res) => {
  try {
    console.log('🧹 [SAFETY SWITCH API] Clearing all pending actions (emergency)');
    
    safetySwitchService.clearAllPendingActions();
    
    res.json({
      success: true,
      message: 'All pending actions cleared successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [SAFETY SWITCH API] Error clearing pending actions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Error handling middleware for safety switch routes
 */
router.use((error, req, res, next) => {
  console.error('❌ [SAFETY SWITCH API] Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in safety switch API',
    details: error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
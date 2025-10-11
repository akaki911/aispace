
const express = require('express');
const router = express.Router();
const aiRolloutManager = require('../services/ai_rollout_manager');
const { requireSuperAdmin } = require('../middleware/admin_guards');

// Get current rollout status
router.get('/status', async (req, res) => {
  try {
    const metrics = aiRolloutManager.getMetrics();
    const health = await aiRolloutManager.healthCheck();
    
    res.json({
      success: true,
      rollout: metrics,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Rollout Control] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rollout status',
      details: error.message
    });
  }
});

// Update rollout strategy - SUPER_ADMIN only
router.post('/update', requireSuperAdmin, async (req, res) => {
  try {
    const { strategy, percentage, userGroups } = req.body;
    
    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: 'Strategy is required'
      });
    }
    
    const validStrategies = ['blue', 'green', 'canary', 'gradual', 'user-groups'];
    if (!validStrategies.includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`
      });
    }
    
    aiRolloutManager.updateRollout(strategy, percentage, userGroups);
    
    // Send notification if hooks service available
    try {
      const NotificationHooksService = require('../services/notificationHooks');
      const notificationHooks = new NotificationHooksService();
      
      await notificationHooks.notify('rollout_update', {
        strategy,
        percentage,
        userGroups,
        updatedBy: req.user?.id || 'unknown',
        timestamp: new Date().toISOString()
      });
    } catch (notifyError) {
      console.warn('⚠️ Failed to send rollout notification:', notifyError.message);
    }
    
    console.log(`🔧 [Rollout Control] Strategy updated to ${strategy} by ${req.user?.id}`);
    
    res.json({
      success: true,
      message: 'Rollout strategy updated successfully',
      config: aiRolloutManager.rolloutConfig
    });
  } catch (error) {
    console.error('❌ [Rollout Control] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rollout strategy',
      details: error.message
    });
  }
});

// Gradual rollout with predefined percentages
router.post('/gradual/:step', requireSuperAdmin, async (req, res) => {
  try {
    const step = req.params.step;
    
    const rolloutSteps = {
      '1': { percentage: 5, description: 'Initial rollout - 5%' },
      '2': { percentage: 25, description: 'Partial rollout - 25%' },
      '3': { percentage: 100, description: 'Full rollout - 100%' }
    };
    
    if (!rolloutSteps[step]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step. Use 1 (5%), 2 (25%), or 3 (100%)'
      });
    }
    
    const config = rolloutSteps[step];
    aiRolloutManager.updateRollout('gradual', config.percentage);
    
    console.log(`🚀 [Rollout Control] Gradual step ${step}: ${config.description}`);
    
    res.json({
      success: true,
      message: `Gradual rollout step ${step} activated`,
      step: parseInt(step),
      percentage: config.percentage,
      description: config.description
    });
  } catch (error) {
    console.error('❌ [Rollout Control] Gradual step error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update gradual rollout',
      details: error.message
    });
  }
});

// Emergency rollback to blue (stable)
router.post('/rollback', requireSuperAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    aiRolloutManager.updateRollout('blue', 100);
    
    // Send emergency rollback notification
    try {
      const NotificationHooksService = require('../services/notificationHooks');
      const notificationHooks = new NotificationHooksService();
      
      await notificationHooks.notify('emergency_rollback', {
        reason: reason || 'Emergency rollback initiated',
        rolledBackBy: req.user?.id || 'unknown',
        timestamp: new Date().toISOString()
      });
    } catch (notifyError) {
      console.warn('⚠️ Failed to send rollback notification:', notifyError.message);
    }
    
    console.log(`🚨 [Rollout Control] Emergency rollback by ${req.user?.id}: ${reason}`);
    
    res.json({
      success: true,
      message: 'Emergency rollback completed - all traffic routed to blue (stable)',
      reason: reason || 'Emergency rollback initiated'
    });
  } catch (error) {
    console.error('❌ [Rollout Control] Rollback error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform rollback',
      details: error.message
    });
  }
});

// Test specific instance
router.post('/test/:instance', requireSuperAdmin, async (req, res) => {
  try {
    const instance = req.params.instance;
    const { message = 'Test message' } = req.body;
    
    const validInstances = ['blue', 'green', 'canary'];
    if (!validInstances.includes(instance)) {
      return res.status(400).json({
        success: false,
        error: `Invalid instance. Must be one of: ${validInstances.join(', ')}`
      });
    }
    
    // Force test on specific instance
    const originalStrategy = aiRolloutManager.rolloutConfig.strategy;
    aiRolloutManager.updateRollout(instance);
    
    try {
      const response = await aiRolloutManager.routeRequest('chat', {
        message,
        personalId: 'test-user',
        context: { projectInfo: { source: 'rollout_test' } }
      }, 'test-user', 'SUPER_ADMIN');
      
      // Restore original strategy
      aiRolloutManager.updateRollout(originalStrategy);
      
      res.json({
        success: true,
        message: `Test completed on ${instance} instance`,
        instance,
        response: response.response?.substring(0, 100) + '...',
        latency: response._rollout?.latency,
        version: response._rollout?.version
      });
    } catch (testError) {
      // Restore original strategy even if test fails
      aiRolloutManager.updateRollout(originalStrategy);
      throw testError;
    }
  } catch (error) {
    console.error('❌ [Rollout Control] Test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test instance',
      details: error.message
    });
  }
});

module.exports = router;

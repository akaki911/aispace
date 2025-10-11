
const express = require('express');
const router = express.Router();
const auditService = require('../services/audit_service');
const { requireSuperAdmin } = require('../middleware/role_guards');

// All audit routes require Super Admin access
router.use(requireSuperAdmin);

// Get audit logs with filtering
router.get('/logs', async (req, res) => {
  try {
    const {
      limit = 100,
      startAfter,
      action,
      userId,
      role,
      success
    } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (userId) filters.userId = userId;
    if (role) filters.role = role;
    if (success !== undefined) filters.success = success === 'true';

    const logs = await auditService.getAuditLogs(
      Math.min(parseInt(limit), 500), // Max 500 for performance
      startAfter || null,
      filters
    );

    console.log(`🔍 [AUDIT API] Retrieved ${logs.length} audit logs for admin ${req.session.user.id}`);

    res.json({
      success: true,
      logs,
      count: logs.length,
      hasMore: logs.length === parseInt(limit)
    });

  } catch (error) {
    console.error('❌ [AUDIT API] Error retrieving logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs'
    });
  }
});

// Get audit statistics
router.get('/stats', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const timeRange = Math.min(parseInt(hours), 168); // Max 7 days

    const stats = await auditService.getAuditStats(timeRange);

    console.log(`📊 [AUDIT API] Retrieved audit stats for ${timeRange}h for admin ${req.session.user.id}`);

    res.json({
      success: true,
      stats,
      timeRange: `${timeRange} hours`
    });

  } catch (error) {
    console.error('❌ [AUDIT API] Error retrieving stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics'
    });
  }
});

// Get available audit actions for filtering
router.get('/actions', async (req, res) => {
  try {
    const actions = [
      'LOGIN_SUCCESS',
      'LOGIN_FAIL',
      'DEVICE_TRUSTED',
      'PASSKEY_VERIFY_OK',
      'LOGOUT_SUCCESS',
      'ADMIN_ACCESS',
      'AI_PROMPT_UPDATED',
      'AI_KEY_ROTATED',
      'AI_BACKUP_TRIGGERED',
      'AI_RESTORE_TRIGGERED',
      'AI_USER_BANNED'
    ];

    res.json({
      success: true,
      actions
    });

  } catch (error) {
    console.error('❌ [AUDIT API] Error retrieving actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit actions'
    });
  }
});

// Manual audit log (for testing)
router.post('/test-log', async (req, res) => {
  try {
    const { action, details } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required'
      });
    }

    const logId = await auditService.logSecurityEvent({
      action: `TEST_${action}`,
      userId: req.session.user.id,
      role: req.session.user.role,
      req,
      success: true,
      details: {
        ...details,
        testLog: true,
        adminId: req.session.user.id
      }
    });

    console.log(`🧪 [AUDIT API] Test log created by admin ${req.session.user.id}`);

    res.json({
      success: true,
      logId,
      message: 'Test audit log created'
    });

  } catch (error) {
    console.error('❌ [AUDIT API] Error creating test log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test audit log'
    });
  }
});

module.exports = router;

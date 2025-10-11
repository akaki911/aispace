
const express = require('express');
const router = express.Router();

router.post('/setup', (req, res) => {
  const provided = req.headers['x-admin-setup-token'] || req.body?.token || '';
  const expected = process.env.ADMIN_SETUP_TOKEN || '';
  if (!expected) return res.status(500).json({ error: 'ADMIN_SETUP_TOKEN not configured' });
  if (!provided || provided !== expected) return res.status(401).json({ error: 'Invalid setup token' });
  return res.status(200).json({ ok: true });
});

// Check if any admin exists
router.get('/status', async (req, res) => {
  try {
    // Legacy admin check removed - device authentication system is now active
    const hasAdmins = true;
    
    res.json({
      success: true,
      needsSetup: !hasAdmins,
      hasAdmins,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Admin Setup] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check admin setup status',
      details: error.message
    });
  }
});

// Initialize first admin setup
router.post('/initialize', async (req, res) => {
  try {
    const { personalId, setupToken } = req.body;
    
    // Verify setup token
    const expectedToken = process.env.ADMIN_SETUP_TOKEN || 'DEV_TOKEN';
    if (setupToken !== expectedToken) {
      return res.status(403).json({
        success: false,
        error: 'Invalid setup token'
      });
    }
    
    // Check if already has admins
    // Legacy admin check removed - device authentication system is now active
    const hasAdmins = true;
    if (hasAdmins) {
      return res.status(400).json({
        success: false,
        error: 'Admin setup already completed'
      });
    }
    
    res.json({
      success: true,
      message: 'Admin setup initialized',
      personalId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [Admin Setup] Initialize error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize admin setup',
      details: error.message
    });
  }
});

module.exports = router;

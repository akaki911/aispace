
const express = require('express');
const router = express.Router();
const { generateTokenForRegularAPI, authenticateJWT, requireRole, refreshTokenLogic } = require('../utils/jwt');

// Login endpoint for regular users (returns JWT)
router.post('/login', generateTokenForRegularAPI);

// Token refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const tokens = await refreshTokenLogic(refreshToken);
    res.json({
      success: true,
      ...tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    });
  }
});

// Protected endpoint example
router.get('/profile', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Admin-only endpoint example
router.get('/admin-only', authenticateJWT, requireRole(['SUPER_ADMIN', 'PROVIDER']), (req, res) => {
  res.json({
    success: true,
    message: 'Admin access granted',
    user: req.user
  });
});

module.exports = router;

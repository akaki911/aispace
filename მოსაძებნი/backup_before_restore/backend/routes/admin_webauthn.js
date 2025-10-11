
const express = require('express');
const router = express.Router();

// Get current user info
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    id: req.session.user.id,
    email: req.session.user.email,
    role: req.session.user.role,
    authenticated: true
  });
});

// Register passkey endpoint
router.post('/register', (req, res) => {
  // Mock implementation for now
  console.log('🔐 WebAuthn register request:', req.body);
  res.json({ 
    success: true, 
    message: 'WebAuthn registration mock endpoint',
    mock: true 
  });
});

// Authenticate passkey endpoint
router.post('/authenticate', (req, res) => {
  // Mock implementation for now
  console.log('🔐 WebAuthn authenticate request:', req.body);
  res.json({ 
    success: true, 
    message: 'WebAuthn authentication mock endpoint',
    mock: true 
  });
});

module.exports = router;

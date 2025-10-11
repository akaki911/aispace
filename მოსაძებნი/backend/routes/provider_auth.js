
const express = require('express');
const { signInWithEmailAndPassword } = require('firebase/auth');
const { auth } = require('../firebase');
const auditService = require('../services/audit_service');

const router = express.Router();

// Provider-specific authentication middleware
const requireProviderRole = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== 'PROVIDER') {
    return res.status(403).json({
      success: false,
      error: 'Provider access required',
      code: 'PROVIDER_ONLY'
    });
  }
  next();
};

// Provider login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    console.log('🔐 [Provider Auth] Login attempt:', { email });

    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Verify this user has PROVIDER role
    // In real implementation, check Firestore user document
    const userRole = 'PROVIDER'; // Mock - get from Firestore

    if (userRole !== 'PROVIDER') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized as provider'
      });
    }

    // Create session
    req.session.user = {
      id: userCredential.user.uid,
      email: userCredential.user.email,
      role: 'PROVIDER',
      displayName: userCredential.user.displayName || 'Provider User',
      authMethod: 'firebase'
    };
    req.session.isAuthenticated = true;
    req.session.userRole = 'PROVIDER';

    // SOL-425: Audit log provider login
    await auditService.logLoginSuccess(
      userCredential.user.uid,
      'PROVIDER',
      null,
      req,
      'firebase'
    );

    console.log('✅ [Provider Auth] Login successful:', { email, userId: userCredential.user.uid });

    res.json({
      success: true,
      user: req.session.user
    });

  } catch (error) {
    // SOL-425: Audit log failed provider login
    await auditService.logLoginFail(
      email,
      error.code || 'unknown_error',
      req,
      'firebase'
    );

    console.error('❌ [Provider Auth] Login error:', error);
    res.status(401).json({
      success: false,
      error: error.code === 'auth/invalid-credential' ? 'Invalid credentials' : 'Authentication failed'
    });
  }
});

// Provider logout
router.post('/logout', requireProviderRole, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ [Provider Auth] Logout error:', err);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    res.clearCookie('connect.sid'); // Clear session cookie
    console.log('✅ [Provider Auth] Logout successful');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Provider session check
router.get('/me', requireProviderRole, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: req.session.user,
    role: req.session.user.role,
    userId: req.session.user.id,
    deviceTrust: false // Providers don't get device trust by default
  });
});

// Provider dashboard access (example protected route)
router.get('/dashboard', requireProviderRole, (req, res) => {
  res.json({
    success: true,
    message: 'Provider dashboard access granted',
    user: req.session.user
  });
});

module.exports = router;

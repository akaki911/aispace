
const express = require('express');
const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { auth } = require('../firebase');
const auditService = require('../services/audit_service');

const router = express.Router();

// Customer-specific authentication middleware
const requireCustomerRole = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== 'CUSTOMER') {
    return res.status(403).json({
      success: false,
      error: 'Customer access required',
      code: 'CUSTOMER_ONLY'
    });
  }
  next();
};

// Customer registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, personalId } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    console.log('📝 [Customer Auth] Registration attempt:', { email });

    // Create Firebase user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Create session
    req.session.user = {
      id: userCredential.user.uid,
      email: userCredential.user.email,
      role: 'CUSTOMER',
      displayName: firstName && lastName ? `${firstName} ${lastName}` : 'Customer User',
      personalId,
      authMethod: 'firebase'
    };
    req.session.isAuthenticated = true;
    req.session.userRole = 'CUSTOMER';

    console.log('✅ [Customer Auth] Registration successful:', { email, userId: userCredential.user.uid });

    res.status(201).json({
      success: true,
      user: req.session.user
    });

  } catch (error) {
    console.error('❌ [Customer Auth] Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.code === 'auth/email-already-in-use' ? 'Email already registered' : 'Registration failed'
    });
  }
});

// Customer login
router.post('/login', async (req, res) => {
  try {
    const { email, password, trustDevice } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    console.log('🔐 [Customer Auth] Login attempt:', { email, trustDevice });

    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Create session
    req.session.user = {
      id: userCredential.user.uid,
      email: userCredential.user.email,
      role: 'CUSTOMER',
      displayName: userCredential.user.displayName || 'Customer User',
      authMethod: 'firebase'
    };
    req.session.isAuthenticated = true;
    req.session.userRole = 'CUSTOMER';

    // Register device if trustDevice is requested
    if (trustDevice && req.body.deviceInfo) {
      try {
        const deviceService = require('../services/device_service');
        await deviceService.registerDevice({
          userId: userCredential.user.uid,
          clientId: req.body.deviceInfo.clientId,
          fingerprint: req.body.deviceInfo.fingerprint,
          uaInfo: req.body.deviceInfo.uaInfo,
          ip: req.ip || req.connection.remoteAddress,
          trustDevice: true
        });
        console.log('📱 [Customer Auth] Device registered for customer:', userCredential.user.uid);
      } catch (deviceError) {
        console.warn('⚠️ [Customer Auth] Device registration failed:', deviceError);
      }
    }

    // SOL-425: Audit log customer login
    await auditService.logLoginSuccess(
      userCredential.user.uid,
      'CUSTOMER',
      req.body.deviceInfo?.clientId || null,
      req,
      'firebase'
    );

    console.log('✅ [Customer Auth] Login successful:', { email, userId: userCredential.user.uid });

    res.json({
      success: true,
      user: req.session.user
    });

  } catch (error) {
    // SOL-425: Audit log failed customer login
    await auditService.logLoginFail(
      email,
      error.code || 'unknown_error',
      req,
      'firebase'
    );

    console.error('❌ [Customer Auth] Login error:', error);
    res.status(401).json({
      success: false,
      error: error.code === 'auth/invalid-credential' ? 'Invalid credentials' : 'Authentication failed'
    });
  }
});

// Customer logout
router.post('/logout', requireCustomerRole, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ [Customer Auth] Logout error:', err);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    res.clearCookie('connect.sid');
    console.log('✅ [Customer Auth] Logout successful');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Customer session check
router.get('/me', requireCustomerRole, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: req.session.user,
    role: req.session.user.role,
    userId: req.session.user.id,
    deviceTrust: false // Customers don't get device trust by default
  });
});

// Customer profile access (example protected route)
router.get('/profile', requireCustomerRole, (req, res) => {
  res.json({
    success: true,
    message: 'Customer profile access granted',
    user: req.session.user
  });
});

module.exports = router;

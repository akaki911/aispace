const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Simplified fallback store - will be moved to Redis in production
const fallbackTokenStore = new Map();

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of fallbackTokenStore.entries()) {
    if (now > value.expiresAt) {
      fallbackTokenStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// Generate SMS/TOTP fallback when WebAuthn fails
router.post('/fallback/generate', async (req, res) => {
  try {
    const { personalId, reason } = req.body;

    // Hash personal ID for security
    const SUPER_ADMIN_HASH = crypto.createHash('sha256').update('01019062020').digest('hex');
    const providedHash = crypto.createHash('sha256').update(personalId).digest('hex');

    if (providedHash !== SUPER_ADMIN_HASH) {
      return res.status(403).json({
        error: 'Fallback ავტორიზაცია მხოლოდ სუპერ ადმინისტრატორისთვისაა',
        code: 'SUPER_ADMIN_ONLY'
      });
    }

    // Only allow fallback for specific reasons
    const validReasons = ['device_lost', 'device_malfunction', 'webauthn_unavailable'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        error: 'არავალიდური fallback მიზეზი',
        code: 'INVALID_REASON'
      });
    }

    // Generate 6-digit fallback code
    const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(fallbackCode).digest('hex');

    // Store with expiration (5 minutes)
    fallbackTokenStore.set(personalId, {
      tokenHash,
      reason,
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      attempts: 0,
      maxAttempts: 3
    });

    // In production, send via SMS or display in secure admin panel
    console.log('🔐 Fallback code generated for super admin:', fallbackCode);

    res.json({
      message: 'Fallback კოდი გენერირებულია',
      expiresIn: 300, // 5 minutes
      // For development only - remove in production
      ...(process.env.NODE_ENV === 'development' && { fallbackCode })
    });

  } catch (error) {
    console.error('❌ Fallback generation error:', error);
    res.status(500).json({
      error: 'Fallback კოდის გენერაცია ვერ მოხერხდა',
      code: 'FALLBACK_GENERATION_FAILED'
    });
  }
});

// Verify fallback code
router.post('/fallback/verify', async (req, res) => {
  try {
    const { personalId, fallbackCode } = req.body;

    const storedToken = fallbackTokenStore.get(personalId);
    if (!storedToken) {
      return res.status(400).json({
        error: 'Fallback კოდი ვერ მოიძებნა',
        code: 'TOKEN_NOT_FOUND'
      });
    }

    // Check expiration
    if (Date.now() > storedToken.expiresAt) {
      fallbackTokenStore.delete(personalId);
      return res.status(400).json({
        error: 'Fallback კოდის ვადა ამოიწურა',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Check attempts
    if (storedToken.attempts >= storedToken.maxAttempts) {
      fallbackTokenStore.delete(personalId);
      return res.status(429).json({
        error: 'ძალიან ბევრი არასწორი მცდელობა',
        code: 'TOO_MANY_ATTEMPTS'
      });
    }

    // Verify code
    const providedHash = crypto.createHash('sha256').update(fallbackCode).digest('hex');
    if (providedHash !== storedToken.tokenHash) {
      storedToken.attempts++;
      return res.status(400).json({
        error: 'არასწორი fallback კოდი',
        code: 'INVALID_CODE',
        attemptsLeft: storedToken.maxAttempts - storedToken.attempts
      });
    }

    // Success - create session
    req.session.user = {
      id: '01019062020',
      role: 'SUPER_ADMIN',
      personalId: '01019062020',
      email: 'admin@bakhmaro.co',
      displayName: 'სუპერ ადმინისტრატორი',
      authMethod: 'fallback'
    };
    req.session.isAuthenticated = true;
    req.session.isSuperAdmin = true;
    req.session.userRole = 'SUPER_ADMIN';
    req.session.userId = '01019062020';

    // Clean up
    fallbackTokenStore.delete(personalId);

    console.log('✅ Fallback authentication successful for super admin');

    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }

      res.json({
        ok: true,
        role: 'SUPER_ADMIN',
        authMethod: 'fallback',
        user: req.session.user
      });
    });

  } catch (error) {
    console.error('❌ Fallback verification error:', error);
    res.status(500).json({
      error: 'Fallback კოდის ვერიფიკაცია ვერ მოხერხდა',
      code: 'FALLBACK_VERIFICATION_FAILED'
    });
  }
});

// General auth /me endpoint - MUST be accessible
router.get('/me', (req, res) => {
  try {
    console.log('🔍 [FALLBACK AUTH] /me endpoint called:', {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      isAuthenticated: req.session?.isAuthenticated,
      sessionId: req.sessionID?.substring(0, 8) || null,
      path: req.path,
      originalUrl: req.originalUrl
    });

    if (!req.session?.user || !req.session?.isAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        authenticated: false,
        user: null,
        endpoint: '/api/auth/me',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      user: req.session.user,
      authenticated: true,
      endpoint: '/api/auth/me',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    console.error('❌ General auth /me error:', { errorId, message: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      authenticated: false,
      endpoint: '/api/auth/me',
      errorId
    });
  }
});

// Auth status endpoint that works for both authenticated and unauthenticated users
router.get('/status', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    authenticated: !!req.session?.user,
    hasSession: !!req.session
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  try {
    console.log('🚪 [FALLBACK AUTH] Logout request received');
    
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ [FALLBACK AUTH] Session destroy error:', err);
        return res.status(500).json({
          success: false,
          error: 'Session destroy failed'
        });
      }

      // Clear multiple cookie names that might be in use
      res.clearCookie('connect.sid');
      res.clearCookie('bk_admin.sid');
      console.log('✅ [FALLBACK AUTH] Logout successful');
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('❌ [FALLBACK AUTH] Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

module.exports = router;
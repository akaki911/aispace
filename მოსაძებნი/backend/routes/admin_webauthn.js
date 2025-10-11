const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const { getWebAuthnConfig, validateWebAuthnRequest } = require('../config/webauthn');
const deviceService = require('../services/device_service');
const credentialService = require('../services/credential_service');
const userService = require('../services/user_service');
const auditService = require('../services/audit_service');
const {
  originGuard,
  adminSetupGuard,
  rateLimitSimple
} = require('../middleware/admin_guards');

const persistSession = (req) => new Promise((resolve, reject) => {
  if (!req.session?.save) {
    return resolve();
  }

  req.session.save((err) => {
    if (err) {
      return reject(err);
    }
    resolve();
  });
});

const getAdminSessionState = (req) => {
  if (!req.session) {
    return null;
  }

  if (!req.session.adminWebauthn) {
    req.session.adminWebauthn = {};
  }

  return req.session.adminWebauthn;
};

const respondWithServerError = (res, scope, error, message) => {
  const errorId = randomUUID();
  console.error(`❌ [Admin WebAuthn] ${scope} failed`, {
    errorId,
    message: error?.message,
    cause: error?.cause,
    stack: error?.stack
  });

  res.status(500).json({
    success: false,
    error: message,
    errorId
  });
};

// SOL-427: Apply enhanced security guards with strict rate limiting
router.use(originGuard);

// SOL-427: Import rate limiter from main app
const rateLimit = require('express-rate-limit');
const webauthnVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Very strict limit for verification
  message: {
    error: 'Too many WebAuthn verification attempts',
    code: 'WEBAUTHN_RATE_LIMITED',
    retryAfter: '10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Get current user info
router.get('/me', (req, res) => {
  try {
    console.log('🔍 [Admin WebAuthn] /me check', {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      isAuthenticated: req.session?.isAuthenticated,
      sessionId: req.sessionID?.substring(0, 8) || null
    });

    if (!req.session || !req.session.user || !req.session.isAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        authenticated: false,
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (req.session.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'WebAuthn access restricted to super admin',
        authenticated: true,
        code: 'INSUFFICIENT_PRIVILEGES',
        userRole: req.session.user.role
      });
    }

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.session.user.id,
        email: req.session.user.email,
        role: req.session.user.role,
        personalId: req.session.user.personalId,
        displayName: req.session.user.displayName
      },
      role: req.session.user.role,
      userId: req.session.user.id
    });
  } catch (error) {
    respondWithServerError(res, '/me', error, 'Internal server error');
  }
});

// ===== PASSKEY REGISTRATION FLOW =====

// Step 1: Generate registration options
router.post('/register-options', adminSetupGuard, async (req, res) => {
  try {
    const { userId, email } = req.body;

    console.log(`🔐 [Passkey Register] Request received:`, { userId, email, origin: req.get('origin'), host: req.get('host') });

    if (!userId || !email) {
      console.log(`❌ [Passkey Register] Missing required fields`);
      return res.status(400).json({
        success: false,
        error: 'userId and email are required'
      });
    }

    console.log(`🔐 [Passkey Register] Generating options for ${email}`);

    // Get dynamic WebAuthn config for this request
    const config = getWebAuthnConfig(req);
    const originValidation = validateWebAuthnRequest(req, config);

    if (!originValidation.valid) {
      console.warn('⚠️ [Admin Passkey Register] Origin validation failed', originValidation);
      return res.status(400).json({
        success: false,
        error: 'Invalid request origin',
        code: 'INVALID_RP_ORIGIN',
        expected: originValidation.expected,
        received: originValidation.received,
      });
    }

    // Get existing credentials for excludeCredentials
    const existingCredentials = await credentialService.getUserCredentials(userId);
    const excludeCredentials = existingCredentials.map(cred => ({
      id: Buffer.from(cred.credentialId, 'base64url'),
      type: 'public-key',
      transports: cred.transports || ['internal', 'hybrid']
    }));

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: userId,
      userName: email,
      userDisplayName: email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Force platform authenticator (Windows Hello/Face ID)
        userVerification: 'preferred', // Allow PIN as fallback
        residentKey: 'preferred', // Discoverable credentials preferred
        requireResidentKey: false // But not required
      },
      supportedAlgorithmIDs: [-7, -35, -36, -257, -258, -259], // Enhanced algorithm support
      timeout: 120000, // Extended timeout for biometric setup
      extensions: {
        // Enable enhanced extensions for better Windows Hello support
        credProps: true,
        largeBlob: { support: 'preferred' }
      }
    });

    const sessionState = getAdminSessionState(req);
    if (!sessionState) {
      return respondWithServerError(res, 'register-options session', new Error('Session unavailable'), 'Failed to persist registration session');
    }

    sessionState.registration = {
      challenge: options.challenge,
      userId,
      email,
      createdAt: Date.now()
    };

    await persistSession(req);

    console.log(`✅ [Passkey Register] Options generated for ${email}`);

    res.json({
      success: true,
      publicKey: options
    });

  } catch (error) {
    respondWithServerError(res, 'register-options', error, 'Failed to generate registration options');
  }
});

// Step 2: Verify registration response
router.post('/register-verify', adminSetupGuard, webauthnVerifyLimiter, async (req, res) => {
  try {
    const { credential, deviceFingerprint, clientId, uaInfo } = req.body || {};
    const sessionState = getAdminSessionState(req);
    const registrationState = sessionState?.registration;

    if (!credential || !registrationState?.challenge || !registrationState?.userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registration data'
      });
    }

    console.log(`🔐 [Passkey Register] Verifying credential for ${registrationState.email}`);

    const config = getWebAuthnConfig(req);
    const originValidation = validateWebAuthnRequest(req, config);

    if (!originValidation.valid) {
      console.warn('⚠️ [Admin Passkey Login] Origin validation failed', originValidation);
      return res.status(400).json({
        success: false,
        error: 'Invalid request origin',
        code: 'INVALID_RP_ORIGIN',
        expected: originValidation.expected,
        received: originValidation.received,
      });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: registrationState.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: false
    });

    if (!verification.verified || !verification.registrationInfo) {
      console.log('❌ [Passkey Register] Verification failed');
      return res.status(400).json({
        success: false,
        error: 'Registration verification failed'
      });
    }

    const { credentialID, credentialPublicKey, counter, aaguid } = verification.registrationInfo;
    const credentialIdB64Url = Buffer.from(credentialID).toString('base64url');
    const credentialPublicKeyB64 = Buffer.from(credentialPublicKey).toString('base64');
    const userId = registrationState.userId;
    const email = registrationState.email;

    try {
      await userService.createUser({
        userId,
        email,
        role: 'SUPER_ADMIN',
        status: 'active'
      });
    } catch (userError) {
      console.warn('⚠️ [Passkey Register] User persistence notice:', userError.message);
    }

    await credentialService.storeCredential({
      credentialId: credentialIdB64Url,
      userId,
      publicKey: credentialPublicKeyB64,
      counter,
      aaguid: aaguid ? Buffer.from(aaguid).toString('hex') : null,
      transports: credential.response?.transports || ['internal', 'hybrid']
    });

    await auditService.logPasskeyVerification(
      userId,
      credentialIdB64Url,
      req,
      true
    );

    if (deviceFingerprint && clientId && uaInfo) {
      try {
        await deviceService.registerDevice({
          userId,
          clientId,
          fingerprint: deviceFingerprint,
          uaInfo,
          credentialId: credentialIdB64Url,
          ip: req.ip || req.connection?.remoteAddress,
          aaguid: aaguid ? Buffer.from(aaguid).toString('hex') : null
        });
        console.log(`📱 [Device] Registered device for ${email} during passkey registration`);
      } catch (deviceError) {
        console.error('⚠️ [Device] Failed to register device during registration:', deviceError.message);
      }
    }

    if (req.session) {
      req.session.user = {
        id: userId,
        role: 'SUPER_ADMIN',
        personalId: userId,
        email,
        displayName: req.session.user?.displayName || 'სუპერ ადმინისტრატორი'
      };
      req.session.isAuthenticated = true;
      req.session.isSuperAdmin = true;
      req.session.userRole = 'SUPER_ADMIN';
      req.session.deviceTrusted = true;
      console.log('✅ [Passkey Register] Super admin session established via passkey');
    }

    if (sessionState) {
      delete sessionState.registration;
      await persistSession(req);
    }

    res.json({
      success: true,
      verified: true
    });
  } catch (error) {
    respondWithServerError(res, 'register-verify', error, 'Registration verification failed');
  }
});

// ===== PASSKEY AUTHENTICATION FLOW =====

// Step 1: Generate authentication options
router.post('/login-options', async (req, res) => {
  try {
    console.log('🔐 [Passkey Login] Generating authentication options');

    const config = getWebAuthnConfig(req);
    const originValidation = validateWebAuthnRequest(req, config);

    if (!originValidation.valid) {
      console.warn('⚠️ [Admin Passkey Login] Origin validation failed', originValidation);
      return res.status(400).json({
        success: false,
        error: 'Invalid request origin',
        code: 'INVALID_RP_ORIGIN',
        expected: originValidation.expected,
        received: originValidation.received,
      });
    }

    const allCredentials = await credentialService.getAllCredentials();

    const allowCredentials = allCredentials.map((cred) => ({
      id: Buffer.from(cred.credentialId, 'base64url'),
      type: 'public-key',
      transports: cred.transports || ['internal', 'hybrid']
    }));

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 120000,
      extensions: {
        appid: config.rpID,
        credProps: true
      }
    });

    const sessionState = getAdminSessionState(req);
    if (!sessionState) {
      return respondWithServerError(res, 'login-options session', new Error('Session unavailable'), 'Failed to persist authentication session');
    }

    sessionState.login = {
      challenge: options.challenge,
      createdAt: Date.now()
    };

    await persistSession(req);

    console.log(`✅ [Passkey Login] Options generated with ${allowCredentials.length} credentials`);

    res.json({
      success: true,
      publicKey: options
    });
  } catch (error) {
    respondWithServerError(res, 'login-options', error, 'Failed to generate authentication options');
  }
});

// Step 2: Verify authentication response
router.post('/login-verify', webauthnVerifyLimiter, async (req, res) => {
  try {
    const { credential, deviceFingerprint, clientId, uaInfo } = req.body || {};
    const sessionState = getAdminSessionState(req);
    const loginState = sessionState?.login;

    if (!credential || !loginState?.challenge) {
      return res.status(400).json({
        success: false,
        error: 'Invalid authentication data'
      });
    }

    console.log('🔐 [Passkey Login] Verifying authentication');

    const config = getWebAuthnConfig(req);
    const credentialIdBase64url = Buffer.from(credential.rawId, 'base64url').toString('base64url');
    const storedCredential = await credentialService.findByCredentialId(credentialIdBase64url);

    if (!storedCredential) {
      return res.status(400).json({
        success: false,
        error: 'Credential not found'
      });
    }

    const storedCredentialId = storedCredential.credentialId || storedCredential.credentialID;
    const storedPublicKey = storedCredential.publicKey || storedCredential.credentialPublicKey;

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: loginState.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      authenticator: {
        credentialID: Buffer.from(storedCredentialId, 'base64url'),
        credentialPublicKey: Buffer.from(storedPublicKey, 'base64'),
        counter: storedCredential.counter,
        transports: storedCredential.transports || ['internal', 'hybrid']
      },
      requireUserVerification: false
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: 'Authentication verification failed'
      });
    }

    if (typeof verification.authenticationInfo?.newCounter === 'number') {
      await credentialService.updateCounter(storedCredential.id, verification.authenticationInfo.newCounter);
    }

    await auditService.logPasskeyVerification(
      storedCredential.userId,
      credentialIdBase64url,
      req,
      true
    );

    if (deviceFingerprint && clientId && uaInfo) {
      try {
        const recognition = await deviceService.recognizeDevice(clientId, deviceFingerprint, uaInfo);
        if (recognition.recognized && recognition.device) {
          await deviceService.updateDeviceLogin(
            recognition.device.deviceId,
            req.ip || req.connection?.remoteAddress,
            credentialIdBase64url
          );
          console.log(`📱 [Device] Updated login for recognized device ${recognition.device.deviceId}`);
        } else {
          await deviceService.registerDevice({
            userId: storedCredential.userId,
            clientId,
            fingerprint: deviceFingerprint,
            uaInfo,
            credentialId: credentialIdBase64url,
            ip: req.ip || req.connection?.remoteAddress,
            aaguid: storedCredential.aaguid || null
          });
          console.log('📱 [Device] Registered new device during authentication');
        }
      } catch (deviceError) {
        console.warn('⚠️ [Device] Authentication device reconciliation failed', deviceError.message);
      }
    }

    if (req.session) {
      req.session.user = {
        id: storedCredential.userId,
        role: 'SUPER_ADMIN',
        personalId: storedCredential.userId,
        email: req.session.user?.email || 'admin@bakhmaro.co',
        displayName: req.session.user?.displayName || 'სუპერ ადმინისტრატორი'
      };
      req.session.isAuthenticated = true;
      req.session.isSuperAdmin = true;
      req.session.userRole = 'SUPER_ADMIN';
      req.session.deviceTrusted = true;
    }

    if (sessionState) {
      delete sessionState.login;
      await persistSession(req);
    }

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: storedCredential.userId,
        role: 'SUPER_ADMIN',
        authenticatedViaPasskey: true
      }
    });
  } catch (error) {
    respondWithServerError(res, 'login-verify', error, 'Authentication verification failed');
  }
});

// ===== MANAGEMENT ENDPOINTS =====

// List user's credentials
router.get('/credentials', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  // Only allow super admin to view credentials
  if (req.session.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  }

  res.json({
    success: true,
    message: 'Credentials endpoint - implementation pending'
  });
});

// Delete a credential
router.delete('/credentials/:credentialId', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  if (req.session.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  }

  res.json({
    success: true,
    message: 'Credential deletion - implementation pending'
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  try {
    console.log('🚪 [WEBAUTHN] Logout request received');
    
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ [WEBAUTHN] Session destroy error:', err);
        return res.status(500).json({
          success: false,
          error: 'Session destroy failed'
        });
      }

      res.clearCookie('bk_admin.sid');
      console.log('✅ [WEBAUTHN] Logout successful');
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('❌ [WEBAUTHN] Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

module.exports = router;
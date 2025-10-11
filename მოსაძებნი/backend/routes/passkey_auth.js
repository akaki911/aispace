const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { getWebAuthnConfig, validateWebAuthnRequest } = require('../config/webauthn');
const credentialService = require('../services/credential_service');
const userService = require('../services/user_service');
const auditService = require('../services/audit_service');
const deviceService = require('../services/device_service');

const router = express.Router();

const telemetryEnabled = process.env.NODE_ENV !== 'production';
const logTelemetry = (message, meta = {}) => {
  if (!telemetryEnabled) {
    return;
  }
  console.log(`🛰️ [Passkey API] ${message}`, meta);
};

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

const respondWithServerError = (res, scope, error, message) => {
  const errorId = randomUUID();
  console.error(`❌ [Passkey API] ${scope} failed`, {
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

const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many Passkey verification attempts',
    code: 'PASSKEY_RATE_LIMITED',
    retryAfter: '10 minutes',
  },
});

router.post('/register-options', async (req, res) => {
  try {
    const { userId, email, displayName } = req.body || {};

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        error: 'userId and email are required',
      });
    }

    const config = getWebAuthnConfig(req);
    const originValidation = validateWebAuthnRequest(req, config);

    if (!originValidation.valid) {
      console.warn('⚠️ [Passkey Register] Origin validation failed', originValidation);
      return res.status(400).json({
        success: false,
        error: 'Invalid request origin',
        code: 'INVALID_RP_ORIGIN',
        expected: originValidation.expected,
        received: originValidation.received,
      });
    }

    logTelemetry('Issuing registration options', { userId, email, rpID: config.rpID });

    let existingCredentials = [];
    try {
      existingCredentials = await credentialService.getUserCredentials(userId);
    } catch (error) {
      console.warn('⚠️ [Passkey Register] Failed to load existing credentials', error.message);
    }
    const excludeCredentials = existingCredentials.map((cred) => {
      const storedId = cred.credentialId || cred.credentialID;
      if (!storedId) {
        return null;
      }
      return {
        id: Buffer.from(storedId, 'base64url'),
        type: 'public-key',
        transports: cred.transports || ['internal', 'hybrid'],
      };
    }).filter(Boolean);

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: userId,
      userName: email,
      userDisplayName: displayName || email,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'required',
        requireResidentKey: true,
      },
      supportedAlgorithmIDs: [-7, -35, -36, -257, -258, -259],
      excludeCredentials,
    });

    req.session.passkeyRegistration = {
      challenge: options.challenge,
      userId,
      email,
      displayName: displayName || email,
      createdAt: Date.now(),
    };

    await persistSession(req);

    res.json({
      success: true,
      publicKey: options,
    });
  } catch (error) {
    respondWithServerError(res, 'generate registration options', error, 'Failed to generate registration options');
  }
});

router.post('/register-verify', verifyLimiter, async (req, res) => {
  try {
    const { credential, deviceFingerprint, clientId, uaInfo } = req.body || {};
    const sessionData = req.session.passkeyRegistration;

    if (!credential || !sessionData?.challenge) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registration data',
      });
    }

    const config = getWebAuthnConfig(req);
    const originValidation = validateWebAuthnRequest(req, config);

    if (!originValidation.valid) {
      console.warn('⚠️ [Passkey Login] Origin validation failed', originValidation);
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
      expectedChallenge: sessionData.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        error: 'Registration verification failed',
      });
    }

    const { credentialID, credentialPublicKey, counter, aaguid } = verification.registrationInfo;
    const credentialId = Buffer.from(credentialID).toString('base64url');
    const publicKey = Buffer.from(credentialPublicKey).toString('base64');

    const existingUser = await userService.getUser(sessionData.userId).catch(() => null);
    if (!existingUser) {
      await userService.createUser({
        userId: sessionData.userId,
        email: sessionData.email,
        role: 'CUSTOMER',
        status: 'active',
      });
    }

    await credentialService.storeCredential({
      credentialId,
      userId: sessionData.userId,
      publicKey,
      counter,
      aaguid: aaguid ? Buffer.from(aaguid).toString('hex') : null,
      transports: credential.response?.transports || ['internal', 'hybrid'],
    });

    await auditService.logPasskeyVerification(
      sessionData.userId,
      credentialId,
      req,
      true,
    );

    if (deviceFingerprint && clientId && uaInfo) {
      try {
        await deviceService.registerDevice({
          userId: sessionData.userId,
          clientId,
          fingerprint: deviceFingerprint,
          uaInfo,
          credentialId,
          ip: req.ip || req.connection?.remoteAddress,
          aaguid: aaguid ? Buffer.from(aaguid).toString('hex') : null,
        });
      } catch (deviceError) {
        console.warn('⚠️ [Passkey Register] Device registration failed', deviceError);
      }
    }

    delete req.session.passkeyRegistration;

    logTelemetry('Passkey registered', { userId: sessionData.userId });

    res.json({
      success: true,
      verified: true,
    });
  } catch (error) {
    respondWithServerError(res, 'registration verification', error, 'Registration verification failed');
  }
});

router.post('/login-options', async (req, res) => {
  try {
    const config = getWebAuthnConfig(req);

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: 'preferred',
      timeout: 120000,
      allowCredentials: [],
    });

    req.session.passkeyLogin = {
      challenge: options.challenge,
      createdAt: Date.now(),
    };

    await persistSession(req);

    res.json({
      success: true,
      publicKey: options,
    });
  } catch (error) {
    respondWithServerError(res, 'generate authentication options', error, 'Failed to generate authentication options');
  }
});

router.post('/login-verify', verifyLimiter, async (req, res) => {
  try {
    const { credential, deviceFingerprint, clientId, uaInfo } = req.body || {};
    const challenge = req.session.passkeyLogin?.challenge;

    if (!credential || !challenge) {
      return res.status(400).json({
        success: false,
        error: 'Invalid authentication data',
      });
    }

    const config = getWebAuthnConfig(req);
    const credentialId = Buffer.from(credential.rawId, 'base64url').toString('base64url');
    const storedCredential = await credentialService.findByCredentialId(credentialId);

    if (!storedCredential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found on this device',
      });
    }

    const storedCredentialId = storedCredential.credentialId || storedCredential.credentialID;
    const storedPublicKey = storedCredential.publicKey || storedCredential.credentialPublicKey;

    if (!storedCredentialId || !storedPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'Stored credential is missing required properties',
      });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedRPID: config.rpID,
      expectedOrigin: config.origin,
      authenticator: {
        credentialID: Buffer.from(storedCredentialId, 'base64url'),
        credentialPublicKey: Buffer.from(storedPublicKey, 'base64'),
        counter: storedCredential.counter,
        transports: storedCredential.transports || ['internal', 'hybrid'],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: 'Authentication verification failed',
      });
    }

    if (typeof verification.authenticationInfo?.newCounter === 'number') {
      await credentialService.updateCounter(storedCredential.id, verification.authenticationInfo.newCounter);
    }

    await auditService.logPasskeyVerification(
      storedCredential.userId,
      credentialId,
      req,
      true,
    );

    if (deviceFingerprint && clientId && uaInfo) {
      try {
        const recognition = await deviceService.recognizeDevice(clientId, deviceFingerprint, uaInfo);
        if (recognition.recognized && recognition.device) {
          await deviceService.updateDeviceLogin(
            recognition.device.deviceId,
            req.ip || req.connection?.remoteAddress,
            credentialId,
          );
        } else {
          await deviceService.registerDevice({
            userId: storedCredential.userId,
            clientId,
            fingerprint: deviceFingerprint,
            uaInfo,
            credentialId,
            ip: req.ip || req.connection?.remoteAddress,
            aaguid: storedCredential.aaguid || null,
          });
        }
      } catch (deviceError) {
        console.warn('⚠️ [Passkey Login] Device reconciliation failed', deviceError);
      }
    }

    const user = await userService.getUser(storedCredential.userId);
    const resolvedUser = {
      id: storedCredential.userId,
      email: user?.email || storedCredential.email || 'user@bakhmaro.co',
      role: user?.role || 'CUSTOMER',
      authenticatedViaPasskey: true,
      displayName: user?.displayName || user?.email || storedCredential.email || 'Passkey User',
    };

    req.session.user = {
      id: resolvedUser.id,
      email: resolvedUser.email,
      role: resolvedUser.role,
      authenticatedViaPasskey: true,
    };
    req.session.isAuthenticated = true;
    req.session.authMethod = 'passkey';

    delete req.session.passkeyLogin;

    logTelemetry('Passkey login verified', { userId: resolvedUser.id, role: resolvedUser.role });

    res.json({
      success: true,
      user: resolvedUser,
    });
  } catch (error) {
    respondWithServerError(res, 'authentication verification', error, 'Authentication verification failed');
  }
});

module.exports = router;

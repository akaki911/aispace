// Device-based Authentication API Routes
const express = require('express');
const rateLimit = require('express-rate-limit');
const deviceService = require('../services/device_service');
const userService = require('../services/user_service');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Rate limiting for device operations
const deviceRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per window
  message: { error: 'Too many device requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// CORS and origin validation middleware
const validateOrigin = (req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.REPLIT_DOMAIN,
    'http://localhost:5000',
    'https://localhost:5000'
  ].filter(Boolean);

  const origin = req.get('origin');
  const referer = req.get('referer');
  
  // Allow same-origin requests
  const isValidOrigin = allowedOrigins.some(allowed => 
    origin?.includes(allowed) || referer?.includes(allowed)
  );

  if (!isValidOrigin && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  next();
};

// Apply middleware
router.use(deviceRateLimit);
router.use(validateOrigin);

// POST /api/auth/device/register - Register device after authentication
router.post('/register', async (req, res) => {
  try {
    // Require authentication for device registration
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { clientId, fingerprint, uaInfo, credentialId, trustDevice } = req.body;
    
    if (!clientId || !fingerprint || !uaInfo) {
      return res.status(400).json({
        success: false,
        error: 'Missing required device information'
      });
    }

    console.log(`📱 [DEVICE] Registering device for user ${req.session.user.id}`);

    const deviceId = await deviceService.registerDevice({
      userId: req.session.user.id,
      clientId,
      fingerprint,
      uaInfo,
      credentialId: credentialId || null,
      ip: req.ip || req.connection.remoteAddress,
      aaguid: req.body.aaguid || null,
      trustDevice: trustDevice || false // SOL-422: Pass trust preference
    });

    res.json({
      success: true,
      deviceId,
      message: 'Device registered successfully'
    });

  } catch (error) {
    console.error('❌ [DEVICE] Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Device registration failed',
      details: error.message
    });
  }
});

// GET /api/auth/devices/list - List user's trusted devices (auth required)
router.get('/devices/list', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const devices = await deviceService.getUserDevices(req.session.user.id);
    
    res.json({
      success: true,
      devices: devices || []
    });

  } catch (error) {
    console.error('❌ [DEVICE] List devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices',
      details: error.message
    });
  }
});

// DELETE /api/auth/devices/:deviceId - Remove trusted device (auth required)
router.delete('/devices/:deviceId', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID required'
      });
    }

    await deviceService.removeUserDevice(req.session.user.id, deviceId);
    
    res.json({
      success: true,
      message: 'Device removed successfully'
    });

  } catch (error) {
    console.error('❌ [DEVICE] Remove device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove device',
      details: error.message
    });
  }
});

// POST /api/auth/device/recognize - Recognize device (no auth required)
router.post('/recognize', async (req, res) => {
  try {
    const { clientId, fingerprint, uaInfo } = req.body;
    
    if (!clientId || !fingerprint || !uaInfo) {
      return res.status(400).json({
        success: false,
        error: 'Missing device information'
      });
    }

    console.log(`📱 [DEVICE] Recognizing device with clientId ${clientId.substring(0, 8)}...`);

    const recognition = await deviceService.recognizeDevice(clientId, fingerprint, uaInfo);

    res.json({
      success: true,
      ...recognition
    });

  } catch (error) {
    console.error('❌ [DEVICE] Recognition error:', error);
    res.status(500).json({
      success: false,
      error: 'Device recognition failed',
      details: error.message
    });
  }
});

// GET /api/auth/bootstrap - Combined session + device recognition
router.get('/bootstrap', async (req, res) => {
  try {
    const result = {
      authenticated: false,
      user: null,
      deviceRecognition: {
        recognized: false,
        device: null,
        suggestedAuthMethod: 'register'
      }
    };

    // Check existing session
    if (req.session?.user) {
      result.authenticated = true;
      result.user = {
        id: req.session.user.id,
        email: req.session.user.email,
        role: req.session.user.role,
        authenticatedViaPasskey: req.session.user.authenticatedViaPasskey
      };
    }

    // Device recognition requires device info from client
    const { clientId, fingerprint, uaInfo } = req.query;
    
    if (clientId && fingerprint && uaInfo) {
      try {
        const fingerprintData = JSON.parse(fingerprint);
        const uaData = JSON.parse(uaInfo);
        
        const recognition = await deviceService.recognizeDevice(clientId, fingerprintData, uaData);
        result.deviceRecognition = recognition;
        
        console.log(`🔍 [BOOTSTRAP] Device recognition: ${recognition.recognized ? 'YES' : 'NO'} for role ${recognition.device?.registeredRole || 'unknown'}`);
      } catch (parseError) {
        console.warn('⚠️ [BOOTSTRAP] Failed to parse device info:', parseError.message);
      }
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ [BOOTSTRAP] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Bootstrap failed',
      details: error.message
    });
  }
});

// POST /api/auth/device/trust - Set device trust (auth required)
router.post('/trust', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { deviceId, trusted } = req.body;
    
    if (!deviceId || typeof trusted !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data'
      });
    }

    await deviceService.setDeviceTrust(deviceId, trusted);
    
    res.json({
      success: true,
      message: `Device ${trusted ? 'trusted' : 'untrusted'} successfully`
    });

  } catch (error) {
    console.error('❌ [DEVICE] Trust error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device trust',
      details: error.message
    });
  }
});

// GET /api/auth/devices - Get user devices (auth required)
router.get('/devices', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const devices = await deviceService.getUserDevices(req.session.user.id);
    
    res.json({
      success: true,
      devices: devices.map(device => ({
        id: device.id,
        platform: device.platform,
        os: device.os,
        trusted: device.trusted,
        lastSeenAt: device.lastSeenAt,
        loginCount: device.loginCount,
        hasPasskey: !!device.primaryCredentialIdHash
      }))
    });

  } catch (error) {
    console.error('❌ [DEVICE] Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get devices',
      details: error.message
    });
  }
});

// DELETE /api/auth/device/:deviceId - Remove device (auth required)
router.delete('/:deviceId', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { deviceId } = req.params;
    
    // Verify device belongs to user (security check)
    const devices = await deviceService.getUserDevices(req.session.user.id);
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found or not owned by user'
      });
    }

    await deviceService.removeDevice(deviceId);
    
    res.json({
      success: true,
      message: 'Device removed successfully'
    });

  } catch (error) {
    console.error('❌ [DEVICE] Remove device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove device',
      details: error.message
    });
  }
});

module.exports = router;
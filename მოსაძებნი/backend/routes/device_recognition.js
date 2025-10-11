const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const deviceService = require('../services/device_service');

// Device storage file
const DEVICES_FILE = path.join(__dirname, '../data/recognized_devices.json');

// Ensure devices file exists
const ensureDevicesFile = async () => {
  try {
    await fs.access(DEVICES_FILE);
  } catch (error) {
    const initialData = { devices: {} };
    await fs.writeFile(DEVICES_FILE, JSON.stringify(initialData, null, 2));
    console.log('📱 Created recognized devices file');
  }
};

// Load devices data
const loadDevices = async () => {
  try {
    await ensureDevicesFile();
    const data = await fs.readFile(DEVICES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading devices:', error);
    return { devices: {} };
  }
};

// Save devices data
const saveDevices = async (devicesData) => {
  try {
    await fs.writeFile(DEVICES_FILE, JSON.stringify(devicesData, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving devices:', error);
    return false;
  }
};

// Check if device is recognized
router.post('/check', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    const devicesData = await loadDevices();
    const device = devicesData.devices[deviceId];

    if (device && device.isActive) {
      // Update last used timestamp
      device.lastUsed = new Date().toISOString();
      await saveDevices(devicesData);

      console.log(`✅ Device recognized: ${deviceId.slice(0, 8)}... (Role: ${device.registeredRole})`);

      res.json({
        recognized: true,
        device: {
          deviceId: device.deviceId,
          registeredRole: device.registeredRole,
          lastUsed: device.lastUsed,
          registeredAt: device.registeredAt
        }
      });
    } else {
      console.log(`❓ Unknown device: ${deviceId.slice(0, 8)}...`);
      res.json({ recognized: false });
    }
  } catch (error) {
    console.error('❌ Device check error:', error);
    res.status(500).json({ error: 'Device check failed' });
  }
});

// Register new device
router.post('/register', async (req, res) => {
  try {
    const { deviceId, role, userAgent } = req.body;

    if (!deviceId || !role) {
      return res.status(400).json({ error: 'Device ID and role required' });
    }

    const devicesData = await loadDevices();

    const deviceRecord = {
      deviceId,
      registeredRole: role,
      userAgent: userAgent || 'Unknown',
      registeredAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      isActive: true
    };

    devicesData.devices[deviceId] = deviceRecord;

    const saved = await saveDevices(devicesData);

    if (saved) {
      console.log(`✅ Device registered: ${deviceId.slice(0, 8)}... (Role: ${role})`);
      res.json({ success: true, device: deviceRecord });
    } else {
      res.status(500).json({ error: 'Failed to save device' });
    }
  } catch (error) {
    console.error('❌ Device registration error:', error);
    res.status(500).json({ error: 'Device registration failed' });
  }
});

// Get user's devices (admin only)
router.get('/list', async (req, res) => {
  try {
    // Check if user is admin (simplified check)
    if (!req.session?.user || req.session.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const devicesData = await loadDevices();
    const activeDevices = Object.values(devicesData.devices).filter(d => d.isActive);

    res.json({ devices: activeDevices });
  } catch (error) {
    console.error('❌ Device list error:', error);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

// Revoke device (admin only)
router.post('/revoke', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!req.session?.user || req.session.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    const devicesData = await loadDevices();
    const device = devicesData.devices[deviceId];

    if (device) {
      device.isActive = false;
      device.revokedAt = new Date().toISOString();

      const saved = await saveDevices(devicesData);

      if (saved) {
        console.log(`🚫 Device revoked: ${deviceId.slice(0, 8)}...`);
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to revoke device' });
      }
    } else {
      res.status(404).json({ error: 'Device not found' });
    }
  } catch (error) {
    console.error('❌ Device revoke error:', error);
    res.status(500).json({ error: 'Device revoke failed' });
  }
});

// The following route was added to the original code with error handling.
router.post('/recognize', async (req, res) => {
  try {
    const { clientId, fingerprint, uaInfo } = req.body;

    if (!clientId || !fingerprint || !uaInfo) {
      return res.status(400).json({
        success: false,
        error: 'Missing device information (clientId, fingerprint, uaInfo required)',
        timestamp: new Date().toISOString()
      });
    }

    // Generate device key using clientId (consistent with frontend)
    const deviceKey = clientId;

    const devicesData = await loadDevices();
    const device = devicesData.devices[deviceKey];

    if (device && device.isActive) {
      // Update last used timestamp for file-based devices
      device.lastUsed = new Date().toISOString();
      await saveDevices(devicesData);

      console.log(`✅ Device recognized (recognize route - file store): ${deviceKey.slice(0, 8)}... (Role: ${device.registeredRole})`);

      return res.json({
        success: true,
        recognized: true,
        device: {
          deviceId: device.deviceId,
          registeredRole: device.registeredRole,
          lastSeenAt: device.lastUsed,
          trusted: device.trusted || false
        },
        suggestedAuthMethod: device.registeredRole === 'SUPER_ADMIN' ? 'passkey' : 'password',
        timestamp: new Date().toISOString()
      });
    }

    // Fallback to Firestore-backed device service when local cache misses
    const recognition = await deviceService.recognizeDevice(clientId, fingerprint, uaInfo);

    if (recognition.recognized) {
      console.log(`✅ Device recognized (recognize route - firestore): ${recognition.device.deviceId.slice(0, 8)}... (Role: ${recognition.device.registeredRole})`);

      return res.json({
        success: true,
        recognized: true,
        device: recognition.device,
        suggestedAuthMethod: recognition.suggestedAuthMethod,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`❓ Unknown device (recognize route): ${deviceKey.slice(0, 8)}...`);
    return res.json({
      success: true,
      recognized: false,
      device: null,
      suggestedAuthMethod: 'register',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device recognition error:', error);
    res.status(500).json({
      success: false,
      error: 'Device recognition failed',
      timestamp: new Date().toISOString()
    });
  }
});

// General authentication status endpoint
router.get('/me', (req, res) => {
  try {
    console.log('🔍 [DEVICE RECOGNITION] /me endpoint called:', {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionId: req.sessionID?.substring(0, 8)
    });

    if (!req.session?.user) {
      // Return 200 with authenticated: false for unauthenticated users
      return res.status(200).json({
        success: false,
        authenticated: false,
        user: null,
        message: 'Not authenticated'
      });
    }

    res.json({
      success: true,
      user: req.session.user,
      authenticated: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Device recognition /me error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      authenticated: false
    });
  }
});

module.exports = router;
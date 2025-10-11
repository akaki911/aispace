
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TrustedDeviceStore {
  constructor() {
    this.devicesPath = path.join(__dirname, '../data/trusted_devices.json');
    this.ensureDevicesFile();
  }

  ensureDevicesFile() {
    try {
      const dataDir = path.dirname(this.devicesPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.devicesPath)) {
        const initialData = {};
        fs.writeFileSync(this.devicesPath, JSON.stringify(initialData, null, 2));
        console.log('📱 Created trusted devices file');
      }
    } catch (error) {
      console.error('❌ Error ensuring devices file:', error);
    }
  }

  loadDevices() {
    try {
      if (!fs.existsSync(this.devicesPath)) {
        return {};
      }

      const data = fs.readFileSync(this.devicesPath, 'utf8');
      if (!data.trim()) {
        return {};
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Error loading trusted devices:', error);
      return {};
    }
  }

  saveDevices(devices) {
    try {
      fs.writeFileSync(this.devicesPath, JSON.stringify(devices, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error saving trusted devices:', error);
      return false;
    }
  }

  addTrustedDevice(adminId, deviceHash, deviceInfo) {
    const devices = this.loadDevices();
    
    if (!devices[adminId]) {
      devices[adminId] = [];
    }

    const deviceRecord = {
      hash: deviceHash,
      info: deviceInfo,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isActive: true
    };

    devices[adminId].push(deviceRecord);
    return this.saveDevices(devices);
  }

  isTrustedDevice(adminId, deviceHash) {
    const devices = this.loadDevices();
    
    if (!devices[adminId]) {
      return false;
    }

    const device = devices[adminId].find(d => d.hash === deviceHash && d.isActive);
    
    if (device) {
      // Update last used timestamp
      device.lastUsed = Date.now();
      this.saveDevices(devices);
      return true;
    }

    return false;
  }

  getTrustedDevices(adminId) {
    const devices = this.loadDevices();
    return devices[adminId] || [];
  }

  revokeTrustedDevice(adminId, deviceHash) {
    const devices = this.loadDevices();
    
    if (!devices[adminId]) {
      return false;
    }

    const device = devices[adminId].find(d => d.hash === deviceHash);
    if (device) {
      device.isActive = false;
      device.revokedAt = Date.now();
      return this.saveDevices(devices);
    }

    return false;
  }
}

module.exports = new TrustedDeviceStore();

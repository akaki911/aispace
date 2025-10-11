
const express = require('express');
const router = express.Router();
const backupSystemService = require('../services/backup_system_service');
const { requireAssistantAuth, requireRole } = require('../middleware/authz');

// Initialize backup system
router.post('/initialize', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const result = await backupSystemService.initialize();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger manual backup
router.post('/backup/full', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const result = await backupSystemService.performFullBackup();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get backup system status
router.get('/status', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const result = await backupSystemService.getBackupStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test disaster recovery
router.post('/test/recovery/:backupId', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { backupId } = req.params;
    const result = await backupSystemService.testDisasterRecovery(backupId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify backup integrity
router.post('/verify/:backupId', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { backupId } = req.params;
    const result = await backupSystemService.verifyBackupIntegrity(backupId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List recent backups
router.get('/backups/recent', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const backupDir = path.join(process.cwd(), '.backups');
    const files = await fs.readdir(backupDir);
    
    const manifests = files
      .filter(f => f.endsWith('.manifest.json'))
      .map(f => f.replace('.manifest.json', ''))
      .sort()
      .reverse()
      .slice(0, 10);
    
    const backupInfo = [];
    for (const backupId of manifests) {
      try {
        const manifestPath = path.join(backupDir, `${backupId}.manifest.json`);
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        backupInfo.push({
          backupId,
          timestamp: manifest.timestamp,
          status: manifest.verification.overallStatus || 'unknown',
          totalSize: manifest.metadata.totalSize || 0
        });
      } catch (error) {
        backupInfo.push({
          backupId,
          error: 'Failed to read manifest'
        });
      }
    }
    
    res.json({ success: true, backups: backupInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download backup manifest
router.get('/backup/:backupId/manifest', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { backupId } = req.params;
    const path = require('path');
    const fs = require('fs').promises;
    
    const manifestPath = path.join(process.cwd(), '.backups', `${backupId}.manifest.json`);
    const manifest = await fs.readFile(manifestPath, 'utf8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backupId}.manifest.json"`);
    res.send(manifest);
  } catch (error) {
    res.status(404).json({ success: false, error: 'Backup manifest not found' });
  }
});

// Cleanup old backups
router.post('/cleanup', requireAssistantAuth, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const result = await backupSystemService.cleanupOldBackups();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

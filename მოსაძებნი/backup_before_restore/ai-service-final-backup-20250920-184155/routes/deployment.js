
const express = require('express');
const DeploymentManager = require('../../scripts/deployment-manager');
const DeploymentHealthChecker = require('../deployment-health-check');

const router = express.Router();

// Deploy endpoint
router.post('/deploy', async (req, res) => {
  try {
    const manager = new DeploymentManager();
    const result = await manager.deploy();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Deployment completed successfully',
        backup: result.backupName
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rollback endpoint
router.post('/rollback', async (req, res) => {
  try {
    const { target_commit, reason } = req.body;
    const manager = new DeploymentManager();
    
    // Find the most recent backup if no specific target
    const backups = manager.getBackups();
    const backupName = target_commit || (backups.length > 0 ? backups[0].name : null);
    
    if (!backupName) {
      return res.status(400).json({
        success: false,
        error: 'No backup available for rollback'
      });
    }
    
    const result = await manager.rollback(backupName);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Rollback to ${backupName} completed successfully`,
        reason: reason || 'Manual rollback'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const checker = new DeploymentHealthChecker();
    await checker.performHealthCheck();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Backup management
router.get('/backups', (req, res) => {
  try {
    const manager = new DeploymentManager();
    const backups = manager.getBackups();
    
    res.json({
      success: true,
      backups: backups.map(backup => ({
        name: backup.name,
        created: backup.created,
        size: `${Math.round(backup.size / 1024)}KB`
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Backup creation
router.post('/backup', async (req, res) => {
  try {
    const { type = 'manual' } = req.body;
    const manager = new DeploymentManager();
    const backupName = await manager.createBackup();
    
    res.json({
      success: true,
      backup: backupName,
      type,
      created: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

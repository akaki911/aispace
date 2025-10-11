const { Router } = require('express');

const router = Router();

router.get('/status', (_req, res) => {
  return res.status(200).json({
    success: true,
    enabled: false,
    provider: null,
    lastBackupAt: null,
    nextBackupAt: null,
    items: 0,
    message: 'Backup system disabled in this environment.',
    timestamp: new Date().toISOString(),
  });
});

router.get('/list', (_req, res) => {
  return res.status(200).json({
    success: true,
    enabled: false,
    backups: [],
    count: 0,
    message: 'Backup system disabled in this environment.',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

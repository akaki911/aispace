const express = require('express');
const { adminSetupGuard } = require('../middleware/admin_guards');
const { getSnapshots } = require('../services/gurulo_brain_status');

const router = express.Router();

const buildHandler = (extractor) => (req, res) => {
  try {
    const snapshots = getSnapshots();
    const payload = extractor(snapshots);

    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  } catch (error) {
    console.error('❌ [GURULO STATUS] Failed to build snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'GURULO_STATUS_UNAVAILABLE',
      message: 'Unable to generate Gurulo status snapshot',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

router.get('/gurulo-status', adminSetupGuard, buildHandler((snapshots) => snapshots.guruloStatus));

router.get(
  '/gurulo-brain-status',
  adminSetupGuard,
  buildHandler((snapshots) => snapshots.brainStatus),
);

module.exports = router;

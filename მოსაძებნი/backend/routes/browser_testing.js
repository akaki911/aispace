const express = require('express');
const router = express.Router();
const { getStatus, queueRun } = require('../services/browserTestingOrchestrator');

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', mode: res.locals.assistantMode || 'build' });
});

router.get('/status', (req, res) => {
  res.json({ success: true, data: getStatus() });
});

router.post('/jobs/trigger', (req, res) => {
  const result = queueRun();
  res.status(202).json({ success: true, data: result });
});

module.exports = router;

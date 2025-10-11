
// backend/routes/admin_setup.js
const express = require('express');
const router = express.Router();

router.post('/setup', (req, res) => {
  const provided = req.headers['x-admin-setup-token'] || req.body?.token || '';
  const expected = process.env.ADMIN_SETUP_TOKEN || '';
  if (!expected) return res.status(500).json({ error: 'ADMIN_SETUP_TOKEN not configured' });
  if (!provided || provided !== expected) return res.status(401).json({ error: 'Invalid setup token' });
  return res.status(200).json({ ok: true });
});

module.exports = router;

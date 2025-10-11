const express = require('express');
const router = express.Router();
const { list } = require('../services/integrationRegistry');

router.get('/health', (req, res) => {
  res.json({ success: true, connectors: list().length });
});

router.get('/connectors', (req, res) => {
  res.json({ success: true, data: list() });
});

module.exports = router;

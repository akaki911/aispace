const express = require('express');
const { getVersionInfo } = require('../utils/versionInfo');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(getVersionInfo());
});

module.exports = router;

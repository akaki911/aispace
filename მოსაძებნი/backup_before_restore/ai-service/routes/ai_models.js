'use strict';

const express = require('express');
const router = express.Router();
const { getModels } = require('../controllers/modelsController');

// Source of truth endpoint
router.get('/models', getModels);

module.exports = router;
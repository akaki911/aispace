'use strict';

const express = require('express');
const router = express.Router();
const { getModels } = require('../controllers/modelsController');
const { z } = require('zod');

// Define a Zod schema for validation (assuming no specific params for /models)
const modelsSchema = z.object({}); 

// Middleware for validation
const validateModelsParams = (req, res, next) => {
  try {
    modelsSchema.parse(req.query); // or req.body or req.params depending on where params are
    next();
  } catch (error) {
    return res.status(400).json({ message: 'Invalid input', errors: error.errors });
  }
};

// Source of truth endpoint
router.get('/models', validateModelsParams, getModels);

module.exports = router;
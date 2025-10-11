
const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { verifyAdminToken } = require('../utils/jwt');

const router = express.Router();

// Rate limiting for introspection endpoint
const introspectionRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per window
  message: { error: 'Too many introspection requests', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request validation schema
const introspectionSchema = Joi.object({
  token: Joi.string().required()
});

// POST /admin/auth/introspect - Token introspection endpoint
router.post('/introspect', introspectionRateLimit, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = introspectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        active: false,
        error: 'Invalid request format',
        details: error.details[0].message
      });
    }

    const { token } = value;

    try {
      // Verify the token
      const claims = verifyAdminToken(token);
      
      // Return active token with claims
      res.json({
        active: true,
        claims: {
          role: claims.role,
          personalId: claims.personalId,
          sessionId: claims.sessionId,
          action: claims.action,
          iat: claims.iat,
          exp: claims.exp,
          iss: claims.iss,
          aud: claims.aud
        }
      });

    } catch (verificationError) {
      // Token is invalid or expired
      res.json({
        active: false,
        error: 'Token verification failed'
      });
    }

  } catch (error) {
    console.error('❌ Token introspection error:', error);
    res.status(500).json({
      active: false,
      error: 'Internal server error',
      code: 'INTROSPECTION_ERROR'
    });
  }
});

module.exports = router;

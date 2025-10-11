
const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
// Basic admin auth middleware for now
const verifyAdminSession = (req, res, next) => {
  // Simple admin check - in production this should verify JWT or session
  const adminToken = req.headers['x-admin-token'] || req.session?.adminUser;
  
  if (!adminToken) {
    return res.status(401).json({
      error: 'Admin authentication required',
      code: 'ADMIN_AUTH_REQUIRED'
    });
  }

  // Mock admin user for now
  req.adminUser = {
    personalId: '01019062020',
    role: 'SUPER_ADMIN',
    email: 'admin@bakhmaro.co'
  };

  next();
};

const router = express.Router();

// Rate limiting
const createUserRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many user creation attempts', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schema
const createUserSchema = Joi.object({
  role: Joi.string().valid('SUPER_ADMIN', 'PROVIDER').required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().when('role', {
    is: 'SUPER_ADMIN',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  lastName: Joi.string().when('role', {
    is: 'SUPER_ADMIN', 
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  personalId: Joi.string().when('role', {
    is: 'SUPER_ADMIN',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  phone: Joi.string().optional(),
  companyName: Joi.string().when('role', {
    is: 'PROVIDER',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  contactName: Joi.string().when('role', {
    is: 'PROVIDER',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  taxId: Joi.string().when('role', {
    is: 'PROVIDER',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  note: Joi.string().optional()
});

router.post('/create', createUserRateLimit, verifyAdminSession, async (req, res) => {
  try {
    console.log('🔒 Admin user creation requested by:', req.adminUser.personalId);

    // Validate request body
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_FAILED',
        details: error.details.map(d => d.message)
      });
    }

    const userData = value;

    // Simulate user creation (replace with actual Firebase Admin SDK implementation)
    const mockUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Audit log entry
    const auditEntry = {
      action: `CREATE_${userData.role}`,
      targetEmail: userData.email,
      byPersonalId: req.adminUser.personalId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      success: true
    };

    console.log('📝 Audit log:', auditEntry);

    // Return success response
    res.json({
      ok: true,
      uid: mockUserId,
      role: userData.role,
      email: userData.email,
      firestoreUserDocId: `${userData.role.toLowerCase()}_${mockUserId}`,
      message: `${userData.role} user created successfully`,
      audit: auditEntry
    });

  } catch (error) {
    console.error('❌ User creation error:', error);
    
    // Audit log for failure
    const failureAudit = {
      action: `CREATE_USER_FAILED`,
      targetEmail: req.body?.email || 'unknown',
      byPersonalId: req.adminUser?.personalId || 'unknown',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message
    };

    console.log('📝 Failed audit log:', failureAudit);

    res.status(500).json({
      error: 'User creation failed',
      code: 'CREATION_FAILED',
      details: error.message
    });
  }
});

module.exports = router;

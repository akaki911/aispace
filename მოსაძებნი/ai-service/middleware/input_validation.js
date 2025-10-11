
const { z } = require('zod');

/**
 * Input Validation Schemas using Zod
 */

// Chat request schema
const chatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message too long')
    .refine(val => val.trim().length > 0, 'Message cannot be only whitespace'),
  
  personalId: z.string()
    .optional()
    .refine(val => !val || /^[a-zA-Z0-9_-]+$/.test(val), 'Invalid personalId format'),
  
  context: z.object({
    fileContext: z.array(z.string()).optional(),
    projectInfo: z.record(z.any()).optional()
  }).optional()
});

// Models request schema (GET params)
const modelsParamsSchema = z.object({
  category: z.enum(['small', 'medium', 'large']).optional(),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).optional()
});

// Proposals request schema
const proposalsParamsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'applied']).optional(),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(50)).optional()
});

// Create proposal schema
const createProposalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  changes: z.array(z.object({
    file: z.string().min(1),
    action: z.enum(['create', 'update', 'delete']),
    content: z.string()
  })).min(1, 'At least one change is required')
});

// File path validation
const filePathSchema = z.string()
  .min(1)
  .refine(path => !path.includes('..'), 'Path traversal not allowed')
  .refine(path => !path.startsWith('/'), 'Absolute paths not allowed')
  .refine(path => !/\.(env|key|secret|credentials)$/i.test(path), 'Sensitive file access denied');

/**
 * Validation middleware factory
 */
function validateRequest(schema, target = 'body') {
  return (req, res, next) => {
    try {
      let dataToValidate;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        console.warn('❌ [VALIDATION] Request validation failed:', errors);
        
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors,
          timestamp: new Date().toISOString()
        });
      }

      // Replace original data with validated data
      switch (target) {
        case 'body':
          req.body = result.data;
          break;
        case 'query':
          req.query = result.data;
          break;
        case 'params':
          req.params = result.data;
          break;
      }

      next();

    } catch (error) {
      console.error('❌ [VALIDATION] Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'VALIDATION_MIDDLEWARE_ERROR',
        message: 'Validation processing failed',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Rate limiting by IP
 */
const rateLimitByIP = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  // Simple in-memory rate limiting (in production, use Redis)
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const key = `rate_limit_${ip}`;
  const currentWindow = Math.floor(now / windowMs);
  const stored = global.rateLimitStore.get(key);

  if (!stored || stored.window !== currentWindow) {
    global.rateLimitStore.set(key, {
      window: currentWindow,
      count: 1
    });
    return next();
  }

  if (stored.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP',
      retryAfter: Math.ceil((windowMs - (now % windowMs)) / 1000),
      timestamp: new Date().toISOString()
    });
  }

  stored.count++;
  next();
};

module.exports = {
  // Schemas
  chatRequestSchema,
  modelsParamsSchema,
  proposalsParamsSchema,
  createProposalSchema,
  filePathSchema,
  
  // Middleware
  validateRequest,
  rateLimitByIP,
  
  // Specific validators
  validateChatRequest: validateRequest(chatRequestSchema, 'body'),
  validateModelsParams: validateRequest(modelsParamsSchema, 'query'),
  validateProposalsParams: validateRequest(proposalsParamsSchema, 'query'),
  validateCreateProposal: validateRequest(createProposalSchema, 'body')
};

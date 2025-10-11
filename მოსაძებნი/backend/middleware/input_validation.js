
const { z } = require('zod');

/**
 * Backend Input Validation Schemas
 */

// File tree request validation
const fileTreeParamsSchema = z.object({
  path: z.string().optional().refine(
    path => !path || (!path.includes('..') && !path.startsWith('/')),
    'Invalid path format'
  )
});

// Auto-improve validation
const autoImproveRequestSchema = z.object({
  type: z.enum(['validate', 'apply', 'rollback']),
  proposalId: z.string().optional(),
  changes: z.array(z.object({
    file: z.string().min(1),
    action: z.enum(['create', 'update', 'delete']),
    content: z.string()
  })).optional()
});

// Admin auth validation
const adminAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  setupToken: z.string().optional()
});

// Memory sync validation
const memorySyncSchema = z.object({
  userId: z.string().min(1),
  data: z.record(z.any()),
  timestamp: z.string().optional()
});

/**
 * Validation middleware factory for Backend
 */
function validateBackendRequest(schema, target = 'body') {
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

        console.warn('❌ [BACKEND VALIDATION] Request validation failed:', errors);
        
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors,
          timestamp: new Date().toISOString()
        });
      }

      // Replace with validated data
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
      console.error('❌ [BACKEND VALIDATION] Validation error:', error);
      res.status(500).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Validation processing failed',
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = {
  fileTreeParamsSchema,
  autoImproveRequestSchema,
  adminAuthSchema,
  memorySyncSchema,
  validateBackendRequest,
  
  // Specific validators
  validateFileTreeParams: validateBackendRequest(fileTreeParamsSchema, 'query'),
  validateAutoImprove: validateBackendRequest(autoImproveRequestSchema, 'body'),
  validateAdminAuth: validateBackendRequest(adminAuthSchema, 'body'),
  validateMemorySync: validateBackendRequest(memorySyncSchema, 'body')
};

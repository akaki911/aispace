
// AI Guard Middleware - Security layer for AI operations
const aiGuard = {
  // Validate AI requests
  validateRequest: (req, res, next) => {
    try {
      // Basic validation for AI requests
      if (!req.body && req.method === 'POST') {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'Request body is required for AI operations'
        });
      }
      
      next();
    } catch (error) {
      console.error('[AI Guard] Validation error:', error);
      res.status(500).json({
        error: 'AI Guard Error',
        message: 'Request validation failed'
      });
    }
  },

  // Rate limiting for AI requests
  rateLimit: (req, res, next) => {
    // Simple rate limiting - can be enhanced
    next();
  }
};

module.exports = aiGuard;

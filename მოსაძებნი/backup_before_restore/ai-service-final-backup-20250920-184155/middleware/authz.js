
/**
 * Authorization Middleware for Replit Assistant API
 * SOL-211 Security Hardening - Production Ready
 * 
 * Integrates with existing JWT/session authentication system
 */

const { verifyToken, extractTokenFromRequest } = require('../../backend/utils/jwt');

/**
 * Check backend session for authenticated user
 */
async function checkBackendSession(req) {
  try {
    const response = await fetch('http://localhost:5002/api/admin/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': req.headers.cookie || '',
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.user) {
        return {
          id: data.user.id,
          role: data.user.role || 'SUPER_ADMIN',
          permissions: ['assistant:read', 'assistant:write', 'assistant:admin'],
          authenticated: true,
          authMethod: 'session'
        };
      }
    }
    return null;
  } catch (error) {
    console.error('❌ [AUTHZ] Backend session check failed:', error.message);
    return null;
  }
}

/**
 * Main authorization middleware for assistant endpoints
 * Supports both JWT tokens and session-based authentication
 */
async function requireAssistantAuth(req, res, next) {
  try {
    // Development mode უპირველეს ყოვლისა
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 [DEV] Development mode - bypassing authentication');
      req.user = {
        id: req.headers['x-user-id'] || '01019062020',
        role: req.headers['x-user-role'] || 'SUPER_ADMIN',
        permissions: ['assistant:read', 'assistant:write', 'assistant:admin'],
        authenticated: true,
        authMethod: 'development-bypass'
      };
      return next();
    }

    // Production mode authentication
    const token = extractTokenFromRequest(req);
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded.type === 'api_access') {
          req.user = {
            id: decoded.userId,
            role: decoded.role,
            permissions: decoded.permissions || [],
            authenticated: true,
            authMethod: 'jwt'
          };
          
          console.log('✅ [AUTHZ] JWT authentication successful:', req.user.id);
          return next();
        }
      } catch (jwtError) {
        console.warn('⚠️ [AUTHZ] JWT verification failed:', jwtError.message);
      }
    }

    // Fallback to session authentication
    const sessionUser = await checkBackendSession(req);
    if (sessionUser) {
      req.user = sessionUser;
      console.log('✅ [AUTHZ] Session authentication successful:', req.user.id);
      return next();
    }

    // No valid authentication found
    console.log('❌ [AUTHZ] No valid authentication found');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid authentication required',
      timestamp: new Date().toISOString(),
      supportedMethods: ['JWT Bearer token', 'Admin session']
    });

  } catch (error) {
    console.error('❌ [AUTHZ] Authentication error:', error.message);
    res.status(500).json({
      error: 'Authentication Error',
      message: 'Internal authentication failure',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Role-based authorization check
 * @param {string[]} requiredRoles - Array of required roles
 */
function requireRole(requiredRoles = ['SUPER_ADMIN', 'ADMIN']) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.authenticated) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        });
      }

      const userRole = req.user.role;
      if (!requiredRoles.includes(userRole)) {
        console.log(`❌ [AUTHZ] Role '${userRole}' not in required roles: ${requiredRoles.join(', ')}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          requiredRoles: requiredRoles,
          userRole: userRole,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ [AUTHZ] Role check passed: ${userRole}`);
      next();

    } catch (error) {
      console.error('❌ [AUTHZ] Role check error:', error.message);
      res.status(500).json({
        error: 'Authorization Error',
        message: 'Role validation failed',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Permission-based authorization check
 * @param {string} requiredPermission - Required permission
 */
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.authenticated) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        });
      }

      const userPermissions = req.user.permissions || [];
      if (!userPermissions.includes(requiredPermission)) {
        console.log(`❌ [AUTHZ] Missing permission '${requiredPermission}' for user ${req.user.id}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Missing required permission',
          requiredPermission: requiredPermission,
          userPermissions: userPermissions,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ [AUTHZ] Permission check passed: ${requiredPermission}`);
      next();

    } catch (error) {
      console.error('❌ [AUTHZ] Permission check error:', error.message);
      res.status(500).json({
        error: 'Authorization Error',
        message: 'Permission validation failed',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Enhanced rate limiting middleware for assistant endpoints
 */
function assistantRateLimit() {
  const requests = new Map();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // 30 requests per minute

  return (req, res, next) => {
    // SOL-311: Skip rate limiting for health endpoints and status checks
    const healthPaths = ['/health', '/api/health', '/status', '/api/status'];
    if (healthPaths.includes(req.path)) {
      return next();
    }

    const clientId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    
    // Clean up old entries
    for (const [id, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(id);
      }
    }

    // Check current client
    let clientData = requests.get(clientId);
    if (!clientData) {
      clientData = { count: 0, firstRequest: now };
      requests.set(clientId, clientData);
    }

    // Reset window if needed
    if (now - clientData.firstRequest > windowMs) {
      clientData.count = 0;
      clientData.firstRequest = now;
    }

    clientData.count++;

    const remaining = Math.max(0, maxRequests - clientData.count);
    const resetTime = Math.ceil((clientData.firstRequest + windowMs) / 1000);
    
    // Add rate limit headers to all responses
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Used': clientData.count.toString()
    });

    if (clientData.count > maxRequests) {
      const retryAfter = Math.ceil((windowMs - (now - clientData.firstRequest)) / 1000);
      
      console.warn(`⚠️ [RATE_LIMIT] Client ${clientId} exceeded limit: ${clientData.count}/${maxRequests} on ${req.path}`);
      
      // Add Retry-After header for better client handling
      res.set('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        limit: maxRequests,
        remaining: 0,
        used: clientData.count,
        windowMs: windowMs,
        retryAfter: retryAfter,
        resetTime: resetTime,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
}

/**
 * Request logging middleware for security auditing
 */
function auditLog(req, res, next) {
  const startTime = Date.now();
  
  // Log request with enhanced details
  console.log(`🔐 [AUDIT] ${req.method} ${req.path} - User: ${req.user?.id || 'anonymous'} - Role: ${req.user?.role || 'none'} - IP: ${req.ip} - Auth: ${req.user?.authMethod || 'none'}`);
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const executionTime = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    console.log(`🔐 [AUDIT] Response: ${res.statusCode} - ${success ? 'SUCCESS' : 'FAILED'} - ${executionTime}ms - User: ${req.user?.id || 'anonymous'}`);
    
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Development mode bypass (only for testing)
 */
function developmentBypass(req, res, next) {
  // ყოველთვის ჩართული DEV მოდში
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 [DEV] Development mode - bypassing authentication');
    req.user = {
      id: req.headers['x-user-id'] || '01019062020',
      role: req.headers['x-user-role'] || 'SUPER_ADMIN',
      permissions: ['assistant:read', 'assistant:write', 'assistant:admin'],
      authenticated: true,
      authMethod: 'development-bypass'
    };
    return next();
  }
  next();
}

module.exports = {
  requireAssistantAuth,
  requireRole,
  requirePermission,
  assistantRateLimit,
  securityHeaders,
  auditLog,
  developmentBypass
};

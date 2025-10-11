/**
 * RBAC Middleware for AI Service
 * Enforces role-based access control for sensitive endpoints
 */

const { verifyServiceToken, getServiceAuthConfigs } = require('../../shared/serviceToken');

/**
 * Check if user has required role for Auto-Improve features
 */
const requireSuperAdmin = (req, res, next) => {
  try {
    // Extract authentication info from service token or headers
    const authHeader = req.headers.authorization;
    const personalId = req.headers['x-personal-id'] || req.body?.personalId;

    console.log('🔒 [RBAC] Checking Super Admin access:', { personalId, hasAuth: !!authHeader });

    // Super Admin Personal ID check
    const SUPER_ADMIN_ID = '01019062020';

    if (personalId !== SUPER_ADMIN_ID) {
      console.warn('🚫 [RBAC] Access denied - not Super Admin:', personalId);
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Super Admin role required for Auto-Improve operations',
        requiredRole: 'SUPER_ADMIN',
        userRole: 'CUSTOMER',
        timestamp: new Date().toISOString()
      });
    }

    // Additional service authentication check
    if (req.serviceAuth && !req.serviceAuth.permissions.includes('auto_improve')) {
      console.warn('🚫 [RBAC] Service lacks auto_improve permission');
      return res.status(403).json({
        success: false,
        error: 'SERVICE_PERMISSION_DENIED',
        message: 'Service not authorized for Auto-Improve operations',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ [RBAC] Super Admin access granted');
    next();

  } catch (error) {
    console.error('❌ [RBAC] RBAC middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'RBAC_ERROR',
      message: 'Role validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

const resolvePrimaryServiceConfig = () => getServiceAuthConfigs()[0] || null;

const extractServiceToken = (req) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.headers['x-service-token'] || req.headers['x-ai-internal-token'] || null;
};

/**
 * Check if request comes from authorized Backend service
 */
const requireBackendService = (req, res, next) => {
  try {
    // Service authentication should be validated by service_auth middleware
    if (!req.serviceAuth || req.serviceAuth.service !== 'backend') {
      console.warn('🚫 [RBAC] Non-backend service access denied');
      return res.status(403).json({
        success: false,
        error: 'SERVICE_ACCESS_DENIED',
        message: 'Only Backend service can access Auto-Improve endpoints',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ [RBAC] Backend service access granted');
    next();

  } catch (error) {
    console.error('❌ [RBAC] Service RBAC error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVICE_RBAC_ERROR',
      message: 'Service role validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Combined middleware for Auto-Improve endpoints
 */
const protectAutoImprove = (req, res, next) => {
  const primaryConfig = resolvePrimaryServiceConfig();
  const isDevelopmentBypass = primaryConfig?.isFallback && process.env.NODE_ENV === 'development';

  if (isDevelopmentBypass) {
    console.log('🔓 [AI RBAC] Development mode - bypassing RBAC for AutoImprove');
    return next();
  }

  if (req.user && req.user.role === 'SUPER_ADMIN') {
    console.log('✅ [AI RBAC] SUPER_ADMIN access granted');
    return next();
  }

  if (req.serviceAuth?.isAuthenticated) {
    const permissions = Array.isArray(req.serviceAuth.permissions) ? req.serviceAuth.permissions : [];
    if (permissions.includes('auto_improve') || req.serviceAuth.service === 'backend') {
      console.log('✅ [AI RBAC] Service auth granted via middleware context');
      return next();
    }
  }

  const serviceToken = extractServiceToken(req);

  if (serviceToken) {
    try {
      const verification = verifyServiceToken(serviceToken);
      const decoded = verification.decoded || {};
      const serviceName = decoded.service || decoded.svc || 'unknown';
      const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];

      if (serviceName === 'backend' || serviceName === 'backend-auto-improve' || permissions.includes('auto_improve')) {
        console.log('✅ [AI RBAC] Service token verified for AutoImprove access', {
          service: serviceName,
          permissions
        });
        return next();
      }
    } catch (error) {
      console.warn('⚠️ [AI RBAC] Service token verification failed:', error.message);
    }
  }

  console.warn('🚫 [AI RBAC] Access denied - not SUPER_ADMIN and invalid service token');
  return res.status(403).json({
    success: false,
    error: 'FORBIDDEN',
    message: 'SUPER_ADMIN access required',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  requireSuperAdmin,
  requireBackendService,
  protectAutoImprove
};
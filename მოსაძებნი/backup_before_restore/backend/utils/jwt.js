
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Generate JWT token for API access
const generateApiToken = (userId, role, permissions = []) => {
  const payload = {
    userId,
    role,
    permissions,
    type: 'api_access',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'bakhmaro-api',
    audience: 'bakhmaro-clients'
  });
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  const payload = {
    userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'bakhmaro-api',
    audience: 'bakhmaro-clients'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'bakhmaro-api',
      audience: 'bakhmaro-clients'
    });
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

// Extract token from request
const extractTokenFromRequest = (req) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return apiKey;
  }

  // Check query parameter
  if (req.query.token) {
    return req.query.token;
  }

  return null;
};

// JWT Middleware for API routes
const authenticateJWT = (req, res, next) => {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const decoded = verifyToken(token);
    
    // Check token type
    if (decoded.type !== 'api_access') {
      return res.status(401).json({
        error: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'TOKEN_INVALID'
    });
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: 'Missing required permission',
        code: 'MISSING_PERMISSION',
        required: requiredPermission,
        available: req.user.permissions
      });
    }

    next();
  };
};

// Token refresh endpoint logic
const refreshTokenLogic = async (refreshToken) => {
  try {
    const decoded = verifyToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }

    // In production, verify refresh token against database/Redis
    // For now, generate new tokens
    const newAccessToken = generateApiToken(decoded.userId, 'CUSTOMER'); // Default role
    const newRefreshToken = generateRefreshToken(decoded.userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: JWT_EXPIRES_IN
    };
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
};

// Regular API token endpoint
const generateTokenForRegularAPI = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate against Firebase (this would be replaced with your user validation)
    // For now, simple validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Mock user validation - replace with actual Firebase/DB check
    const userId = email; // This should be actual user ID
    const role = 'CUSTOMER'; // This should come from user data
    
    const accessToken = generateApiToken(userId, role);
    const refreshToken = generateRefreshToken(userId);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN,
      user: { id: userId, email, role }
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      error: 'Token generation failed',
      code: 'TOKEN_GENERATION_ERROR'
    });
  }
};

module.exports = {
  generateApiToken,
  generateRefreshToken,
  verifyToken,
  extractTokenFromRequest,
  authenticateJWT,
  requireRole,
  requirePermission,
  refreshTokenLogic,
  generateTokenForRegularAPI,
  JWT_SECRET,
  JWT_EXPIRES_IN
};

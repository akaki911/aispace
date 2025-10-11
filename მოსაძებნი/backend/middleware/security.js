
const rateLimit = require('express-rate-limit');

// Security Headers Middleware
const securityHeaders = (req, res, next) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// IP Logging Middleware
const ipLogger = (req, res, next) => {
  const realIP = req.get('X-Forwarded-For') || 
                 req.get('X-Real-IP') || 
                 req.connection.remoteAddress || 
                 req.ip;
  
  req.realIP = realIP;
  
  // Log suspicious activity
  if (process.env.ENABLE_SECURITY_LOGGING === 'true') {
    console.log(`🔍 REQUEST: ${req.method} ${req.originalUrl} from ${realIP}`);
  }
  
  next();
};

// Device Fingerprint Middleware
const deviceFingerprintMiddleware = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  const customFingerprint = req.get('X-Device-Fingerprint') || '';
  
  req.deviceInfo = {
    userAgent,
    language: acceptLanguage.split(',')[0],
    customFingerprint,
    timestamp: Date.now()
  };
  
  next();
};

// Auth Rate Limiter
const createAuthLimiter = (windowMs = 5 * 60 * 1000, max = 5) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMITED',
      retryAfter: Math.ceil(windowMs / 1000 / 60) + ' minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      return req.realIP || req.ip;
    }
  });
};

// API Rate Limiter
const createApiLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many API requests',
      code: 'API_RATE_LIMITED',
      retryAfter: Math.ceil(windowMs / 1000 / 60) + ' minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.realIP || req.ip;
    }
  });
};

module.exports = {
  securityHeaders,
  ipLogger,
  deviceFingerprintMiddleware,
  createAuthLimiter,
  createApiLimiter
};

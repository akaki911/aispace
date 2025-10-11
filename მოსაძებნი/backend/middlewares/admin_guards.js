// backend/middlewares/admin_guards.js
const crypto = require('crypto');

function originGuard(req, res, next) {
  const devDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
  const allowedOrigins = [
    `https://${devDomain}`,
    'https://2c2cd970-4894-4549-bf8a-0ed98550093e-00-2lgecmi2xhw4g.janeway.replit.dev',
    'http://localhost:5000',
    'http://localhost:3000'
  ].filter(Boolean);

  // Add custom allowed origins from env
  const customOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  
  const allowed = [...allowedOrigins, ...customOrigins];

  const origin = req.headers.origin || '';

  console.log('🔍 [Origin Guard] Checking origin:', { origin, allowed, devDomain });

  // Allow server-to-server / curl (no Origin header)
  if (!origin) return next();

  // Development bypass: Allow any replit.dev origin
  if (process.env.NODE_ENV === 'development' && origin.includes('.replit.dev')) {
    console.log('✅ [Origin Guard] Development bypass for replit.dev origin');
    return next();
  }

  if (allowed.length && allowed.includes(origin)) {
    console.log('✅ [Origin Guard] Origin allowed');
    return next();
  }
  
  console.log('❌ [Origin Guard] Origin not allowed:', { origin, allowed });
  return res.status(403).json({ error: 'Origin not allowed', origin, allowed });
}

const adminSetupGuard = (req, res, next) => {
  // Skip if already authenticated as admin
  if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN')) {
    return next();
  }

  const token = req.headers['x-admin-setup-token'] || 
                req.headers['X-Admin-Setup-Token'] || 
                req.query.setupToken ||
                req.body?.adminSetupToken ||
                req.body?.token ||
                '';

  console.log('🔐 Admin Setup Guard:', {
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    expectedToken: process.env.ADMIN_SETUP_TOKEN ? 'SET' : 'NOT_SET',
    isDevelopment: process.env.NODE_ENV === 'development',
    tokenPrefix: token ? token.substring(0, 15) + '...' : 'NONE'
  });

  if (!token) {
    console.log('❌ No admin setup token provided');
    return res.status(401).json({ 
      error: 'Admin setup token required',
      debug: {
        hasToken: false,
        tokenLength: 0
      }
    });
  }

  // Enhanced validation for development and production
  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  let isValid = false;

  if (process.env.NODE_ENV === 'development') {
    // Development: Accept localStorage tokens and various formats
    const validPrefixes = [
      'DEV_ADMIN_SETUP_TOKEN_',
      'admin_setup_token_',
      'DEV_'
    ];

    // Check if token matches expected token exactly
    if (expectedToken && token === expectedToken) {
      isValid = true;
    }
    // Check if token has valid development prefix and sufficient length
    else if (validPrefixes.some(prefix => token.startsWith(prefix)) && token.length >= 15) {
      isValid = true;
    }
    // Special case for tokens stored in localStorage (common pattern)
    else if (token.includes('_ok') && token.length >= 20) {
      isValid = true;
    }
    // Allow any token with reasonable length in development
    else if (token.length >= 20 && token.length <= 50) {
      isValid = true;
    }
  } else {
    // Production: Exact match only
    isValid = expectedToken && token === expectedToken;
  }

  if (!isValid) {
    console.log('❌ Invalid admin setup token:', {
      tokenPrefix: token.substring(0, 15),
      tokenLength: token.length,
      expectedLength: expectedToken ? expectedToken.length : 0,
      nodeEnv: process.env.NODE_ENV
    });

    return res.status(401).json({ 
      error: 'Admin setup token required',
      debug: {
        hasToken: true,
        tokenLength: token.length,
        expectedLength: expectedToken ? expectedToken.length : 0,
        nodeEnv: process.env.NODE_ENV,
        hint: 'Token format not recognized for current environment'
      }
    });
  }

  console.log('✅ Admin setup token validated successfully');
  next();
};

function adminPersonalGuard(req, res, next) {
  // This guard validates that the user's personal ID matches allowed admin
  // SUPERADMIN ONLY: WebAuthn/Passkey functionality restricted to 01019062020 (აკაკი ცინცაძე)
  console.log('🔐 Admin Personal Guard: Checking super admin personal ID authorization...');

  const allowedPersonalId = process.env.ADMIN_ALLOWED_PERSONAL_ID || '01019062020';
  const requestPersonalId = req.body?.adminId || req.body?.personalId || req.body?.userId;
  if (!personalId || personalId !== process.env.ADMIN_ALLOWED_PERSONAL_ID) {
    return res.status(403).json({error:'Admin not allowed'});
  }
  next();
}

function rateLimitSimple(windowMs = 10000, max = 10) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(ts => now - ts < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (arr.length > max) return res.status(429).json({error:'Too many requests'});
    next();
  };
}

module.exports = { originGuard, adminSetupGuard, adminPersonalGuard, rateLimitSimple };
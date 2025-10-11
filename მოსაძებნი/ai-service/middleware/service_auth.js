const { randomUUID, timingSafeEqual } = require('crypto');

const { verifyServiceToken, getInternalToken } = require('../../shared/serviceToken');
const { INTERNAL_HEADER } = require('../../shared/config/envValidator');

const HEADER_NAME = INTERNAL_HEADER.toLowerCase();

const ids = () => ({
  correlationId: randomUUID(),
  traceId: randomUUID(),
  spanId: randomUUID().slice(0, 16),
});

const log = (level, message, metadata = {}) => {
  const payload = {
    level,
    message,
    service: 'ai-service',
    scope: 'service-auth',
    ...ids(),
    ...metadata,
  };

  if (level === 'error' || level === 'fatal') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
};

const constantTimeEquals = (a, b) => {
  const expected = Buffer.from(String(a || ''), 'utf8');
  const provided = Buffer.from(String(b || ''), 'utf8');
  if (expected.length !== provided.length) {
    return false;
  }
  try {
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
};

const forbidden = (res, reason) => {
  res.status(403).json({
    error: 'INVALID_SERVICE_TOKEN',
    reason,
    status: 403,
    timestamp: new Date().toISOString(),
  });
};

const extractToken = (req) => {
  const primary = req.headers[HEADER_NAME];
  if (typeof primary === 'string' && primary.trim()) {
    return primary.trim();
  }
  const legacy = req.headers['x-ai-internal-token'];
  if (typeof legacy === 'string' && legacy.trim()) {
    return legacy.trim();
  }
  return null;
};

const serviceAuth = (req, res, next) => {
  const provided = extractToken(req);
  const expected = getInternalToken();

  if (!provided) {
    log('warn', 'service token missing', { path: req.originalUrl, reason: 'token_missing' });
    forbidden(res, 'token_missing');
    return;
  }

  if (expected && constantTimeEquals(expected, provided)) {
    req.serviceAuth = {
      isAuthenticated: true,
      method: 'header',
      service: 'backend',
      permissions: ['auto_improve', 'proposals', 'internal'],
    };
    return next();
  }

  try {
    const { decoded } = verifyServiceToken(provided);
    req.serviceAuth = {
      isAuthenticated: true,
      method: 'jwt',
      service: decoded.service || decoded.svc || 'unknown',
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      tokenIssuedAt: decoded.iat,
    };
    return next();
  } catch (error) {
    const reason = error?.message === 'jwt expired' ? 'token_expired' : 'token_mismatch';
    log('warn', 'service token rejected', { path: req.originalUrl, reason, error: error?.name || error?.message || 'unknown' });
    forbidden(res, reason);
  }
};

module.exports = {
  serviceAuth,
  HEADER_NAME,
};

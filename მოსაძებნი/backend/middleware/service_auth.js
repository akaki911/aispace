const { randomUUID, timingSafeEqual } = require('crypto');

const { verifyServiceToken, getInternalToken } = require('../../shared/serviceToken');
const { INTERNAL_HEADER } = require('../../shared/config/envValidator');

const HEADER_NAME = INTERNAL_HEADER.toLowerCase();

const buildIds = () => ({
  correlationId: randomUUID(),
  traceId: randomUUID(),
  spanId: randomUUID().slice(0, 16),
});

const logStructured = (level, message, metadata = {}) => {
  const payload = {
    level,
    message,
    ...buildIds(),
    ...metadata,
    scope: 'service-auth',
    service: 'backend',
  };

  if (level === 'error' || level === 'fatal') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
};

const safeEqual = (a, b) => {
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

const respondForbidden = (res, reason) => {
  res.status(403).json({
    error: 'INVALID_SERVICE_TOKEN',
    reason,
    status: 403,
    timestamp: new Date().toISOString(),
  });
};

const extractHeaderToken = (req) => {
  const direct = req.headers[HEADER_NAME];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }
  const legacy = req.headers[`x-ai-internal-token`];
  if (typeof legacy === 'string' && legacy.trim()) {
    return legacy.trim();
  }
  return null;
};

const serviceAuth = (req, res, next) => {
  const token = extractHeaderToken(req);
  const expected = getInternalToken();

  if (!token) {
    logStructured('warn', 'service token missing', { path: req.originalUrl, reason: 'token_missing' });
    respondForbidden(res, 'token_missing');
    return;
  }

  if (expected && safeEqual(expected, token)) {
    req.serviceAuth = {
      isAuthenticated: true,
      method: 'header',
      service: 'internal-client',
      permissions: ['auto_improve', 'proposals', 'internal'],
    };
    return next();
  }

  try {
    const { decoded } = verifyServiceToken(token);
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
    logStructured('warn', 'service token rejected', {
      path: req.originalUrl,
      reason,
      error: error?.name || error?.message || 'unknown',
    });
    respondForbidden(res, reason);
  }
};

module.exports = {
  serviceAuth,
  HEADER_NAME,
};

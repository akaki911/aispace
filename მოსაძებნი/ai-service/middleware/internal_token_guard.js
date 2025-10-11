const { verifyInternalToken } = require('../../shared/internalToken');

const headerCandidates = ['x-internal-token', 'x-ai-internal-token', 'x-service-token'];

const extractToken = (headers = {}) => {
  for (const key of headerCandidates) {
    const value = headers[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const requireInternalToken = (req, res, next) => {
  const candidate = extractToken(req.headers);
  const verification = verifyInternalToken(candidate);

  if (verification.ok) {
    req.internalAuth = {
      tokenSource: verification.expected?.source || null,
    };
    return next();
  }

  const reason = verification.reason || 'token_missing';
  const context = {
    reason,
    path: req.originalUrl || req.url,
    method: req.method,
  };

  if (verification.expected?.source) {
    context.expectedSource = verification.expected.source;
  }

  const hasConfiguredToken = Boolean(verification.expected?.token);
  const usesFallback = Boolean(verification.expected?.isFallback);

  if (!hasConfiguredToken || usesFallback) {
    console.warn('🚫 [AI InternalAuth] Internal token not configured', context);
    return res.status(503).json({
      success: false,
      error: 'INTERNAL_AUTH_DISABLED',
      reason,
    });
  }

  if (reason === 'token_missing') {
    console.warn('🚫 [AI InternalAuth] Missing internal token header', context);
    return res.status(401).json({
      success: false,
      error: 'INTERNAL_TOKEN_REQUIRED',
      reason,
    });
  }

  console.warn('🚫 [AI InternalAuth] Internal token rejected', context);
  return res.status(403).json({
    success: false,
    error: 'INTERNAL_TOKEN_REJECTED',
    reason,
  });
};

module.exports = {
  requireInternalToken,
};

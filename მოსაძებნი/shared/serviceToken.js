const jwt = require('jsonwebtoken');

const DEFAULT_SERVICE_SECRET = 'bakhmaro-ai-service-internal-token-dev-2024';
const DEFAULT_SERVICE_TOKEN_TTL = 120;
const LEGACY_ISSUER = 'bakhmaro-backend';
const LEGACY_AUDIENCE = 'bakhmaro-ai-service';

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const buildServiceAuthConfigs = () => {
  const configs = [];
  const ttlSeconds = toPositiveInteger(process.env.AI_SERVICE_TOKEN_TTL, DEFAULT_SERVICE_TOKEN_TTL);
  const sharedSecret = (process.env.AI_SERVICE_SHARED_SECRET || '').trim();
  const legacySecret = (process.env.AI_INTERNAL_TOKEN || '').trim();

  if (sharedSecret) {
    configs.push({
      key: 'AI_SERVICE_SHARED_SECRET',
      type: 'shared',
      secret: sharedSecret,
      ttlSeconds,
      signOptions: { algorithm: 'HS256' },
      verifyOptions: { algorithms: ['HS256'] },
      isFallback: false,
    });
  }

  if (legacySecret) {
    configs.push({
      key: 'AI_INTERNAL_TOKEN',
      type: 'legacy',
      secret: legacySecret,
      ttlSeconds,
      signOptions: { algorithm: 'HS256', issuer: LEGACY_ISSUER, audience: LEGACY_AUDIENCE },
      verifyOptions: { algorithms: ['HS256'], issuer: LEGACY_ISSUER, audience: LEGACY_AUDIENCE },
      isFallback: false,
    });
  }

  if (!configs.length) {
    configs.push({
      key: 'DEFAULT_FALLBACK',
      type: 'fallback',
      secret: DEFAULT_SERVICE_SECRET,
      ttlSeconds,
      signOptions: { algorithm: 'HS256' },
      verifyOptions: { algorithms: ['HS256'] },
      isFallback: true,
    });
  }

  return configs;
};

const getServiceAuthConfigs = () => buildServiceAuthConfigs();

const getInternalToken = () => (process.env.AI_INTERNAL_TOKEN || '').trim();

const resolvePrimaryConfig = () => {
  const configs = getServiceAuthConfigs();
  return configs[0];
};

const ensurePermissionsArray = (candidate, fallback) => {
  if (Array.isArray(candidate) && candidate.length) {
    return candidate;
  }
  if (Array.isArray(fallback) && fallback.length) {
    return fallback;
  }
  return ['chat'];
};

const createServiceToken = (payload = {}, options = {}) => {
  const config = resolvePrimaryConfig();
  if (!config || !config.secret) {
    throw new Error('SERVICE_SECRET_MISSING');
  }

  const now = Math.floor(Date.now() / 1000);
  const permissions = ensurePermissionsArray(payload.permissions, options.permissions);

  const tokenPayload = {
    svc: payload.svc || payload.service || options.service || 'backend',
    service: payload.service || payload.svc || options.service || 'backend',
    role: payload.role || options.role || 'SYSTEM_BOT',
    permissions,
    type: 'service_auth',
    iat: payload.iat || options.iat || now,
    ...payload,
  };

  const ttlSeconds = typeof options.ttlSeconds === 'number' && options.ttlSeconds > 0
    ? options.ttlSeconds
    : config.ttlSeconds;

  const signOptions = { ...config.signOptions };
  signOptions.expiresIn = options.expiresIn || ttlSeconds;

  if (options.issuer) {
    signOptions.issuer = options.issuer;
  }
  if (options.audience) {
    signOptions.audience = options.audience;
  }
  if (options.algorithm) {
    signOptions.algorithm = options.algorithm;
  }

  return jwt.sign(tokenPayload, config.secret, signOptions);
};

const verifyServiceToken = (token, overrides = {}) => {
  const configs = getServiceAuthConfigs();
  let lastError = null;

  for (const config of configs) {
    try {
      const verifyOptions = { ...config.verifyOptions };
      if (overrides.verifyOptions) {
        Object.assign(verifyOptions, overrides.verifyOptions);
      }
      const decoded = jwt.verify(token, config.secret, verifyOptions);
      return { decoded, config };
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error('INVALID_SERVICE_TOKEN');
  if (lastError) {
    error.cause = lastError;
  }
  throw error;
};

module.exports = {
  createServiceToken,
  verifyServiceToken,
  getServiceAuthConfigs,
  getInternalToken,
  DEFAULT_SERVICE_SECRET,
  DEFAULT_SERVICE_TOKEN_TTL,
  LEGACY_AUDIENCE,
  LEGACY_ISSUER,
};

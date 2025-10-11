const { randomUUID, randomBytes } = require('crypto');
const { z } = require('zod');

const INTERNAL_HEADER = 'x-internal-token';

const baseSchema = z.object({
  NODE_ENV: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  ADMIN_SETUP_TOKEN: z.string().optional(),
  AI_INTERNAL_TOKEN: z.string().optional(),
  AI_SERVICE_SHARED_SECRET: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  ENABLE_METADATA: z.string().optional(),
});

const maskSecret = (value) => {
  if (!value) {
    return null;
  }
  const stringValue = String(value);
  if (stringValue.length <= 6) {
    return `${stringValue[0] || '*'}***${stringValue.slice(-1) || '*'}`;
  }
  return `${stringValue.slice(0, 3)}…${stringValue.slice(-3)}`;
};

const timingIds = () => ({
  correlationId: randomUUID(),
  traceId: randomUUID(),
  spanId: randomUUID().slice(0, 16),
});

const emitLog = (serviceName, level, message, metadata = {}) => {
  const ids = timingIds();
  const payload = {
    service: serviceName,
    level,
    message,
    ...ids,
    ...metadata,
  };

  if (level === 'error' || level === 'fatal') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else if (level === 'info') {
    console.info(JSON.stringify(payload));
  } else {
    console.debug(JSON.stringify(payload));
  }
};

const buildResult = (overrides = {}) => ({
  flags: {
    firebaseAdmin: 'enabled',
    groq: 'enabled',
    metadata: 'enabled',
  },
  warnings: [],
  fatals: [],
  appliedFallbacks: {},
  headerName: INTERNAL_HEADER,
  ...overrides,
});

const ensureFallback = (env, key, factory) => {
  if (env[key] && env[key].trim()) {
    return false;
  }
  const fallback = factory();
  env[key] = fallback;
  return true;
};

const validateEnv = ({ serviceName, exitOnError = true }) => {
  const parsed = baseSchema.parse(process.env);
  const env = { ...parsed };
  env.NODE_ENV = (env.NODE_ENV || 'development').toLowerCase();
  const isProduction = env.NODE_ENV === 'production';

  const result = buildResult({
    nodeEnv: env.NODE_ENV,
  });

  const logMeta = (meta = {}) => ({ serviceName, ...meta });

  const missingFatal = (key, reason) => {
    result.fatals.push(key);
    emitLog(serviceName, 'fatal', `missing required environment variable ${key}`, logMeta({ reason }));
    if (isProduction && exitOnError) {
      process.exitCode = 1;
      throw new Error(`Missing required environment variable: ${key}`);
    }
  };

  const warnMissing = (key, reason) => {
    result.warnings.push(key);
    emitLog(serviceName, 'warn', `missing optional environment variable ${key}`, logMeta({ reason }));
  };

  if (!env.SESSION_SECRET || env.SESSION_SECRET.trim().length < 16) {
    if (isProduction) {
      missingFatal('SESSION_SECRET', 'session');
    } else {
      ensureFallback(env, 'SESSION_SECRET', () => randomBytes(32).toString('hex'));
      result.appliedFallbacks.SESSION_SECRET = true;
      warnMissing('SESSION_SECRET', 'fallback-generated');
    }
  }

  if (!env.ADMIN_SETUP_TOKEN || env.ADMIN_SETUP_TOKEN.trim().length < 8) {
    if (isProduction) {
      missingFatal('ADMIN_SETUP_TOKEN', 'admin-bootstrap');
    } else {
      ensureFallback(env, 'ADMIN_SETUP_TOKEN', () => 'dev-admin-bootstrap-token');
      result.appliedFallbacks.ADMIN_SETUP_TOKEN = true;
      warnMissing('ADMIN_SETUP_TOKEN', 'fallback-applied');
    }
  }

  if (!env.AI_INTERNAL_TOKEN || env.AI_INTERNAL_TOKEN.trim().length < 12) {
    if (isProduction) {
      missingFatal('AI_INTERNAL_TOKEN', 'service-auth');
    } else {
      ensureFallback(env, 'AI_INTERNAL_TOKEN', () => `dev-ai-internal-${randomBytes(12).toString('hex')}`);
      result.appliedFallbacks.AI_INTERNAL_TOKEN = true;
      warnMissing('AI_INTERNAL_TOKEN', 'fallback-generated');
    }
  }

  if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim().length < 8) {
    result.flags.groq = 'disabled';
    warnMissing('GROQ_API_KEY', 'ai-fallback');
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_KEY && !env.FIREBASE_PRIVATE_KEY) {
    result.flags.firebaseAdmin = 'disabled';
    warnMissing('FIREBASE_SERVICE_ACCOUNT_KEY', 'firebase-disabled');
  }

  if (!env.ENABLE_METADATA) {
    env.ENABLE_METADATA = isProduction ? 'true' : 'false';
    if (env.ENABLE_METADATA === 'false') {
      result.flags.metadata = 'disabled';
    }
  }

  Object.assign(process.env, env);

  emitLog(serviceName, 'info', 'environment validated', logMeta({
    sessionSecret: maskSecret(env.SESSION_SECRET),
    adminToken: maskSecret(env.ADMIN_SETUP_TOKEN),
    internalToken: maskSecret(env.AI_INTERNAL_TOKEN),
    firebaseAdmin: result.flags.firebaseAdmin,
    groq: result.flags.groq,
    metadata: result.flags.metadata,
  }));

  return Object.freeze(result);
};

module.exports = {
  validateEnv,
  maskSecret,
  INTERNAL_HEADER,
};

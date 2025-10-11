const crypto = require('crypto');
const { resolveFirebaseServiceAccount } = require('../../shared/secretResolver');
const { describeInternalToken } = require('../../shared/internalToken');

const MIN_SESSION_SECRET_LENGTH = 32;

const normaliseNodeEnv = (value) => {
  if (!value) return 'development';
  const lowered = String(value).trim().toLowerCase();
  return lowered === 'production' ? 'production' : 'development';
};

const formatIssue = (key, reason, severity = 'error') => ({ key, reason, severity });

const buildRuntimeConfig = () => {
  const issues = [];
  const warnings = [];

  process.env.NODE_ENV = normaliseNodeEnv(process.env.NODE_ENV);
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';

  if (!process.env.ADMIN_SETUP_TOKEN || !process.env.ADMIN_SETUP_TOKEN.trim()) {
    issues.push(formatIssue('ADMIN_SETUP_TOKEN', 'missing', isProduction ? 'fatal' : 'warn'));
    if (!isProduction) {
      process.env.ADMIN_SETUP_TOKEN = 'dev-admin-bootstrap-token';
      warnings.push({ key: 'ADMIN_SETUP_TOKEN', reason: 'using-development-fallback' });
    }
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < MIN_SESSION_SECRET_LENGTH) {
    issues.push(
      formatIssue(
        'SESSION_SECRET',
        process.env.SESSION_SECRET ? 'too-short' : 'missing',
        isProduction ? 'fatal' : 'warn',
      ),
    );

    if (!isProduction) {
      const generated = crypto.randomBytes(48).toString('hex');
      process.env.SESSION_SECRET = generated;
      warnings.push({ key: 'SESSION_SECRET', reason: 'generated-development-secret' });
    }
  }

  const firebaseAccount = resolveFirebaseServiceAccount();
  const firebaseEnabled = Boolean(firebaseAccount.credential);
  if (!firebaseEnabled) {
    issues.push(formatIssue('FIREBASE_SERVICE_ACCOUNT_KEY', 'unavailable', isProduction ? 'fatal' : 'warn'));
  }

  const internalTokenDescriptor = describeInternalToken();
  if (!internalTokenDescriptor.present) {
    issues.push(formatIssue('AI_INTERNAL_TOKEN', 'missing', isProduction ? 'fatal' : 'warn'));
  } else if (internalTokenDescriptor.isFallback) {
    issues.push(formatIssue('AI_INTERNAL_TOKEN', 'fallback-token', isProduction ? 'fatal' : 'warn'));
  }

  if (!process.env.NODE_ENV || !['production', 'development'].includes(process.env.NODE_ENV)) {
    issues.push(formatIssue('NODE_ENV', 'invalid', isProduction ? 'fatal' : 'warn'));
  }

  const fatalIssues = issues.filter((issue) => issue.severity === 'fatal');

  if (fatalIssues.length && isProduction) {
    fatalIssues.forEach((issue) => {
      console.error(`❌ [RuntimeConfig] Missing critical env: ${issue.key} (${issue.reason})`);
    });
    console.error('❌ [RuntimeConfig] Cannot continue without required environment variables.');
    process.exit(1);
  }

  const degraded = !isProduction && issues.some((issue) => issue.severity !== 'fatal');

  if (degraded) {
    console.warn('⚠️ [RuntimeConfig] Running in degraded mode due to incomplete environment configuration.');
    issues
      .filter((issue) => issue.severity !== 'fatal')
      .forEach((issue) => {
        console.warn(`   ↳ ${issue.key}: ${issue.reason}`);
      });
  }

  warnings.forEach((warning) => {
    console.warn(`⚠️ [RuntimeConfig] ${warning.key}: ${warning.reason}`);
  });

  const summary = {
    env: {
      nodeEnv,
      isProduction,
    },
    degraded,
    issues,
    warnings,
    security: {
      sessionSecret: {
        length: process.env.SESSION_SECRET ? process.env.SESSION_SECRET.length : 0,
      },
      internalToken: internalTokenDescriptor,
    },
    integrations: {
      firebase: {
        enabled: firebaseEnabled,
        source: firebaseAccount.source || null,
      },
    },
  };

  if (!firebaseEnabled) {
    console.warn('⚠️ [RuntimeConfig] Firebase Admin disabled (fb_admin=disabled).');
    process.env.FIREBASE_ADMIN_DISABLED = '1';
  }

  if (internalTokenDescriptor.present) {
    console.log(
      `🔐 [RuntimeConfig] Internal service token sourced from ${internalTokenDescriptor.source} (${internalTokenDescriptor.masked})`,
    );
    if (internalTokenDescriptor.isFallback) {
      console.warn('⚠️ [RuntimeConfig] Internal token is using insecure fallback value. Update AI_INTERNAL_TOKEN immediately.');
    }
  } else {
    console.warn('⚠️ [RuntimeConfig] Internal service token not configured; internal automation will be disabled.');
  }

  if (firebaseEnabled) {
    console.log(
      `🔥 [RuntimeConfig] Firebase Admin credentials ready (${firebaseAccount.source || 'unknown-source'})`,
    );
  }

  if (process.env.SESSION_SECRET) {
    console.log(
      `🔑 [RuntimeConfig] SESSION_SECRET configured (${process.env.SESSION_SECRET.length} chars)`,
    );
  }

  if (process.env.ADMIN_SETUP_TOKEN) {
    console.log('🛡️ [RuntimeConfig] ADMIN_SETUP_TOKEN configured');
  }

  return Object.freeze({
    ...summary,
    firebaseAccount,
  });
};

module.exports = buildRuntimeConfig();

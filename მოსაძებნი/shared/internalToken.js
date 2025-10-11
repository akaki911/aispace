const crypto = require('crypto');
const { maskSecret } = require('./secretResolver');

const INTERNAL_TOKEN_KEYS = [
  'AI_INTERNAL_TOKEN',
  'AI_SERVICE_INTERNAL_TOKEN',
  'AI_SERVICE_SHARED_SECRET',
  'INTERNAL_SERVICE_TOKEN',
];

const DEFAULT_DEV_TOKEN = 'bakhmaro-ai-service-internal-token-dev-2024';

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

function resolveInternalToken() {
  for (const key of INTERNAL_TOKEN_KEYS) {
    const value = process.env[key];
    if (hasValue(value)) {
      const trimmed = value.trim();
      return {
        token: trimmed,
        source: `env:${key}`,
        isFallback: trimmed === DEFAULT_DEV_TOKEN,
      };
    }
  }

  return { token: null, source: null, isFallback: false };
}

function getInternalToken() {
  return resolveInternalToken();
}

function verifyInternalToken(candidate) {
  const expected = resolveInternalToken();

  if (!expected.token) {
    return {
      ok: false,
      reason: 'token_missing',
      expected,
    };
  }

  if (expected.isFallback) {
    return {
      ok: false,
      reason: 'token_expired',
      expected,
    };
  }

  const provided = hasValue(candidate) ? candidate.trim() : '';

  if (!provided) {
    return {
      ok: false,
      reason: 'token_missing',
      expected,
    };
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected.token);

  if (providedBuffer.length !== expectedBuffer.length) {
    return {
      ok: false,
      reason: 'token_mismatch',
      expected,
    };
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return {
      ok: false,
      reason: 'token_mismatch',
      expected,
    };
  }

  return {
    ok: true,
    expected,
  };
}

function describeInternalToken() {
  const resolved = resolveInternalToken();
  if (!resolved.token) {
    return { present: false, source: null, masked: null, isFallback: false };
  }

  return {
    present: true,
    source: resolved.source,
    masked: maskSecret(resolved.token, { prefix: 4, suffix: 4 }),
    isFallback: resolved.isFallback,
  };
}

module.exports = {
  getInternalToken,
  verifyInternalToken,
  describeInternalToken,
  DEFAULT_DEV_TOKEN,
};

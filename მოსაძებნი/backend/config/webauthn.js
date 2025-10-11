
// WebAuthn Configuration for Bakhmaro Project
// Unified RP configuration using getRpConfig

const { getRpConfig } = require('../utils/rpid');

const normaliseOrigin = (value) => {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(String(value));
    return parsed.origin;
  } catch (error) {
    return null;
  }
};

const getExpectedOrigins = (config) => {
  if (!config) {
    return [];
  }

  if (Array.isArray(config.expectedOrigins) && config.expectedOrigins.length > 0) {
    return config.expectedOrigins;
  }

  return config.origin ? [config.origin] : [];
};

const validateWebAuthnRequest = (req, config) => {
  const expectedOrigins = getExpectedOrigins(config).map(normaliseOrigin).filter(Boolean);
  const headerOrigin = req?.get?.('origin') || req?.get?.('Origin') || req?.headers?.origin || null;
  const receivedOrigin = normaliseOrigin(headerOrigin);

  if (!headerOrigin) {
    return { valid: true, expected: expectedOrigins, received: null, reason: null };
  }

  if (!receivedOrigin) {
    return {
      valid: false,
      expected: expectedOrigins,
      received: headerOrigin,
      reason: 'invalid-origin-header',
    };
  }

  if (expectedOrigins.length > 0 && !expectedOrigins.includes(receivedOrigin)) {
    return {
      valid: false,
      expected: expectedOrigins,
      received: receivedOrigin,
      reason: 'origin-mismatch',
    };
  }

  return {
    valid: true,
    expected: expectedOrigins,
    received: receivedOrigin,
    reason: null,
  };
};

const buildWebAuthnConfig = (config) => ({
  ...config,
  // WebAuthn-specific configuration
  attestation: 'none', // For privacy
  userVerification: 'preferred', // Prefer biometric but allow PIN
  residentKey: 'preferred', // Prefer discoverable credentials
  authenticatorSelection: {
    userVerification: 'preferred', // Windows Hello compatibility
    residentKey: 'preferred', // Windows Hello compatibility
    requireResidentKey: false // But not required for compatibility
  },
  timeout: 120000, // 2 minutes for biometric setup
  supportedAlgorithmIDs: [-7, -35, -36, -257, -258, -259], // Enhanced algorithm support
  allowCredentials: [] // Empty for discoverable credentials
});

const computeWebAuthnConfig = (req = null) => buildWebAuthnConfig(getRpConfig(req));

let memoisedDefaultConfig = null;
let hasLoggedDefault = false;

const logConfigSelection = (config, context = 'default') => {
  console.log(`🔐 [WebAuthn Config] Using ${context} config - rpID: ${config.rpID}, origin: ${config.origin}`);
};

// Dynamic configuration function using unified resolver
const getWebAuthnConfig = (req = null) => {
  const config = computeWebAuthnConfig(req);

  if (req) {
    req.__webAuthnConfig = config;
    logConfigSelection(config, 'request');
  } else if (!hasLoggedDefault) {
    logConfigSelection(config, 'default');
    hasLoggedDefault = true;
  }

  return config;
};

const getDefaultWebAuthnConfig = () => {
  if (!memoisedDefaultConfig) {
    memoisedDefaultConfig = computeWebAuthnConfig();
  }

  if (!hasLoggedDefault) {
    logConfigSelection(memoisedDefaultConfig, 'default');
    hasLoggedDefault = true;
  }

  return memoisedDefaultConfig;
};

const lazyConfig = {};
for (const key of Object.keys(computeWebAuthnConfig())) {
  Object.defineProperty(lazyConfig, key, {
    enumerable: true,
    get() {
      const config = getDefaultWebAuthnConfig();
      return config[key];
    }
  });
}

module.exports = {
  ...lazyConfig,
  getWebAuthnConfig,
  getDefaultWebAuthnConfig,
  validateWebAuthnRequest,
};

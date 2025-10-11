
const { URL } = require('url');

const REPLIT_SUFFIXES = ['.replit.dev', '.repl.co'];

const isBlank = (value) => !value || !String(value).trim();

const isReplitHost = (host = '') =>
  REPLIT_SUFFIXES.some((suffix) => host.endsWith(suffix));

const normaliseHost = (host = '') => host.trim().toLowerCase();

const buildHttpsOrigin = (host) => `https://${host}`;

const parseOrigin = (value) => {
  if (isBlank(value)) {
    return null;
  }

  try {
    const parsed = new URL(value);
    // Always upgrade to HTTPS for recognised hosts
    if (parsed.protocol !== 'https:' && isReplitHost(parsed.hostname)) {
      parsed.protocol = 'https:';
      parsed.port = '';
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

const resolveFromRequest = (req = {}) => {
  const originHeader = req?.get?.('origin') || req?.get?.('Origin') || req?.headers?.origin;
  const hostHeader = req?.get?.('host') || req?.get?.('Host') || req?.headers?.host;
  const forwardedProto = req?.get?.('x-forwarded-proto') || req?.get?.('X-Forwarded-Proto');

  const parsedOrigin = parseOrigin(originHeader);
  if (parsedOrigin) {
    return {
      rpID: normaliseHost(parsedOrigin.hostname),
      origin: parsedOrigin.toString(),
      source: 'origin-header'
    };
  }

  if (hostHeader) {
    const host = normaliseHost(hostHeader.split(':')[0]);
    if (!host) {
      return null;
    }

    const proto = forwardedProto === 'http' ? 'http' : 'https';
    const origin = proto === 'https' ? buildHttpsOrigin(host) : `${proto}://${host}`;

    return {
      rpID: host,
      origin: isReplitHost(host) ? buildHttpsOrigin(host) : origin,
      source: 'host-header'
    };
  }

  return null;
};

const resolveFromEnv = () => {
  const envRpId = normaliseHost(process.env.RP_ID || '');
  const envOrigin = parseOrigin(process.env.ORIGIN || '');

  if (!envRpId && !envOrigin) {
    return null;
  }

  if (envOrigin && !envRpId) {
    return {
      rpID: normaliseHost(envOrigin.hostname),
      origin: envOrigin.toString(),
      source: 'env-origin'
    };
  }

  if (envRpId && !envOrigin) {
    const origin = buildHttpsOrigin(envRpId);
    return {
      rpID: envRpId,
      origin,
      source: 'env-rpid'
    };
  }

  if (envOrigin) {
    const hostname = normaliseHost(envOrigin.hostname);
    return {
      rpID: envRpId || hostname,
      origin: envOrigin.toString(),
      source: 'env-both'
    };
  }

  return {
    rpID: envRpId,
    origin: buildHttpsOrigin(envRpId),
    source: 'env-rpid'
  };
};

const resolveDefaults = () => {
  const fallbackHost = 'localhost';
  return {
    rpID: fallbackHost,
    origin: 'http://localhost',
    source: 'default'
  };
};

const getRpConfig = (req) => {
  if (req?.__resolvedRpConfig) {
    return req.__resolvedRpConfig;
  }

  const requestConfig = resolveFromRequest(req);
  const envConfig = resolveFromEnv();
  const baseConfig = requestConfig || envConfig || resolveDefaults();

  let finalConfig = { ...baseConfig };

  if (envConfig) {
    if (requestConfig && requestConfig.rpID !== envConfig.rpID) {
      console.debug(
        `🔍 [RPID] Request rpID ${requestConfig.rpID} differs from env rpID ${envConfig.rpID}; using env configuration.`
      );
    }
    finalConfig = {
      ...finalConfig,
      rpID: envConfig.rpID,
      origin: envConfig.origin,
      source: envConfig.source || 'env',
    };
  }

  const parsed = parseOrigin(finalConfig.origin);
  if (parsed) {
    finalConfig.rpID = normaliseHost(parsed.hostname);
    finalConfig.origin = parsed.toString();
  }

  if (isReplitHost(finalConfig.rpID)) {
    finalConfig.origin = buildHttpsOrigin(finalConfig.rpID);
  }

  if (!req?.__loggedRpSummary) {
    console.info(`ℹ️ [RPID] rpID=${finalConfig.rpID} origin=${finalConfig.origin} source=${finalConfig.source}`);
    if (req) {
      req.__loggedRpSummary = true;
    }
  }

  const config = Object.freeze({
    rpID: finalConfig.rpID,
    origin: finalConfig.origin,
    expectedOrigins: [finalConfig.origin],
    rpName: 'Bakhmaro Cottages - Georgian Rental Platform'
  });

  if (req) {
    req.__resolvedRpConfig = config;
  }

  return config;
};

const getRpId = (req) => getRpConfig(req).rpID;
const getOrigin = (req) => getRpConfig(req).origin;

module.exports = {
  getRpConfig,
  getRpId,
  getOrigin
};

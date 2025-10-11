const getRpId = (req) => {
  // Use explicit environment variable first
  if (process.env.RP_ID) {
    console.log('🔧 Using RP_ID from environment:', process.env.RP_ID);
    return process.env.RP_ID;
  }

  // Extract from request
  const host = req?.get('Host') || req?.get('host');
  const origin = req?.get('Origin') || req?.get('origin');

  console.log('🔧 RP ID resolution - Host:', host, 'Origin:', origin);

  if (host) {
    // Remove port if present and handle Replit domains properly
    const domain = host.split(':')[0];

    // Special handling for Replit domains
    if (domain.includes('.replit.dev')) {
      console.log('🔧 Detected Replit domain, using full domain:', domain);
      return domain;
    }

    console.log('🔧 Resolved RP_ID from host:', domain);
    return domain;
  }

  if (origin) {
    try {
      const url = new URL(origin);

      // Special handling for Replit domains in origin
      if (url.hostname.includes('.replit.dev')) {
        console.log('🔧 Detected Replit domain in origin, using full hostname:', url.hostname);
        return url.hostname;
      }

      console.log('🔧 Resolved RP_ID from origin:', url.hostname);
      return url.hostname;
    } catch (e) {
      console.warn('🔧 Failed to parse origin URL:', origin);
    }
  }

  // Development fallback for local environments
  const fallback = process.env.NODE_ENV === 'development' ? 'localhost' : 'localhost';
  console.log('🔧 Using fallback RP_ID:', fallback);
  return fallback;
};

const getOrigin = (req) => {
  if (process.env.ORIGIN) {
    return process.env.ORIGIN;
  }

  const origin = req.get('Origin') || req.get('Referer');
  if (origin) {
    return origin;
  }

  // Construct from request
  const protocol = req.secure || req.get('X-Forwarded-Proto') === 'https' ? 'https' : 'http';
  const host = req.get('Host') || req.hostname;
  return `${protocol}://${host}`;
};

// Legacy exports for backward compatibility
const rpId = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN;

if (!rpId || !origin) {
  console.warn('[WebAuthn] RP_ID/ORIGIN missing in env - will be determined dynamically from requests');
}

module.exports = { rpId, origin, getRpId, getOrigin };
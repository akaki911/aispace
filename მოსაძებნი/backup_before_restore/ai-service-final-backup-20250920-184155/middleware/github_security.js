
const crypto = require('crypto');

/**
 * GitHub Security Middleware - SOL-311
 * Ensures no GitHub secrets leak to frontend
 */

// Sanitize GitHub responses to prevent token leakage
const sanitizeGitHubResponse = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Remove any potential token fields from response
    if (data && typeof data === 'object') {
      const sanitized = sanitizeObject(data);
      return originalJson.call(this, sanitized);
    }
    return originalJson.call(this, data);
  };
  
  next();
};

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Remove any fields that might contain tokens
      if (key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key')) {
        sanitized[key] = value ? 'SET' : 'MISSING';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// Validate GitHub token format (without exposing it)
const validateGitHubToken = () => {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) return { valid: false, reason: 'Missing' };
  
  // Enhanced GitHub token format validation
  if (token.startsWith('ghp_') && token.length >= 40) {
    return { valid: true, type: 'Personal Access Token', length: token.length };
  }
  
  if (token.startsWith('ghs_')) {
    return { valid: true, type: 'Server-to-Server Token', length: token.length };
  }
  
  if (token.startsWith('gho_')) {
    return { valid: true, type: 'OAuth Token', length: token.length };
  }
  
  if (token.startsWith('ghu_')) {
    return { valid: true, type: 'User-to-Server Token', length: token.length };
  }
  
  if (token.startsWith('ghr_')) {
    return { valid: true, type: 'Refresh Token', length: token.length };
  }
  
  // Legacy token without prefix (40 characters)
  if (token.length === 40 && /^[a-f0-9]{40}$/.test(token)) {
    return { valid: true, type: 'Legacy Personal Access Token', length: 40 };
  }
  
  return { valid: false, reason: 'Invalid format or unknown token type' };
};

// Additional security helper for webhook validation
const validateWebhookSignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
    
  const actualSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(actualSignature, 'hex')
  );
};

module.exports = {
  sanitizeGitHubResponse,
  validateGitHubToken,
  validateWebhookSignature
};

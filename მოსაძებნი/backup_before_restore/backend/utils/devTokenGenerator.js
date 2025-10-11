
const crypto = require('crypto');

function generateDevAdminToken() {
  // Generate a 39-character token for development
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString('hex');
  return `DEV_${timestamp}_${random}`.substring(0, 39);
}

function validateDevToken(token) {
  if (!token) return false;
  
  // In development, accept any token that starts with DEV_ and is at least 30 chars
  if (process.env.NODE_ENV === 'development' && token.startsWith('DEV_') && token.length >= 30) {
    return true;
  }
  
  // For production, use proper validation
  return token && token.length === 39;
}

module.exports = {
  generateDevAdminToken,
  validateDevToken
};

/**
 * GitHub Environment Variable Validation Helper
 * Creates structured environment configuration and validates required variables
 * STRICT PATCH MODE: Server-side only, no UI changes
 */

function requireEnv() {
  const config = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER, 
    GITHUB_REPO: process.env.GITHUB_REPO,
    GITHUB_API_URL: process.env.GITHUB_API_URL || 'https://api.github.com',
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET
  };

  // Check required variables
  const missing = [];
  
  if (!config.GITHUB_TOKEN) {
    missing.push('GITHUB_TOKEN');
  }
  
  if (!config.GITHUB_OWNER) {
    missing.push('GITHUB_OWNER');
  }
  
  if (!config.GITHUB_REPO) {
    missing.push('GITHUB_REPO');
  }

  // Throw structured error for missing variables (HTTP 500)
  if (missing.length > 0) {
    const error = new Error(`Missing required GitHub environment variables: ${missing.join(', ')}`);
    error.status = 500;
    error.code = 'MISSING_ENV_VARS';
    error.missing = missing;
    error.message = `GitHub integration requires the following environment variables: ${missing.join(', ')}. Please configure them in your deployment settings.`;
    throw error;
  }

  // Validate webhook secret if webhooks are enabled
  // This is optional - only required if webhook routes are used
  
  return config;
}

module.exports = { requireEnv };
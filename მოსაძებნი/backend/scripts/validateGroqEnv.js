
const fs = require('fs');
const path = require('path');

/**
 * Groq API Environment Validation and Cleanup Script
 * Validates and cleans up Groq API configuration
 */

class GroqEnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
    this.requiredEnvVars = [
      'GROQ_API_KEY',
      'AI_SERVICE_URL',
      'AI_INTERNAL_TOKEN'
    ];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      fix: '🔧'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  validateGroqApiKey() {
    this.log('Validating GROQ_API_KEY...', 'info');
    
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      this.errors.push('GROQ_API_KEY is not set in environment variables');
      this.log('GROQ_API_KEY missing', 'error');
      return false;
    }

    // Validate API key format (Groq keys typically start with 'gsk_')
    if (!apiKey.startsWith('gsk_')) {
      this.warnings.push('GROQ_API_KEY does not start with "gsk_" - may be invalid format');
      this.log('GROQ_API_KEY format suspicious', 'warning');
    }

    // Check minimum length
    if (apiKey.length < 50) {
      this.errors.push('GROQ_API_KEY appears too short - likely invalid');
      this.log('GROQ_API_KEY too short', 'error');
      return false;
    }

    // Check for obvious test/placeholder values
    const placeholderPatterns = [
      'your-api-key',
      'placeholder',
      'test-key',
      'example',
      'fake',
      'dummy'
    ];

    const isPlaceholder = placeholderPatterns.some(pattern => 
      apiKey.toLowerCase().includes(pattern)
    );

    if (isPlaceholder) {
      this.errors.push('GROQ_API_KEY appears to be a placeholder value');
      this.log('GROQ_API_KEY is placeholder', 'error');
      return false;
    }

    this.log('GROQ_API_KEY format validation passed', 'success');
    return true;
  }

  validateServiceUrls() {
    this.log('Validating service URLs...', 'info');
    
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    
    // Check if URL format is valid
    try {
      new URL(aiServiceUrl);
      this.log(`AI_SERVICE_URL valid: ${aiServiceUrl}`, 'success');
    } catch (error) {
      this.errors.push(`AI_SERVICE_URL invalid format: ${aiServiceUrl}`);
      this.log('AI_SERVICE_URL format invalid', 'error');
      return false;
    }

    // Check for localhost vs 0.0.0.0 usage in Replit
    if (aiServiceUrl.includes('localhost') && process.env.REPLIT_CLUSTER) {
      this.warnings.push('Using localhost in Replit - consider using 0.0.0.0 or proper service discovery');
      this.log('localhost usage in Replit detected', 'warning');
    }

    return true;
  }

  validateInternalToken() {
    this.log('Validating AI_INTERNAL_TOKEN...', 'info');
    
    const internalToken = process.env.AI_INTERNAL_TOKEN;
    
    if (!internalToken) {
      this.warnings.push('AI_INTERNAL_TOKEN not set - using development default');
      this.log('AI_INTERNAL_TOKEN missing', 'warning');
      return true; // Not critical, has fallback
    }

    // Check if it's the development default
    if (internalToken === 'bakhmaro-ai-service-internal-token-dev-2024') {
      this.warnings.push('AI_INTERNAL_TOKEN is using development default - consider setting production value');
      this.log('AI_INTERNAL_TOKEN is dev default', 'warning');
    }

    // Check minimum security length
    if (internalToken.length < 32) {
      this.warnings.push('AI_INTERNAL_TOKEN is quite short - consider longer token for security');
      this.log('AI_INTERNAL_TOKEN short', 'warning');
    }

    this.log('AI_INTERNAL_TOKEN validation passed', 'success');
    return true;
  }

  checkEnvFileExists() {
    this.log('Checking for .env files...', 'info');
    
    const envFiles = ['.env', '.env.local', '.env.production'];
    const foundFiles = [];
    
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        foundFiles.push(envFile);
        this.log(`Found ${envFile}`, 'success');
      }
    }

    if (foundFiles.length === 0) {
      this.warnings.push('No .env files found - environment variables must be set externally');
      this.log('No .env files found', 'warning');
    }

    return foundFiles;
  }

  generateEnvExample() {
    this.log('Generating .env.example...', 'info');
    
    const envExample = `# Groq API Configuration
# Get your API key from: https://console.groq.com/keys
GROQ_API_KEY=gsk_your_groq_api_key_here

# AI Service Configuration  
AI_SERVICE_URL=http://0.0.0.0:5001
AI_INTERNAL_TOKEN=your-secure-internal-token-32chars-min

# Backend Configuration
PORT=5002

# Database URLs (if needed)
DATABASE_URL=your_database_url_here
FIREBASE_PROJECT_ID=your_firebase_project_id

# Development flags
DEBUG_MODE=false
NODE_ENV=production
`;

    try {
      fs.writeFileSync('.env.example', envExample);
      this.fixes.push('Generated .env.example with Groq configuration');
      this.log('.env.example generated', 'fix');
    } catch (error) {
      this.errors.push(`Failed to generate .env.example: ${error.message}`);
      this.log('Failed to generate .env.example', 'error');
    }
  }

  async testGroqConnection() {
    this.log('Testing Groq API connection...', 'info');
    
    if (!process.env.GROQ_API_KEY) {
      this.log('Skipping connection test - no API key', 'warning');
      return false;
    }

    try {
      const axios = require('axios');
      
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        this.log('Groq API connection successful', 'success');
        return true;
      } else {
        this.errors.push(`Groq API connection failed with status: ${response.status}`);
        this.log('Groq API connection failed', 'error');
        return false;
      }
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      
      if (status === 401) {
        this.errors.push('Groq API authentication failed - invalid API key');
        this.log('Groq API auth failed', 'error');
      } else if (status === 429) {
        this.warnings.push('Groq API rate limit exceeded during test');
        this.log('Groq API rate limited', 'warning');
      } else {
        this.errors.push(`Groq API connection error: ${message}`);
        this.log(`Groq API error: ${message}`, 'error');
      }
      
      return false;
    }
  }

  async validateAll() {
    this.log('Starting Groq environment validation...', 'info');
    
    const results = {
      apiKey: this.validateGroqApiKey(),
      serviceUrls: this.validateServiceUrls(),
      internalToken: this.validateInternalToken(),
      envFiles: this.checkEnvFileExists(),
      connection: await this.testGroqConnection()
    };

    // Generate .env.example if needed
    this.generateEnvExample();

    return results;
  }

  generateReport() {
    this.log('Generating validation report...', 'info');
    
    const report = {
      timestamp: new Date().toISOString(),
      status: this.errors.length === 0 ? 'PASS' : 'FAIL',
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        fixes: this.fixes.length
      },
      details: {
        errors: this.errors,
        warnings: this.warnings,
        fixes: this.fixes
      },
      recommendations: []
    };

    // Add recommendations based on findings
    if (this.errors.length > 0) {
      report.recommendations.push('🔧 Fix all errors before proceeding to production');
    }
    
    if (this.warnings.length > 0) {
      report.recommendations.push('⚠️ Review warnings for security and stability improvements');
    }

    if (!process.env.GROQ_API_KEY) {
      report.recommendations.push('🔑 Set GROQ_API_KEY in Replit Secrets');
    }

    report.recommendations.push('📚 Check Groq API documentation: https://console.groq.com/docs');
    report.recommendations.push('🚀 Monitor API usage at: https://console.groq.com/usage');

    return report;
  }

  printReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 GROQ ENVIRONMENT VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Status: ${report.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Errors: ${report.summary.errors}, Warnings: ${report.summary.warnings}, Fixes: ${report.summary.fixes}`);
    
    if (report.details.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      report.details.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    if (report.details.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      report.details.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    if (report.details.fixes.length > 0) {
      console.log('\n🔧 FIXES APPLIED:');
      report.details.fixes.forEach(fix => console.log(`  • ${fix}`));
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    
    console.log('\n' + '='.repeat(60));
  }
}

// CLI usage
async function main() {
  const validator = new GroqEnvValidator();
  
  try {
    const results = await validator.validateAll();
    const report = validator.generateReport();
    
    validator.printReport(report);
    
    // Exit with error code if validation failed
    process.exit(report.status === 'PASS' ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { GroqEnvValidator };

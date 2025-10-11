
#!/usr/bin/env node

/**
 * Startup GitHub Verification
 * Quick check to ensure GitHub integration is ready on startup
 */

const https = require('https');

class StartupGitHubCheck {
  async quickCheck() {
    console.log('🔍 Quick GitHub Integration Check...');
    
    const checks = [
      this.checkEnvVars(),
      this.checkTokenBasic(),
      this.checkServices()
    ];
    
    const results = await Promise.allSettled(checks);
    
    let allGood = true;
    results.forEach((result, index) => {
      const checkNames = ['Environment', 'Token', 'Services'];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${checkNames[index]}: ${result.value}`);
      } else {
        console.log(`❌ ${checkNames[index]}: ${result.reason}`);
        allGood = false;
      }
    });
    
    if (allGood) {
      console.log('🎉 GitHub integration ready!');
    } else {
      console.log('⚠️ GitHub integration needs attention');
      console.log('💡 Run: node scripts/github-verification.js for detailed diagnostics');
    }
    
    return allGood;
  }

  async checkEnvVars() {
    const required = ['GITHUB_TOKEN', 'GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME'];
    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      throw new Error(`Missing: ${missing.join(', ')}`);
    }
    
    return 'All required environment variables present';
  }

  async checkTokenBasic() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('No token');
    
    // Quick format check
    if (token.startsWith('ghp_') || token.startsWith('ghs_') || /^[a-f0-9]{40}$/.test(token)) {
      return 'Token format valid';
    } else {
      throw new Error('Invalid token format');
    }
  }

  async checkServices() {
    try {
      const response = await fetch('http://127.0.0.1:5001/health');
      if (response.ok) {
        return 'AI service responding';
      } else {
        throw new Error(`AI service HTTP ${response.status}`);
      }
    } catch (error) {
      throw new Error(`AI service unreachable: ${error.message}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new StartupGitHubCheck();
  checker.quickCheck().catch(console.error);
}

module.exports = StartupGitHubCheck;

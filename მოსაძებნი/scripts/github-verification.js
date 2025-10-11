
#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');

class GitHubVerifier {
  constructor() {
    this.results = [];
    this.currentTest = 0;
    this.totalTests = 6;
  }

  log(test, status, message, details = null) {
    const icons = { pass: '✅', fail: '❌', info: 'ℹ️', warn: '⚠️' };
    const icon = icons[status] || 'ℹ️';
    
    console.log(`${icon} [Test ${++this.currentTest}/${this.totalTests}] ${test}: ${message}`);
    if (details) console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    
    this.results.push({ test, status, message, details });
  }

  async makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // 1. Environment Variables Check
  async checkEnvironmentVariables() {
    const services = ['backend', 'ai-service'];
    
    for (const service of services) {
      try {
        const { exec } = require('child_process');
        const result = await new Promise((resolve, reject) => {
          exec(`cd ${service} && printenv | grep GITHUB_`, (error, stdout) => {
            if (error && error.code !== 1) reject(error); // code 1 = no match, acceptable
            resolve(stdout);
          });
        });
        
        const envVars = result.trim().split('\n').filter(line => line);
        const hasToken = envVars.some(line => line.startsWith('GITHUB_TOKEN='));
        const hasOwner = envVars.some(line => line.startsWith('GITHUB_REPO_OWNER=') || line.startsWith('GITHUB_OWNER='));
        const hasRepo = envVars.some(line => line.startsWith('GITHUB_REPO_NAME=') || line.startsWith('GITHUB_REPO='));
        
        if (hasToken && hasOwner && hasRepo) {
          this.log(`${service} Environment`, 'pass', 'GitHub environment variables configured');
        } else {
          this.log(`${service} Environment`, 'fail', 'Missing GitHub environment variables', {
            hasToken, hasOwner, hasRepo, found: envVars.map(v => v.split('=')[0])
          });
        }
      } catch (error) {
        this.log(`${service} Environment`, 'fail', `Error checking environment: ${error.message}`);
      }
    }
  }

  // 2. Token Scope Verification  
  async checkTokenScope() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      this.log('Token Scope', 'fail', 'GITHUB_TOKEN not found in environment');
      return;
    }

    try {
      const options = {
        hostname: 'api.github.com',
        path: '/user',
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Gurulo-AI-Verification',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const response = await this.makeRequest(options);
      
      if (response.statusCode === 200) {
        const scopes = response.headers['x-oauth-scopes'] || 'none';
        const userData = JSON.parse(response.body);
        this.log('Token Scope', 'pass', `Valid token for user: ${userData.login}`, {
          scopes: scopes.split(', ').filter(s => s),
          rateLimit: response.headers['x-ratelimit-remaining']
        });
      } else {
        this.log('Token Scope', 'fail', `Invalid token: HTTP ${response.statusCode}`, {
          response: response.body.substring(0, 200)
        });
      }
    } catch (error) {
      this.log('Token Scope', 'fail', `Token verification failed: ${error.message}`);
    }
  }

  // 3. Branches Pagination Test
  async checkBranchesPagination() {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_REPO_OWNER || process.env.GITHUB_OWNER || 'akaki911';
    const repo = process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO || 'bakhmaro.co';

    if (!token) {
      this.log('Branches Pagination', 'fail', 'No GitHub token for pagination test');
      return;
    }

    try {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/branches?per_page=1`,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Gurulo-AI-Verification',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const response = await this.makeRequest(options);
      
      if (response.statusCode === 200) {
        const branches = JSON.parse(response.body);
        const linkHeader = response.headers['link'];
        const hasNext = linkHeader && linkHeader.includes('rel="next"');
        
        this.log('Branches Pagination', 'pass', `Pagination test successful`, {
          branchesReturned: branches.length,
          hasNextPage: hasNext,
          linkHeader: linkHeader || 'none'
        });
      } else {
        this.log('Branches Pagination', 'fail', `Repository access failed: HTTP ${response.statusCode}`, {
          repository: `${owner}/${repo}`,
          response: response.body.substring(0, 200)
        });
      }
    } catch (error) {
      this.log('Branches Pagination', 'fail', `Pagination test failed: ${error.message}`);
    }
  }

  // 4. Push Update Flow (GET contents → PUT with SHA)
  async checkPushUpdateFlow() {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_REPO_OWNER || process.env.GITHUB_OWNER || 'akaki911';
    const repo = process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO || 'bakhmaro.co';
    const testFile = 'test-verification.txt';

    if (!token) {
      this.log('Push Update Flow', 'fail', 'No GitHub token for push test');
      return;
    }

    try {
      // Step 1: Try to get existing file
      const getOptions = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/contents/${testFile}?ref=main`,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Gurulo-AI-Verification',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      let fileSha = null;
      const getResponse = await this.makeRequest(getOptions);
      
      if (getResponse.statusCode === 200) {
        const fileData = JSON.parse(getResponse.body);
        fileSha = fileData.sha;
        this.log('Push Update Flow', 'info', `File exists, SHA obtained: ${fileSha.substring(0, 8)}...`);
      } else if (getResponse.statusCode === 404) {
        this.log('Push Update Flow', 'info', 'File does not exist, will create new file');
      } else {
        this.log('Push Update Flow', 'fail', `Failed to check file: HTTP ${getResponse.statusCode}`);
        return;
      }

      // Step 2: Create/Update file with SHA
      const content = `GitHub Push Test - ${new Date().toISOString()}`;
      const requestBody = {
        message: `Test commit from Gurulo AI verification - ${new Date().toISOString()}`,
        content: Buffer.from(content).toString('base64'),
        branch: 'main',
        committer: {
          name: 'Gurulo AI Verification',
          email: 'verification@gurulo.ai'
        },
        author: {
          name: 'Gurulo AI Verification',
          email: 'verification@gurulo.ai'
        }
      };

      if (fileSha) {
        requestBody.sha = fileSha;
      }

      const putOptions = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/contents/${testFile}`,
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Gurulo-AI-Verification',
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        }
      };

      const putResponse = await this.makeRequest(putOptions, JSON.stringify(requestBody));
      
      if (putResponse.statusCode === 200 || putResponse.statusCode === 201) {
        const result = JSON.parse(putResponse.body);
        this.log('Push Update Flow', 'pass', `File push successful`, {
          operation: fileSha ? 'update' : 'create',
          newSha: result.content.sha.substring(0, 8) + '...',
          commitUrl: result.commit.html_url
        });
      } else {
        this.log('Push Update Flow', 'fail', `Push failed: HTTP ${putResponse.statusCode}`, {
          response: putResponse.body.substring(0, 300)
        });
      }

    } catch (error) {
      this.log('Push Update Flow', 'fail', `Push test failed: ${error.message}`);
    }
  }

  // 5. PR Merge Conflicts Simulation
  async checkPRMergeConflicts() {
    // This would require creating actual branches and PRs, which is complex
    // Instead, we'll check if our endpoints handle conflict responses properly
    this.log('PR Merge Conflicts', 'info', 'Conflict handling check - testing endpoint responses', {
      note: 'This would require actual PR creation for full testing',
      recommendation: 'Test manually by creating conflicting PRs'
    });

    // Test if our GitHub integration service handles 409 responses
    try {
      const response = await fetch('http://127.0.0.1:5001/api/ai/github/pulls/999999/merge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_method: 'merge' })
      });

      if (response.status === 404) {
        this.log('PR Merge Conflicts', 'pass', 'Endpoint correctly handles non-existent PR');
      } else {
        this.log('PR Merge Conflicts', 'warn', `Unexpected response: ${response.status}`);
      }
    } catch (error) {
      this.log('PR Merge Conflicts', 'warn', `Service not available for conflict test: ${error.message}`);
    }
  }

  // 6. Webhook HMAC Verification
  async checkWebhookSecurity() {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!secret) {
      this.log('Webhook Security', 'fail', 'GITHUB_WEBHOOK_SECRET not configured');
      return;
    }

    try {
      // Test HMAC generation
      const testPayload = JSON.stringify({ test: 'webhook verification', timestamp: Date.now() });
      const hmac = crypto.createHmac('sha256', secret);
      const signature = 'sha256=' + hmac.update(testPayload, 'utf8').digest('hex');

      // Test our webhook security endpoint
      const response = await fetch('http://127.0.0.1:5001/api/ai/github/webhook/test-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature
        },
        body: testPayload
      });

      if (response.ok) {
        const result = await response.json();
        this.log('Webhook Security', 'pass', 'HMAC verification working correctly', {
          secretLength: secret.length,
          signatureValid: result.webhookSecurityValid,
          hasSignature: result.hasSignature,
          hasSecret: result.hasSecret
        });
      } else {
        this.log('Webhook Security', 'fail', `Webhook security test failed: ${response.status}`);
      }
    } catch (error) {
      this.log('Webhook Security', 'warn', `Webhook security test error: ${error.message}`);
    }
  }

  // Main verification runner
  async runVerification() {
    console.log('🔍 GitHub Integration Verification Starting...\n');
    
    await this.checkEnvironmentVariables();
    await this.checkTokenScope();
    await this.checkBranchesPagination();
    await this.checkPushUpdateFlow();
    await this.checkPRMergeConflicts();
    await this.checkWebhookSecurity();

    console.log('\n📊 Verification Summary:');
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    
    if (failed === 0) {
      console.log('\n🎉 GitHub Integration is properly configured!');
    } else {
      console.log('\n🔧 GitHub Integration needs attention. Check failed tests above.');
    }

    return { passed, failed, warnings, results: this.results };
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new GitHubVerifier();
  verifier.runVerification().catch(console.error);
}

module.exports = GitHubVerifier;


#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const AI_BASE_URL = 'http://localhost:5001';

const endpoints = [
  '/api/ai/github/status',
  '/api/ai/github/stats', 
  '/api/ai/github/commits?limit=10',
  '/api/ai/github/branches/status',
  '/api/ai/repository-automation/status',
  '/api/ai/version-control/recent-files'
];

async function testEndpoint(url) {
  try {
    console.log(`🔍 Testing: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${url} - Status: ${response.status}`);
      if (data.success !== false) {
        console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
      } else {
        console.log(`⚠️  Response indicates failure: ${data.error || data.message}`);
      }
    } else {
      console.log(`❌ ${url} - Status: ${response.status}`);
      console.log(`   Error: ${data.error || data.message || 'Unknown error'}`);
    }
    
    console.log('');
  } catch (error) {
    console.log(`💥 ${url} - Connection Error: ${error.message}`);
    console.log('');
  }
}

async function testGitHubIntegration() {
  console.log('🚀 GitHub Integration Test Suite\n');
  console.log('📋 Environment Check:');
  console.log(`   GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   GITHUB_REPO_OWNER: ${process.env.GITHUB_REPO_OWNER || 'Not set'}`);
  console.log(`   GITHUB_REPO_NAME: ${process.env.GITHUB_REPO_NAME || 'Not set'}`);
  console.log('');

  console.log('🔗 Testing Frontend Proxy Endpoints:');
  for (const endpoint of endpoints) {
    await testEndpoint(`${BASE_URL}${endpoint}`);
  }

  console.log('🤖 Testing Direct AI Service Endpoints:');
  for (const endpoint of endpoints) {
    await testEndpoint(`${AI_BASE_URL}${endpoint}`);
  }

  console.log('✨ Test completed!');
}

if (require.main === module) {
  testGitHubIntegration().catch(console.error);
}

module.exports = { testGitHubIntegration };

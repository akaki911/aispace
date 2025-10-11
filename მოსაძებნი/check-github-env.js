

/**
 * GitHub Environment Variables Checker
 * ამოწმებს ყველა სერვისში GitHub-ის env ცვლადების ხელმისაწვდომობას
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 GitHub Environment Variables Checker\n');

// ძირითადი სერვისები
const services = [
  { name: 'Root', path: '.' },
  { name: 'Backend', path: './backend' },
  { name: 'AI Service', path: './ai-service' }
];

const requiredVars = [
  'GITHUB_TOKEN',
  'GITHUB_OWNER', 
  'GITHUB_REPO',
  'GITHUB_API_URL'
];

function checkEnvInService(serviceName, servicePath) {
  console.log(`\n📦 ${serviceName} (${servicePath}):`);
  console.log('─'.repeat(40));
  
  // Set working directory for the service
  const originalCwd = process.cwd();
  
  try {
    if (fs.existsSync(servicePath)) {
      process.chdir(servicePath);
    }
    
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        const maskedValue = varName === 'GITHUB_TOKEN' 
          ? `${value.substring(0, 8)}...` 
          : value;
        console.log(`  ✅ ${varName}: ${maskedValue}`);
      } else {
        console.log(`  ❌ ${varName}: MISSING`);
      }
    });
    
    // Check .env files
    const envFiles = ['.env', '.env.local', '.env.example'];
    envFiles.forEach(envFile => {
      if (fs.existsSync(envFile)) {
        console.log(`  📄 Found: ${envFile}`);
        try {
          const content = fs.readFileSync(envFile, 'utf8');
          requiredVars.forEach(varName => {
            if (content.includes(varName)) {
              console.log(`    🔧 ${varName} configured in ${envFile}`);
            }
          });
        } catch (e) {
          console.log(`    ⚠️ Could not read ${envFile}`);
        }
      }
    });
    
  } catch (error) {
    console.log(`  ❌ Error checking ${serviceName}: ${error.message}`);
  } finally {
    process.chdir(originalCwd);
  }
}

// Check each service
services.forEach(service => {
  checkEnvInService(service.name, service.path);
});

// GitHub API connectivity test
console.log('\n🌐 GitHub API Connectivity Test:');
console.log('─'.repeat(40));

async function testGitHubAPI() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  
  if (!token) {
    console.log('❌ Cannot test - GITHUB_TOKEN missing');
    return;
  }
  
  if (!owner || !repo) {
    console.log('❌ Cannot test - GITHUB_OWNER or GITHUB_REPO missing');
    return;
  }
  
  try {
    const fetch = require('node-fetch');
    console.log(`🔄 Testing: ${apiUrl}/repos/${owner}/${repo}`);
    
    const response = await fetch(`${apiUrl}/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Bakhmaro-GitHub-Checker'
      },
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Repository accessible: ${data.full_name}`);
      console.log(`   Private: ${data.private}`);
      console.log(`   Default branch: ${data.default_branch}`);
    } else {
      console.log(`❌ GitHub API Error: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.log('   🔍 Repository not found or no access');
      } else if (response.status === 401) {
        console.log('   🔑 Invalid or expired token');
      }
    }
    
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
  }
}

testGitHubAPI().then(() => {
  console.log('\n✅ Environment check completed!');
}).catch(console.error);

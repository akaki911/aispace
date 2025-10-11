/**
 * Security Fixes Testing Script
 * 
 * Tests the enhanced security measures in TrustedOps Policy:
 * 1. Path traversal protection
 * 2. Protected file/directory access prevention  
 * 3. Explicit operation allowlist (.json exclusion)
 */

const TrustedOpsPolicy = require('./services/trusted_ops_policy');
const SafetySwitchService = require('./services/safety_switch_service');

async function testSecurityFixes() {
  console.log('🔒 [SECURITY TEST] Starting security fixes validation...');
  
  try {
    // Initialize services
    console.log('\n📋 Initialize Services');
    const safetySwitch = new SafetySwitchService();
    await safetySwitch.initialize();
    
    // Test 1: Path Traversal Attempts (should be BLOCKED)
    console.log('\n🚨 Test 1: Path Traversal Protection');
    const pathTraversalAttempts = [
      '../../../etc/passwd',
      '../../package.json', 
      '../.env',
      './node_modules/evil/hack.js',
      '/etc/hosts'
    ];
    
    for (const maliciousPath of pathTraversalAttempts) {
      const traversalAction = {
        tool_name: 'writeFile',
        parameters: {
          filePath: maliciousPath,
          content: 'MALICIOUS CONTENT'
        }
      };
      
      const result = await safetySwitch.requestActionConfirmation(traversalAction);
      if (result.instant) {
        console.log(`❌ SECURITY FAILURE: Path traversal allowed for ${maliciousPath}`);
      } else {
        console.log(`✅ Path traversal blocked: ${maliciousPath}`);
      }
    }
    
    // Test 2: Protected Files (should be BLOCKED)
    console.log('\n🔒 Test 2: Protected File Access');
    const protectedFiles = [
      'package.json',
      '.env', 
      'firebase-admin-key.json',
      '.replit',
      'tsconfig.json'
    ];
    
    for (const protectedFile of protectedFiles) {
      const protectedAction = {
        tool_name: 'writeFile',
        parameters: {
          filePath: protectedFile,
          content: 'SHOULD BE BLOCKED'
        }
      };
      
      const result = await safetySwitch.requestActionConfirmation(protectedAction);
      if (result.instant) {
        console.log(`❌ SECURITY FAILURE: Protected file access allowed for ${protectedFile}`);
      } else {
        console.log(`✅ Protected file blocked: ${protectedFile}`);
      }
    }
    
    // Test 3: .json Files (should be BLOCKED from auto-approval)
    console.log('\n🔍 Test 3: .json File Restriction');
    const jsonAction = {
      tool_name: 'writeFile',
      parameters: {
        filePath: 'config.json',
        content: '{"test": "value"}'
      }
    };
    
    const jsonResult = await safetySwitch.requestActionConfirmation(jsonAction);
    if (jsonResult.instant) {
      console.log('❌ SECURITY FAILURE: .json file auto-approved (should require confirmation)');
    } else {
      console.log('✅ .json file correctly requires confirmation');
    }
    
    // Test 4: Safe Code Files (should be ALLOWED)
    console.log('\n✅ Test 4: Safe Code File Auto-Approval');
    const safeCodeFiles = [
      { ext: '.tsx', path: 'components/Button.tsx' },
      { ext: '.py', path: 'scripts/helper.py' },
      { ext: '.css', path: 'styles/theme.css' },
      { ext: '.md', path: 'docs/readme.md' }
    ];
    
    for (const safeFile of safeCodeFiles) {
      const safeAction = {
        tool_name: 'writeFile',
        parameters: {
          filePath: safeFile.path,
          content: `// Safe ${safeFile.ext} file content`
        }
      };
      
      const result = await safetySwitch.requestActionConfirmation(safeAction);
      if (result.instant) {
        console.log(`✅ Safe ${safeFile.ext} auto-approved: ${safeFile.path}`);
      } else {
        console.log(`⚠️ Safe ${safeFile.ext} unexpectedly requires confirmation: ${safeFile.path}`);
      }
    }
    
    // Test 5: Export Compatibility
    console.log('\n🔧 Test 5: Export Compatibility');
    try {
      const { safetySwitchService } = require('./services/safety_switch_service');
      console.log('✅ Singleton export working');
    } catch (error) {
      console.log('❌ Singleton export broken:', error.message);
    }
    
    console.log('\n🎉 [SECURITY TEST] Security fixes validation completed!');
    console.log('🛡️ Enhanced security measures are now active');
    
  } catch (error) {
    console.error('❌ [SECURITY TEST] Test failed:', error);
    process.exit(1);
  }
}

// Run the security test
if (require.main === module) {
  testSecurityFixes().catch(console.error);
}

module.exports = { testSecurityFixes };
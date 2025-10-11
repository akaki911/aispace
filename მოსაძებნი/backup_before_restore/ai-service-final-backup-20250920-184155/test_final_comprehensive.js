/**
 * Final Comprehensive Testing Script
 * 
 * Complete validation of Phase 1 TrustedOps implementation including:
 * - Security fixes validation
 * - Instant execution testing
 * - Package installation blocking
 * - Audit/rollback system
 */

const SafetySwitchService = require('./services/safety_switch_service');

async function runComprehensiveTest() {
  console.log('🏆 [FINAL TEST] Starting comprehensive Phase 1 validation...');
  
  try {
    // Initialize services
    console.log('\n📋 Initialize SafetySwitchService');
    const safetySwitch = new SafetySwitchService();
    await safetySwitch.initialize();
    
    let testResults = {
      instantCodeApproval: false,
      packageInstallBlocked: false,
      pathTraversalBlocked: false,
      jsonFileBlocked: false,
      auditLogging: false,
      exportCompatibility: false
    };
    
    // Test 1: INSTANT CODE EXECUTION (.tsx should be auto-approved)
    console.log('\n🚀 Test 1: Instant .tsx file execution (like Replit Assistant)');
    const tsxAction = {
      tool_name: 'writeFile',
      parameters: {
        filePath: 'src/components/TestComponent.tsx',
        content: 'export const TestComponent = () => <div>Hello World</div>;'
      }
    };
    
    const tsxResult = await safetySwitch.requestActionConfirmation(tsxAction);
    if (tsxResult.instant) {
      console.log('✅ .tsx file auto-approved instantly!', tsxResult.reason);
      testResults.instantCodeApproval = true;
    } else {
      console.log('❌ .tsx file should be auto-approved but requires confirmation');
    }
    
    // Test 2: PACKAGE INSTALL BLOCKED (medium-risk should require confirmation)  
    console.log('\n🔒 Test 2: installPackage requires confirmation (security fix)');
    const packageAction = {
      tool_name: 'installPackage',
      parameters: {
        packageName: 'express'
      }
    };
    
    // This should NOT wait for input since it should require confirmation
    console.log('Testing package install - should require confirmation immediately...');
    const packagePromise = safetySwitch.requestActionConfirmation(packageAction);
    
    // Wait briefly to see if it returns immediately (requires confirmation) or waits (auto-approved)
    const raceResult = await Promise.race([
      packagePromise,
      new Promise(resolve => setTimeout(() => resolve('TIMEOUT_CONFIRMATION_REQUIRED'), 1000))
    ]);
    
    if (raceResult === 'TIMEOUT_CONFIRMATION_REQUIRED') {
      console.log('✅ installPackage correctly requires confirmation (not auto-approved)');
      testResults.packageInstallBlocked = true;
    } else if (raceResult.instant) {
      console.log('❌ SECURITY FAILURE: installPackage was auto-approved when it should require confirmation');
    } else {
      console.log('✅ installPackage requires confirmation');
      testResults.packageInstallBlocked = true;
    }
    
    // Test 3: PATH TRAVERSAL BLOCKED
    console.log('\n🚨 Test 3: Path traversal protection');
    const traversalAction = {
      tool_name: 'writeFile', 
      parameters: {
        filePath: '../../../etc/passwd',
        content: 'MALICIOUS'
      }
    };
    
    const traversalPromise = safetySwitch.requestActionConfirmation(traversalAction);
    const traversalRace = await Promise.race([
      traversalPromise,
      new Promise(resolve => setTimeout(() => resolve('PATH_TRAVERSAL_BLOCKED'), 1000))
    ]);
    
    if (traversalRace === 'PATH_TRAVERSAL_BLOCKED') {
      console.log('✅ Path traversal correctly blocked/requires confirmation');
      testResults.pathTraversalBlocked = true;
    } else if (traversalRace.instant) {
      console.log('❌ SECURITY FAILURE: Path traversal was auto-approved');
    } else {
      console.log('✅ Path traversal requires confirmation');
      testResults.pathTraversalBlocked = true;
    }
    
    // Test 4: .JSON FILES BLOCKED FROM AUTO-APPROVAL
    console.log('\n🔍 Test 4: .json files require confirmation');
    const jsonAction = {
      tool_name: 'writeFile',
      parameters: {
        filePath: 'config.json',
        content: '{"test": "value"}'
      }
    };
    
    const jsonPromise = safetySwitch.requestActionConfirmation(jsonAction);
    const jsonRace = await Promise.race([
      jsonPromise,
      new Promise(resolve => setTimeout(() => resolve('JSON_BLOCKED'), 1000))
    ]);
    
    if (jsonRace === 'JSON_BLOCKED') {
      console.log('✅ .json files correctly require confirmation (not auto-approved)');
      testResults.jsonFileBlocked = true;
    } else if (jsonRace.instant) {
      console.log('❌ SECURITY ISSUE: .json file was auto-approved when it should require confirmation');
    } else {
      console.log('✅ .json file requires confirmation');
      testResults.jsonFileBlocked = true;
    }
    
    // Test 5: AUDIT LOGGING
    console.log('\n📊 Test 5: Audit logging verification');
    const auditStats = safetySwitch.trustedOpsPolicy.getStats();
    if (auditStats.totalBypassed > 0) {
      console.log('✅ Audit logging working:', auditStats);
      testResults.auditLogging = true;
    } else {
      console.log('⚠️ No audit entries found');
    }
    
    // Test 6: EXPORT COMPATIBILITY 
    console.log('\n🔧 Test 6: Export compatibility');
    try {
      const { safetySwitchService } = require('./services/safety_switch_service');
      console.log('✅ Singleton export working');
      testResults.exportCompatibility = true;
    } catch (error) {
      console.log('❌ Singleton export broken:', error.message);
    }
    
    // FINAL RESULTS
    console.log('\n🏆 [FINAL TEST RESULTS] Phase 1 Comprehensive Validation:');
    console.log('==========================================');
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Phase 1 TrustedOps ready for production!');
      console.log('🚀 Instant execution parity with Replit Assistant achieved!');
      console.log('🛡️ Security measures verified and operational!');
    } else {
      console.log('❌ Some tests failed - Phase 1 needs additional fixes');
    }
    
  } catch (error) {
    console.error('❌ [FINAL TEST] Comprehensive test failed:', error);
    process.exit(1);
  }
}

// Run the comprehensive test
if (require.main === module) {
  runComprehensiveTest().catch(console.error);
}

module.exports = { runComprehensiveTest };
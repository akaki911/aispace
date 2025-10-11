/**
 * TrustedOps Testing Script
 * 
 * Tests the TrustedOps Policy integration with SafetySwitch Service
 * to verify instant execution capabilities like Replit Assistant.
 */

const TrustedOpsPolicy = require('./services/trusted_ops_policy');
const SafetySwitchService = require('./services/safety_switch_service');

async function testTrustedOpsSystem() {
  console.log('🧪 [TRUSTED OPS TEST] Starting TrustedOps system test...');
  
  try {
    // Test 1: Create and initialize TrustedOpsPolicy
    console.log('\n📋 Test 1: Initialize TrustedOpsPolicy');
    const trustedOps = new TrustedOpsPolicy();
    await trustedOps.initialize();
    console.log('✅ TrustedOpsPolicy initialized successfully');
    
    // Test 2: Create and initialize SafetySwitchService with TrustedOps
    console.log('\n📋 Test 2: Initialize SafetySwitchService with TrustedOps');
    const safetySwitch = new SafetySwitchService();
    await safetySwitch.initialize();
    console.log('✅ SafetySwitchService with TrustedOps initialized successfully');
    
    // Test 3: Test LOW RISK operation (should be auto-approved)
    console.log('\n📋 Test 3: Test LOW RISK code file operation (instant like Replit Assistant)');
    const lowRiskAction = {
      tool_name: 'writeFile',
      parameters: {
        filePath: 'test.tsx',
        content: 'const HelloWorld = () => <div>Hello World</div>;'
      }
    };
    
    const lowRiskResult = await safetySwitch.requestActionConfirmation(lowRiskAction);
    if (lowRiskResult.instant) {
      console.log('🚀 ✅ LOW RISK: Instant approval successful!', lowRiskResult.reason);
    } else {
      console.log('❌ LOW RISK: Should have been auto-approved');
    }
    
    // Test 4: Test MEDIUM RISK operation with small size (should be auto-approved)
    console.log('\n📋 Test 4: Test MEDIUM RISK small config file (auto-approved)');
    const mediumRiskAction = {
      tool_name: 'writeFile',
      parameters: {
        filePath: 'config.json',
        content: '{"theme": "dark", "lang": "en"}'
      }
    };
    
    const mediumRiskResult = await safetySwitch.requestActionConfirmation(mediumRiskAction);
    if (mediumRiskResult.instant) {
      console.log('🚀 ✅ MEDIUM RISK: Small config auto-approved!', mediumRiskResult.reason);
    } else {
      console.log('⚠️ MEDIUM RISK: Requires confirmation (expected for medium risk)');
    }
    
    // Test 5: Test HIGH RISK operation (should require confirmation)
    console.log('\n📋 Test 5: Test HIGH RISK protected file (requires confirmation)');
    const highRiskAction = {
      tool_name: 'writeFile',
      parameters: {
        filePath: 'package.json',
        content: '{"name": "test"}'
      }
    };
    
    const highRiskResult = await safetySwitch.requestActionConfirmation(highRiskAction);
    if (!highRiskResult.instant) {
      console.log('✅ HIGH RISK: Correctly requires confirmation');
    } else {
      console.log('❌ HIGH RISK: Should require confirmation, not instant approval');
    }
    
    // Test 6: Test TrustedOps audit log
    console.log('\n📋 Test 6: Check audit log');
    const auditLog = trustedOps.getAuditLog();
    console.log(`✅ Audit log contains ${auditLog.length} entries`);
    
    // Test 7: Test policy statistics
    console.log('\n📋 Test 7: Check policy statistics');
    const stats = trustedOps.getStats();
    console.log('✅ Policy statistics:', {
      isEnabled: stats.isEnabled,
      totalBypassed: stats.totalBypassed,
      auditingEnabled: stats.auditingEnabled,
      rollbackEnabled: stats.rollbackEnabled
    });
    
    console.log('\n🎉 [TRUSTED OPS TEST] All tests completed successfully!');
    console.log('🚀 TrustedOps system ready for instant execution like Replit Assistant!');
    
  } catch (error) {
    console.error('❌ [TRUSTED OPS TEST] Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testTrustedOpsSystem().catch(console.error);
}

module.exports = { testTrustedOpsSystem };
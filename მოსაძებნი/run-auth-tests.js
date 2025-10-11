
const AuthFlowTests = require('./backend/test/auth-flow-tests');
const express = require('express');

async function runTests() {
  console.log('🚀 Starting Authentication Flow Testing Suite\n');
  
  try {
    // Create a test app instance (you might need to adjust this based on your setup)
    const app = require('./backend/index.js');
    
    // Initialize test suite
    const testSuite = new AuthFlowTests(app);
    
    // Run all tests
    await testSuite.runAllTests();
    
    console.log('\n🎉 Testing complete!');
    
  } catch (error) {
    console.error('❌ Test suite failed to initialize:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests().then(() => {
    console.log('✅ All tests completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test run failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };

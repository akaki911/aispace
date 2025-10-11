
#!/usr/bin/env node

const { runComprehensiveTests } = require('./backend/test_ai_comprehensive.js');

console.log('🔧 Bakhmaro AI სისტემის სრული ტესტირება');
console.log('══════════════════════════════════════════\n');

// Run the comprehensive tests
runComprehensiveTests()
  .then(() => {
    console.log('\n🎉 ტესტირება დასრულდა!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ ტესტირების შეცდომა:', error.message);
    process.exit(1);
  });

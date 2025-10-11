
// Initialize Firebase first
const admin = require('../firebase');

// Import migration functions after Firebase is initialized
const { migrateWebAuthnCredentials } = require('./migrateWebAuthnToFirestore');

async function runMigrationSafely() {
  console.log('🔄 [MIGRATION RUNNER] Starting WebAuthn migration process...');
  
  try {
    // Verify Firebase connection
    console.log('🔍 [MIGRATION RUNNER] Verifying Firebase connection...');
    const db = admin.firestore();
    await db.collection('authCredentials').limit(1).get();
    console.log('✅ [MIGRATION RUNNER] Firebase connection verified');
    
    // Run migration
    await migrateWebAuthnCredentials();
    
    console.log('🎉 [MIGRATION RUNNER] Migration completed successfully!');
    console.log('📝 [MIGRATION RUNNER] Next steps:');
    console.log('   1. Test Passkey login functionality');
    console.log('   2. Verify counters are updating correctly');
    console.log('   3. Check that no JSON files are being read during authentication');
    
  } catch (error) {
    console.error('❌ [MIGRATION RUNNER] Migration failed:', error);
    console.log('🔧 [MIGRATION RUNNER] Recovery options:');
    console.log('   1. Check Firebase service account configuration');
    console.log('   2. Verify JSON credentials file exists');
    console.log('   3. Review error logs above');
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runMigrationSafely()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 [MIGRATION RUNNER] Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMigrationSafely };

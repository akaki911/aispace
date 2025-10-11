
const admin = require('./backend/firebase.js');

async function createSuperAdminUser() {
  try {
    const userRecord = await admin.auth().createUser({
      uid: '6H0Gwt0JRSqhNK1a4cvY',
      email: 'admin@bakhmaro.co',
      password: '2Akakiviinaadzea3@',
      displayName: 'აკაკი ცინცაძე',
      emailVerified: true,
    });

    console.log('✅ Successfully created Firebase user:', userRecord.uid);
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'SUPER_ADMIN',
      personalId: '01019062020'
    });
    
    console.log('✅ Successfully set custom claims');
    
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('✅ User already exists in Firebase Auth');
      
      // Just update the password
      try {
        await admin.auth().updateUser('6H0Gwt0JRSqhNK1a4cvY', {
          password: '2Akakiviinaadzea3@'
        });
        console.log('✅ Password updated');
      } catch (updateError) {
        console.error('❌ Error updating password:', updateError);
      }
    } else {
      console.error('❌ Error creating user:', error);
    }
  }
}

createSuperAdminUser().then(() => {
  process.exit(0);
}).catch(console.error);


const fetch = require('node-fetch');

async function checkSystemHealth() {
  console.log('🔧 სისტემის ჯანმრთელობის შემოწმება...\n');

  // 1. Backend Health
  try {
    const backendHealth = await fetch('http://localhost:5002/health');
    console.log(`✅ Backend: ${backendHealth.ok ? 'OK' : 'ERROR'} (${backendHealth.status})`);
  } catch (error) {
    console.log('❌ Backend: OFFLINE');
  }

  // 2. AI Service Health
  try {
    const aiHealth = await fetch('http://localhost:5001/health');
    console.log(`✅ AI Service: ${aiHealth.ok ? 'OK' : 'ERROR'} (${aiHealth.status})`);
  } catch (error) {
    console.log('❌ AI Service: OFFLINE');
  }

  // 3. WebAuthn Debug
  try {
    const webauthnDebug = await fetch('http://localhost:5002/api/admin/auth/webauthn/debug');
    if (webauthnDebug.ok) {
      const data = await webauthnDebug.json();
      console.log('✅ WebAuthn Config:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ WebAuthn Debug: ERROR');
  }

  // 4. Admin Session Check
  try {
    const adminMe = await fetch('http://localhost:5002/api/admin/auth/me', {
      headers: { 'Cookie': '' }
    });
    console.log(`🔐 Admin Session: ${adminMe.status === 200 ? 'ACTIVE' : 'INACTIVE'} (${adminMe.status})`);
  } catch (error) {
    console.log('❌ Admin Session Check: ERROR');
  }

  console.log('\n🏁 შემოწმება დასრულდა');
}

checkSystemHealth().catch(console.error);

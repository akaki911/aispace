
const http = require('http');

console.log('🔍 Auth Diagnostics Test Starting...');

// Test 1: Backend health check
function testBackendHealth() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5002,
      path: '/api/health',
      method: 'GET'
    }, (res) => {
      console.log('🏥 Backend Health:', res.statusCode);
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (err) => {
      console.log('❌ Backend Health Error:', err.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Test 2: Auth endpoint without session
function testAuthEndpointNoSession() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5002,
      path: '/api/admin/auth/me',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('🔐 Auth Endpoint (No Session):');
        console.log('   Status:', res.statusCode);
        console.log('   Headers:', res.headers);
        console.log('   Response:', data);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Auth Endpoint Error:', err.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Run all tests
async function runDiagnostics() {
  console.log('='.repeat(50));
  
  await testBackendHealth();
  console.log('-'.repeat(30));
  
  await testAuthEndpointNoSession();
  console.log('-'.repeat(30));
  
  console.log('✅ Diagnostics Complete');
  console.log('='.repeat(50));
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Check browser DevTools Network tab');
  console.log('2. Look for Set-Cookie headers in response');
  console.log('3. Verify credentials: "include" in fetch requests');
  console.log('4. Check if session cookie is being sent back');
}

runDiagnostics();

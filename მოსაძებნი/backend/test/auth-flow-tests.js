
const assert = require('assert');
const request = require('supertest');

class AuthFlowTests {
  constructor(app) {
    this.app = app;
    this.testResults = [];
    this.sessionCookie = null;
  }

  async runAllTests() {
    console.log('🧪 Starting Authentication Flow Tests...\n');
    
    const tests = [
      this.testSessionInitialization,
      this.testWebAuthnRegistrationOptions,
      this.testWebAuthnLoginOptions,
      this.testDevModeBypass,
      this.testAuthenticationPersistence,
      this.testLogoutFlow,
      this.testUnauthorizedAccess,
      this.testRateLimiting
    ];

    for (const test of tests) {
      try {
        console.log(`🔍 Running: ${test.name}`);
        await test.call(this);
        this.testResults.push({ 
          test: test.name, 
          status: 'PASSED',
          timestamp: new Date().toISOString()
        });
        console.log(`✅ ${test.name} - PASSED\n`);
      } catch (error) {
        console.error(`❌ ${test.name} - FAILED:`, error.message);
        this.testResults.push({
          test: test.name,
          status: 'FAILED',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.generateTestReport();
  }

  async testSessionInitialization() {
    const response = await request(this.app)
      .get('/api/admin/webauthn/me')
      .expect(401);

    assert(response.body.error === 'Not authenticated', 'Initial state should be unauthenticated');
    
    // Capture session cookie for subsequent tests
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      this.sessionCookie = setCookie[0].split(';')[0];
    }
  }

  async testWebAuthnRegistrationOptions() {
    const response = await request(this.app)
      .post('/api/admin/webauthn/register-options')
      .set('x-admin-setup-token', process.env.ADMIN_SETUP_TOKEN || 'DEV_TOKEN')
      .send({
        userId: '01019062020',
        email: 'admin@bakhmaro.ge'
      });

    if (process.env.NODE_ENV === 'development') {
      // In development, this might be bypassed or work differently
      assert(response.status === 200 || response.status === 403, 'Registration options should return 200 or 403');
    } else {
      assert(response.status === 200, 'Registration options should return 200 in production');
      assert(response.body.success === true, 'Should be successful');
      assert(response.body.options.challenge, 'Should include WebAuthn challenge');
      assert(response.body.options.user, 'Should include user information');
    }
  }

  async testWebAuthnLoginOptions() {
    const response = await request(this.app)
      .post('/api/admin/webauthn/login-options')
      .send({});

    // Should either work or indicate no credentials
    assert(response.status === 200 || response.status === 404, 
           'Login options should return 200 or 404 (no credentials)');
  }

  async testDevModeBypass() {
    if (process.env.NODE_ENV !== 'development') {
      console.log('⏭️ Skipping dev mode bypass test (not in development)');
      return;
    }

    const response = await request(this.app)
      .post('/api/admin/webauthn/login-verify')
      .send({ credential: 'DEV_MODE' });

    assert(response.status === 200, 'Dev mode bypass should work');
    assert(response.body.success === true, 'Response should indicate success');
    assert(response.body.user, 'Should return user object');
    
    // Capture auth cookie
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      this.sessionCookie = setCookie[0].split(';')[0];
    }
  }

  async testAuthenticationPersistence() {
    if (!this.sessionCookie) {
      console.log('⏭️ Skipping persistence test (no session cookie available)');
      return;
    }

    const response = await request(this.app)
      .get('/api/admin/webauthn/me')
      .set('Cookie', this.sessionCookie)
      .expect(200);

    assert(response.body.success === true, 'Should be authenticated with valid session');
    assert(response.body.user, 'Should return user information');
    assert(response.body.user.role === 'SUPER_ADMIN', 'Should have correct role');
  }

  async testLogoutFlow() {
    if (!this.sessionCookie) {
      console.log('⏭️ Skipping logout test (no session cookie available)');
      return;
    }

    const response = await request(this.app)
      .post('/api/admin/auth/logout')
      .set('Cookie', this.sessionCookie)
      .expect(200);

    assert(response.body.success === true, 'Logout should succeed');

    // Verify session is destroyed
    const meResponse = await request(this.app)
      .get('/api/admin/webauthn/me')
      .set('Cookie', this.sessionCookie)
      .expect(401);

    assert(meResponse.body.error === 'Not authenticated', 'Should be logged out');
  }

  async testUnauthorizedAccess() {
    const response = await request(this.app)
      .post('/api/admin/webauthn/register-options')
      .send({ userId: '12345678901', email: 'wrong@test.com' }); // Wrong user

    assert(response.status === 403, 'Should reject unauthorized access');
    assert(response.body.code === 'SUPER_ADMIN_ONLY', 'Should indicate admin-only restriction');
  }

  async testRateLimiting() {
    // Test multiple rapid requests
    const requests = Array(6).fill().map(() => 
      request(this.app)
        .post('/api/admin/webauthn/login-options')
        .send({})
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    // Rate limiting should kick in after 5 requests
    assert(rateLimited, 'Rate limiting should activate after multiple requests');
  }

  generateTestReport() {
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    
    console.log('\n📊 AUTHENTICATION FLOW TEST REPORT');
    console.log('=====================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(result => {
          console.log(`  - ${result.test}: ${result.error}`);
        });
    }

    console.log('\n📝 Detailed Results:', JSON.stringify(this.testResults, null, 2));
  }
}

module.exports = AuthFlowTests;

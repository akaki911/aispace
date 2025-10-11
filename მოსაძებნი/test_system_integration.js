
const axios = require('axios');

// Ensure local service calls bypass any corporate proxies that may block 0.0.0.0
const proxyBypassHosts = ['127.0.0.1', 'localhost', '0.0.0.0'];
const existingNoProxy = process.env.NO_PROXY ? process.env.NO_PROXY.split(',') : [];
const mergedNoProxy = Array.from(new Set([...existingNoProxy, ...proxyBypassHosts]));
process.env.NO_PROXY = mergedNoProxy.filter(Boolean).join(',');
axios.defaults.proxy = false;
axios.defaults.headers.common['Origin'] = 'http://localhost:5000';

class SystemIntegrationTest {
  constructor() {
    this.baseURL = process.env.BASE_URL || 'http://127.0.0.1:5002';
    this.aiServiceURL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Starting System Integration Tests...\n');
    
    const tests = [
      this.testAIServiceHealth,
      this.testBackendProxy,
      this.testAuthorizationFlow,
      this.testAIChatFlow,
      this.testMemorySync,
      this.testErrorHandling,
      this.testPerformance
    ];
    
    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        console.error(`❌ Test failed: ${test.name}`, error.message);
        this.testResults.push({
          test: test.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    this.generateTestReport();
  }

  async testAIServiceHealth() {
    console.log('🏥 Testing AI Service Health...');
    
    const response = await axios.get(`${this.aiServiceURL}/health`);
    
    const serviceStatus = response.data?.status;
    const normalizedStatus = typeof serviceStatus === 'string'
      ? serviceStatus.toLowerCase()
      : serviceStatus;
    const isHealthy = normalizedStatus === 'healthy' || response.data?.ok === true;

    if (response.status === 200 && isHealthy) {
      console.log('✅ AI Service health check passed');
      this.testResults.push({ test: 'ai_service_health', status: 'passed' });
    } else {
      throw new Error('AI Service health check failed');
    }
  }

  async testBackendProxy() {
    console.log('🔄 Testing Backend Proxy...');
    
    const response = await axios.get(`${this.baseURL}/api/ai/health`);
    
    if (response.status === 200) {
      console.log('✅ Backend proxy test passed');
      this.testResults.push({ test: 'backend_proxy', status: 'passed' });
    } else {
      throw new Error('Backend proxy test failed');
    }
  }

  async testAuthorizationFlow() {
    console.log('🔐 Testing Authorization Flow...');
    
    // Test without authorization
    try {
      await axios.post(`${this.baseURL}/api/ai/chat`, {
        message: 'test',
        personalId: null
      });
      throw new Error('Should have been rejected');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Authorization rejection test passed');
      } else {
        throw error;
      }
    }
    
    // Test with valid authorization
    const response = await axios.post(`${this.baseURL}/api/ai/chat`, {
      message: 'გამარჯობა',
      personalId: '01019062020'
    });
    
    if (response.status === 200) {
      console.log('✅ Authorization acceptance test passed');
      this.testResults.push({ test: 'authorization_flow', status: 'passed' });
    } else {
      throw new Error('Authorization acceptance test failed');
    }
  }

  async testAIChatFlow() {
    console.log('💬 Testing AI Chat Flow...');
    
    const startTime = Date.now();
    const response = await axios.post(`${this.baseURL}/api/ai/chat`, {
      message: 'რამდენია 2+2?',
      personalId: '01019062020'
    });
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200 && response.data.response) {
      console.log(`✅ AI Chat test passed (${responseTime}ms)`);
      this.testResults.push({ 
        test: 'ai_chat_flow', 
        status: 'passed',
        responseTime
      });
    } else {
      throw new Error('AI Chat test failed');
    }
  }

  async testMemorySync() {
    console.log('🧠 Testing Memory Sync...');
    
    // Test memory storage
    const response = await axios.post(`${this.baseURL}/api/ai/remember`, {
      userId: '01019062020',
      fact: 'ტესტური ფაქტი სისტემის შემოწმებისთვის'
    });
    
    if (response.status === 200) {
      console.log('✅ Memory sync test passed');
      this.testResults.push({ test: 'memory_sync', status: 'passed' });
    } else {
      throw new Error('Memory sync test failed');
    }
  }

  async testErrorHandling() {
    console.log('⚠️ Testing Error Handling...');
    
    try {
      await axios.post(`${this.baseURL}/api/ai/chat`, {
        message: '', // Empty message should trigger validation error
        personalId: '01019062020'
      });
      throw new Error('Should have triggered validation error');
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        console.log('✅ Error handling test passed');
        this.testResults.push({ test: 'error_handling', status: 'passed' });
      } else {
        throw error;
      }
    }
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    const requests = [];
    const concurrentRequests = 5;
    
    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(
        axios.post(`${this.baseURL}/api/ai/chat`, {
          message: `ტესტური შეკითხვა ${i + 1}`,
          personalId: '01019062020'
        })
      );
    }
    
    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    
    const allSuccessful = responses.every(r => r.status === 200);
    const averageTime = totalTime / concurrentRequests;
    
    if (allSuccessful && averageTime < 5000) {
      console.log(`✅ Performance test passed (avg: ${averageTime}ms)`);
      this.testResults.push({ 
        test: 'performance', 
        status: 'passed',
        averageTime,
        concurrentRequests
      });
    } else {
      throw new Error(`Performance test failed: avg ${averageTime}ms`);
    }
  }

  generateTestReport() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%\n`);
    
    this.testResults.forEach(result => {
      const status = result.status === 'passed' ? '✅' : '❌';
      const time = result.responseTime ? ` (${result.responseTime}ms)` : '';
      console.log(`${status} ${result.test}${time}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n🎯 System Status:', passed === total ? 'HEALTHY' : 'NEEDS ATTENTION');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SystemIntegrationTest();
  tester.runAllTests().catch(console.error);
}

module.exports = SystemIntegrationTest;


const axios = require('axios');
const { performance } = require('perf_hooks');

// Service URLs
const AI_SERVICE_URL = 'http://0.0.0.0:5001';
const BACKEND_URL = 'http://0.0.0.0:5002';
const FRONTEND_URL = 'http://0.0.0.0:5000';

let testResults = {
  healthChain: { passed: 0, failed: 0, tests: [] },
  functional: { passed: 0, failed: 0, tests: [] },
  performance: { passed: 0, failed: 0, tests: [], metrics: {} }
};

// Utility functions
const logTest = (category, testName, passed, details = {}) => {
  const status = passed ? '✅' : '❌';
  const timestamp = new Date().toISOString();
  
  console.log(`${status} [${category.toUpperCase()}] ${testName}`, details);
  
  testResults[category].tests.push({
    name: testName,
    passed,
    timestamp,
    details
  });
  
  if (passed) {
    testResults[category].passed++;
  } else {
    testResults[category].failed++;
  }
};

const measureTime = async (fn) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

// 1. Health Chain Tests: AI(5001) → BE(5002) → FE proxy
async function testHealthChain() {
  console.log('\n🏥 Testing Health Chain: AI → Backend → Frontend Proxy\n');

  // Test 1: AI Service Health
  try {
    const aiHealthResponse = await axios.get(`${AI_SERVICE_URL}/health/ready`, {
      timeout: 5000
    });
    
    const aiHealthPassed = aiHealthResponse.status === 200 && 
                          aiHealthResponse.data.status === 'READY';
    
    logTest('healthChain', 'AI Service Ready Check', aiHealthPassed, {
      status: aiHealthResponse.status,
      serviceStatus: aiHealthResponse.data.status,
      uptime: aiHealthResponse.data.uptime
    });
    
  } catch (error) {
    logTest('healthChain', 'AI Service Ready Check', false, {
      error: error.message,
      code: error.code
    });
  }

  // Test 2: Backend Health
  try {
    const backendHealthResponse = await axios.get(`${BACKEND_URL}/api/health`, {
      timeout: 5000
    });
    
    const backendHealthPassed = backendHealthResponse.status === 200 && 
                               backendHealthResponse.data.status === 'ok';
    
    logTest('healthChain', 'Backend Health Check', backendHealthPassed, {
      status: backendHealthResponse.status,
      serviceStatus: backendHealthResponse.data.status,
      port: backendHealthResponse.data.port
    });
    
  } catch (error) {
    logTest('healthChain', 'Backend Health Check', false, {
      error: error.message,
      code: error.code
    });
  }

  // Test 3: Frontend Proxy to Backend
  try {
    const proxyHealthResponse = await axios.get(`${FRONTEND_URL}/api/health`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Smoke-Test/1.0'
      }
    });
    
    const proxyHealthPassed = proxyHealthResponse.status === 200;
    
    logTest('healthChain', 'Frontend Proxy Health', proxyHealthPassed, {
      status: proxyHealthResponse.status,
      proxyWorking: true
    });
    
  } catch (error) {
    logTest('healthChain', 'Frontend Proxy Health', false, {
      error: error.message,
      code: error.code,
      proxyWorking: false
    });
  }

  // Test 4: System Status Chain
  try {
    const systemStatusResponse = await axios.get(`${BACKEND_URL}/api/health/system-status`, {
      timeout: 10000
    });
    
    const systemPassed = systemStatusResponse.status === 200 &&
                        systemStatusResponse.data.overallStatus === 'HEALTHY';
    
    logTest('healthChain', 'System Status Chain', systemPassed, {
      status: systemStatusResponse.status,
      overallStatus: systemStatusResponse.data.overallStatus,
      aiServiceReady: systemStatusResponse.data.health?.aiService?.ready,
      aiServiceLive: systemStatusResponse.data.health?.aiService?.live
    });
    
  } catch (error) {
    logTest('healthChain', 'System Status Chain', false, {
      error: error.message,
      code: error.code
    });
  }
}

// 2. Functional Tests: FE→BE→AI Chain
async function testFunctional() {
  console.log('\n🔧 Testing Functional Flow: FE → BE → AI\n');

  // Test 1: AI Chat Flow (FE→BE→AI)
  try {
    const chatPayload = {
      message: "გამარჯობა, ეს smoke test-ია",
      personalId: "smoke-test-user",
      context: {
        projectInfo: { source: "smoke_test" }
      }
    };

    const { result: chatResponse, duration: chatDuration } = await measureTime(async () => {
      return await axios.post(`${FRONTEND_URL}/api/ai/intelligent-chat`, chatPayload, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Smoke-Test/1.0'
        }
      });
    });

    const chatPassed = (chatResponse.status === 200 || chatResponse.status === 400) &&
                      chatResponse.data.success !== undefined;

    logTest('functional', 'AI Chat Flow (FE→BE→AI)', chatPassed, {
      status: chatResponse.status,
      success: chatResponse.data.success,
      hasResponse: !!chatResponse.data.response,
      duration: `${chatDuration.toFixed(2)}ms`,
      rollout: chatResponse.data.rollout
    });

  } catch (error) {
    logTest('functional', 'AI Chat Flow (FE→BE→AI)', false, {
      error: error.message,
      code: error.code,
      timeout: error.code === 'ECONNABORTED'
    });
  }

  // Test 2: Auto-Improve Proposals (previously 404)
  try {
    const proposalsResponse = await axios.get(`${FRONTEND_URL}/api/ai/autoimprove/proposals`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Smoke-Test/1.0'
      }
    });

    const proposalsPassed = proposalsResponse.status === 200 &&
                           proposalsResponse.data.success &&
                           Array.isArray(proposalsResponse.data.proposals);

    logTest('functional', 'Auto-Improve Proposals Access', proposalsPassed, {
      status: proposalsResponse.status,
      success: proposalsResponse.data.success,
      proposalsCount: proposalsResponse.data.proposals?.length,
      no404: true
    });

  } catch (error) {
    const is404 = error.response?.status === 404;
    logTest('functional', 'Auto-Improve Proposals Access', false, {
      error: error.message,
      status: error.response?.status,
      is404Error: is404
    });
  }

  // Test 3: AI Models Endpoint
  try {
    const modelsResponse = await axios.get(`${FRONTEND_URL}/api/ai/models`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Smoke-Test/1.0'
      }
    });

    const modelsPassed = modelsResponse.status === 200 &&
                        modelsResponse.data.success &&
                        Array.isArray(modelsResponse.data.models);

    logTest('functional', 'AI Models Endpoint', modelsPassed, {
      status: modelsResponse.status,
      success: modelsResponse.data.success,
      modelsCount: modelsResponse.data.models?.length
    });

  } catch (error) {
    logTest('functional', 'AI Models Endpoint', false, {
      error: error.message,
      status: error.response?.status
    });
  }

  // Test 4: Release Notes endpoint schema
  try {
    const releaseResponse = await axios.post(`${BACKEND_URL}/api/ai/repository-automation/release/generate-notes`, {}, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Smoke-Test/1.0'
      }
    });

    const data = releaseResponse.data || {};
    const schemaPassed = releaseResponse.status === 200 &&
      data.success !== false &&
      typeof data.version === 'string' &&
      typeof data.notes === 'string' &&
      typeof data.range === 'object';

    logTest('functional', 'Release Notes Schema', schemaPassed, {
      status: releaseResponse.status,
      success: data.success,
      hasVersion: typeof data.version === 'string',
      hasNotes: typeof data.notes === 'string',
      hasRange: typeof data.range === 'object'
    });
  } catch (error) {
    logTest('functional', 'Release Notes Schema', false, {
      error: error.message,
      status: error.response?.status
    });
  }
}

// 3. Performance Tests: Concurrent Load + Latency
async function testPerformance() {
  console.log('\n⚡ Testing Performance: Concurrent Load (5-10 requests)\n');

  const concurrentRequests = 8; // Middle of 5-10 range
  const latencies = [];
  const errors = [];

  console.log(`🚀 Launching ${concurrentRequests} concurrent requests...`);

  const requests = Array.from({ length: concurrentRequests }, (_, i) => {
    return measureTime(async () => {
      try {
        const response = await axios.post(`${FRONTEND_URL}/api/ai/intelligent-chat`, {
          message: `Performance test ${i + 1}`,
          personalId: `perf-test-${i}`,
          context: { projectInfo: { source: `perf_test_${i}` } }
        }, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `Smoke-Test-Concurrent-${i}/1.0`
          }
        });

        return {
          success: true,
          status: response.status,
          requestId: i + 1
        };
      } catch (error) {
        errors.push({
          requestId: i + 1,
          error: error.message,
          status: error.response?.status
        });
        return {
          success: false,
          status: error.response?.status || 'timeout',
          requestId: i + 1
        };
      }
    });
  });

  try {
    const results = await Promise.all(requests);
    
    // Collect latencies and calculate metrics
    results.forEach(({ result, duration }) => {
      latencies.push(duration);
    });

    latencies.sort((a, b) => a - b);
    
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const avg = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const max = Math.max(...latencies);
    const min = Math.min(...latencies);

    const errorRate = (errors.length / concurrentRequests) * 100;
    const p95Target = 900; // ms for DEV
    const errorRateTarget = 2; // %

    const p95Passed = p95 <= p95Target;
    const errorRatePassed = errorRate < errorRateTarget;

    // Store metrics for summary
    testResults.performance.metrics = {
      concurrentRequests,
      latencies: { p50, p95, p99, avg, max, min },
      errorRate,
      errors: errors.length,
      targets: { p95: p95Target, errorRate: errorRateTarget }
    };

    logTest('performance', 'P95 Latency Target (≤900ms)', p95Passed, {
      p95: `${p95.toFixed(2)}ms`,
      target: `${p95Target}ms`,
      passed: p95Passed
    });

    logTest('performance', 'Error Rate Target (<2%)', errorRatePassed, {
      errorRate: `${errorRate.toFixed(2)}%`,
      target: '<2%',
      errors: errors.length,
      total: concurrentRequests
    });

    logTest('performance', 'Concurrent Load Test', p95Passed && errorRatePassed, {
      concurrentRequests,
      avg: `${avg.toFixed(2)}ms`,
      p50: `${p50.toFixed(2)}ms`,
      p95: `${p95.toFixed(2)}ms`,
      p99: `${p99.toFixed(2)}ms`,
      errorRate: `${errorRate.toFixed(2)}%`,
      overallPassed: p95Passed && errorRatePassed
    });

  } catch (error) {
    logTest('performance', 'Concurrent Load Test', false, {
      error: error.message,
      concurrentRequests
    });
  }
}

// Test Summary and Results
function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 SMOKE TEST RESULTS SUMMARY (SOL-362 Post-Cutover)');
  console.log('='.repeat(80));

  const categories = ['healthChain', 'functional', 'performance'];
  let totalPassed = 0;
  let totalFailed = 0;

  categories.forEach(category => {
    const { passed, failed } = testResults[category];
    totalPassed += passed;
    totalFailed += failed;
    
    const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const status = failed === 0 ? '✅' : '❌';
    
    console.log(`\n${status} ${categoryName}: ${passed}/${passed + failed} tests passed`);
    
    if (category === 'performance' && testResults.performance.metrics) {
      const metrics = testResults.performance.metrics;
      console.log(`   📊 Performance Metrics:`);
      console.log(`   • P95 Latency: ${metrics.latencies.p95.toFixed(2)}ms (target: ≤${metrics.targets.p95}ms)`);
      console.log(`   • Error Rate: ${metrics.errorRate.toFixed(2)}% (target: <${metrics.targets.errorRate}%)`);
      console.log(`   • Concurrent Requests: ${metrics.concurrentRequests}`);
    }
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`🏁 OVERALL RESULT: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
  
  const overallStatus = totalFailed === 0 ? 'PASSED ✅' : 'FAILED ❌';
  console.log(`📋 Status: ${overallStatus}`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed Tests:');
    categories.forEach(category => {
      testResults[category].tests.forEach(test => {
        if (!test.passed) {
          console.log(`   • [${category.toUpperCase()}] ${test.name}: ${test.details.error || 'Failed'}`);
        }
      });
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✨ SOL-362 Microservice Architecture: ${overallStatus}`);
  console.log('='.repeat(80));
}

// Main test execution
async function runSmokeTests() {
  console.log('🚀 Starting SOL-362 Post-Cutover Smoke Tests');
  console.log('📋 Testing: Health Chain → Functional Flow → Performance');
  console.log('-'.repeat(80));

  try {
    await testHealthChain();
    await testFunctional();
    await testPerformance();
  } catch (error) {
    console.error('💥 Critical test failure:', error);
  }

  printSummary();

  // Exit with appropriate code
  const totalFailed = testResults.healthChain.failed + 
                     testResults.functional.failed + 
                     testResults.performance.failed;
  
  process.exit(totalFailed === 0 ? 0 : 1);
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n⏹️ Test interrupted by user');
  printSummary();
  process.exit(1);
});

// Run tests
runSmokeTests().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});

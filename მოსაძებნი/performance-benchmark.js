
const axios = require('axios');
const { performance } = require('perf_hooks');

const FRONTEND_URL = 'http://0.0.0.0:5000';
const CONCURRENT_REQUESTS = [5, 8, 10]; // Test different loads
const TARGET_P95 = 900; // ms
const TARGET_ERROR_RATE = 2; // %

async function runPerformanceTest(concurrentCount) {
  console.log(`\n⚡ Testing with ${concurrentCount} concurrent requests`);
  console.log('-'.repeat(50));
  
  const latencies = [];
  const errors = [];
  const startTime = performance.now();
  
  const requests = Array.from({ length: concurrentCount }, (_, i) => {
    return (async () => {
      const requestStart = performance.now();
      try {
        const response = await axios.post(`${FRONTEND_URL}/api/ai/intelligent-chat`, {
          message: `Perf test ${i + 1} - concurrent ${concurrentCount}`,
          personalId: `perf-${concurrentCount}-${i}`,
          context: { projectInfo: { source: `perf_test_${concurrentCount}_${i}` } }
        }, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `PerfTest-${concurrentCount}-${i}/1.0`
          }
        });
        
        const duration = performance.now() - requestStart;
        latencies.push(duration);
        
        return {
          success: true,
          status: response.status,
          duration,
          requestId: i + 1
        };
      } catch (error) {
        const duration = performance.now() - requestStart;
        errors.push({
          requestId: i + 1,
          error: error.message,
          status: error.response?.status,
          duration
        });
        
        return {
          success: false,
          status: error.response?.status || 'timeout',
          duration,
          requestId: i + 1
        };
      }
    })();
  });
  
  const results = await Promise.all(requests);
  const totalTime = performance.now() - startTime;
  
  // Calculate metrics
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = latencies.length > 0 ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length : 0;
  const max = latencies.length > 0 ? Math.max(...latencies) : 0;
  const min = latencies.length > 0 ? Math.min(...latencies) : 0;
  
  const errorRate = (errors.length / concurrentCount) * 100;
  const throughput = (concurrentCount / totalTime) * 1000; // requests per second
  
  // Check targets
  const p95Pass = p95 <= TARGET_P95;
  const errorPass = errorRate < TARGET_ERROR_RATE;
  
  console.log(`📊 Results for ${concurrentCount} concurrent requests:`);
  console.log(`   • Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`   • Throughput: ${throughput.toFixed(2)} req/s`);
  console.log(`   • Success Rate: ${((concurrentCount - errors.length) / concurrentCount * 100).toFixed(2)}%`);
  console.log(`   • Error Rate: ${errorRate.toFixed(2)}% ${errorPass ? '✅' : '❌'} (target: <${TARGET_ERROR_RATE}%)`);
  console.log(`   • Latencies:`);
  console.log(`     - P50: ${p50.toFixed(2)}ms`);
  console.log(`     - P95: ${p95.toFixed(2)}ms ${p95Pass ? '✅' : '❌'} (target: ≤${TARGET_P95}ms)`);
  console.log(`     - P99: ${p99.toFixed(2)}ms`);
  console.log(`     - Avg: ${avg.toFixed(2)}ms`);
  console.log(`     - Min: ${min.toFixed(2)}ms`);
  console.log(`     - Max: ${max.toFixed(2)}ms`);
  
  if (errors.length > 0) {
    console.log(`   • Errors (${errors.length}):`);
    errors.forEach(error => {
      console.log(`     - Request ${error.requestId}: ${error.error} (${error.status})`);
    });
  }
  
  return {
    concurrentCount,
    metrics: { p50, p95, p99, avg, max, min, errorRate, throughput },
    targets: { p95Pass, errorPass },
    passed: p95Pass && errorPass,
    totalTime,
    errors: errors.length
  };
}

async function main() {
  console.log('🚀 SOL-362 Performance Benchmark');
  console.log('='.repeat(60));
  console.log(`Target: P95 ≤ ${TARGET_P95}ms, Error Rate < ${TARGET_ERROR_RATE}%`);
  
  const results = [];
  
  for (const count of CONCURRENT_REQUESTS) {
    try {
      const result = await runPerformanceTest(count);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Test failed for ${count} concurrent requests:`, error.message);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 PERFORMANCE SUMMARY');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.concurrentCount} concurrent: P95=${result.metrics.p95.toFixed(2)}ms, Errors=${result.metrics.errorRate.toFixed(2)}%`);
  });
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n🏁 Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('💥 Benchmark failed:', error);
  process.exit(1);
});

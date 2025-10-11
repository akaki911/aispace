
const http = require('http');

class DeploymentHealthChecker {
  constructor() {
    this.checks = [
      { name: 'AI Service', url: '/api/ai/health', port: 5001 },
      { name: 'Backend Service', url: '/api/health', port: 5002 },
      { name: 'Frontend', url: '/', port: 3000 }
    ];
  }

  async checkEndpoint(name, url, port) {
    return new Promise((resolve) => {
      const options = {
        hostname: '0.0.0.0',
        port: port,
        path: url,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        const success = res.statusCode >= 200 && res.statusCode < 400;
        console.log(`${success ? '✅' : '❌'} ${name}: ${res.statusCode}`);
        resolve({ name, success, status: res.statusCode });
      });

      req.on('error', (err) => {
        console.log(`❌ ${name}: ${err.message}`);
        resolve({ name, success: false, error: err.message });
      });

      req.on('timeout', () => {
        console.log(`❌ ${name}: Timeout`);
        req.destroy();
        resolve({ name, success: false, error: 'Timeout' });
      });

      req.end();
    });
  }

  async performHealthCheck() {
    console.log('🔍 Starting deployment health check...');
    
    const results = await Promise.all(
      this.checks.map(check => 
        this.checkEndpoint(check.name, check.url, check.port)
      )
    );

    const allPassed = results.every(result => result.success);
    
    console.log('\n📊 Health Check Summary:');
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${result.name}: ${status}`);
    });

    if (allPassed) {
      console.log('\n🎉 All health checks passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some health checks failed!');
      process.exit(1);
    }
  }

  async waitForServices(maxWait = 60000) {
    console.log('⏳ Waiting for services to start...');
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const results = await Promise.all(
        this.checks.map(check => 
          this.checkEndpoint(check.name, check.url, check.port)
        )
      );
      
      const allReady = results.every(result => result.success);
      
      if (allReady) {
        console.log('✅ All services are ready!');
        return true;
      }
      
      console.log('⏳ Waiting for services... Retrying in 5 seconds');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('❌ Services did not start within timeout');
    return false;
  }
}

// CLI usage
if (require.main === module) {
  const checker = new DeploymentHealthChecker();
  
  const command = process.argv[2];
  
  if (command === 'wait') {
    checker.waitForServices().then(ready => {
      process.exit(ready ? 0 : 1);
    });
  } else {
    checker.performHealthCheck();
  }
}

module.exports = DeploymentHealthChecker;

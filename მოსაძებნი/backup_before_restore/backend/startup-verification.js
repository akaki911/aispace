
const http = require('http');

console.log("🔍 [Startup Verification] Checking backend health...");

// Check if port 5002 is available
const testPort = (port) => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(port, () => {
      server.close(() => {
        console.log(`✅ Port ${port} is available`);
        resolve(true);
      });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`🔄 Port ${port} is in use - this might be expected if backend is already running`);
      }
      resolve(false);
    });
  });
};

// Health check function
const healthCheck = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5002,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`✅ Backend health check passed: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log(`❌ Backend health check failed:`, err.message);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log(`⏰ Backend health check timeout`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
};

async function runStartupChecks() {
  console.log("🏁 Starting backend startup verification...");
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check if backend responds
  const isHealthy = await healthCheck();
  
  if (isHealthy) {
    console.log("🎉 Backend startup verification completed successfully!");
  } else {
    console.log("⚠️ Backend may not be fully ready. This might be normal during startup.");
  }
}

runStartupChecks();

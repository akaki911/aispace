
const http = require('http');

const services = [
  { name: 'Frontend (Vite)', port: 3000, path: '/' },
  { name: 'AI Service', port: 5001, path: '/health' },
  { name: 'Backend', port: 5002, path: '/health' }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${service.port}${service.path}`, (res) => {
      resolve({ ...service, status: res.statusCode, healthy: res.statusCode === 200 });
    });
    
    req.on('error', () => {
      resolve({ ...service, status: 'ERROR', healthy: false });
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ ...service, status: 'TIMEOUT', healthy: false });
    });
  });
}

async function checkAllServices() {
  console.log('🔍 SOL-017 Service Health Check\n');
  
  const results = await Promise.all(services.map(checkService));
  
  let allHealthy = true;
  results.forEach(result => {
    const icon = result.healthy ? '✅' : '❌';
    console.log(`${icon} ${result.name} (Port ${result.port}): ${result.status}`);
    if (!result.healthy) allHealthy = false;
  });
  
  console.log('\n' + (allHealthy ? '🎉 All services are healthy!' : '⚠️  Some services need attention'));
  
  if (!allHealthy) {
    console.log('\n🔧 Troubleshooting:');
    console.log('• Use portkiller to clear stuck ports');
    console.log('• Check console logs for startup errors');
    console.log('• Verify .env configuration');
  }
  
  return allHealthy;
}

if (require.main === module) {
  checkAllServices().then(healthy => process.exit(healthy ? 0 : 1));
}

module.exports = { checkAllServices };

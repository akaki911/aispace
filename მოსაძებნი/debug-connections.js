import http from 'http';

// Test internal service connections
const testConnections = async () => {
  console.log('🔍 Testing internal service connections...');

  const services = [
    { name: 'AI Service', url: 'http://127.0.0.1:5001/api/ai/health' },
    { name: 'Backend Service', url: 'http://127.0.0.1:5002/api/health' },
    { name: 'Frontend Dev Server', url: 'http://127.0.0.1:3000' }
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url);
      console.log(`✅ ${service.name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${service.name}: ${error.message}`);
    }
  }
};

testConnections();
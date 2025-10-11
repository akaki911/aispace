
#!/usr/bin/env node
require('dotenv').config();

const net = require('net');
const PORT = process.env.PORT || 5002;
const HOST = process.env.BACKEND_HOST || '0.0.0.0';

console.log('🔍 Backend Startup Validation');
console.log(`Testing port ${PORT} on ${HOST}...`);

// Check if port is available
const server = net.createServer();

server.listen(PORT, HOST, () => {
  console.log(`✅ Port ${PORT} is available`);
  server.close();
  
  // Start main backend
  console.log('🚀 Starting main backend server...');
  require('./index.js');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use`);
    
    // Try to find available port
    const altPort = parseInt(PORT) + Math.floor(Math.random() * 100) + 1;
    console.log(`🔄 Trying alternative port ${altPort}...`);
    
    process.env.PORT = altPort;
    require('./index.js');
  } else {
    console.error('❌ Startup validation failed:', err.message);
    process.exit(1);
  }
});

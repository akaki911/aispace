const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '127.0.0.1';

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://workspace-akakicincadze.replit.app',
    /https:\/\/.*\.replit\.dev$/,
    /https:\/\/.*\.repl\.co$/
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK with enhanced error handling
let admin;
let isFirebaseAvailable = false;

try {
  admin = require('firebase-admin');

  if (admin.apps.length === 0) {
    // Check multiple possible environment variable names
    let serviceAccountKey = process.env.FIREBASE_ADMIN_KEY || 
                           process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey || serviceAccountKey === 'undefined') {
      console.warn('⚠️ Firebase service account key not found - AI Service will run without Firebase');
      isFirebaseAvailable = false;
    } else {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        
        // Fix escaped newlines in private_key
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages'
        });

        isFirebaseAvailable = true;
        console.log('✅ Firebase Admin initialized with service account credentials');
      } catch (parseError) {
        console.error('❌ Firebase service account JSON parse error:', parseError.message);
        console.warn('⚠️ AI Service continuing without Firebase');
        isFirebaseAvailable = false;
      }
    }
  } else {
    isFirebaseAvailable = true;
    console.log('✅ Using existing Firebase Admin app');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.warn('⚠️ AI Service continuing without Firebase');
  isFirebaseAvailable = false;
}

// Export Firebase availability status for other modules
global.isFirebaseAvailable = isFirebaseAvailable;

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ai-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// JavaScript modules only
console.log('✅ Using JavaScript modules directly');

// Enhanced Auto-improve routes with detailed error handling
let autoImproveDiscoveryRoutes = null;
let autoImproveExecRoutes = null;

try {
  autoImproveDiscoveryRoutes = require('./routes/autoImprove');
  console.log('✅ Auto-improve discovery routes loaded successfully');
} catch (error) {
  console.warn('⚠️ Auto-improve discovery routes not available:', error.message);
  console.warn('Details:', error);
}

try {
  autoImproveExecRoutes = require('./routes/autoImproveExec');
  console.log('✅ Auto-improve exec routes loaded successfully');
} catch (error) {
  console.warn('⚠️ Auto-improve exec routes not available:', error.message);
  console.warn('Details:', error);
}

// Mount auto-improve routes with TypeScript support
if (autoImproveDiscoveryRoutes) {
  app.use('/api/ai/autoimprove', autoImproveDiscoveryRoutes.default || autoImproveDiscoveryRoutes);
}

// Mount auto-improve exec routes with TypeScript support
if (autoImproveExecRoutes) {
  app.use('/api/ai/autoimprove', autoImproveExecRoutes.default || autoImproveExecRoutes);
}

// Mount existing routes
try {
  const chatRouter = require('./routes/ai_chat');
  app.use('/api/ai/chat', chatRouter);
  console.log('✅ AI chat routes mounted');
} catch (error) {
  console.warn('⚠️ AI chat routes not available:', error.message);
}

try {
  const fsRouter = require('./routes/fs_api');
  app.use('/api/fs', fsRouter);
  console.log('✅ File system routes mounted');
} catch (error) {
  console.warn('⚠️ File system routes not available:', error.message);
}

// Canary routes for auto-improve paths that should be handled by Backend
app.all('/api/ai/autoimprove/proposals*', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented in AI Service',
    message: 'This endpoint is handled by Backend service',
    redirect: 'Try the Backend service at port 5002',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

app.all('/api/ai/auto-improve/proposals*', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented in AI Service', 
    message: 'This endpoint is handled by Backend service',
    redirect: 'Try the Backend service at port 5002',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Debug route for auto-improve - placed after route mounting
app.get('/api/ai/autoimprove/_debug/ping', (req, res) => {
  res.json({
    ok: true,
    service: 'ai-service',
    route: '/api/ai/autoimprove',
    timestamp: Date.now(),
    message: 'Auto-improve routes are working',
    mountedRoutes: app._router ? app._router.stack.length : 'unknown',
    availableEndpoints: [
      'POST /api/ai/autoimprove/discover',
      'POST /api/ai/autoimprove/:id/dry-run', 
      'POST /api/ai/autoimprove/:id/apply',
      'POST /api/ai/autoimprove/:id/rollback',
      'GET /api/ai/autoimprove/_debug/ping',
      '⚠️ /proposals/* routes → Backend service'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'POST /api/ai/chat',
      'GET /api/fs/search',
      'GET /api/fs/file/*',
      'POST /api/ai/autoimprove/discover',
      'POST /api/ai/autoimprove/:id/dry-run',
      'POST /api/ai/autoimprove/:id/apply',
      'POST /api/ai/autoimprove/:id/rollback',
      'GET /api/ai/autoimprove/_debug/ping'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ AI Service error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Enhanced server startup with port conflict handling
const server = app.listen(PORT, HOST, () => {
  console.log(`🤖 AI Service running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log('🔧 Try running: bash scripts/port-cleanup.sh');
    process.exit(1);
  } else {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 AI Service shutting down gracefully...');
  server.close(() => {
    console.log('✅ AI Service stopped');
    process.exit(0);
  });
});

module.exports = app;
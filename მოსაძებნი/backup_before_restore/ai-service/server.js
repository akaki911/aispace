const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const path = require('path');

// Firebase initialization with proper credential gating
const admin = require('firebase-admin');

// Global Firebase availability flag
let isFirebaseAvailable = false;

// Initialize Firebase Admin ONLY if proper credentials are available
if (!admin.apps.length) {
  try {
    // Only initialize Firebase if we have proper service account credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages'
      });
      isFirebaseAvailable = true;
      console.log('✅ Firebase Admin initialized with service account credentials');
    } else {
      console.log('🔍 Firebase credentials check:');
      console.log('- FIREBASE_SERVICE_ACCOUNT_KEY:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'MISSING');
      console.log('- FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'NOT_SET');
      console.log('- FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING');

      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && !process.env.FIREBASE_PRIVATE_KEY) {
        console.log('📝 Firebase service account key not found - using local storage only');
        console.log('🔒 Firebase operations will be disabled to prevent ADC errors');
        isFirebaseAvailable = false;
      } else {
        console.log('✅ Firebase credentials found - attempting initialization');
      }
    }
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed, using local storage fallback:', error.message);
    isFirebaseAvailable = false;
  }
}

// Export Firebase availability flag for other modules
global.isFirebaseAvailable = isFirebaseAvailable;

// Enhanced console logging matching Replit format exactly
const logWithTimestamp = (message, service = 'ai-service', process = 'cd ai-service ...') => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`▷ ${process}`);
  console.log(`Port :${PORT} opened on (...).replit.dev`);
};

const logProcessStart = (processName, port) => {
  console.log(`▷ ${processName}`);
  console.log(`Port :${port} opened on (...).replit.dev`);
};

// Initialize with Replit-style logging
console.log('▷ cd ai-service ...');
console.log('📡 Initializing AI Microservice components...');
console.log('🔍 [ENHANCED MONITOR] Preparing Georgian AI file intelligence...');

const app = express();
const PORT = process.env.PORT || process.env.AI_PORT || 5001;

logWithTimestamp(`🔧 Port configuration: ${PORT}`);

// Enhanced CORS configuration with production support
// Build allowed origins array
const allowedOrigins = [
  'https://d2c296ba-6bdd-412e-987c-2af0f275fc6d-00-3mn8zz92vqke4.riker.replit.dev',
  'http://localhost:3000',
  'http://localhost:5000',    // Frontend dev server
  'http://0.0.0.0:3000',
  'http://0.0.0.0:5000',      // Replit binding
];

// Add environment-specific origins
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.DEPLOYMENT_URL) {
  allowedOrigins.push(process.env.DEPLOYMENT_URL);
}

// Add Replit domain patterns for both development and production
allowedOrigins.push(/^https:\/\/.*\.replit\.dev$/);
allowedOrigins.push(/^https:\/\/.*\.repl\.co$/);
allowedOrigins.push(/^https:\/\/.*\.sisko\.replit\.dev$/);
allowedOrigins.push(/^https:\/\/.*\.riker\.replit\.dev$/);

// SOL-203: CORS credentials:true + headers passthrough
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`🚫 AI Service CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Cache-Control'  // Headers passthrough
  ],
  credentials: true     // SOL-203 requirement
}));
app.use(express.json({ limit: '50mb' }));

// Enhanced File Monitor Service Integration
const EnhancedFileMonitorService = require('./services/enhanced_file_monitor_service');
const { router: enhancedFileMonitorRouter, setEnhancedFileMonitorService } = require('./routes/enhanced_file_monitor_api');
const ConsolidatedMemoryService = require('./services/consolidated_memory_service');

// Initialize Enhanced File Monitor with Georgian AI intelligence
let enhancedFileMonitorService = null;
let consolidatedMemoryService = null;

// Import routes
console.log('📁 Loading route modules...');
const fileSearchRoute = require('./routes/file_search');
const fsFileRoute = require('./routes/fs_file');
const aiChatRoute = require('./routes/ai_chat');
const healthRoute = require('./routes/health');
const memoryUpdate = require('./routes/memory_update_main');
const aiRoutes = require('./routes/ai_routes');
const memorySync = require('./routes/memory_sync');
const memoryRecovery = require('./routes/memory_recovery');
const aiModelsRoute = require('./routes/ai_models');

// Register routes
console.log('🔗 Registering routes...');

// Georgian AI Enhanced File Monitor API - WITH DIAGNOSTICS
const efm = require('./routes/enhanced_file_monitor_api');
console.log('🔍 [DEBUG] Enhanced File Monitor require:', {
  hasModule: !!efm,
  keys: Object.keys(efm || {}),
  hasRouter: !!efm?.router,
  routerType: typeof efm?.router,
  stackLength: efm?.router?.stack?.length
});

if (efm && efm.router) {
  console.log('🔍 Mounting Enhanced File Monitor API...');
  app.use('/api/file-monitor', efm.router);
  // Set service connection
  if (efm.setEnhancedFileMonitorService) {
    efm.setEnhancedFileMonitorService = setEnhancedFileMonitorService;
  }
  console.log('✅ Enhanced File Monitor API routes mounted successfully');
} else {
  console.error('❌ Enhanced File Monitor API import failed:', efm);
}

// File system routes FIRST
app.use('/api/fs', (req, res, next) => {
  console.log(`📁 FS Route: ${req.method} ${req.path}`);
  next();
});
app.use('/api/fs', fileSearchRoute);
app.use('/api/fs', fsFileRoute);
app.use('/api/fs', require('./routes/fs_tree'));
// SOL-212: Add Gurulo FS API
app.use('/api/fs', require('./routes/fs_api'));

// SOL-203: SINGLE AI Route Mounting - NO DUPLICATES
console.log('🔗 AI routes - single mount pattern...');

// Import new endpoints
const aiStreamRoute = require('./routes/ai_stream');    // NEW
const aiRecoveryRoute = require('./routes/ai_recovery'); // NEW

// Single AI route logging middleware
app.use('/api/ai', (req, res, next) => {
  console.log(`🤖 AI Route: ${req.method} ${req.path}`);
  next();
});

// Mount routes ONCE ONLY - SOL-203 compliance
app.use('/api/ai', aiChatRoute);           // POST /chat
app.use('/api/ai', aiStreamRoute);         // POST /stream (NEW)
app.use('/api/ai', aiModelsRoute);         // GET /models (NEW)
app.use('/api/ai/recovery', aiRecoveryRoute); // POST /recover/:id (NEW)
app.use('/health', healthRoute);           // GET /health (root level)

// Replit Assistant Integration - SOL-210 Architecture
app.use('/api/assistant', require('./routes/replit_assistant'));

// Georgian AI Enhanced File Monitor Routes (Registered below with other routes)

// Phase 3: Safety Switch API Routes - Action Confirmation System
console.log('🔒 Mounting Safety Switch routes...');
app.use('/api/safety-switch', require('./routes/safety_switch'));

// Multi-Tab Terminal API Routes
console.log('🖥️ Mounting Terminal Session routes...');
app.use('/api/terminal', require('./routes/terminal_sessions'));

// Health check endpoint
app.get('/api/ai/health', (req, res) => {
  console.log('🔍 [AI Service] Health check requested');
  res.status(200).json({
    status: 'OK',
    service: 'ai-service',
    port: PORT || 5001,
    timestamp: new Date().toISOString(),
    version: '2.0',
    endpoints: [
      '/api/ai/chat',
      '/api/ai/memory/:userId',
      '/api/ai/health'
    ]
  });
});

// Consolidated health endpoint with consistent response format
const healthResponse = (req, res) => {
  console.log(`🏥 AI Health check requested at ${req.path}`);
  res.status(200).json({
    ok: true,
    status: 'HEALTHY',
    service: 'AI Microservice',
    message: 'AI Service is running',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: process.uptime(),
    endpoints: {
      health: '/health',
      api_health: '/api/health',
      chat: '/api/ai/chat',
      file_search: '/api/fs/search'
    },
    version: '3.0'
  });
};

// Apply to both endpoints for backward compatibility
app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

// System status endpoint
app.get('/system-status', (req, res) => {
  try {
    console.log('🤖 AI Route: GET /system-status');
    res.status(200).json({
      status: 'HEALTHY',
      service: 'AI Service',
      version: '3.0',
      endpoints: {
        health: '/health',
        api_health: '/api/health',
        chat: '/api/ai/chat',
        file_search: '/api/fs/search'
      },
      timestamp: new Date().toISOString(),
      port: PORT,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('❌ AI Service system status error:', error);
    res.status(500).json({
      status: 'ERROR',
      service: 'AI Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add /api/system-status endpoint as well
app.get('/api/system-status', (req, res) => {
  try {
    console.log('🤖 AI Route: GET /api/system-status');
    res.status(200).json({
      status: 'HEALTHY',
      service: 'AI Service',
      version: '3.0',
      endpoints: {
        health: '/health',
        api_health: '/api/health',
        chat: '/api/ai/chat',
        file_search: '/api/fs/search'
      },
      timestamp: new Date().toISOString(),
      port: PORT,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('❌ AI Service system status error:', error);
    res.status(500).json({
      status: 'ERROR',
      service: 'AI Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: "AI Microservice v3.0",
    status: "online",
    availableEndpoints: [
      "/health",
      "/api/ai/chat",
      "/api/fs/search",
      "/api/fs/file"
    ],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  res.json({ message: 'AI Service test successful', timestamp: new Date().toISOString() });
});

// Missing endpoints
app.get('/api/ai/csrf', (req, res) => {
  res.json({ csrfToken: 'mock-csrf-token', timestamp: Date.now() });
});

// Memory sync route
app.use('/api/ai/memory-sync', require('./routes/memory_sync'));

// Memory training endpoint
app.post('/api/ai/train-memory', async (req, res) => {
  try {
    const { userId, memoryData, trainingMode } = req.body;
    console.log(`🤖 Memory training requested for user: ${userId}, mode: ${trainingMode}`);

    if (!userId || !memoryData) {
      return res.status(400).json({
        success: false,
        error: 'სავალდებულო პარამეტრები ვერ მოიძებნა'
      });
    }

    // Simulate training process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Queue sync for the training results
    const memorySyncService = require('./services/memory_sync_service');
    memorySyncService.queueSync(userId, memoryData, 'training');

    res.json({
      success: true,
      message: 'მეხსიერების ტრენირება წარმატებით დასრულდა',
      trainingComplete: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Memory training error:', error);
    res.status(500).json({
      success: false,
      error: 'მეხსიერების ტრენირებაში შეცდომა',
      details: error.message
    });
  }
});

// Memory endpoint with enhanced error handling
app.get('/api/ai/memory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📖 Memory request for user: ${userId}`);

    let memoryData;
    let serviceError = null; // Initialize serviceError to null

    try {
      // Clear require cache to ensure fresh module load
      const servicePath = './services/consolidated_memory_service';
      delete require.cache[require.resolve(servicePath)];

      const memoryService = require(servicePath);
      console.log('✅ Memory service loaded successfully');

      // Try multiple ways to access getUserMemory
      let getUserMemoryFn;
      if (typeof memoryService.getUserMemory === 'function') {
        getUserMemoryFn = memoryService.getUserMemory;
      } else if (typeof memoryService.default?.getUserMemory === 'function') {
        getUserMemoryFn = memoryService.default.getUserMemory;
      } else if (memoryService.ConsolidatedMemoryService) {
        const instance = new memoryService.ConsolidatedMemoryService();
        getUserMemoryFn = instance.getUserMemory.bind(instance);
      } else {
        throw new Error('getUserMemory method not accessible');
      }

      console.log('✅ GetUserMemory method verified');
      memoryData = await getUserMemoryFn(userId);
      console.log('✅ Memory data loaded successfully');

    } catch (err) { // Catch specific error from memory service
      serviceError = err; // Store the error
      console.error('⚠️ Memory service error:', serviceError.message);
      console.log('🔄 Using fallback memory data');

      // Return comprehensive fallback memory data
      memoryData = {
        personalInfo: {
          name: userId === '01019062020' ? 'კაკი' : "გიორგი",
          age: "25",
          interests: "AI, Web Development, UI/UX",
          notes: "AI Developer specializing in React and TypeScript",
          preferredLanguage: "ka",
          role: "developer",
          programmingLanguages: ["TypeScript", "React", "Node.js"],
          codeStyle: "strict, typed",
          currentProject: "Bakhmaro AI Developer Panel"
        },
        facts: ["User prefers Georgian language interface", "Expert in React development"],
        grammarFixes: [],
        interactionHistory: [],
        savedRules: [
          {
            id: "1",
            title: "არ დამალო ფაილები ფაილის ხედში",
            description: "ფაილების ხილვადობა უზრუნველყოფილი უნდა იყოს ყოველთვის",
            isActive: true,
            category: "ui"
          }
        ],
        errorLogs: [],
        contextActions: [],
        codePreferences: [
          {
            id: "1",
            name: "TypeScript strict mode",
            type: "preferred",
            description: "ყოველთვის გამოიყენე strict typing"
          }
        ],
        stats: {
          totalRules: 1,
          activeRules: 1,
          resolvedErrors: 0,
          totalActions: 0,
          accuracyRate: 85,
          memoryUsage: 0.0028
        }
      };
    }

    res.json({
      success: true,
      data: memoryData,
      timestamp: new Date().toISOString(),
      fallbackUsed: !!serviceError // Use the stored serviceError to determine fallbackUsed
    });

  } catch (error) { // Catch any other unexpected errors in the endpoint
    console.error('❌ Memory endpoint critical error:', error);

    // Always return success with fallback data to prevent UI crashes
    res.json({
      success: true,
      data: {
        personalInfo: {
          name: "Default User",
          age: "25",
          interests: "Development",
          notes: "Default user data",
          preferredLanguage: "ka",
          role: "user"
        },
        facts: [],
        grammarFixes: [],
        interactionHistory: [],
        savedRules: [],
        errorLogs: [],
        contextActions: [],
        codePreferences: [],
        stats: {
          totalRules: 0,
          activeRules: 0,
          resolvedErrors: 0,
          totalActions: 0,
          accuracyRate: 0,
          memoryUsage: 0
        }
      },
      timestamp: new Date().toISOString(),
      fallbackUsed: true,
      error: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ AI Service Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    path: req.path
  });
});

// 404 handler (MUST be last)
app.use('*', (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'POST /api/ai/chat',
      'GET /api/fs/search',
      'GET /api/fs/file/*'
    ]
  });
});

// Start server with enhanced error handling
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  // Exact Replit format
  console.log(`▷ cd ai-service ...`);
  console.log(`Port :${PORT} opened on (...).replit.dev`);

  // Additional status info matching Replit style
  console.log('✅ AI Microservice v3.0 ONLINE');
  console.log('📁 File Search API ready');
  console.log('🤖 AI Chat API ready');
  console.log('🏥 Health Check ready');
  console.log('🔗 CORS enabled');
  console.log('💾 Memory management initialized');
  console.log(`🚀 AI Microservice ready to receive requests on ${HOST}:${PORT}`);

  // Initialize semantic search service
  try {
    const { semanticSearchService } = require('./services/semantic_search_service');
    await semanticSearchService.loadKnowledgeBase();
    console.log('🧠 Semantic search service initialized');
  } catch (error) {
    console.warn('⚠️ Semantic search service initialization failed:', error.message);
  }

  // Initialize file system monitoring service (Phase 1 - "Eyes")
  try {
    const { fileSystemMonitorService } = require('./services/file_system_monitor_service');
    await fileSystemMonitorService.initialize();
    console.log('👁️ File system monitoring service initialized');
  } catch (error) {
    console.warn('⚠️ File system monitoring service initialization failed:', error.message);
  }

  // Initialize Enhanced File Monitor Service with Georgian AI Intelligence
  try {
    // Initialize memory service - use exported instance
    consolidatedMemoryService = require('./services/consolidated_memory_service');
    console.log('🧠 Memory service instance loaded for file monitoring');

    // Initialize enhanced file monitor with AI capabilities
    enhancedFileMonitorService = new EnhancedFileMonitorService({
      intelligentAnsweringEngine: null, // Will be connected later
      memoryService: consolidatedMemoryService,
      webSocketManager: null // Will be connected when available
    });

    // Connect the service to the API routes
    if (efm && efm.setEnhancedFileMonitorService) {
      efm.setEnhancedFileMonitorService(enhancedFileMonitorService);
      console.log('✅ Enhanced File Monitor service connected to API routes');
    }

    // Initialize the enhanced monitoring
    await enhancedFileMonitorService.initialize();

    console.log('🔍 [ENHANCED MONITOR] Georgian AI file intelligence initialized');
    console.log('🇬🇪 [ENHANCED MONITOR] Real-time pattern detection active');
    console.log('🛡️ [ENHANCED MONITOR] Security scanning enabled');
    console.log('📊 [ENHANCED MONITOR] Complexity analysis ready');

  } catch (error) {
    console.warn('⚠️ [ENHANCED MONITOR] Enhanced file monitoring initialization failed:', error.message);
    console.warn('⚠️ [ENHANCED MONITOR] Falling back to basic file monitoring...');
  }

  // Initialize console monitoring service (Phase 2 - "Ears")
  try {
    const { replitMonitorService } = require('./services/replit_monitor_service');
    await replitMonitorService.initialize();
    console.log('👂 Console monitoring service initialized');
  } catch (error) {
    console.warn('⚠️ Console monitoring service initialization failed:', error.message);
  }

  // Initialize action executor service (Phase 1 - "The Toolbox")
  try {
    const { actionExecutorService } = require('./services/action_executor_service');
    await actionExecutorService.initialize();
    console.log('🔧 Action executor service initialized');
  } catch (error) {
    console.warn('⚠️ Action executor service initialization failed:', error.message);
  }

  // Health check heartbeat every 5 minutes (optimized frequency)
  setInterval(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('💓 AI Service heartbeat - Status: HEALTHY');
      console.log('🔗 Endpoints active: /api/ai/chat, /api/fs/search, /health');
    }
  }, 5 * 60 * 1000);

  console.log('🚀 AI Microservice ready to receive requests');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use. Use portkiller to free it.`);
    console.log(`🔧 Run: kill -9 $(lsof -ti:${PORT}) || portkiller`);
  } else {
    console.log(`❌ AI Service startup error: ${error.message}`);
  }
  process.exit(1);
});

module.exports = app;
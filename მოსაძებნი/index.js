const path = require('path');
const { bootstrapEnv } = require('./scripts/bootstrapEnv');
const { ensureLocalSecrets } = require('./scripts/ensureLocalSecrets');

bootstrapEnv();
ensureLocalSecrets({ cwd: path.resolve(__dirname) });

// Apply sane defaults for optional environment variables to reduce noisy warnings in development setups.
const envFallbackUsage = {};
const applyFallback = (key, fallback) => {
  if (process.env[key] && String(process.env[key]).trim() !== '') {
    return false;
  }
  if (fallback !== undefined) {
    process.env[key] = fallback;
    envFallbackUsage[key] = true;
  }
  return true;
};

applyFallback('FRONTEND_URL', 'http://127.0.0.1:5000');

const formatEnvValue = (key, formatter) => {
  const rawValue = process.env[key];
  if (!rawValue || String(rawValue).trim() === '') {
    return 'NOT_SET';
  }
  const formatted = formatter ? formatter(rawValue) : rawValue;
  return envFallbackUsage[key] ? `${formatted} (default)` : formatted;
};

// Environment verification at startup
console.log('🔧 Environment Variables Check:');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV || 'NOT_SET');
console.log('🔧 SESSION_SECRET:', formatEnvValue('SESSION_SECRET', value => 'SET (' + value.length + ' chars)'));
console.log('🔧 ADMIN_SETUP_TOKEN:', formatEnvValue('ADMIN_SETUP_TOKEN', value => 'SET (' + value.length + ' chars)'));
console.log('🔧 FRONTEND_URL:', formatEnvValue('FRONTEND_URL'));
console.log('PORT:', process.env.PORT || 'NOT_SET');

// Environment setup
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DEBUG_LEVEL = process.env.DEBUG_LEVEL || 'info'; // debug, info, warn, error

// Enhanced logging with level control
const log = {
  debug: (msg, ...args) => {
    if (['debug'].includes(DEBUG_LEVEL)) {
      console.debug(`🐛 [DEBUG] ${msg}`, ...args);
    }
  },
  info: (msg, ...args) => {
    if (['debug', 'info'].includes(DEBUG_LEVEL)) {
      console.info(`ℹ️ [INFO] ${msg}`, ...args);
    }
  },
  warn: (msg, ...args) => {
    if (['debug', 'info', 'warn'].includes(DEBUG_LEVEL)) {
      console.warn(`⚠️ [WARN] ${msg}`, ...args);
    }
  },
  error: (msg, ...args) => {
    console.error(`❌ [ERROR] ${msg}`, ...args);
  }
};

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const { securityHeaders, ipLogger, deviceFingerprintMiddleware } = require('./backend/middleware/security');

const app = express();
const PORT = process.env.PORT || 5003;

// CORS Configuration
const allowedOrigins = [
  'https://d2c296ba-6bdd-412e-987c-2af0f275fc6d-00-3mn8zz92vqke4.riker.replit.dev',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://12224013-3626-4849-b9ee-d5c2e07173af-00-x1g26xmwc88m.sisko.replit.dev',
  'https://workspace.akakicincadze.repl.co',
  'https://bakhmaro.co',
  'https://aispace.bakhmaro.co'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Important for SSE with credentials
  optionsSuccessStatus: 200 // For legacy browser support
};

// CORS Configuration - Will be set up later after allowedOrigins is extended

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Security middleware (apply first)
app.use(securityHeaders);
app.use(ipLogger);
app.use(deviceFingerprintMiddleware);

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Trust proxy for correct IP detection
app.set('trust proxy', 1);

// Backend health endpoint with degraded fallback reporting
app.get('/api/health', async (req, res) => {
  const backendHealthUrl =
    process.env.BACKEND_HEALTH_URL || 'http://127.0.0.1:5002/api/health';
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    try {
      controller.abort('health-timeout');
    } catch (error) {
      console.warn('⚠️ [FRONTEND_HEALTH] Abort failed', error);
    }
  }, Number(process.env.BACKEND_HEALTH_TIMEOUT_MS || 2000));

  const health = {
    ok: false,
    degraded: true,
    service: 'frontend-proxy',
    timestamp: new Date().toISOString(),
    backend: {
      url: backendHealthUrl,
      reachable: false,
      httpStatus: null,
      ok: false,
      degraded: true,
      error: null,
    },
  };

  try {
    const response = await fetch(backendHealthUrl, {
      signal: controller.signal,
      headers: { 'x-forwarded-by': 'frontend-proxy' },
    });
    health.backend.httpStatus = response.status;
    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      const backendOk = payload?.ok !== false && payload?.status !== 'error';
      const backendDegraded = Boolean(payload?.degraded) || backendOk === false;
      health.backend.reachable = true;
      health.backend.ok = backendOk;
      health.backend.degraded = backendDegraded;
      health.backend.error = payload?.error ?? null;
      health.ok = backendOk && !backendDegraded;
      health.degraded = backendDegraded && !health.ok;
    } else {
      health.backend.error = `HTTP ${response.status}`;
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error.message : String(error ?? 'unknown');
    health.backend.error = normalizedError;
    if (normalizedError?.includes('health-timeout')) {
      health.backend.error = 'timeout';
    }
    console.warn('⚠️ [FRONTEND_HEALTH] Backend health degraded', {
      error: normalizedError,
    });
  } finally {
    clearTimeout(timeout);
  }

  res.status(200).json(health);
});

// Enhanced session configuration with production security
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('❌ CRITICAL: SESSION_SECRET is required in production');
  process.exit(1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'fallback-session-secret-dev-only'),
  resave: false,
  saveUninitialized: false,
  name: 'bk_admin.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Always secure in production
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.bakhmaro.co' : undefined,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  proxy: process.env.NODE_ENV === 'production' // Trust proxy in production
}));

console.log('✅ Session middleware initialized successfully');

// Enhanced CORS Configuration - support production Replit domains
// Add deployment URL support for production
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.DEPLOYMENT_URL) {
  allowedOrigins.push(process.env.DEPLOYMENT_URL);
}

// Add Replit domains for both development and production
// Replit deployments need these patterns in production too
allowedOrigins.push(/https:\/\/.*\.replit\.dev$/);
allowedOrigins.push(/https:\/\/.*\.repl\.co$/);
allowedOrigins.push(/https:\/\/.*\.sisko\.replit\.dev$/);
allowedOrigins.push(/https:\/\/.*\.riker\.replit\.dev$/);

console.log('🔧 Enhanced CORS Configuration:', {
  origins: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Admin-Setup-Token',
    'X-Device-Fingerprint',
    'X-Requested-With'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400
});

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
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Admin-Setup-Token',
    'X-Device-Fingerprint',
    'X-Requested-With'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400
}));

// Enhanced Rate Limiting Configuration
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes default
  max: 100,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMITED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for DevConsole endpoints
    if (req.path.startsWith('/api/dev/console/') || req.path.includes('/dev/')) {
      return true;
    }
    // Skip rate limiting in development if configured
    return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_RATE_LIMIT === 'true';
  }
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMITED',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply global rate limiting
app.use(globalLimiter);
// Apply strict rate limiting to auth routes
app.use('/api/admin/auth', authLimiter);

// Basic API endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Backend API is live'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Import and mount routes (avoiding duplicates and organizing)
try {
  // Admin routes
  app.use('/api/admin/auth', require('./backend/routes/admin_auth'));
  app.use('/api/admin/setup', require('./backend/routes/admin_setup'));
  app.use('/api/admin/users', require('./backend/routes/admin_users'));
  app.use('/api/admin/webauthn', require('./routes/admin_webauthn'));
  app.use('/api/admin/introspection', require('./routes/admin_introspection'));

  // File management routes
  app.use('/api/files', require('./routes/file_tree'));
  app.use('/api/files', require('./routes/file_save'));
  app.use('/api/bulk', require('./routes/bulk_download')); // Optimized ZIP download

  // Enhanced search routes
  const enhancedSearchRoutes = require('./routes/enhanced_search');
  app.use('/api/search', enhancedSearchRoutes);

  // 🔧 Port management routes
  const portManagementRoutes = require('./routes/port_management');
  app.use('/api', portManagementRoutes);

  // File system routes alias for AI Developer Panel compatibility
  app.use('/api/fs/tree', (req, res, next) => {
    console.log('🔄 [Route Alias] /api/fs/tree -> /api/files/tree');
    req.url = req.url.replace('/api/fs/tree', '/api/files/tree');
    req.originalUrl = req.originalUrl.replace('/api/fs/tree', '/api/files/tree');
    require('./routes/file_tree')(req, res, next);
  });

  // AI and Messaging routes
  app.use('/api/ai', require('./routes/ai_proxy'));
  app.use('/api/messaging', require('./routes/messaging'));

  // SSE realtime errors MUST be mounted BEFORE memory_api to avoid route conflicts
  try {
    const memoryRealtimeRouter = require('./routes/memory_realtime');
    app.use('/api/memory', memoryRealtimeRouter);
    console.log('[SSE] /api/memory/realtime-errors mounted');
    console.log('[DEBUG] /api/memory/_debug/emit-error endpoint available');
  } catch (e) {
    console.error('[SSE] mount failed:', e?.message);
  }

  // Memory and Performance routes (must be after SSE to avoid conflicts)
  app.use("/api/memory", require("./routes/memory_api"));
  app.use('/api/performance', require('./routes/performance_routes'));
  app.use('/api/project', require('./routes/project_stats'));

  // User and Notification routes
  app.use('/api/user', require('./routes/user_activity'));
  app.use('/api/notifications', require('./routes/notifications'));

  // Other specific routes
  app.use('/api/commission', require('./routes/commission'));
  app.use('/api/auth', require('./routes/fallback_auth'));
  app.use('/api/jwt', require('./routes/jwt_auth'));
  app.use('/api', require('./routes/health')); // Moved health to root API path

  // Developer routes
  app.use('/api/developer', require('./routes/developer_panel'));

  // Developer console routes with proper middleware
  const { router: devConsoleRouter, loggerMiddleware: devConsoleLoggerMiddleware } = require('./routes/dev_console');
  app.use(devConsoleLoggerMiddleware); // Apply logger middleware before the routes
  app.use('/api/dev/console', devConsoleRouter);

  // 📢 Activity mounts & diagnostics
  console.log('[BOOT] Mounting Activity routes...');
  // Activity routes with proper error handling
  try {
    app.use('/api/activity-stream', require('./routes/activity_stream'));
    console.log('✅ Mounted /api/activity-stream');
  } catch (e) {
    console.error('❌ Failed to mount activity-stream:', e.message);
  }

  try {
    app.use('/api/activity', require('./routes/activity_ingest'));
    console.log('✅ Mounted /api/activity');
  } catch (e) {
    console.error('❌ Failed to mount activity:', e.message);
  }

  console.log('[BOOT] Activity routes: SSE=/api/activity-stream, REST=/api/activity');
  console.log('[BOOT] ENV: ENABLE_ACTIVITY_PERSIST=%s HMAC=%s', process.env.ENABLE_ACTIVITY_PERSIST, process.env.ACTIVITY_HMAC_SECRET ? 'SET' : 'MISSING');
  // Expose logActivity for other parts of the application
  module.exports.logActivity = require('./services/activity_bus').logActivity;

  // Terminal sessions routes
  const terminalSessionsRoutes = require('./routes/terminal_sessions');
  app.use('/api/terminal', terminalSessionsRoutes);

  console.log('[BOOT] All API routes registered successfully');
} catch (error) {
  console.error('❌ Error registering routes:', error);
  process.exit(1);
}

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ [Global Error Handler]:', error);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ [404] ${req.method} ${req.path} not found`);
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🔗 Admin API: http://0.0.0.0:${PORT}/api/admin/auth/me`);
  console.log('✅ Backend initialization complete');
});

server.on('error', (error) => {
  console.error('❌ Server startup error:', error);
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Trying alternate port...`);
    process.exit(1);
  }
});

// Test AI service connection
setTimeout(async () => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';
    console.log(`🔧 Testing AI Service at: ${aiServiceUrl}/health`);

    const response = await fetch(`${aiServiceUrl}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ AI Service connection verified:', data.service);
    } else {
      console.warn(`⚠️ AI Service health check failed with status: ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ AI Service not available during startup:', error.message);
  }
}, 3000);

module.exports = app;
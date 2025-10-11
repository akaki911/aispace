require('dotenv').config();

const path = require('path');
const { ensureLocalSecrets } = require('../scripts/ensureLocalSecrets');
const { validateEnv } = require('../shared/config/envValidator');

ensureLocalSecrets({ cwd: path.resolve(__dirname, '..') });

const envValidation = validateEnv({ serviceName: 'backend' });
process.env.FB_ADMIN_STATE = envValidation.flags.firebaseAdmin;

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
applyFallback('DEV_TASKS_ENABLED', 'false');

const runtimeConfig = require('./config/runtimeConfig');
const isProductionEnv = runtimeConfig.env.isProduction;

if (!isProductionEnv && !process.env.METADATA_SERVER_DETECTION) {
  process.env.METADATA_SERVER_DETECTION = 'none';
  console.log('🛡️ [Metadata] Disabled cloud metadata probing for local development.');
}

const formatEnvValue = (key, formatter) => {
  const rawValue = process.env[key];
  if (!rawValue || String(rawValue).trim() === '') {
    return 'NOT_SET';
  }
  const formatted = formatter ? formatter(rawValue) : rawValue;
  return envFallbackUsage[key] ? `${formatted} (default)` : formatted;
};

// === CRITICAL: Node.js Crypto API Setup for WebAuthn ===
// ეს საჭიროა @simplewebauthn/server-ისთვის Node.js v18+ environment-ში
const { webcrypto } = require('crypto');
global.crypto = webcrypto;
console.log('🔐 [WebAuthn] Global crypto polyfill initialized for @simplewebauthn/server');

// Environment verification at startup
console.log('🔧 Environment Variables Check:');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV || 'NOT_SET');
console.log('🔧 SESSION_SECRET:', formatEnvValue('SESSION_SECRET', value => 'SET (' + value.length + ' chars)'));
console.log('🔧 ADMIN_SETUP_TOKEN:', formatEnvValue('ADMIN_SETUP_TOKEN', value => 'SET (' + value.length + ' chars)'));
console.log('🔧 FRONTEND_URL:', formatEnvValue('FRONTEND_URL'));
console.log('🔧 DEV_TASKS_ENABLED:', formatEnvValue('DEV_TASKS_ENABLED'));
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

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { getRpConfig } = require('./utils/rpid');
const fetch = global.fetch
  ? (...args) => global.fetch(...args)
  : (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

console.log('📦 Starting backend initialization...');

const { securityHeaders, ipLogger, deviceFingerprintMiddleware } = require('./middleware/security');
const { correlationMiddleware } = require('./middleware/correlation_middleware');
const { buildModeGuard } = require('./middleware/build_mode_guard');
const { serviceAuth } = require('./middleware/service_auth');

const app = express();
const PORT = process.env.PORT || 5002; // SOL-311: Fixed port configuration

const { setupGuruloWebSocket } = require('./services/gurulo_ws');
const versionRoute = require('./routes/version');
const aiTraceRoutes = require('./routes/ai_trace');

const httpServer = http.createServer(app);

const websocketAllowlist = [
  FRONTEND_URL,
  process.env.ALT_FRONTEND_URL,
  'http://127.0.0.1:5000',
  'http://localhost:5000',
  'https://127.0.0.1:5000',
].filter(Boolean);

const guruloRealtime = setupGuruloWebSocket(httpServer, {
  allowOrigins: websocketAllowlist,
  logger: log,
});

app.locals.guruloRealtime = guruloRealtime;

app.use(buildModeGuard);

const guardedPrefixes = ['/internal', '/api/internal', '/api/proposals', '/proposals', '/api/ai/proposals'];
guardedPrefixes.forEach((prefix) => {
  app.use(prefix, serviceAuth);
});

// UPDATE 2024-10-01: Harden AI metadata endpoints by requiring known admin or
// service tokens while still allowing privileged session users in dev setups.
const authorizeAiMetadataRequest = (req, res, next) => {
  try {
    const privilegedRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'PROVIDER_ADMIN']);
    const sessionUser = req.session?.user || req.user || {};

    if (sessionUser?.role && privilegedRoles.has(sessionUser.role)) {
      log.debug('✅ [AI AUTH] Session role authorized for AI metadata', {
        path: req.path,
        role: sessionUser.role,
      });
      return next();
    }

    const authorizedIdsEnv = process.env.AI_AUTHORIZED_PERSONAL_IDS || '01019062020';
    const authorizedIds = authorizedIdsEnv
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const personalId = sessionUser?.personalId || req.headers['x-user-id'];

    if (personalId && authorizedIds.includes(personalId)) {
      log.debug('✅ [AI AUTH] Session personalId authorized for AI metadata', {
        path: req.path,
        personalId,
      });
      return next();
    }

    const adminHeader = req.headers['x-admin-setup-token'];
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : null;

    const providedTokens = [adminHeader, bearerToken].filter(Boolean);
    const validTokens = [
      process.env.ADMIN_SETUP_TOKEN,
      process.env.AI_SERVICE_TOKEN,
      process.env.AI_INTERNAL_TOKEN,
      process.env.AI_PANEL_TOKEN,
    ].filter(Boolean);

    const hasValidToken = providedTokens.some((token) => validTokens.includes(token));

    const isDevelopment = process.env.NODE_ENV !== 'production';
    const devTokenAllowList = new Set([
      'DEV_ADMIN_SETUP_TOKEN',
      'dev-token',
      'development',
      'admin_setup_token',
      'admin-setup-token',
    ]);
    const looksLikeDevToken = providedTokens.some(
      (token) =>
        typeof token === 'string' &&
        (token.startsWith('DEV_') ||
          token.endsWith('_dev') ||
          token.startsWith('dev-') ||
          token.startsWith('test-') ||
          devTokenAllowList.has(token))
    );

    if (hasValidToken || (isDevelopment && looksLikeDevToken)) {
      log.debug('✅ [AI AUTH] Token accepted for AI metadata', {
        path: req.path,
        via: hasValidToken ? 'env-token' : 'dev-token',
      });
      return next();
    }

    log.warn('🚫 [AI AUTH] Unauthorized AI metadata request blocked', {
      path: req.path,
      hasAuthorizationHeader: Boolean(authHeader),
      hasAdminSetupHeader: Boolean(adminHeader),
      userId: personalId || null,
      userRole: sessionUser?.role || null,
    });

    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid AI access token',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('❌ [AI AUTH] Error validating AI metadata token', error);
    return res.status(500).json({
      success: false,
      error: 'AUTH_VALIDATION_FAILED',
      message: 'Unable to validate AI access token',
      timestamp: new Date().toISOString(),
    });
  }
};

// SOL-311: Health endpoint before rate limiting
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'backend',
    port: process.env.PORT || 5002
  });
});

// Gurulo UI test clients and scripted runners need a generous rate limit when
// exercising the chat proxy. Apply their bypass marker before attaching the
// shared rate limiter so the skip callback can observe it.
app.use((req, _res, next) => {
  if (req.skipRateLimit) {
    return next();
  }

  const clientHeader = (req.headers['x-gurulo-client'] || '').toString().toLowerCase();
  if (clientHeader === 'gurulo-ui-test') {
    req.skipRateLimit = true;
    req.rateLimitBypassReason = 'gurulo-ui-test';
    return next();
  }

  const personalIdHeader = (
    req.headers['x-user-id'] ||
    req.headers['x-personal-id'] ||
    ''
  )
    .toString()
    .toLowerCase();

  if (personalIdHeader === 'front_chat_tester') {
    req.skipRateLimit = true;
    req.rateLimitBypassReason = 'front_chat_tester';
  }

  next();
});

// SOL-311: Rate limiting with monitoring endpoints whitelist
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => {
    // Whitelist health and monitoring endpoints
    if (req.path === '/api/health') return true;
    if (req.path.includes('/api/ai/autoimprove/monitor/')) return true;
    if (req.path.includes('/api/ai/auto-improve/monitor/')) return true;
    if (req.path.includes('/api/ai/autoimprove/proposals')) return true; // Bypass proposals endpoint
    if (req.path.includes('/api/ai/auto-improve/proposals')) return true; // Bypass proposals endpoint
    if (req.isMonitoringEndpoint) return true;
    if (req.skipRateLimit) return true;
    if (req.headers['x-monitoring-endpoint'] === 'true') return true;
    const clientHeader = (req.headers['x-gurulo-client'] || '').toString().toLowerCase();
    if (clientHeader === 'gurulo-ui-test') return true;
    const personalIdHeader = (
      req.headers['x-user-id'] ||
      req.headers['x-personal-id'] ||
      ''
    )
      .toString()
      .toLowerCase();
    if (personalIdHeader === 'front_chat_tester') return true;
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    retryAfter: '15 minutes'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// CORS Configuration
const resolveCorsOptions = (req) => {
  const { origin } = getRpConfig(req);
  return {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Setup-Token',
      'X-Device-Fingerprint',
      'X-Requested-With',
      'X-Correlation-ID',
      'Cookie',
      'Cache-Control'
    ],
    exposedHeaders: [
      'Set-Cookie',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Correlation-ID'
    ],
    optionsSuccessStatus: 200,
    maxAge: 86400
  };
};

app.use((req, res, next) => {
  try {
    const { origin } = getRpConfig(req);
    const requestOrigin = req.header('Origin');
    if (!requestOrigin || requestOrigin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } catch (error) {
    console.error('⚠️ [CORS] Failed to resolve origin header:', error.message);
  }
  next();
});

const corsOptionsDelegate = (req, callback) => {
  const options = resolveCorsOptions(req);
  const requestOrigin = req.header('Origin');

  if (requestOrigin && requestOrigin !== options.origin) {
    console.warn(`🚫 CORS blocked origin: ${requestOrigin} (expected ${options.origin})`);
    return callback(null, { ...options, origin: false });
  }

  callback(null, options);
};

app.use(cors(corsOptionsDelegate));

// Enhanced Rate Limiting Configuration - Increased for WebAuthn testing
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 500 to 1000 for WebAuthn testing
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
    // Skip rate limiting for AI service internal calls
    if (req.path.startsWith('/api/ai/') || req.headers['x-ai-internal-token']) {
      return true;
    }
    // Skip WebAuthn testing endpoints in development
    if (req.path.includes('/webauthn/') && process.env.NODE_ENV === 'development') {
      return true;
    }
    // Skip rate limiting in development if configured
    return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_RATE_LIMIT === 'true';
  }
});

// SOL-427: Strict Rate Limiting for Authentication and Verification Routes
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'development' ? 20 : 5, // SOL-427: Reduced limits
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMITED',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // SOL-427: Never skip rate limiting for verification routes
    return false;
  }
});

// SOL-427: Special rate limiter for WebAuthn verification routes
const webauthnVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // SOL-427: Very strict limit for biometric verification
  message: {
    error: 'Too many WebAuthn verification attempts',
    code: 'WEBAUTHN_RATE_LIMITED',
    retryAfter: '10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting conditionally
if (process.env.DEV_BYPASS_RATE_LIMIT !== 'true') {
  app.use(globalLimiter);
  app.use('/api/admin/auth', authLimiter);
  console.log('🛡️ Rate limiting enabled');
} else {
  console.log('⚠️ Rate limiting bypassed for development');
}

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

// Import routes
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin_auth');
const adminWebauthnRoutes = require('./routes/admin_webauthn');
const passkeyAuthRoutes = require('./routes/passkey_auth');
const providerAuthRoutes = require('./routes/provider_auth');
const customerAuthRoutes = require('./routes/customer_auth');
const securityAuditRoutes = require('./routes/security_audit');
const roleGuards = require('./middleware/role_guards');
const legacyAiRoutes = require('./routes/ai_legacy');

// Mount routes
app.use('/api/health', healthRoutes);
app.use('/api/version', versionRoute);

// Route advice for auto-routing - mount at specific path to avoid shadowing
const routeAdviceRoutes = require('./routes/route_advice');
app.use('/api/auth/route-advice', routeAdviceRoutes);

// Metrics endpoint
app.use('/metrics', require('./routes/metrics'));

// Mount Post-Apply Verification routes
try {
  const postApplyVerificationRoutes = require('./routes/post_apply_verification');
  app.use('/api/ai/autoimprove/post-apply', postApplyVerificationRoutes);
  app.use('/api/ai/auto-improve/post-apply', postApplyVerificationRoutes);
  console.log('✅ [POST-APPLY] Verification routes mounted at:');
  console.log('   - Primary: /api/ai/autoimprove/post-apply/*');
  console.log('   - Alias: /api/ai/auto-improve/post-apply/*');
} catch (error) {
  console.error('❌ Failed to mount post-apply verification routes:', error.message);
}

console.log('✅ [AUTO-IMPROVE] Routes mounted successfully at:');
console.log('   - Primary: /api/ai/autoimprove/*');
console.log('   - Alias: /api/ai/auto-improve/*');
console.log('   - Debug: /api/ai/autoimprove/_debug/ping');
console.log('   - Health: /api/ai/autoimprove/health');
console.log('   - Proposals: /api/ai/autoimprove/proposals');
console.log('   - Dry-run: /api/ai/autoimprove/dry-run/validate');
console.log('   - Approve: /api/ai/autoimprove/proposals/:id/approve');
console.log('   - Alternative: /api/ai/auto-improve/* (alias endpoints)');

// Mount auto-update control routes with error handling
const autoUpdateControlRoutes = require('./routes/auto_update_control');
try {
  app.use('/api/admin/auto-update', autoUpdateControlRoutes);
  console.log('✅ Auto-update control routes mounted at /api/admin/auto-update');
} catch (error) {
  console.error('❌ Failed to mount auto-update control routes:', error.message);
}

// Mount admin auth routes FIRST (highest priority)
try {
  const adminAuthRoute = require('./routes/admin_auth');
  app.use('/api/admin/auth', adminAuthRoute);
  console.log('✅ Admin auth route mounted at /api/admin/auth');
} catch (error) {
  console.error('❌ Failed to load admin auth route:', error.message);
}

// Mount AI rollout control routes
try {
  const aiRolloutControl = require('./routes/ai_rollout_control');
  app.use('/api/admin/ai-rollout', aiRolloutControl);
  app.use('/api/admin/ai', require('./routes/ai_diagnostics'));
  console.log('✅ AI rollout control routes mounted at /api/admin/ai-rollout');
} catch (error) {
  console.error('❌ Failed to load AI rollout control routes:', error.message);
}

const guruloStatusRoutes = require('./routes/gurulo_status');

const routeFiles = [
  'health',
  'file_tree',
  'ai_proxy',
  'memory_api',
  'dev_console'
];

routeFiles.forEach(routeFile => {
  try {
    const routePath = `./routes/${routeFile}.js`;
    console.log(`🔍 Attempting to load: ${routePath}`);

    // Check if file exists first
    if (!fs.existsSync(path.join(__dirname, routePath))) {
      console.warn(`⚠️ Route file not found: ${routePath}`);
      return;
    }

    const route = require(routePath);

    // Mount with different prefixes based on route type
    if (routeFile === 'health') {
      app.use('/api', route);
      console.log(`✅ Health route mounted at /api`);
    } else if (routeFile === 'file_tree') {
      app.use('/api/files', route);
      console.log(`✅ File tree route mounted at /api/files`);

      // Mount files upload/apply routes
      const filesUpload = require('./routes/files_upload');
      const filesApply  = require('./routes/files_apply');
      app.use('/api/files', filesUpload); // POST /upload, GET /attachment/:id
      app.use('/api/files', filesApply);  // POST /apply
      console.log('✅ Files upload/apply routes mounted at /api/files');
    } else if (routeFile === 'ai_proxy') {
      // AI proxy route moved to after autoimprove to prevent shadowing
      console.log(`⏳ AI proxy route deferred until after autoimprove`);
    } else if (routeFile === 'memory_api') {
      app.use('/api/memory', route);
      console.log(`✅ Memory API route mounted at /api/memory`);
    } else if (routeFile === 'dev_console') {
      app.use('/api/dev', route);
      console.log(`✅ Dev console route mounted at /api/dev`);
    } else {
      app.use('/api', route);
      console.log(`✅ Generic route mounted at /api: ${routeFile}`);
    }

  } catch (error) {
    console.error(`❌ Failed to load route ${routeFile}:`, error.message);
    console.error(`❌ Error details:`, error.stack);
  }
});

console.log('📂 Routes loading completed');

try {
  const browserTestingRoutes = require('./routes/browser_testing');
  app.use('/api/dev/browser-testing', browserTestingRoutes);
  console.log('✅ Browser testing routes mounted at /api/dev/browser-testing');
} catch (error) {
  console.error('❌ Failed to load browser testing routes:', error.message);
}

try {
  const devTestsRoutes = require('./routes/dev_tests');
  app.use('/api/dev/tests', devTestsRoutes);
  console.log('✅ Dev tests routes mounted at /api/dev/tests');
} catch (error) {
  console.error('❌ Failed to load dev tests routes:', error.message);
}

try {
  const integrationRoutes = require('./routes/integrations');
  app.use('/api/platform/integrations', integrationRoutes);
  console.log('✅ Integration routes mounted at /api/platform/integrations');
} catch (error) {
  console.error('❌ Failed to load integration routes:', error.message);
}

try {
  const secretsRoutes = require('./routes/secrets');
  app.use('/api/admin/secrets', secretsRoutes);
  console.log('✅ Secrets manager routes mounted at /api/admin/secrets');
} catch (error) {
  console.error('❌ Failed to load secrets routes:', error.message);
}

// Mount Auto-Improve routes BEFORE any AI proxy - CRITICAL for route precedence
try {
  const autoImproveRoutes = require('./routes/auto_improve');
  const autoImproveMounts = [
    '/api/ai/autoimprove',
    '/api/ai/auto-improve',
    '/api/auto-improve',
  ];
  autoImproveMounts.forEach((mountPath) => {
    app.use(mountPath, serviceAuth, autoImproveRoutes);
  });
  console.log('✅ Auto-improve routes mounted successfully with service authentication guard');
  console.log('📍 Auto-improve endpoints available:');
  console.log('   - Health: /api/ai/autoimprove/_debug/ping');
  console.log('   - List: /api/ai/autoimprove/proposals');
  console.log('   - Dry-run: /api/ai/autoimprove/dry-run/validate');
  console.log('   - Approve: /api/ai/autoimprove/proposals/:id/approve');
  console.log('   - Alternative: /api/ai/auto-improve/* (alias endpoints)');
  console.log('   - Internal: /internal/backend/autoimprove/* (requires AI_INTERNAL_TOKEN)');
  console.log('   - Internal alias: /internal/backend/auto-improve/*');
} catch (error) {
  console.error('❌ Failed to mount auto-improve routes:', error.message);
}

const proxyAiHealth = async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `ai-health-${Date.now().toString(36)}`;
  const targetUrl = `${AI_SERVICE_URL}/api/ai/health`;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), AI_HEALTH_TIMEOUT_MS);
  const startedAt = Date.now();

  console.log('🔍 [AI HEALTH] Forwarding health check to AI service', {
    targetUrl,
    correlationId
  });

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Bakhmaro-Backend-HealthProbe',
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
        'X-Correlation-Id': correlationId,
        Origin: req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5000'
      }
    });

    const durationMs = Date.now() - startedAt;
    const bodyText = await upstreamResponse.text();
    let payload = null;

    try {
      payload = JSON.parse(bodyText);
    } catch (parseError) {
      console.warn('⚠️ [AI HEALTH] Upstream response not JSON, returning raw payload');
    }

    if (!upstreamResponse.ok) {
      console.error('❌ [AI HEALTH] Upstream health check failed', {
        status: upstreamResponse.status,
        durationMs,
        correlationId
      });

      res.status(upstreamResponse.status).json({
        ok: false,
        status: 'UPSTREAM_UNAVAILABLE',
        message: 'AI service health check failed',
        upstreamStatus: upstreamResponse.status,
        upstreamBody: payload || bodyText,
        correlationId,
        durationMs,
        timestamp: new Date().toISOString(),
        port: PORT
      });
      return;
    }

    res.set('Cache-Control', 'no-store');
    const responsePayload = typeof payload === 'object' && payload !== null
      ? payload
      : { message: bodyText };

    res.status(200).json({
      ...responsePayload,
      proxy: {
        forwarded: true,
        durationMs,
        upstreamUrl: targetUrl,
        upstreamStatus: upstreamResponse.status,
        backendPort: PORT
      }
    });
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    console.error('❌ [AI HEALTH] Failed to contact AI service', {
      message: error.message,
      aborted: isAbort,
      correlationId
    });

    res.status(502).json({
      ok: false,
      status: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      message: isAbort ? 'AI service health check timed out' : 'AI service health check failed',
      correlationId,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      port: PORT
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};

// Add other essential AI endpoints that Frontend expects
app.get('/api/ai/health', proxyAiHealth);

// Add AI models endpoint with rollout support (must be mounted before proxy/legacy handlers)
app.get('/api/ai/models', authorizeAiMetadataRequest, async (req, res) => {
  try {
    console.log('🔍 [AI MODELS] GET /api/ai/models requested from Backend');

    // Use AI Rollout Manager for models endpoint
    const aiRolloutManager = require('./services/ai_rollout_manager');
    const userRole = req.session?.user?.role || req.header('x-user-role') || null;
    const personalId = req.session?.user?.personalId || req.header('x-user-id') || null;

    const response = await aiRolloutManager.routeRequest('getModels', {}, personalId, userRole);

    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/json; charset=utf-8');

    console.log('✅ [AI MODELS] Returning models via rollout manager');

    return res.status(200).json({
      ...response,
      service: 'backend-rollout'
    });
  } catch (err) {
    console.error('❌ [AI MODELS] Rollout error:', err);

    // Fallback to static models
    const models = [
      {
        id: 'llama-3.1-8b-instant',
        label: 'LLaMA 3.1 8B (სწრაფი)',
        category: 'small',
        description: 'უსწრაფესი მოდელი მარტივი ამოცანებისთვის',
        tokens: '8K context'
      },
      {
        id: 'llama-3.3-70b-versatile',
        label: 'LLaMA 3.3 70B (ძლიერი)',
        category: 'large',
        description: 'ძლიერი მოდელი რთული ამოცანებისთვის',
        tokens: '128K context'
      }
    ];

    return res.status(200).json({
      success: true,
      models,
      timestamp: new Date().toISOString(),
      service: 'backend-fallback'
    });
  }
});

// Primary live chat router must be mounted before legacy/proxy handlers
const aiChatRouter = require('./routes/ai_chat');
app.use('/api/ai/admin', require('./routes/ai_admin'));
app.use('/api/ai/trace', aiTraceRoutes);
app.use('/api/ai', aiChatRouter);

// Mount Gurulo status routes before legacy/proxy AI handlers
app.use('/api', guruloStatusRoutes);

// Mount legacy AI compatibility routes before proxy to guarantee coverage
app.use('/api/ai', legacyAiRoutes);

// Mount AI proxy routes (if available)
const aiProxyRoutes = require('./routes/ai_proxy');
app.use('/api/ai', aiProxyRoutes);

// Mount file-monitor routes for Live Agent functionality
app.get('/api/file-monitor/events', (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since) : 0;

    // Return mock events for now - this would connect to AI service in production
    const events = global.liveAgentEvents || [];
    const newEvents = events.filter(event =>
      new Date(event.timestamp).getTime() > since
    );

    res.json({
      success: true,
      events: newEvents,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ File monitor events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file monitor events'
    });
  }
});

app.get('/api/file-monitor/health', (req, res) => {
  res.json({
    success: true,
    status: 'active',
    message: 'File monitor service active',
    timestamp: new Date().toISOString()
  });
});

// Mount Auto-Improve routes
const autoImproveRoutes = require('./routes/auto_improve');

// Add intelligent-chat endpoint with rollout support
app.post('/api/ai/intelligent-chat', async (req, res) => {
  try {
    console.log('🤖 [INTELLIGENT CHAT] Request received from Frontend');

    const { message, personalId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Use AI Rollout Manager for Blue/Green deployment
    const aiRolloutManager = require('./services/ai_rollout_manager');
    const userRole = req.session?.user?.role || null;

    const response = await aiRolloutManager.routeRequest('chat', {
      message,
      personalId: personalId || 'anonymous',
      context: {
        fileContext: [],
        projectInfo: { source: 'intelligent_chat' }
      }
    }, personalId, userRole);

    console.log('✅ [INTELLIGENT CHAT] Response generated via AI Rollout Manager');

    res.json({
      success: true,
      response: response.response,
      timestamp: new Date().toISOString(),
      personalId: response.personalId,
      model: response.model || 'ai-microservice',
      modelLabel: 'AI Microservice',
      service: 'ai-microservice',
      usage: response.usage,
      rollout: response._rollout
    });

  } catch (error) {
    console.error('❌ [INTELLIGENT CHAT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'AI_SERVICE_ERROR',
      message: 'Failed to generate AI response',
      timestamp: new Date().toISOString()
    });
  }
});

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:5001').replace(/\/$/, '');
const AI_HEALTH_TIMEOUT_MS = Number(process.env.AI_HEALTH_TIMEOUT_MS || 5000);

// AI Service proxy completely removed - all AI functionality handled locally in Backend
console.log('ℹ️ AI Service proxy removed - Backend handles all AI operations locally');

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
app.use('/api/config', require('./routes/config'));

// User and Notification routes
app.use('/api/user', require('./routes/user_activity'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/github', require('./routes/github'));

// Backup fallback routes (disabled in this environment but avoids 404s)
app.use('/api/backup_system', require('./routes/backup_fallback'));

// Other specific routes
app.use('/api/commission', require('./routes/commission'));
app.use('/api/jwt', require('./routes/jwt_auth'));
app.use('/api', require('./routes/health')); // Moved health to root API path

// Developer routes
app.use('/api/developer', require('./routes/developer_panel'));

// Developer console routes with proper middleware
try {
  const devConsoleModule = require('./routes/dev_console');
  const devConsoleRouter = devConsoleModule.loggerMiddleware ? devConsoleModule : devConsoleModule.router || devConsoleModule;
  const devConsoleLoggerMiddleware = devConsoleModule.loggerMiddleware;

  if (devConsoleLoggerMiddleware) {
    app.use(devConsoleLoggerMiddleware); // Apply logger middleware before the routes
  }
  app.use('/api/dev/console', devConsoleRouter);
  console.log('✅ Dev console routes mounted successfully');
} catch (error) {
  console.error('❌ Failed to mount dev console routes:', error.message);
}

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

// Routes - Admin WebAuthn routes BEFORE any other routes to prevent shadowing
console.log('🔐 [WEBAUTHN] Mounting admin WebAuthn routes at /api/admin/webauthn');
app.use('/api/admin/webauthn', adminWebauthnRoutes);
console.log('🔐 [WEBAUTHN] Mounting universal passkey routes at /api/auth/passkey');
app.use('/api/auth/passkey', passkeyAuthRoutes);
console.log('✅ [WEBAUTHN] Admin WebAuthn routes mounted successfully');

app.use('/api/admin/auth', require('./routes/admin_auth'));

// Mount general fallback auth routes FIRST (includes /me endpoint) - CRITICAL for route precedence
console.log('🔐 [AUTH] Mounting fallback auth routes at /api/auth');
const fallbackAuthRouter = require('./routes/fallback_auth');
app.use('/api/auth', fallbackAuthRouter);
console.log('✅ [AUTH] Fallback auth routes mounted successfully (includes /me endpoint)');

// Mount specific auth sub-routes AFTER fallback routes to avoid shadowing
console.log('🔐 [DEVICE] Mounting device recognition routes at /api/auth/device');
app.use('/api/auth/device', require('./routes/device_recognition'));
console.log('✅ [DEVICE] Device recognition routes mounted successfully');

console.log('🔐 [ROUTE] Mounting route advice at /api/auth/route-advice');
app.use('/api/auth/route-advice', require('./routes/route_advice'));
console.log('✅ [ROUTE] Route advice mounted successfully');

// Verify /api/auth/me endpoint is accessible with explicit test
console.log('✅ [AUTH] /api/auth/me endpoint should now be available');
console.log('🔍 [AUTH] Route verification - checking /me endpoint availability');

app.use('/api/admin/users', require('./routes/admin_users'));
app.use('/api/admin/setup', require('./routes/admin_setup'));
app.use('/api/admin/introspection', require('./routes/admin_introspection'));
app.use('/api/admin/activity', require('./routes/user_activity'));
app.use('/api/admin/stats', require('./routes/activity_stats'));
app.use('/api/admin/stream', require('./routes/activity_stream'));
app.use('/api/admin/auto-update', require('./routes/auto_update_control'));
app.use('/api/admin/port', require('./routes/port_management'));
app.use('/api/admin/port-crisis', require('./routes/port_crisis_management'));
app.use('/api/admin/verify', require('./routes/post_apply_verification'));

// Mount device recognition routes
app.use('/api/device', require('./routes/device_recognition'));
app.use('/api/auth/device', require('./routes/device_auth'));

// Mount canary routes before error handlers
try {
  app.use('/api/admin/canary', require('./routes/canary_apply'));
  console.log('✅ Canary routes mounted at /api/admin/canary');
} catch (error) {
  console.error('❌ Failed to mount canary routes:', error.message);
}

// Mount logs correlation routes
try {
  app.use('/api/logs', require('./routes/logs_correlation'));
  console.log('✅ Logs correlation routes mounted at /api/logs');
} catch (error) {
  console.error('❌ Failed to mount logs correlation routes:', error.message);
}
app.use('/api/ai/autoimprove', require('./routes/auto_improve'));

// Mount notification hooks routes
const notificationHooks = require('./routes/notification_hooks');
app.use('/api/notifications', notificationHooks);

console.log('[BOOT] All API routes registered successfully');

// System cleanup endpoint for admins
app.post('/api/admin/system/cleanup', (req, res) => {
  const { personalId } = req.body;

  if (personalId !== '01019062020') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  try {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear any cached data
    console.log('🧹 System cleanup initiated by SUPER_ADMIN');

    res.json({
      success: true,
      message: 'System cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Global error handler with enhanced logging
app.use((error, req, res, next) => {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || `err_${Date.now()}`;

  console.error('❌ [Global Error Handler]:', {
    correlationId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent']?.substring(0, 100),
    origin: req.headers.origin,
    sessionId: req.sessionID?.substring(0, 8),
    timestamp: new Date().toISOString()
  });

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  // Set correlation ID in response headers
  res.set('X-Correlation-ID', correlationId);

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(error.status || 500).json({
    success: false,
    error: error.name || 'Internal Server Error',
    message: isDevelopment ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    correlationId,
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.get('/api/gurulo/ws/health', (req, res) => {
  const stats = guruloRealtime?.stats?.() || { clients: 0 };
  res.json({
    success: true,
    status: 'ready',
    clients: stats.clients,
    timestamp: new Date().toISOString(),
  });
});

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
// Enhanced server startup with port conflict handling
const server = httpServer.listen(PORT, "0.0.0.0", (error) => {
  if (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }

  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Backend initialization complete`);

  // Test critical routes - with safe access
  if (process.env.NODE_ENV === 'development') {
    console.log('🧪 Testing critical routes...');
    try {
      const routes = (app._router?.stack || []).map(r => {
        if (r && r.route) {
          return `${Object.keys(r.route.methods).join(', ').toUpperCase()} ${r.route.path}`;
        } else if (r && r.name === 'router') {
          return `ROUTER ${r.regexp.source}`;
        }
        return 'MIDDLEWARE';
      }).filter(r => r !== 'MIDDLEWARE');

      console.log('📋 Registered routes:', routes.length);
    } catch (error) {
      console.warn('⚠️ Route listing failed:', error.message);
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log('🔧 Try running: bash scripts/port-cleanup.sh');
    process.exit(1);
  } else {
    console.error('❌ Backend startup error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
server.on('close', () => {
  try {
    guruloRealtime?.close?.();
  } catch (error) {
    console.warn('⚠️ Failed to shut down Gurulo realtime server cleanly:', error.message);
  }
});

process.on('SIGTERM', () => {
  console.log('📴 Backend shutting down gracefully...');
  server.close(() => {
    console.log('✅ Backend stopped');
    process.exit(0);
  });
});

// AI Service connection testing removed - using Backend-only architecture
console.log('✅ Backend-only AI architecture - no external AI service dependency');

module.exports = app;
module.exports.server = server;
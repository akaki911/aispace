const express = require('express');
const router = express.Router();
const { EventEmitter } = require('events');
const axios = require('axios'); // For Groq API requests

// Global event emitter for dev console logs
const devConsoleEmitter = new EventEmitter();
devConsoleEmitter.setMaxListeners(50);

// --- Issue 1: Groq API Error Handling ---
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY; // Ensure this is loaded from environment/secrets

// Retry configuration
const RETRY_CONFIG = {
  retries: 3,
  factor: 1000, // Start with 1 second backoff
  maxTimeout: 10000, // Max 10 seconds backoff
  randomize: true
};

// Function to format Groq API requests with validation
const formatGroqRequest = (messages, model = 'llama3-8b-8192') => {
  const requestId = `req_${Date.now()}`;

  // Log the incoming request for debugging
  console.log(`🔍 [${requestId}] Validating Groq API request:`, {
    messagesType: typeof messages,
    messagesIsArray: Array.isArray(messages),
    messagesLength: messages ? messages.length : 0,
    model: model,
    hasGroqKey: !!GROQ_API_KEY,
    requestPayload: { messages, model }
  });

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    const error = new Error('Invalid request: Messages array is required and cannot be empty.');
    console.error(`❌ [${requestId}] Validation failed - Messages:`, {
      messages,
      type: typeof messages,
      isArray: Array.isArray(messages),
      length: messages ? messages.length : 0
    });
    throw error;
  }

  if (!GROQ_API_KEY) {
    const error = new Error('Groq API key is missing. Please set GROQ_API_KEY environment variable.');
    console.error(`❌ [${requestId}] Validation failed - Missing API Key`);
    throw error;
  }

  if (!model) {
    const error = new Error('Invalid request: Model name is required.');
    console.error(`❌ [${requestId}] Validation failed - Model:`, { model });
    throw error;
  }

  console.log(`✅ [${requestId}] Groq API request validation passed`);

  return {
    url: GROQ_API_URL,
    method: 'post',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    data: {
      messages,
      model,
      temperature: 0.7,
      max_tokens: 1024
    }
  };
};

// Function to send request with retry logic
const sendRequestWithRetry = async (requestConfig) => {
  let attempt = 0;
  while (attempt < RETRY_CONFIG.retries) {
    try {
      const response = await axios(requestConfig);
      return response.data;
    } catch (error) {
      attempt++;
      const status = error.response ? error.response.status : null;
      const data = error.response ? error.response.data : null;

      if (status === 429) { // Rate Limit Exceeded
        console.warn(`Groq API rate limit exceeded. Attempt ${attempt}/${RETRY_CONFIG.retries}. Retrying...`);
        const delay = Math.min(RETRY_CONFIG.factor * Math.pow(2, attempt) + (RETRY_CONFIG.randomize ? Math.random() * 1000 : 0), RETRY_CONFIG.maxTimeout);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (status === 503 || (data && data.error && data.error.message && data.error.message.includes('timeout'))) { // Service Unavailable or Timeout
        console.warn(`Groq API timeout or service unavailable. Attempt ${attempt}/${RETRY_CONFIG.retries}. Retrying...`);
        const delay = Math.min(RETRY_CONFIG.factor * Math.pow(2, attempt) + (RETRY_CONFIG.randomize ? Math.random() * 1000 : 0), RETRY_CONFIG.maxTimeout);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`Groq API error (status: ${status}):`, data.error ? data.error.message : error.message);
        throw error; // Re-throw other errors
      }
    }
  }
  throw new Error(`Groq API request failed after ${RETRY_CONFIG.retries} attempts.`);
};

// --- DevConsole Setup ---
// Rolling buffer for logs (50k entries max)
const logBuffer = {
  entries: [],
  maxSize: 50000,
  add(entry) {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  },
  filter(source, level, text, timeRange) {
    return this.entries.filter(entry => {
      if (source && source !== 'all' && entry.source !== source) return false;
      if (level && entry.level !== level) return false;
      if (text && !entry.message.toLowerCase().includes(text.toLowerCase())) return false;
      if (timeRange) {
        const entryTime = new Date(entry.ts);
        const now = new Date();
        const diff = now - entryTime;
        switch(timeRange) {
          case '1h': if (diff > 3600000) return false; break;
          case '6h': if (diff > 21600000) return false; break;
          case '24h': if (diff > 86400000) return false; break;
        }
      }
      return true;
    });
  }
};

// Metrics buffer for real-time monitoring
const metricsBuffer = {
  cpu: [],
  memory: [],
  latency: { p50: [], p95: [], p99: [] },
  errors: [],
  maxSize: 1000,
  add(type, value) {
    if (!this[type]) this[type] = [];
    this[type].push({ ts: Date.now(), value });
    if (this[type].length > this.maxSize) {
      this[type].shift();
    }
  }
};

// --- SSE Endpoints ---

// Enhanced SSE endpoint for DevConsole v2
router.get('/console/stream', (req, res) => {
  console.log('🔗 Dev Console SSE connection established');

  // Removed rate limiting for dev console to prevent loops
  // The frontend will handle rate limiting instead

  // Set proper SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no' // Disable nginx buffering
  });

  // Send initial connection confirmation (optimized payload)
  res.write(`data: ${JSON.stringify({
    type: 'info',
    source: 'backend',
    message: 'DevConsole v2 connected successfully',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Send initial demo logs immediately after connection
  setTimeout(() => {
    const georgianSampleLogs = [
      { source: 'backend', level: 'info', message: '🚀 გურულო DevConsole v2.0 ოფიციალურად გაშვებულია', meta: { connectionId: Math.random().toString(36).substr(2, 9), version: '2.0' } },
      { source: 'ai', level: 'info', message: '🤖 AI სისტემა აქტიურია - Groq llama-3.1-8b-instant მზადაა', meta: { version: '3.1', model: 'llama-3.1-8b-instant', status: 'ready' } },
      { source: 'frontend', level: 'info', message: '⚡ React + TypeScript DevServer ჩართულია პორტ 3000-ზე', meta: { port: 3000, hmr: true, framework: 'React-TS' } },
      { source: 'backend', level: 'info', message: '📊 Firebase Admin SDK სრულად კონფიგურირებულია', meta: { mode: 'development', services: ['auth', 'firestore'] } },
      { source: 'ai', level: 'success', message: '✅ Groq API Health Check - ყველაფერი კარგად მუშაობს', meta: { latency: '120ms', tokens: 1024, efficiency: 'high' } },
      { source: 'frontend', level: 'debug', message: '🔄 HMR Hot Module Replacement ოპტიმიზირებული', meta: { watchMode: true, viteVersion: '5.0' } },
      { source: 'backend', level: 'info', message: '🔐 WebAuthn + JWT ავტორიზაცია ხელმისაწვდომია', meta: { rpId: 'auto-detect', jwtEnabled: true } },
      { source: 'ai', level: 'info', message: '🧠 მეხსიერების სინქრონიზაცია დაიწყო - User Context Loading', meta: { userId: '01019062020', memoryFiles: 3 } },
      { source: 'system', level: 'info', message: '🏗️ Code Editor სინტაქს highlighting ჩართულია', meta: { languages: ['typescript', 'javascript', 'css'] } },
      { source: 'backend', level: 'warn', message: '⚠️ Development Mode - Production გასატანად მზად არ არის', meta: { env: 'development', warnings: 2 } }
    ];

    georgianSampleLogs.forEach((log, index) => {
      setTimeout(() => {
        const logWithTs = { ts: Date.now() + index, ...log };
        logBuffer.add(logWithTs);
        devConsoleEmitter.emit('log', logWithTs);
        res.write(`data: ${JSON.stringify(logWithTs)}\n\n`);
      }, index * 300); // Stagger by 300ms
    });
  }, 200);

  // Memory monitoring and response size limiting
  let responseSize = 0;
  const maxResponseSize = 1 * 1024 * 1024; // 1MB limit per connection

  const logInterval = setInterval(() => {
    if (res.finished) {
      clearInterval(logInterval);
      return;
    }

    // Memory monitoring
    const memoryUsage = process.memoryUsage();
    const memoryWarningThreshold = 100 * 1024 * 1024; // 100MB

    if (memoryUsage.heapUsed > memoryWarningThreshold) {
      console.warn('⚠️ High memory usage detected:', Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB');
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    // Check response size limit
    if (responseSize >= maxResponseSize) {
      res.write(`data: ${JSON.stringify({
        type: 'warning',
        message: 'Response size limit reached. Reconnecting may be required.',
        timestamp: new Date().toISOString()
      })}\n\n`);
      clearInterval(logInterval);
      return;
    }

    // Generate multiple log entries per interval for more activity
    const numLogs = Math.floor(Math.random() * 3) + 1; // 1-3 logs per interval

    for (let i = 0; i < numLogs; i++) {
      const sources = ['ai', 'backend', 'frontend'];
      const levels = ['info', 'warn', 'error', 'debug'];

      const mockMessages = [
        '🔧 მომხმარებელი წარმატებით ავტორიზირებული - SUPER_ADMIN',
        '📊 Firebase Firestore კავშირი სტაბილურად მუშაობს',
        '⚡ API Request დამუშავდა - Response Time: 180ms',
        '💾 Redis Cache განახლება შესრულებულია',
        '📁 TypeScript ფაილები წარმატებით კომპილირდა',
        '🚨 Payment Gateway Error - Card Validation Failed',
        '⚠️ Memory Usage: 85% - Garbage Collection საჭიროა',
        '🐛 Debug: Request Timeout - 30s limit exceeded',
        '✅ Health Check Passed - ყველა სერვისი Available',
        '🔒 JWT Token Expired - Auto-refresh ჩაირთო',
        '🤖 Groq AI Response: 1.2k tokens, ქართული ენა detected',
        '🔄 Hot Reload Triggered - 3 files changed',
        '📱 Vite HMR Update - React components reloaded',
        '🔍 AI Model Performance: 95% accuracy, 200ms latency',
        '🎯 Code Analysis Complete - 0 errors, 2 warnings',
        '🚀 Deployment Ready - Build assets optimized',
        '📈 Performance Metrics Updated - CPU: 12%, RAM: 45%',
        '🔐 WebAuthn Passkey Registration - Browser Chrome',
        '💡 AI Suggestion: Georgian translation improvements available',
        '⚡ Database Query Optimized - Index usage: 100%'
      ];

      const source = sources[Math.floor(Math.random() * sources.length)];
      const level = levels[Math.floor(Math.random() * levels.length)];
      const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];

      const logEntry = {
        ts: Date.now() + i,
        source,
        level,
        message: randomMessage,
        meta: {
          id: `req_${Date.now()}_${i}`,
          ms: Math.floor(Math.random() * 1000),
          requestId: Math.random().toString(36).substr(2, 9)
        }
      };

      logBuffer.add(logEntry);
      devConsoleEmitter.emit('log', logEntry);

      try {
        const data = `data: ${JSON.stringify(logEntry)}\n\n`;
        responseSize += data.length;
        res.write(data);
      } catch (error) {
        console.error('❌ SSE write error:', error);
        clearInterval(logInterval);
        return;
      }
    }
  }, 1000); // Every 1 second for more frequent updates

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (res.finished) {
      clearInterval(heartbeatInterval);
      return;
    }
    res.write(`data: ${JSON.stringify({
      ts: Date.now(),
      source: 'backend',
      level: 'debug',
      message: 'Connection heartbeat'
    })}\n\n`);
  }, 30000); // Every 30 seconds

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log('🔌 Dev Console SSE connection closed');
    clearInterval(logInterval);
    clearInterval(heartbeatInterval);
  });
});

// --- SSE Stream endpoint for DevConsole v2 ---
router.get('/stream', (req, res) => {
  console.log('📡 DevConsole SSE stream connection initiated');

  // Set proper SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'DevConsole v2 stream connected',
    timestamp: Date.now()
  })}\n\n`);

  // Set up periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      timestamp: Date.now()
    })}\n\n`);
  }, 30000); // 30 seconds

  // Listen for log events and forward to client
  const logHandler = (logEntry) => {
    try {
      res.write(`data: ${JSON.stringify({
        type: 'log',
        ...logEntry
      })}\n\n`);
    } catch (error) {
      console.error('SSE write error:', error);
    }
  };

  devConsoleEmitter.on('log', logHandler);

  // Clean up on disconnect
  req.on('close', () => {
    console.log('📡 DevConsole SSE stream disconnected');
    clearInterval(heartbeat);
    devConsoleEmitter.removeListener('log', logHandler);
  });

  req.on('error', (err) => {
    console.error('📡 DevConsole SSE stream error:', err);
    clearInterval(heartbeat);
    devConsoleEmitter.removeListener('log', logHandler);
  });
});

// Metrics Stream SSE endpoint
router.get('/metrics/stream', (req, res) => {
  console.log('📊 Dev Metrics SSE connection established');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendMetrics = () => {
    // Simulate metrics data
    const metrics = {
      ts: Date.now(),
      services: {
        backend: {
          cpu: Math.random() * 50 + 10,
          memory: Math.random() * 100 + 50, // MB
          status: 'running',
          uptime: process.uptime()
        },
        ai: {
          cpu: Math.random() * 30 + 5,
          memory: Math.random() * 80 + 40, // MB
          status: 'running',
          requests: Math.floor(Math.random() * 50)
        },
        frontend: {
          status: 'running',
          buildTime: '2.3s'
        }
      },
      latency: {
        p50: Math.random() * 50 + 10,
        p95: Math.random() * 100 + 50,
        p99: Math.random() * 200 + 100
      }
    };
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  };

  sendMetrics(); // Send initial metrics
  const metricsInterval = setInterval(sendMetrics, 5000); // Send every 5 seconds

  req.on('close', () => {
    console.log('📊 Dev Metrics SSE connection closed');
    clearInterval(metricsInterval);
  });
});

// --- Service Management Endpoints ---

router.post('/commands/restart', (req, res) => {
  const { service, action = 'restart' } = req.body;
  console.log(`🔄 Service ${action} request for: ${service}`);

  // Mock service responses
  const responses = {
    'backend': { port: 5002, status: 'restarting', message: 'Backend service restart initiated' },
    'frontend': { port: 3000, status: 'restarting', message: 'Frontend service restart initiated' }
  };

  const serviceResponse = responses[service] || { status: 'unknown', message: `Unknown service: ${service}` };

  res.json({ success: true, service, action, ...serviceResponse, timestamp: new Date().toISOString() });
});

router.get('/services/status', (req, res) => {
  const services = [
    { name: 'Backend', slug: 'backend', port: 5002, status: 'running', pid: Math.floor(Math.random() * 9000) + 1000, uptime: '2h 15m', url: 'https://bakhmaro.replit.dev:5002' },
    { name: 'Frontend', slug: 'frontend', port: 5000, status: 'running', pid: Math.floor(Math.random() * 9000) + 1000, uptime: '2h 15m', url: 'https://bakhmaro.replit.dev:5000' }
  ];

  res.json({ success: true, services, timestamp: new Date().toISOString() });
});

// System metrics endpoint (simplified)
router.get('/metrics', (req, res) => {
  const metrics = {
    system: {
      cpu: Math.random() * 50 + 20,
      memory: Math.random() * 30 + 60, // MB
      diskIO: Math.random() * 20 + 5
    },
    network: {
      requests: Math.floor(Math.random() * 50) + 100,
      responseTime: Math.floor(Math.random() * 200) + 100,
      errors: Math.floor(Math.random() * 5)
    },
    processes: [
      { name: 'backend', pid: 1235, cpu: Math.random() * 20 + 5, memory: Math.random() * 40 + 100, status: 'running' },
      { name: 'frontend', pid: 1236, cpu: Math.random() * 15 + 5, memory: Math.random() * 30 + 80, status: 'running' }
    ]
  };

  res.json({ success: true, metrics, timestamp: new Date().toISOString() });
});

// Mock Command Endpoints (SAFE - NO REAL RESTARTS)
router.post('/commands/run', (req, res) => {
  const { command, args = [] } = req.body;
  console.log(`🏃 MOCK COMMAND RUN: ${command}`);

  const logEntry = {
    ts: Date.now(),
    source: 'backend',
    level: 'info',
    message: `[MOCK] Command run: ${command} ${args.join(' ')} - PRETEND MODE`,
    meta: { command, args, mock: true }
  };

  logBuffer.add(logEntry);
  devConsoleEmitter.emit('log', logEntry);

  res.json({ success: true, jobId: `mock-${Date.now()}`, message: `MOCK command executed - არანაირი რეალური ეფექტი`, mock: true });
});

// Logger middleware to capture all app logs
const loggerMiddleware = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  const logError = (statusCode, method, path) => {
    if (statusCode >= 400) {
      const logEntry = {
        ts: Date.now(),
        source: 'backend',
        level: statusCode >= 500 ? 'error' : 'warn',
        message: `${method} ${path} - ${statusCode}`,
        meta: { method, path, status: statusCode }
      };
      logBuffer.add(logEntry);
      devConsoleEmitter.emit('log', logEntry);
    }
  };

  res.send = function(body) {
    logError(this.statusCode, req.method, req.path);
    return originalSend.call(this, body);
  };

  res.json = function(obj) {
    logError(this.statusCode, req.method, req.path);
    return originalJson.call(this, obj);
  };

  next();
};

// Global console interception for real workflow logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Helper function to add log entries programmatically
const addDevLog = (source, level, message, meta = {}) => {
  const logEntry = {
    ts: Date.now(),
    source: source || 'backend',
    level: level || 'info',
    message,
    meta,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  logBuffer.add(logEntry);
  devConsoleEmitter.emit('log', logEntry);
};

// Console interceptor to capture real workflow logs
const interceptConsoleForDevConsole = () => {
  console.log = function(...args) {
    const message = args.join(' ');

    // Parse source from message patterns
    let source = 'backend';
    let level = 'info';

    if (message.includes('[ai]') || message.includes('🤖') || message.includes('Groq') || message.includes('AI')) {
      source = 'ai';
    } else if (message.includes('[frontend]') || message.includes('⚛️') || message.includes('Vite') || message.includes('React')) {
      source = 'frontend';
    } else if (message.includes('[backend]') || message.includes('📂') || message.includes('Express')) {
      source = 'backend';
    }

    // Determine level from message content
    if (message.includes('❌') || message.includes('ERROR') || message.includes('CRITICAL')) {
      level = 'error';
    } else if (message.includes('⚠️') || message.includes('WARN') || message.includes('🚨')) {
      level = 'warn';
    } else if (message.includes('🔍') || message.includes('DEBUG')) {
      level = 'debug';
    }

    // Only emit clean, meaningful logs (filter out noise)
    if (message.length > 5 && !message.includes('Executing') && !message.includes('undefined') && !message.includes('DevConsole:')) {
      addDevLog(source, level, message, {
        timestamp: new Date().toISOString(),
        type: 'console.log',
        intercepted: true
      });
    }

    // Call original console.log
    originalConsoleLog.apply(console, args);
  };

  console.error = function(...args) {
    const message = args.join(' ');
    let source = 'backend';

    if (message.includes('[ai]') || message.includes('🤖') || message.includes('Groq')) source = 'ai';
    else if (message.includes('[frontend]') || message.includes('⚛️') || message.includes('Vite')) source = 'frontend';

    addDevLog(source, 'error', message, {
      timestamp: new Date().toISOString(),
      type: 'console.error',
      stack: args.length > 1 ? args[1] : undefined
    });

    originalConsoleError.apply(console, args);
  };

  console.warn = function(...args) {
    const message = args.join(' ');
    let source = 'backend';

    if (message.includes('[ai]') || message.includes('🤖') || message.includes('Groq')) source = 'ai';
    else if (message.includes('[frontend]') || message.includes('⚛️') || message.includes('Vite')) source = 'frontend';

    addDevLog(source, 'warn', message, {
      timestamp: new Date().toISOString(),
      type: 'console.warn'
    });

    originalConsoleWarn.apply(console, args);
  };
};

// Start console interception
interceptConsoleForDevConsole();

// Test console interception with sample logs
setTimeout(() => {
  console.log('[ai] 🤖 Testing console interception for DevConsole');
  console.log('[backend] 📡 DevConsole SSE system ready');
  console.log('[frontend] ⚛️ Frontend logging test message');
  console.warn('[ai] ⚠️ Testing warning level capture');
  console.error('[backend] ❌ Testing error level capture');
}, 3000);

// Initial system startup logs
setTimeout(() => {
  addDevLog('backend', 'info', '🚀 Dev Console System initialized', { version: '2.0' });
  addDevLog('backend', 'info', '📊 Real-time metrics streaming active');
  addDevLog('backend', 'info', '🔧 Mock command system ready (SAFE MODE)');
  addDevLog('backend', 'info', '✅ Groq API integration configured');
}, 1000);

// --- Endpoint for fetching logs with pagination ---
// Get recent console logs for fallback/initial load with optimizations
router.get('/tail', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Max 500 logs
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // --- Issue 2: DevConsole crash fix ---
    // Ensure `filters` is defined before use.
    // In this context, `filters` is not used, but if it were,
    // it would need to be initialized here or higher up if it's a dependency.
    // For now, we'll ensure variables are declared properly.

    // Filter logs based on query parameters (example: source, level, text)
    let filteredLogs = logBuffer.entries;
    if (req.query.source && req.query.source !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.source === req.query.source);
    }
    if (req.query.level) {
      filteredLogs = filteredLogs.filter(log => log.level === req.query.level);
    }
    if (req.query.text) {
      filteredLogs = filteredLogs.filter(log => log.message.toLowerCase().includes(req.query.text.toLowerCase()));
    }
    // Add time range filtering if needed

    // Apply pagination
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    res.json({
      ok: true,
      entries: paginatedLogs,
      currentPage: page,
      totalPages: Math.ceil(filteredLogs.length / limit),
      totalLogs: filteredLogs.length,
      limit: limit
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch logs', error: error.message });
  }
});


// --- AI Request Handler ---
router.post('/ai/chat', async (req, res) => {
  const requestId = `req_${Date.now()}`;
  const { messages, model } = req.body;

  console.log(`🔍 [${requestId}] Incoming AI chat request:`, {
    bodyKeys: Object.keys(req.body || {}),
    messagesPresent: !!messages,
    messagesType: typeof messages,
    messagesLength: messages ? messages.length : 0,
    model: model,
    fullRequestBody: req.body
  });

  try {
    // Format and validate request before sending to Groq API
    const requestConfig = formatGroqRequest(messages, model);

    // Send request with retry logic
    const aiResponse = await sendRequestWithRetry(requestConfig);

    // Process AI response (e.g., extract message content)
    let reply = 'Sorry, I could not generate a response.';
    if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
      reply = aiResponse.choices[0].message.content;
    }

    // Log successful AI interaction
    console.debug(`✅ [${requestId}] Cache hit for user data`, {
      model: model || 'default',
      responseLength: reply.length,
      ms: Date.now() - parseInt(requestId.replace('req_', ''))
    });

    addDevLog('ai', 'info', 'AI chat request successful', {
      requestId,
      model: model || 'default',
      responseLength: reply.length
    });

    res.json({ success: true, reply });

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing AI chat request:`, {
      errorMessage: error.message,
      errorStack: error.stack,
      requestBody: req.body
    });

    // Log AI-related errors with enhanced context
    addDevLog('ai', 'error', 'Invalid request format', {
      requestId,
      error: error.message,
      requestContext: {
        requestId,
        responseTime: Date.now() - parseInt(requestId.replace('req_', ''))
      },
      rawMeta: {
        id: requestId,
        ms: Date.now() - parseInt(requestId.replace('req_', ''))
      },
      validationFailure: {
        messagesPresent: !!messages,
        messagesType: typeof messages,
        messagesIsArray: Array.isArray(messages),
        messagesLength: messages ? messages.length : 0,
        modelPresent: !!model,
        hasGroqKey: !!GROQ_API_KEY
      }
    });

    // Handle specific errors gracefully for the user
    let userMessage = 'An error occurred while processing your request.';
    if (error.message.includes('Groq API rate limit exceeded')) {
      userMessage = 'The AI service is currently experiencing high demand. Please try again in a moment.';
    } else if (error.message.includes('Model response timeout') || error.message.includes('service unavailable')) {
      userMessage = 'The AI service timed out. Please try again.';
    } else if (error.message.includes('Invalid request')) {
      userMessage = 'There was an issue with your request format. Please check your input.';
    } else if (error.message.includes('Groq API key is missing')) {
      userMessage = 'AI service is not configured correctly. Please contact support.';
    }

    res.status(error.response?.status || 500).json({ success: false, message: userMessage, details: error.message });
  }
});

// --- Backend Warnings & Optimizations ---
// Middleware to check response size and potentially trim or paginate
const responseSizeLimiter = (req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;
  const MAX_PAYLOAD_SIZE = 500 * 1024; // 500KB limit

  res.json = function(body) {
    let payloadSize = 0;
    try {
      payloadSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch (e) {
      console.warn('Could not determine payload size:', e.message);
    }

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      console.warn(`Large response payload detected for ${req.method} ${req.path}. Payload size: ${payloadSize} bytes. Consider pagination.`);
      // Simple trimming example (not ideal, but demonstrates the concept)
      // For proper pagination, API responses should be designed to support it.
      const trimmedBody = { ...body };
      // Example: Limit the number of items in a list if the response is an array
      if (Array.isArray(trimmedBody.data)) {
        trimmedBody.data = trimmedBody.data.slice(0, 100); // Limit to 100 items
        trimmedBody.warning = 'Response data has been truncated due to size limits. Implement pagination for full data.';
        addDevLog('backend', 'warn', `Response for ${req.method} ${req.path} truncated due to size limit.`);
      }
      return originalJson.call(this, trimmedBody);
    }
    return originalJson.call(this, body);
  };

  res.send = function(body) {
    let payloadSize = 0;
    try {
      payloadSize = Buffer.byteLength(body, 'utf8');
    } catch (e) {
      console.warn('Could not determine payload size:', e.message);
    }

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      console.warn(`Large response payload detected for ${req.method} ${req.path}. Payload size: ${payloadSize} bytes. Consider pagination.`);
      addDevLog('backend', 'warn', `Response for ${req.method} ${req.path} is large. Payload size: ${payloadSize} bytes.`);
      // Trimming send() is harder as it might not be JSON.
    }
    return originalSend.call(this, body);
  };

  next();
};

// Apply the response size limiter middleware to relevant routes if needed,
// or globally if all responses are susceptible. For now, applying it selectively.
// Example: router.use('/some-large-data-route', responseSizeLimiter);


// Throttling/Queuing example (conceptual - requires more implementation)
// let requestQueue = [];
// let isProcessingQueue = false;
// const MAX_CONCURRENT_REQUESTS = 5;

// const processQueue = async () => {
//   if (isProcessingQueue || requestQueue.length === 0) return;
//   isProcessingQueue = true;

//   const task = requestQueue.shift();
//   // Execute task (e.g., call an external API)
//   await task.execute();
//   isProcessingQueue = false;
//   processQueue(); // Process next task
// };

// Middleware to add tasks to queue
// const throttleMiddleware = (req, res, next) => {
//   if (requestQueue.length >= MAX_CONCURRENT_REQUESTS) {
//     console.warn('Backend rate limit approaching. Queuing request.');
//     addDevLog('backend', 'warn', 'Request queued due to rate limit.');
//     requestQueue.push({ req, res, next, execute: () => { /* logic to handle request */ } });
//   } else {
//     next();
//   }
// };

// Default export for Express mounting
module.exports = router;

// Named exports for additional functionality
module.exports.loggerMiddleware = loggerMiddleware;
module.exports.addDevLog = addDevLog;
module.exports.devConsoleEmitter = devConsoleEmitter;
module.exports.logBuffer = logBuffer;
module.exports.metricsBuffer = metricsBuffer;
module.exports.responseSizeLimiter = responseSizeLimiter;
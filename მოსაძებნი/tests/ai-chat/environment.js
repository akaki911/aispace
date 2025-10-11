const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { setTimeout: delay } = require('timers/promises');
const state = require('./state');

const BASE_BACKEND_URL = process.env.AI_CHAT_BACKEND_URL || 'http://127.0.0.1:5002';
const AI_SERVICE_URL = process.env.AI_CHAT_SERVICE_URL || 'http://127.0.0.1:5001';

const processes = [];
let environmentReady = null;

const waitForEndpoint = async (url, { timeoutMs = 20000, intervalMs = 500 } = {}) => {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        return true;
      }
      lastError = new Error(`Status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw lastError || new Error(`Timeout waiting for ${url}`);
};

const startProcess = (label, cwd, entry, envOverrides = {}) => {
  const logFilePath = path.join(state.ensureArtifactDir(), `${label}.log`);
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  const child = spawn('node', [entry], {
    cwd,
    env: { ...process.env, ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  child.on('exit', (code, signal) => {
    logStream.end(`\n[${new Date().toISOString()}] process ${label} exited with code=${code} signal=${signal}\n`);
  });

  processes.push({ label, child, logFilePath });
  return child;
};

const ensureEnvironment = async () => {
  if (!environmentReady) {
    environmentReady = (async () => {
      state.ensureArtifactDir();
      const sharedSecret = process.env.AI_SERVICE_SHARED_SECRET || process.env.AI_INTERNAL_TOKEN || 'test-internal-token';
      const aiEnv = {
        PORT: '5001',
        AI_PORT: '5001',
        NODE_ENV: 'test',
        AI_SERVICE_SHARED_SECRET: sharedSecret,
        AI_SERVICE_TOKEN_TTL: process.env.AI_SERVICE_TOKEN_TTL || '120',
        AI_INTERNAL_TOKEN: process.env.AI_INTERNAL_TOKEN || sharedSecret,
        FRONTEND_URL: 'http://127.0.0.1:5000',
        DEBUG_LEVEL: 'warn',
        CORRELATION_ID: state.corrId,
      };
      const backendEnv = {
        PORT: '5002',
        NODE_ENV: 'development',
        AI_SERVICE_URL,
        SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret',
        FRONTEND_URL: 'http://127.0.0.1:5000',
        DEV_TASKS_ENABLED: 'false',
        AI_SERVICE_SHARED_SECRET: sharedSecret,
        AI_SERVICE_TOKEN_TTL: aiEnv.AI_SERVICE_TOKEN_TTL,
        AI_INTERNAL_TOKEN: aiEnv.AI_INTERNAL_TOKEN,
        AI_PROXY_STREAMING_MODE: 'auto',
        CORRELATION_ID: state.corrId,
        VITE_API_BASE: BASE_BACKEND_URL,
        VITE_AI_SERVICE_URL: AI_SERVICE_URL,
      };

      startProcess('ai-service', path.join(__dirname, '..', '..', 'ai-service'), 'server.js', aiEnv);
      await waitForEndpoint(`${AI_SERVICE_URL}/health`);

      startProcess('backend', path.join(__dirname, '..', '..', 'backend'), 'index.js', backendEnv);
      await waitForEndpoint(`${BASE_BACKEND_URL}/api/version`);

      state.summary.backendUrl = BASE_BACKEND_URL;
      state.summary.aiServiceUrl = AI_SERVICE_URL;
    })();
  }
  return environmentReady;
};

const shutdownEnvironment = async () => {
  for (const proc of processes.splice(0)) {
    try {
      proc.child.kill('SIGTERM');
    } catch (error) {
      console.warn(`Failed to terminate ${proc.label}:`, error.message);
    }
  }
};

process.on('exit', () => {
  if (processes.length) {
    for (const proc of processes) {
      proc.child.kill('SIGTERM');
    }
  }
});

module.exports = {
  ensureEnvironment,
  shutdownEnvironment,
  BASE_BACKEND_URL,
  AI_SERVICE_URL,
};

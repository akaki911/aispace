'use strict';

const path = require('path');
const fsp = require('fs/promises');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { Octokit } = require('@octokit/rest');

const API_REGION = 'us-central1';
const API_ORIGIN = 'https://aispace.bakhmaro.co';
const COOKIE_DOMAIN = '.bakhmaro.co';
const FILES_ROOT = process.env.CODE_ROOT || path.resolve(__dirname, '..', '..');
const FEATURE_FLAGS_COLLECTION = 'featureFlags';
const FEATURE_FLAG_CACHE_MS = 60_000;
const FILE_ROLES = new Set(['DEVELOPER', 'SUPER_ADMIN', 'SUPERADMIN']);

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

const corsOptions = {
  origin: API_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  optionsSuccessStatus: 204,
  preflightContinue: true,
};

app.use('/api', cors(corsOptions));
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', API_ORIGIN);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.header('Access-Control-Allow-Headers', req.get('Access-Control-Request-Headers') || corsOptions.allowedHeaders.join(', '));

  const originalCookie = res.cookie.bind(res);
  res.cookie = (name, value, options = {}) => {
    const nextOptions = { ...options };
    if (!nextOptions.domain) {
      nextOptions.domain = COOKIE_DOMAIN;
    }
    return originalCookie(name, value, nextOptions);
  };

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

const toBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
      return false;
    }
    if (normalized.length === 0) {
      return defaultValue;
    }
  }

  return defaultValue;
};

const parseEnvFlagFallbacks = () => {
  const map = {};

  if (typeof process.env.FEATURE_FLAGS === 'string') {
    try {
      const parsed = JSON.parse(process.env.FEATURE_FLAGS);
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          map[key] = toBoolean(value);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse FEATURE_FLAGS env JSON:', error.message);
    }
  }

  return map;
};

const envFlagFallbacks = parseEnvFlagFallbacks();

const getEnvFlagValue = (flagName) => {
  const directKey = `FEATURE_FLAG_${flagName}`;
  if (process.env[directKey] !== undefined) {
    return toBoolean(process.env[directKey]);
  }

  const normalized = flagName.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  const normalizedKey = `FEATURE_FLAG_${normalized}`;
  if (process.env[normalizedKey] !== undefined) {
    return toBoolean(process.env[normalizedKey]);
  }

  if (envFlagFallbacks[flagName] !== undefined) {
    return envFlagFallbacks[flagName];
  }

  if (envFlagFallbacks[normalized] !== undefined) {
    return envFlagFallbacks[normalized];
  }

  return undefined;
};

const featureFlagCache = {
  expiresAt: 0,
  data: null,
};

const normalizeRelativePath = (rawPath = '') => {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('..') || trimmed.includes('\0')) {
    throw Object.assign(new Error('Unsafe path'), { status: 400 });
  }

  const normalized = path.posix.normalize(trimmed.replace(/\\+/g, '/'));
  if (normalized.startsWith('../') || normalized === '..') {
    throw Object.assign(new Error('Path escapes root'), { status: 400 });
  }

  if (path.isAbsolute(normalized)) {
    throw Object.assign(new Error('Absolute paths are not allowed'), { status: 400 });
  }

  return normalized === '.' ? '' : normalized;
};

const resolvePath = (relativePath = '') => {
  const normalized = normalizeRelativePath(relativePath);
  const resolved = path.resolve(FILES_ROOT, normalized);
  if (!resolved.startsWith(path.resolve(FILES_ROOT))) {
    throw Object.assign(new Error('Resolved path escapes root'), { status: 400 });
  }

  return { normalized, absolute: resolved };
};

const ensureTextContent = async (absolutePath) => {
  const buffer = await fsp.readFile(absolutePath);
  return buffer.toString('utf8');
};

const listDirectory = async (relativePath = '') => {
  const { normalized, absolute } = resolvePath(relativePath);
  const dirStat = await fsp.stat(absolute);

  if (!dirStat.isDirectory()) {
    throw Object.assign(new Error('Not a directory'), { status: 400 });
  }

  const entries = await fsp.readdir(absolute, { withFileTypes: true });
  const results = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.git'))
      .map(async (entry) => {
        const childRelative = normalized ? `${normalized}/${entry.name}` : entry.name;
        const childAbsolute = path.resolve(absolute, entry.name);
        const stats = await fsp.stat(childAbsolute);
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: childRelative,
          size: entry.isDirectory() ? undefined : stats.size,
          lastModified: stats.mtime.toISOString(),
        };
      }),
  );

  return results.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
};

const authenticateRequest = async (req) => {
  const authHeader = req.get('authorization') || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.cookies && typeof req.cookies.__session === 'string') {
    token = req.cookies.__session.trim();
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token, true);
    const roles = Array.isArray(decoded.roles)
      ? decoded.roles
      : typeof decoded.role === 'string'
        ? [decoded.role]
        : [];

    return {
      uid: decoded.uid,
      email: decoded.email || null,
      roles: roles.map((role) => String(role).toUpperCase()),
      claims: decoded,
    };
  } catch (error) {
    console.warn('⚠️ Failed to verify Firebase ID token:', error.message);
    return null;
  }
};

const requireAuthenticatedUser = async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    res.status(401).json({ isAuthenticated: false, error: 'Authentication required' });
    return null;
  }
  return user;
};

const ensureDeveloperRole = (user) => {
  if (!user) {
    return false;
  }

  return user.roles.some((role) => FILE_ROLES.has(role.toUpperCase()));
};

app.get('/api/version', (req, res) => {
  const version = process.env.GIT_SHA || process.env.COMMIT_SHA || 'dev';
  res.json({ version, region: API_REGION, timestamp: new Date().toISOString() });
});

app.get('/api/ai/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ai/models', (req, res) => {
  res.json({
    models: [
      { id: 'gpt-4o-mini', title: 'OpenAI GPT-4o Mini' },
      { id: 'claude-3-5-sonnet', title: 'Anthropic Claude 3.5 Sonnet' },
      { id: 'llama-3.1-8b', title: 'Meta Llama 3.1 8B Instruct' },
    ],
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    res.status(401).json({ isAuthenticated: false });
    return;
  }

  res.json({
    isAuthenticated: true,
    uid: user.uid,
    email: user.email,
    roles: user.roles,
  });
});

app.get('/api/flags', async (req, res) => {
  const now = Date.now();
  if (featureFlagCache.data && featureFlagCache.expiresAt > now) {
    res.json({ flags: featureFlagCache.data, cached: true, expiresAt: featureFlagCache.expiresAt });
    return;
  }

  try {
    const snapshot = await firestore.collection(FEATURE_FLAGS_COLLECTION).get();
    const flags = {};

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const candidate = data.enabled ?? data.value ?? data.flag ?? data;
      flags[doc.id] = toBoolean(candidate, getEnvFlagValue(doc.id) ?? false);
    });

    const fallbackKeys = new Set([
      ...Object.keys(flags),
      ...Object.keys(envFlagFallbacks),
    ]);

    fallbackKeys.forEach((flagKey) => {
      if (flags[flagKey] === undefined) {
        const fallback = getEnvFlagValue(flagKey);
        if (fallback !== undefined) {
          flags[flagKey] = fallback;
        }
      }
    });

    featureFlagCache.data = flags;
    featureFlagCache.expiresAt = Date.now() + FEATURE_FLAG_CACHE_MS;

    res.json({ flags, cached: false, expiresAt: featureFlagCache.expiresAt });
  } catch (error) {
    console.error('❌ Failed to load feature flags:', error);
    res.status(500).json({ error: 'Failed to load feature flags' });
  }
});

app.get('/api/files/tree', async (req, res) => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  if (!ensureDeveloperRole(user)) {
    res.status(403).json({ error: 'Developer or SuperAdmin role required' });
    return;
  }

  try {
    const relative = typeof req.query.path === 'string' ? req.query.path : '';
    const files = await listDirectory(relative);
    res.json({ data: files });
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    console.error('❌ Failed to read file tree:', error);
    res.status(status).json({ error: error.message || 'Failed to read file tree' });
  }
});

app.get('/api/files/content/:path', async (req, res) => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  if (!ensureDeveloperRole(user)) {
    res.status(403).json({ error: 'Developer or SuperAdmin role required' });
    return;
  }

  try {
    let requestedPath = req.params.path || '';
    try {
      requestedPath = decodeURIComponent(requestedPath);
    } catch (error) {
      res.status(400).json({ error: 'Invalid file path encoding' });
      return;
    }
    const { normalized, absolute } = resolvePath(requestedPath);
    const stats = await fsp.stat(absolute);

    if (stats.isDirectory()) {
      res.status(400).json({ error: 'Cannot read a directory' });
      return;
    }

    const content = await ensureTextContent(absolute);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    res.type('text/plain').send(content);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : error.status && Number.isInteger(error.status) ? error.status : 500;
    console.error('❌ Failed to read file content:', error);
    res.status(status).json({ error: error.message || 'Failed to read file content' });
  }
});

app.post('/api/files/save', async (req, res) => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  if (!ensureDeveloperRole(user)) {
    res.status(403).json({ error: 'Developer or SuperAdmin role required' });
    return;
  }

  const { path: requestedPath, content } = req.body || {};

  if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
    res.status(400).json({ error: 'Path is required' });
    return;
  }

  if (typeof content !== 'string') {
    res.status(400).json({ error: 'Content must be a string' });
    return;
  }

  try {
    const { normalized, absolute } = resolvePath(requestedPath);
    await fsp.mkdir(path.dirname(absolute), { recursive: true });
    await fsp.writeFile(absolute, content, 'utf8');
    const stats = await fsp.stat(absolute);

    res.json({
      data: {
        path: normalized,
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
      },
    });
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : error.status && Number.isInteger(error.status) ? error.status : 500;
    console.error('❌ Failed to save file:', error);
    res.status(status).json({ error: error.message || 'Failed to save file' });
  }
});

app.get('/api/console/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write('retry: 5000\n\n');

  let eventCounter = 0;
  const sendEvent = (event, payload) => {
    const id = `${event}-${++eventCounter}`;
    res.write(`id: ${id}\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent('telemetry', {
    status: 'connected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });

  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15_000);

  const telemetryInterval = setInterval(() => {
    sendEvent('telemetry', {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
    });
  }, 5_000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(telemetryInterval);
    res.end();
  });
});

app.get('/api/github/repos', async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(501).json({ error: 'GitHub integration disabled: missing GITHUB_TOKEN' });
    return;
  }

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.request('GET /user/repos', {
      per_page: 50,
      sort: 'updated',
    });

    const repos = data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
      defaultBranch: repo.default_branch,
    }));

    res.json({ repos });
  } catch (error) {
    console.error('❌ Failed to fetch GitHub repositories:', error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 502;
    res.status(status).json({ error: 'Failed to fetch GitHub repositories' });
  }
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled API error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const api = onRequest({ region: API_REGION }, app);

module.exports = { api };

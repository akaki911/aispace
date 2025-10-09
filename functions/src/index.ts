import cors from 'cors';
import express, { type CookieOptions } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { onRequest } from 'firebase-functions/v2/https';

const app = express();

const corsMiddleware = cors({
  origin: 'https://aispace.bakhmaro.co',
  credentials: true,
});

app.use(corsMiddleware);
app.options('*', corsMiddleware);

app.use((_, res, next) => {
  const originalCookie = res.cookie.bind(res);
  res.cookie = ((name, value, options) => {
    const defaults: CookieOptions = {
      domain: '.bakhmaro.co',
      secure: true,
      sameSite: 'lax',
    };
    return originalCookie(name, value, { ...defaults, ...(options ?? {}) });
  }) as typeof res.cookie;
  next();
});

app.use(express.json());

interface RootPackageJson {
  name?: string;
  version?: string;
}

const rootPackageJsonPath = join(__dirname, '../../package.json');
let appVersion = '0.0.0';
try {
  const raw = readFileSync(rootPackageJsonPath, 'utf-8');
  const parsed = JSON.parse(raw) as RootPackageJson;
  if (parsed.version) {
    appVersion = parsed.version;
  }
} catch (error) {
  console.warn('Failed to read root package.json for version info', error);
}

const buildTime = new Date().toISOString();
const commitHash = (() => {
  const candidates = [
    'GIT_COMMIT_SHA',
    'GITHUB_SHA',
    'COMMIT_SHA',
    'VERCEL_GIT_COMMIT_SHA',
    'RENDER_GIT_COMMIT',
  ];

  for (const key of candidates) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
})();

app.get('/version', (_req, res) => {
  res.json({
    name: 'aispace',
    version: appVersion,
    buildTime,
    commit: commitHash ?? null,
  });
});

app.get('/ai/health', (_req, res) => {
  res.json({
    status: 'ok',
    ok: true,
    service: 'aispace-api',
    time: new Date().toISOString(),
  });
});

app.get('/console/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const retryMs = 5000;
  res.write(`retry: ${retryMs}\n\n`);
  res.flushHeaders?.();

  let eventId = 0;
  const sendHeartbeat = () => {
    eventId += 1;
    const payload = {
      type: 'heartbeat',
      time: new Date().toISOString(),
    };
    res.write(`id: ${eventId}\n`);
    res.write('event: heartbeat\n');
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeatInterval = setInterval(sendHeartbeat, 15000);
  sendHeartbeat();

  const cleanup = () => {
    clearInterval(heartbeatInterval);
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
});

const hasGithubSecrets = (): boolean => {
  const { GH_APP_ID, GH_INSTALLATION_ID, GH_PRIVATE_KEY, GH_PAT } = process.env;
  return Boolean(
    (GH_PAT && GH_PAT.trim()) ||
      ((GH_APP_ID && GH_APP_ID.trim()) &&
        (GH_INSTALLATION_ID && GH_INSTALLATION_ID.trim()) &&
        (GH_PRIVATE_KEY && GH_PRIVATE_KEY.trim())),
  );
};

const requireGithubSecrets: express.RequestHandler = (_req, res, next) => {
  if (!hasGithubSecrets()) {
    res.status(501).json({ error: 'missing_secrets' });
    return;
  }
  next();
};

const githubNotImplemented: express.RequestHandler = (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
};

app.get('/github/tree', requireGithubSecrets, githubNotImplemented);
app.get('/github/file', requireGithubSecrets, githubNotImplemented);
app.post('/github/pr', requireGithubSecrets, githubNotImplemented);

export const api = onRequest({ region: 'us-central1' }, app);

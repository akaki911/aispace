import cors, { CorsOptions } from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const SA = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!admin.apps.length) {
  if (!SA) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)) });
}

const app = express();

const allowedOrigin = 'https://aispace.bakhmaro.co';
const allowedOrigins = new Set([allowedOrigin]);
const normaliseOrigin = (origin: string): string => origin.replace(/\/+$/, '');
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const candidate = normaliseOrigin(origin);
    if (allowedOrigins.has(origin) || allowedOrigins.has(candidate)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
};

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

app.get('/ai/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    ok: true,
    service: 'aispace-api',
    time: new Date().toISOString(),
  });
});

app.use(cors(corsOptions));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Vary', 'Origin');
  if (req.headers.origin === allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.cookie('aispace-session', 'active', {
    domain: '.bakhmaro.co',
    secure: true,
    sameSite: 'none',
    httpOnly: false,
    path: '/',
  });

  next();
});

app.get('/console/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write('retry: 5000\n\n');

  let nextId = 1;

  const sendEvent = (event: string, data: unknown) => {
    const payload = JSON.stringify(data);
    res.write(`id: ${nextId}\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${payload}\n\n`);
    nextId += 1;
  };

  sendEvent('connected', { time: new Date().toISOString() });

  const heartbeat = setInterval(() => {
    sendEvent('heartbeat', { time: new Date().toISOString() });
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
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

/**
 * OIDC (Azure AD / Entra ID) for Firebase Auth:
 * Issuer (OIDC): https://login.microsoftonline.com/<TENANT_ID>/v2.0
 * Required Redirect URIs (add in Azure App → Authentication):
 *   https://aispace-prod.firebaseapp.com/__/auth/handler
 *   https://aispace-prod.web.app/__/auth/handler
 * Scopes: openid profile email (optional: offline_access)
 */
import cors, { CorsOptions } from 'cors';
import express, { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Ensure OIDC provider maps your Azure AD/Workspace claim (e.g., employeeId or custom) to
// personal_id in the ID token; Firebase will pass it into getIdTokenResult().claims.
const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!admin.apps.length) {
  if (!serviceAccountJson) {
    throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON');
  }

  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountJson)) });
}

const SESSION_COOKIE_NAME = 'aispace_session';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? '.bakhmaro.co';
const SESSION_TTL_INPUT = Number(process.env.SESSION_TTL_HOURS ?? '8');
const SESSION_TTL_HOURS = Number.isFinite(SESSION_TTL_INPUT) && SESSION_TTL_INPUT > 0 ? SESSION_TTL_INPUT : 8;
const SESSION_EXPIRES_MS = SESSION_TTL_HOURS * 3_600_000;
// CORS allowlist: https://aispace.bakhmaro.co only; also permit missing Origin headers (e.g., curl).
const allowedOrigin = 'https://aispace.bakhmaro.co';

const resolveAllowedPersonalId = (): string | undefined => {
  const candidates = [
    'ADMIN_ALLOWED_PERSONAL_ID',
    'VITE_ALLOWED_PERSONAL_ID',
    'ALLOWED_PERSONAL_ID',
  ];

  for (const key of candidates) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const allowedPersonalId = resolveAllowedPersonalId();

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (origin === allowedOrigin) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
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

const app = express();
const apiRouter = express.Router();

apiRouter.use(cors(corsOptions));
apiRouter.use(express.json());
apiRouter.use((_req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

apiRouter.get('/version', (_req, res) => {
  res.json({
    name: 'aispace',
    version: appVersion,
    buildTime,
    commit: commitHash ?? null,
  });
});

apiRouter.get('/ai/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    ok: true,
    service: 'aispace-api',
    time: new Date().toISOString(),
  });
});

const SSE_WINDOW_MS = 60_000;
const SSE_MAX_CONNECTIONS = 5;
const sseRateLimits = new Map<string, { count: number; resetAt: number }>();

const resolveClientKey = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? req.ip;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip;
};

const trackSseConnection = (key: string): (() => void) | null => {
  const now = Date.now();
  const existing = sseRateLimits.get(key);
  const record =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + SSE_WINDOW_MS }
      : existing;

  if (record.count >= SSE_MAX_CONNECTIONS) {
    return null;
  }

  record.count += 1;
  sseRateLimits.set(key, record);

  return () => {
    const current = sseRateLimits.get(key);
    if (!current) {
      return;
    }
    current.count = Math.max(0, current.count - 1);
    sseRateLimits.set(key, current);
  };
};

apiRouter.get('/console/events', (req: Request, res: Response) => {
  const cleanupRateLimit = trackSseConnection(resolveClientKey(req));
  if (!cleanupRateLimit) {
    res.status(429).json({ error: 'too_many_requests' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write('retry: 5000\n\n');

  let nextId = 1;
  const sendData = (data: string) => {
    res.write(`id: ${nextId}\n`);
    res.write(`data: ${data}\n\n`);
    nextId += 1;
  };

  sendData('💓');

  const heartbeat = setInterval(() => {
    sendData('💓');
  }, 15_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    cleanupRateLimit();
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
});

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) {
      continue;
    }
    cookies[rawName] = rawValue.join('=').trim();
  }

  return cookies;
};

const getSessionCookie = (req: Request): string | undefined => {
  const cookies = parseCookies(req.headers.cookie);
  const cookieValue = cookies[SESSION_COOKIE_NAME];
  if (cookieValue && cookieValue.trim()) {
    return cookieValue.trim();
  }
  return undefined;
};

apiRouter.post('/auth/session', async (req: Request, res: Response) => {
  const { idToken } = req.body ?? {};

  if (typeof idToken !== 'string' || !idToken.trim()) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  try {
    await admin.auth().verifyIdToken(idToken, true);
    const sessionCookie = await admin.auth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_MS,
    });

    res.cookie(SESSION_COOKIE_NAME, sessionCookie, {
      domain: COOKIE_DOMAIN,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_EXPIRES_MS,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to establish session cookie', error);
    res.status(401).json({ error: 'unauthenticated' });
  }
});

apiRouter.post('/auth/logout', async (_req: Request, res: Response) => {
  res.cookie(SESSION_COOKIE_NAME, '', {
    domain: COOKIE_DOMAIN,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  });

  res.json({ ok: true });
});

const UNPROTECTED_PATHS = new Set([
  '/version',
  '/ai/health',
  '/auth/session',
  '/auth/logout',
  '/console/events',
]);

apiRouter.use(async (req, res, next) => {
  if (UNPROTECTED_PATHS.has(req.path)) {
    next();
    return;
  }

  try {
    const sessionCookie = getSessionCookie(req);
    if (!sessionCookie) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
    // Azure AD → App Registration → Token configuration → Add optional claim (ID): employeeId.
    // If you need a different name, map in code (we accept employeeId → personal_id fallback).
    const personalId =
      (decoded.personal_id as string | undefined) ||
      (decoded.employeeId as string | undefined);

    if (!personalId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    if (allowedPersonalId && personalId !== allowedPersonalId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    next();
  } catch (error) {
    console.error('Failed to verify session cookie', error);
    res.status(401).json({ error: 'unauthenticated' });
  }
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

apiRouter.get('/github/tree', requireGithubSecrets, githubNotImplemented);
apiRouter.get('/github/file', requireGithubSecrets, githubNotImplemented);
apiRouter.post('/github/pr', requireGithubSecrets, githubNotImplemented);

app.use('/api', apiRouter);

export const api = onRequest({ region: 'us-central1' }, app);

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
import { once } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';

// Ensure OIDC provider maps your Azure AD/Workspace claim (e.g., employeeId or custom) to
// personal_id in the ID token; Firebase will pass it into getIdTokenResult().claims.
const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!admin.apps.length) {
  if (!serviceAccountJson) {
    throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON');
  }

  const parsedServiceAccount = JSON.parse(serviceAccountJson) as {
    project_id?: string;
  };

  const configuredBucket =
    process.env.STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    (parsedServiceAccount.project_id ? `${parsedServiceAccount.project_id}.appspot.com` : undefined);

  admin.initializeApp({
    credential: admin.credential.cert(parsedServiceAccount),
    storageBucket: configuredBucket,
  });
}

const storage = admin.storage();

const SESSION_COOKIE_NAME = '__Secure-aispace_session';
const CSRF_COOKIE_NAME = '__Secure-aispace_csrf';
const COOKIE_DOMAIN = '.bakhmaro.co';
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

type AuthContext = {
  token: admin.auth.DecodedIdToken;
  roles: string[];
  personalId?: string;
};

const applyStorageCorsHeaders = (res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Vary', 'Origin');
};

const normaliseRoles = (claim: unknown): string[] => {
  if (Array.isArray(claim)) {
    return claim.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof claim === 'string') {
    return [claim];
  }
  return [];
};

const setAuthContext = (res: Response, token: admin.auth.DecodedIdToken, personalId?: string) => {
  const roles = normaliseRoles((token as Record<string, unknown>).roles);
  const context: AuthContext = { token, roles, personalId };
  (res.locals as Record<string, unknown>).auth = context;
};

const getAuthContext = (res: Response): AuthContext | null => {
  const locals = res.locals as Record<string, unknown> & { auth?: AuthContext };
  return locals.auth ?? null;
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

const publicCorsOptions: CorsOptions = {
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  credentials: false,
  optionsSuccessStatus: 204,
};

const publicRouter = express.Router();

publicRouter.use(cors(publicCorsOptions));
publicRouter.use((_req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

publicRouter.get('/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.json({
    name: 'aispace',
    version: appVersion,
    buildTime,
    commit: commitHash ?? null,
    gitSha: process.env.GIT_SHA || 'dev',
    node: process.version,
    region: process.env.GCLOUD_REGION || 'us-central1',
  });
});

publicRouter.get('/ai/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.json({
    status: 'ok',
    ok: true,
    service: 'aispace-api',
    time: new Date().toISOString(),
  });
});

const apiRouter = express.Router();

apiRouter.use(cors(corsOptions));
apiRouter.use(express.json());
apiRouter.use((_req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

const SSE_WINDOW_MS = 60_000;
const SSE_MAX_CONNECTIONS = 5;
const sseRateLimits = new Map<string, { count: number; resetAt: number }>();

const AUTH_RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 30;
const authRateLimitBucket = new Map<string, { count: number; resetAt: number }>();

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

const resolveRateLimitRecord = (
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
) => {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + windowMs };
    store.set(key, fresh);
    return fresh;
  }
  return existing;
};

const incrementRateLimit = (
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
  maxRequests: number,
): { limited: boolean; retryAfterMs: number } => {
  const record = resolveRateLimitRecord(store, key, windowMs);
  if (record.count >= maxRequests) {
    return { limited: true, retryAfterMs: Math.max(0, record.resetAt - Date.now()) };
  }

  record.count += 1;
  store.set(key, record);
  return { limited: false, retryAfterMs: Math.max(0, record.resetAt - Date.now()) };
};

const sendRateLimitResponse = (res: Response, retryAfterMs: number) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ error: 'too_many_requests' });
};

const MAX_BINARY_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_BINARY_MIME_PATTERNS = [
  /^image\//i,
  /^application\/pdf$/i,
  /^application\/zip$/i,
  /^application\/x-zip-compressed$/i,
  /^application\/octet-stream$/i,
];

const TEXT_FILE_EXTENSIONS = ['.ts', '.tsx', '.json', '.md'];

const isBinaryMimeAllowed = (mimeType: string | undefined): boolean => {
  if (!mimeType) {
    return false;
  }
  return ALLOWED_BINARY_MIME_PATTERNS.some((pattern) => pattern.test(mimeType));
};

const isTextFilePath = (path: string): boolean => {
  const lower = path.toLowerCase();
  return TEXT_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
};

const isTextContentTypeHeader = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  return value.startsWith('text/') || value === 'application/json';
};

const sanitizeStoragePath = (input: string | undefined | null): string => {
  if (!input) {
    return '';
  }

  return input
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
};

const getBucket = () => storage.bucket();

const hasUploadPermission = (res: Response): boolean => {
  const context = getAuthContext(res);
  if (!context) {
    return false;
  }

  const privilegedRoles = new Set(['SUPER_ADMIN', 'PROVIDER', 'PROVIDER_ADMIN']);

  if (context.personalId && allowedPersonalId && context.personalId === allowedPersonalId) {
    return true;
  }

  return context.roles.some((role) => privilegedRoles.has(role));
};

apiRouter.get('/console/events', (req: Request, res: Response) => {
  const { limited, retryAfterMs } = incrementRateLimit(
    authRateLimitBucket,
    `console:${resolveClientKey(req)}`,
    AUTH_RATE_LIMIT_WINDOW_MS,
    AUTH_RATE_LIMIT_MAX_REQUESTS,
  );

  if (limited) {
    sendRateLimitResponse(res, retryAfterMs);
    return;
  }

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

const ensureCsrfCookie = (res: Response): string => {
  const token = randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, {
    domain: COOKIE_DOMAIN,
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_EXPIRES_MS,
  });
  return token;
};

const extractCsrfToken = (req: Request): string | undefined => {
  const cookies = parseCookies(req.headers.cookie);
  const cookieValue = cookies[CSRF_COOKIE_NAME];
  if (cookieValue && cookieValue.trim()) {
    return cookieValue.trim();
  }
  return undefined;
};

const verifyCsrfToken = (req: Request, res: Response): boolean => {
  const headerToken = req.headers['x-xsrf-token'];
  const cookieToken = extractCsrfToken(req);

  if (!cookieToken || typeof headerToken !== 'string' || headerToken !== cookieToken) {
    ensureCsrfCookie(res);
    res.status(403).json({ error: 'forbidden' });
    return false;
  }

  return true;
};

const rateLimitAuthRequest = (req: Request, res: Response): boolean => {
  const key = `auth:${resolveClientKey(req)}`;
  const { limited, retryAfterMs } = incrementRateLimit(
    authRateLimitBucket,
    key,
    AUTH_RATE_LIMIT_WINDOW_MS,
    AUTH_RATE_LIMIT_MAX_REQUESTS,
  );

  if (limited) {
    sendRateLimitResponse(res, retryAfterMs);
    return false;
  }

  return true;
};

apiRouter.post('/auth/session', async (req: Request, res: Response) => {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  let idToken: string | undefined;

  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    idToken = authHeader.slice(7).trim();
  }

  if (!idToken) {
    const bodyToken = (req.body ?? {}).idToken;
    if (typeof bodyToken === 'string' && bodyToken.trim()) {
      idToken = bodyToken.trim();
    }
  }

  if (!idToken) {
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

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to establish session cookie', error);
    res.status(401).json({ error: 'unauthenticated' });
  }
});

apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  if (!rateLimitAuthRequest(req, res) || !verifyCsrfToken(req, res)) {
    return;
  }

  res.cookie(SESSION_COOKIE_NAME, '', {
    domain: COOKIE_DOMAIN,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  });

  ensureCsrfCookie(res);

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

    setAuthContext(res, decoded, personalId);
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

apiRouter.post('/files/upload', async (req: Request, res: Response) => {
  applyStorageCorsHeaders(res);
  res.setHeader('Cache-Control', 'no-store');

  if (!hasUploadPermission(res)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const contentTypeHeader = req.headers['content-type'];
  if (typeof contentTypeHeader !== 'string' || !contentTypeHeader.includes('multipart/form-data')) {
    res.status(415).json({ error: 'invalid_content_type' });
    return;
  }

  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentTypeHeader);
  const boundaryKey = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundaryKey) {
    res.status(400).json({ error: 'missing_boundary' });
    return;
  }

  const boundary = `--${boundaryKey}`;
  const boundaryBuffer = Buffer.from(boundary);
  const boundaryWithLeadingCrlf = Buffer.from(`\r\n${boundary}`);
  const closingBoundaryWithLeadingCrlf = Buffer.from(`\r\n${boundary}--`);
  const headerSeparator = Buffer.from('\r\n\r\n');
  const CRLF = Buffer.from('\r\n');
  const reserveLength = Math.max(boundaryWithLeadingCrlf.length, closingBoundaryWithLeadingCrlf.length) + 8;

  type UploadState = 'start' | 'headers' | 'field' | 'file' | 'finished';

  let state: UploadState = 'start';
  let buffer = Buffer.alloc(0);
  let currentFieldName: string | null = null;
  let pendingPath: string | undefined;
  let fileName: string | null = null;
  let fileContentType: string | undefined;
  let destinationPath: string | null = null;
  let writeStream: (NodeJS.WritableStream & { destroy?: (error?: Error) => void }) | null = null;
  let totalBytes = 0;
  let uploadResult: { path: string; size: number; contentType: string } | null = null;
  let uploadError: Error | null = null;
  let finished = false;

  const bucket = getBucket();

  const closeWriteStream = async () => {
    if (!writeStream) {
      return;
    }
    const stream = writeStream;
    writeStream = null;
    try {
      stream.end();
      await once(stream, 'finish');
    } catch (streamError) {
      console.error('Failed to finalise upload stream', streamError);
    }
  };

  const abortProcessing = async (status: number, message: string) => {
    if (uploadError) {
      return;
    }
    uploadError = new Error(message);
    if (writeStream) {
      const stream = writeStream;
      writeStream = null;
      if (typeof stream.destroy === 'function') {
        stream.destroy(uploadError);
      } else {
        stream.end();
      }
    }
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    }
  };

  const writeChunk = async (chunk: Buffer) => {
    const stream = writeStream;
    if (!stream || chunk.length === 0) {
      return;
    }
    totalBytes += chunk.length;
    if (totalBytes > MAX_BINARY_FILE_SIZE_BYTES) {
      await abortProcessing(413, 'file_too_large');
      return;
    }
    if (!stream.write(chunk)) {
      await once(stream, 'drain');
    }
  };

  const finaliseFilePart = async () => {
    if (!writeStream || !destinationPath || !fileContentType) {
      return;
    }
    await closeWriteStream();
    uploadResult = {
      path: destinationPath,
      size: totalBytes,
      contentType: fileContentType,
    };
    destinationPath = null;
    fileContentType = undefined;
    fileName = null;
    totalBytes = 0;
  };

  req.on('aborted', () => {
    void abortProcessing(499, 'client_closed_request');
  });

  try {
    for await (const chunk of req) {
      if (uploadError || finished) {
        break;
      }

      buffer = Buffer.concat([buffer, chunk]);

      let loop = true;
      while (loop && !uploadError && !finished) {
        if (state === 'start') {
          if (buffer.length < boundaryBuffer.length + CRLF.length) {
            loop = false;
            continue;
          }
          if (buffer.indexOf(boundaryBuffer) !== 0) {
            await abortProcessing(400, 'invalid_multipart_preamble');
            break;
          }
          buffer = buffer.slice(boundaryBuffer.length);
          if (buffer.slice(0, 2).equals(Buffer.from('--'))) {
            await abortProcessing(400, 'unexpected_end_of_multipart');
            break;
          }
          if (buffer.slice(0, CRLF.length).equals(CRLF)) {
            buffer = buffer.slice(CRLF.length);
          } else {
            await abortProcessing(400, 'invalid_multipart_boundary');
            break;
          }
          state = 'headers';
          continue;
        }

        if (state === 'headers') {
          const headerEndIndex = buffer.indexOf(headerSeparator);
          if (headerEndIndex === -1) {
            loop = false;
            continue;
          }

          const headerSection = buffer.slice(0, headerEndIndex).toString('utf8');
          buffer = buffer.slice(headerEndIndex + headerSeparator.length);

          const dispositionMatch = /name="([^"]+)"/.exec(headerSection);
          const filenameMatch = /filename="([^"]*)"/.exec(headerSection);
          const contentTypeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerSection);

          currentFieldName = dispositionMatch?.[1] ?? null;

          if (filenameMatch && filenameMatch[1]) {
            fileName = filenameMatch[1];
            fileContentType = contentTypeMatch?.[1]?.trim();

            if (!fileName) {
              await abortProcessing(400, 'missing_filename');
              break;
            }

            if (!fileContentType || !isBinaryMimeAllowed(fileContentType)) {
              await abortProcessing(415, 'unsupported_media_type');
              break;
            }

            const safeSubpath = sanitizeStoragePath(pendingPath);
            const segments = ['uploads'];
            if (safeSubpath) {
              segments.push(safeSubpath);
            }
            segments.push(fileName);
            destinationPath = segments.join('/');

            const gcsFile = bucket.file(destinationPath);
            totalBytes = 0;
            const gcsStream = gcsFile.createWriteStream({
              metadata: {
                contentType: fileContentType,
                cacheControl: 'no-store',
              },
              resumable: false,
            });

            writeStream = gcsStream;

            gcsStream.on('error', async (streamError) => {
              console.error('Upload stream error', streamError);
              await abortProcessing(500, 'upload_failed');
            });

            state = 'file';
            continue;
          }

          state = 'field';
          continue;
        }

        if (state === 'field') {
          const boundaryIndex = buffer.indexOf(boundaryWithLeadingCrlf);
          const closingIndex = buffer.indexOf(closingBoundaryWithLeadingCrlf);
          let index = -1;
          let isClosing = false;

          if (boundaryIndex !== -1 && (closingIndex === -1 || boundaryIndex < closingIndex)) {
            index = boundaryIndex;
          } else if (closingIndex !== -1) {
            index = closingIndex;
            isClosing = true;
          } else {
            loop = false;
            continue;
          }

          const valueBuffer = buffer.slice(0, index);
          let trimmed = valueBuffer;
          if (trimmed.length >= CRLF.length && trimmed.slice(-CRLF.length).equals(CRLF)) {
            trimmed = trimmed.slice(0, -CRLF.length);
          }
          const value = trimmed.toString('utf8');

          if (currentFieldName === 'path') {
            pendingPath = value;
          }

          if (isClosing) {
            finished = true;
            buffer = buffer.slice(index + closingBoundaryWithLeadingCrlf.length);
          } else {
            buffer = buffer.slice(index + boundaryWithLeadingCrlf.length);
            if (buffer.slice(0, CRLF.length).equals(CRLF)) {
              buffer = buffer.slice(CRLF.length);
            }
            state = 'headers';
          }

          continue;
        }

        if (state === 'file') {
          const boundaryIndex = buffer.indexOf(boundaryWithLeadingCrlf);
          const closingIndex = buffer.indexOf(closingBoundaryWithLeadingCrlf);
          let index = -1;
          let isClosing = false;

          if (boundaryIndex !== -1 && (closingIndex === -1 || boundaryIndex < closingIndex)) {
            index = boundaryIndex;
          } else if (closingIndex !== -1) {
            index = closingIndex;
            isClosing = true;
          }

          if (index === -1) {
            if (buffer.length > reserveLength) {
              const chunkToWrite = buffer.slice(0, buffer.length - reserveLength);
              buffer = buffer.slice(buffer.length - reserveLength);
              await writeChunk(chunkToWrite);
            } else {
              loop = false;
            }
            continue;
          }

          const dataPortion = buffer.slice(0, index);
          let effectiveData = dataPortion;
          if (effectiveData.length >= CRLF.length && effectiveData.slice(-CRLF.length).equals(CRLF)) {
            effectiveData = effectiveData.slice(0, -CRLF.length);
          }

          await writeChunk(effectiveData);

          buffer = buffer.slice(index + (isClosing ? closingBoundaryWithLeadingCrlf.length : boundaryWithLeadingCrlf.length));
          await finaliseFilePart();

          if (isClosing) {
            finished = true;
          } else {
            if (buffer.slice(0, CRLF.length).equals(CRLF)) {
              buffer = buffer.slice(CRLF.length);
            }
            state = 'headers';
          }

          continue;
        }

        if (state === 'finished') {
          finished = true;
          break;
        }
      }
    }
  } catch (error) {
    console.error('Failed to process multipart upload', error);
    if (!uploadError) {
      await abortProcessing(500, 'upload_failed');
    }
  } finally {
    await closeWriteStream();
  }

  if (uploadError) {
    return;
  }

  if (!uploadResult) {
    res.status(400).json({ error: 'no_file_uploaded' });
    return;
  }

  res.json(uploadResult);
});

apiRouter.get('/files/content/:path(*)', async (req: Request, res: Response) => {
  applyStorageCorsHeaders(res);
  res.setHeader('Cache-Control', 'no-store');

  const pathParam = typeof req.params.path === 'string' ? req.params.path : undefined;
  const decodedPath = pathParam ? decodeURIComponent(pathParam) : undefined;
  const cleanPath = sanitizeStoragePath(decodedPath);

  if (!cleanPath) {
    res.status(400).json({ error: 'invalid_path' });
    return;
  }

  const bucket = getBucket();
  const file = bucket.file(cleanPath);

  try {
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    if (typeof metadata.size === 'string') {
      res.setHeader('Content-Length', metadata.size);
    }

    const readStream = file.createReadStream();
    readStream.on('error', (error: NodeJS.ErrnoException) => {
      console.error('Failed to stream file content', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'download_failed' });
      }
    });

    readStream.pipe(res);
  } catch (error: unknown) {
    const firebaseError = error as { code?: number | string };
    const codeValue = firebaseError?.code;
    if (codeValue === 404 || codeValue === '404') {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    console.error('Failed to load file metadata', error);
    res.status(500).json({ error: 'download_failed' });
  }
});

apiRouter.post('/files/save', (req: Request, res: Response) => {
  applyStorageCorsHeaders(res);
  res.setHeader('Cache-Control', 'no-store');

  const { path, content, contentType } = (req.body ?? {}) as {
    path?: unknown;
    content?: unknown;
    contentType?: unknown;
  };

  if (typeof path !== 'string' || typeof content !== 'string') {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }

  if (!isTextFilePath(path) || (contentType && !isTextContentTypeHeader(contentType))) {
    res.status(415).json({ error: 'binary_not_supported' });
    return;
  }

  res.json({ success: true, message: 'Text save accepted.' });
});

apiRouter.get('/github/tree', requireGithubSecrets, githubNotImplemented);
apiRouter.get('/github/file', requireGithubSecrets, githubNotImplemented);
apiRouter.post('/github/pr', requireGithubSecrets, githubNotImplemented);

app.use('/api', publicRouter);
app.use('/api', apiRouter);

export const api = onRequest({ region: 'us-central1' }, app);

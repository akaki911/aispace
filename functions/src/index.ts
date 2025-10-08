import cors from 'cors';
import express from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { onRequest } from 'firebase-functions/v2/https';

const app = express();

app.use(cors({ origin: true }));
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

export const api = onRequest({ cors: true, region: 'us-central1' }, app);

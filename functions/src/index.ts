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

app.get('/api/version', (_req, res) => {
  res.json({
    name: 'aispace',
    version: appVersion,
    buildTime,
  });
});

app.get('/api/ai/health', (_req, res) => {
  res.json({
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

app.get('/api/github/tree', requireGithubSecrets, githubNotImplemented);
app.get('/api/github/file', requireGithubSecrets, githubNotImplemented);
app.post('/api/github/pr', requireGithubSecrets, githubNotImplemented);

export const api = onRequest({ cors: true }, app);

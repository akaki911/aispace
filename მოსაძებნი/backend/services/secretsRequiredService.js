const secretsVault = require('./secretsVault');
const secretsScanner = require('./secretsScanner');
const secretsSyncQueue = require('./secretsSyncQueue');

const APP_ORDER = ['frontend', 'backend', 'ai-service'];

const INTEGRATION_SCHEMAS = [
  {
    id: 'firebase',
    label: 'Firebase',
    entries: [
      { key: 'VITE_FIREBASE_API_KEY', apps: ['frontend'], description: 'Firebase web API key' },
      { key: 'VITE_FIREBASE_AUTH_DOMAIN', apps: ['frontend'], description: 'Firebase auth domain' },
      { key: 'VITE_FIREBASE_PROJECT_ID', apps: ['frontend'], description: 'Firebase project identifier' },
      { key: 'VITE_FIREBASE_STORAGE_BUCKET', apps: ['frontend'], description: 'Firebase storage bucket' },
      { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', apps: ['frontend'], description: 'Firebase messaging sender ID' },
      { key: 'VITE_FIREBASE_APP_ID', apps: ['frontend'], description: 'Firebase application ID' },
      { key: 'VITE_FIREBASE_MEASUREMENT_ID', apps: ['frontend'], description: 'Firebase measurement ID' },
      { key: 'FIREBASE_SERVICE_ACCOUNT_KEY', apps: ['backend', 'ai-service'], description: 'Firebase admin credentials' },
      { key: 'FIREBASE_PROJECT_ID', apps: ['backend', 'ai-service'], description: 'Firebase project identifier' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    entries: [
      { key: 'GROQ_API_KEY', apps: ['ai-service', 'backend'], description: 'Groq API key' },
    ],
  },
  {
    id: 'internal',
    label: 'Internal services',
    entries: [
      { key: 'AI_INTERNAL_TOKEN', apps: ['backend', 'ai-service'], description: 'Shared auth token between backend and AI service' },
      { key: 'SESSION_SECRET', apps: ['backend'], description: 'Session signing secret' },
      { key: 'AI_SERVICE_URL', apps: ['backend'], description: 'AI service endpoint' },
      { key: 'ADMIN_SETUP_TOKEN', apps: ['backend'], description: 'Bootstrap token for admin setup' },
      { key: 'ALLOWED_BACKEND_IPS', apps: ['ai-service'], description: 'Allowed backend IP ranges' },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    entries: [
      { key: 'GITHUB_TOKEN', apps: ['backend', 'ai-service'], description: 'GitHub personal access token' },
      { key: 'GITHUB_REPO_OWNER', apps: ['backend', 'ai-service'], description: 'Repository owner' },
      { key: 'GITHUB_REPO_NAME', apps: ['backend', 'ai-service'], description: 'Repository name' },
      { key: 'GITHUB_WEBHOOK_SECRET', apps: ['backend', 'ai-service'], description: 'Webhook signature secret' },
    ],
  },
];

const ensureEntry = (registry, key, app) => {
  if (!registry.has(app)) {
    registry.set(app, new Map());
  }
  const byApp = registry.get(app);
  if (!byApp.has(key)) {
    byApp.set(key, {
      key,
      app,
      reasons: [],
      foundIn: [],
    });
  }
  return byApp.get(key);
};

const sortEntries = (entries) => {
  return entries.sort((a, b) => {
    const appOrderDiff = APP_ORDER.indexOf(a.app) - APP_ORDER.indexOf(b.app);
    if (appOrderDiff !== 0) {
      return appOrderDiff;
    }
    return a.key.localeCompare(b.key);
  });
};

async function getRequiredSecrets() {
  const usageIndex = await secretsScanner.getUsageIndex();
  const summaries = secretsVault.getAllSummaries();
  const summaryMap = new Map(summaries.map((item) => [item.key, item]));
  const registry = new Map();

  // Add integration-driven requirements
  for (const schema of INTEGRATION_SCHEMAS) {
    for (const entry of schema.entries) {
      for (const app of entry.apps) {
        const record = ensureEntry(registry, entry.key, app);
        record.reasons.push({
          type: 'integration',
          integrationId: schema.id,
          integrationLabel: schema.label,
          description: entry.description,
        });
      }
    }
  }

  // Add scan-driven requirements
  for (const [key, info] of usageIndex.entries()) {
    const summary = summaryMap.get(key);
    for (const moduleName of info.modules) {
      if (!APP_ORDER.includes(moduleName)) {
        continue;
      }
      const record = ensureEntry(registry, key, moduleName);
      const foundInModule = info.foundIn.filter((location) => {
        if (!location) return false;
        const normalised = location.replace(/\\/g, '/');
        if (moduleName === 'frontend') {
          return normalised.startsWith('src/');
        }
        if (moduleName === 'backend') {
          return normalised.startsWith('backend/');
        }
        if (moduleName === 'ai-service') {
          return normalised.startsWith('ai-service/');
        }
        return false;
      });

      record.reasons.push({
        type: 'scan',
        module: moduleName,
        count: foundInModule.length,
      });
      record.foundIn = Array.from(new Set([...record.foundIn, ...foundInModule])).slice(0, 20);
      if (summary && summary.required && !record.reasons.some((reason) => reason.type === 'integration' && reason.integrationId === 'internal')) {
        record.reasons.push({
          type: 'flag',
          description: 'marked_required',
        });
      }
    }
  }

  const pendingSyncKeys = secretsSyncQueue.list();

  const items = [];
  for (const [app, records] of registry.entries()) {
    for (const [key, entry] of records.entries()) {
      const summary = summaryMap.get(key);
      const hasSecret = Boolean(summary);
      const hasValue = Boolean(summary?.hasValue);
      const status = hasValue ? 'present' : 'missing';

      items.push({
        key,
        app,
        status,
        reasons: entry.reasons,
        foundIn: entry.foundIn,
        hasSecret,
        hasValue,
        required: Boolean(summary?.required),
        pendingSync: pendingSyncKeys.includes(key),
      });
    }
  }

  return {
    items: sortEntries(items),
    pendingSyncKeys,
  };
}

module.exports = {
  getRequiredSecrets,
  INTEGRATION_SCHEMAS,
};

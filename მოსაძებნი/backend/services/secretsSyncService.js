const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const secretsVault = require('./secretsVault');
const { getRequiredSecrets } = require('./secretsRequiredService');
const secretsSyncQueue = require('./secretsSyncQueue');

const REPO_ROOT = path.join(__dirname, '..', '..');

const SERVICE_ENV_PATHS = {
  frontend: path.join(REPO_ROOT, '.env'),
  backend: path.join(REPO_ROOT, 'backend', '.env'),
  'ai-service': path.join(REPO_ROOT, 'ai-service', '.env'),
};

const SYNC_STATE_PATH = path.join(REPO_ROOT, 'backend', 'data', 'secrets_sync_state.json');

const ENV_KEY_REGEX = /^([A-Z0-9_.:-]+)\s*=.*$/;

const createTimestamp = () => {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  return iso;
};

const ensureDirectory = async (targetPath) => {
  const dir = path.dirname(targetPath);
  await fsp.mkdir(dir, { recursive: true });
};

const safeWriteFile = async (filePath, content) => {
  await ensureDirectory(filePath);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await fsp.open(tempPath, 'w', 0o600);
  await handle.writeFile(content, 'utf8');
  await handle.sync();
  await handle.close();
  await fsp.rename(tempPath, filePath);
};

const createBackup = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const timestamp = createTimestamp();
  const backupName = `${path.basename(filePath)}.${timestamp}.bak`;
  const backupPath = path.join(path.dirname(filePath), backupName);
  await ensureDirectory(backupPath);
  await fsp.copyFile(filePath, backupPath);
  return backupPath;
};

const buildEnvContent = (existingContent, entries) => {
  const entryMap = new Map();
  for (const entry of entries) {
    if (!entry || !entry.key) continue;
    entryMap.set(entry.key, entry.value ?? '');
  }

  const lines = existingContent ? existingContent.split(/\r?\n/) : [];
  const seen = new Set();
  const updatedLines = lines.map((line) => {
    const match = line.match(ENV_KEY_REGEX);
    if (!match) {
      return line;
    }
    const key = match[1];
    if (!entryMap.has(key)) {
      return line;
    }
    seen.add(key);
    const value = entryMap.get(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of entryMap.entries()) {
    if (!seen.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  while (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === '') {
    updatedLines.pop();
  }

  const content = updatedLines.join('\n');
  return content.length ? `${content}\n` : '';
};

const writeEnvFile = async (service, entries) => {
  const envPath = SERVICE_ENV_PATHS[service];
  if (!envPath) {
    throw new Error(`Unknown service: ${service}`);
  }

  const uniqueEntries = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || !entry.key) continue;
    if (seen.has(entry.key)) {
      continue;
    }
    seen.add(entry.key);
    uniqueEntries.push(entry);
  }

  const existing = fs.existsSync(envPath) ? await fsp.readFile(envPath, 'utf8') : '';
  const nextContent = buildEnvContent(existing, uniqueEntries);

  const changed = nextContent !== existing;
  let backupPath = null;

  if (changed) {
    backupPath = await createBackup(envPath);
    await safeWriteFile(envPath, nextContent);
  }

  return {
    changed,
    envPath,
    backupPath,
  };
};

const buildServiceEntries = (service, requiredItems, valueMap) => {
  return requiredItems
    .filter((item) => item.app === service)
    .map((item) => {
      const record = valueMap.get(item.key);
      if (!record) {
        return null;
      }
      return {
        key: item.key,
        value: record.hasValue ? record.value : '',
        hasValue: record.hasValue,
      };
    })
    .filter(Boolean);
};

const extractEnvKey = (line) => {
  if (!line) return null;
  const match = line.match(ENV_KEY_REGEX);
  return match ? match[1] : null;
};

const mergeEnvContentPreservingNewKeys = (backupContent, currentContent) => {
  const backupLines = backupContent ? backupContent.split(/\r?\n/) : [];
  const currentLines = currentContent ? currentContent.split(/\r?\n/) : [];

  const seenKeys = new Set();
  const mergedLines = [];

  for (const line of backupLines) {
    const key = extractEnvKey(line);
    if (key) {
      seenKeys.add(key);
    }
    mergedLines.push(line);
  }

  for (const line of currentLines) {
    const key = extractEnvKey(line);
    if (!key) {
      if (line.trim() === '' && mergedLines[mergedLines.length - 1] === '') {
        continue;
      }
      mergedLines.push(line);
      continue;
    }
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    mergedLines.push(line);
  }

  while (mergedLines.length > 0 && mergedLines[mergedLines.length - 1] === '') {
    mergedLines.pop();
  }

  return mergedLines.length ? `${mergedLines.join('\n')}\n` : '';
};

const summariseSyncServices = (servicesResult) => {
  return Object.fromEntries(
    Object.entries(servicesResult).map(([service, info]) => [
      service,
      {
        status: info.status,
        missingCount: info.missingKeys.length,
        updatedCount: info.updatedKeys.length,
        changed: Boolean(info.changed),
      },
    ]),
  );
};

const summariseRollbackServices = (results) => {
  return Object.fromEntries(
    Object.entries(results).map(([service, info]) => [
      service,
      {
        restored: Boolean(info.restored),
        status: info.restored ? 'restored' : info.reason || 'skipped',
      },
    ]),
  );
};

const computeOverallStatus = (servicesSummary, requiredMissing, action = 'sync') => {
  if (action === 'rollback') {
    return 'rollback';
  }
  const hasDegradedService = Object.values(servicesSummary || {}).some((entry) => entry.status !== 'ok');
  return requiredMissing === 0 && !hasDegradedService ? 'ok' : 'degraded';
};

const persistSyncState = async (snapshot) => {
  const safeSnapshot = {
    action: snapshot.action,
    timestamp: snapshot.timestamp,
    services: snapshot.services,
    queueLength: snapshot.queueLength,
    requiredMissing: snapshot.requiredMissing,
    pendingSyncCount: snapshot.pendingSyncCount,
    lastStatus: snapshot.lastStatus,
  };

  await ensureDirectory(SYNC_STATE_PATH);
  await fsp.writeFile(SYNC_STATE_PATH, `${JSON.stringify(safeSnapshot, null, 2)}\n`, 'utf8');
  return safeSnapshot;
};

const readSyncState = async () => {
  try {
    const payload = await fsp.readFile(SYNC_STATE_PATH, 'utf8');
    if (!payload.trim()) {
      return null;
    }
    return JSON.parse(payload);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.warn('⚠️ [SecretsSync] Failed to read sync state:', error.message);
    return null;
  }
};

async function syncEnvFiles() {
  const required = await getRequiredSecrets();
  const exported = secretsVault.exportForSync();
  const valueMap = new Map(exported.map((item) => [item.key, item]));
  const servicesResult = {};
  const syncedKeys = new Set();

  for (const service of Object.keys(SERVICE_ENV_PATHS)) {
    const entries = buildServiceEntries(service, required.items, valueMap);
    const writeResult = await writeEnvFile(service, entries);
    entries.forEach((entry) => syncedKeys.add(entry.key));

    const missingKeys = required.items
      .filter((item) => item.app === service && item.status === 'missing')
      .map((item) => item.key);

    servicesResult[service] = {
      status: missingKeys.length ? 'degraded' : 'ok',
      missingKeys,
      updatedKeys: entries.map((entry) => entry.key),
      envPath: writeResult.envPath,
      changed: writeResult.changed,
      backupPath: writeResult.backupPath,
    };
  }

  await secretsSyncQueue.remove(Array.from(syncedKeys));

  const pendingSyncKeys = secretsSyncQueue.list();
  const timestamp = new Date().toISOString();
  const servicesSummary = summariseSyncServices(servicesResult);
  const requiredMissingCount = required.items.filter((item) => item.status === 'missing').length;

  await persistSyncState({
    action: 'sync',
    timestamp,
    services: servicesSummary,
    queueLength: pendingSyncKeys.length,
    pendingSyncCount: pendingSyncKeys.length,
    requiredMissing: requiredMissingCount,
    lastStatus: computeOverallStatus(servicesSummary, requiredMissingCount, 'sync'),
  });

  return {
    services: servicesResult,
    pendingSyncKeys,
    timestamp,
  };
}

const findLatestBackup = async (service) => {
  const envPath = SERVICE_ENV_PATHS[service];
  if (!envPath) {
    throw new Error(`Unknown service: ${service}`);
  }

  const dir = path.dirname(envPath);
  let entries;
  try {
    entries = await fsp.readdir(dir);
  } catch (error) {
    return null;
  }

  const baseName = path.basename(envPath);
  const backups = entries
    .filter((file) => file.startsWith(`${baseName}.`) && file.endsWith('.bak'))
    .sort()
    .reverse();

  if (!backups.length) {
    return null;
  }

  return path.join(dir, backups[0]);
};

async function rollbackEnvFiles() {
  const results = {};

  for (const service of Object.keys(SERVICE_ENV_PATHS)) {
    const backupPath = await findLatestBackup(service);
    const envPath = SERVICE_ENV_PATHS[service];
    if (!backupPath) {
      results[service] = { restored: false, reason: 'no_backup' };
      continue;
    }

    const backupContent = await fsp.readFile(backupPath, 'utf8');
    const currentContent = fs.existsSync(envPath) ? await fsp.readFile(envPath, 'utf8') : '';
    const mergedContent = mergeEnvContentPreservingNewKeys(backupContent, currentContent);
    await safeWriteFile(envPath, mergedContent);
    results[service] = { restored: true, backupPath };
  }

  const timestamp = new Date().toISOString();
  const required = await getRequiredSecrets();
  const queueLength = secretsSyncQueue.list().length;
  const servicesSummary = summariseRollbackServices(results);
  const requiredMissingCount = required.items.filter((item) => item.status === 'missing').length;

  await persistSyncState({
    action: 'rollback',
    timestamp,
    services: servicesSummary,
    queueLength,
    pendingSyncCount: queueLength,
    requiredMissing: requiredMissingCount,
    lastStatus: computeOverallStatus(servicesSummary, requiredMissingCount, 'rollback'),
  });

  return {
    services: results,
    timestamp,
  };
}

async function getSecretsTelemetry() {
  const required = await getRequiredSecrets();
  const totalSecrets = secretsVault.getAllSummaries().length;
  const missingCount = required.items.filter((item) => item.status === 'missing').length;
  const pendingSyncKeys = Array.isArray(required.pendingSyncKeys) ? required.pendingSyncKeys : [];
  const queueLength = secretsSyncQueue.list().length;
  const state = await readSyncState();

  const lastStatusFallback = missingCount === 0 ? 'ok' : 'degraded';

  return {
    totals: {
      secrets: totalSecrets,
      requiredMissing: missingCount,
    },
    sync: {
      lastStatus: state?.lastStatus || lastStatusFallback,
      lastAction: state?.action || null,
      lastCompletedAt: state?.timestamp || null,
      queueLength,
      pendingKeys: pendingSyncKeys.length,
    },
    services: state?.services || {},
    observedAt: new Date().toISOString(),
  };
}

module.exports = {
  syncEnvFiles,
  rollbackEnvFiles,
  getSecretsTelemetry,
  SERVICE_ENV_PATHS,
};

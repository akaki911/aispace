const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { logWithCorrelation } = require('../middleware/correlation_middleware');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'auto_improve_event_store.json');
const CHECKPOINT_DIR = path.join(DATA_DIR, 'auto_improve_checkpoints');
const AUDIT_FILE = path.join(DATA_DIR, 'auto_improve_audit.log');

const MAX_EVENTS = 5000;
const MAX_AUDIT_ENTRIES = 2000;

let inMemoryState = {
  lastId: 0,
  events: [],
  audit: []
};

const ensureDirectory = async (targetPath) => {
  const dir = path.dirname(targetPath);
  await fsp.mkdir(dir, { recursive: true });
};

const persistState = async () => {
  await ensureDirectory(STATE_FILE);
  const serialisable = {
    lastId: inMemoryState.lastId,
    events: inMemoryState.events,
    audit: inMemoryState.audit
  };
  await fsp.writeFile(STATE_FILE, JSON.stringify(serialisable, null, 2), 'utf8');
};

const loadState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      inMemoryState = {
        lastId: Number.isFinite(parsed?.lastId) ? parsed.lastId : 0,
        events: Array.isArray(parsed?.events) ? parsed.events : [],
        audit: Array.isArray(parsed?.audit) ? parsed.audit : []
      };
    }
  } catch (error) {
    console.warn('⚠️ [AutoImproveStore] Failed to load persisted state:', error.message);
  }
};

loadState();

const redactSensitiveValue = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const patterns = [
    /(sk|pk|rk|ak|gcp|aws|azure|ya)-[0-9A-Za-z\-_=]{10,}/gi,
    /Bearer\s+[0-9A-Za-z\-_.]+/gi,
    /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    /"(token|cookie|session|secret)"\s*:\s*"[^"]+"/gi
  ];

  let sanitized = value;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
};

const recursivelyRedact = (input) => {
  if (input == null) {
    return input;
  }
  if (typeof input === 'string') {
    return redactSensitiveValue(input);
  }
  if (Array.isArray(input)) {
    return input.map(recursivelyRedact);
  }
  if (typeof input === 'object') {
    return Object.entries(input).reduce((acc, [key, value]) => {
      acc[key] = recursivelyRedact(value);
      return acc;
    }, {});
  }
  return input;
};

const clampEvents = () => {
  if (inMemoryState.events.length > MAX_EVENTS) {
    inMemoryState.events = inMemoryState.events.slice(-MAX_EVENTS);
  }
  if (inMemoryState.audit.length > MAX_AUDIT_ENTRIES) {
    inMemoryState.audit = inMemoryState.audit.slice(-MAX_AUDIT_ENTRIES);
  }
};

const generateEventId = () => {
  const entropy = crypto.randomBytes(4).toString('hex');
  const id = `evt-${Date.now()}-${inMemoryState.lastId + 1}-${entropy}`;
  inMemoryState.lastId += 1;
  return id;
};

const normaliseEvent = (event) => {
  const timestamp = event.timestamp || new Date().toISOString();
  const correlationId = event.correlationId || `be-${crypto.randomBytes(6).toString('hex')}`;
  const payload = recursivelyRedact(event.payload ?? event);

  return {
    id: event.id || generateEventId(),
    runId: event.runId || null,
    checkpointId: event.checkpointId || null,
    type: event.type || 'message',
    message: redactSensitiveValue(event.message || ''),
    risk: event.risk || 'LOW',
    correlationId,
    timestamp,
    latencyMs: event.latencyMs || null,
    diffUrl: event.diffUrl || null,
    payload
  };
};

const recordEvent = async (event) => {
  const normalised = normaliseEvent(event);
  inMemoryState.events.push(normalised);
  clampEvents();
  await persistState();
  return normalised;
};

const getEventsSince = (lastEventId = null, sinceIso = null) => {
  if (!lastEventId && !sinceIso) {
    return [...inMemoryState.events];
  }

  let startIndex = 0;
  if (lastEventId) {
    const index = inMemoryState.events.findIndex((item) => item.id === lastEventId);
    if (index !== -1) {
      startIndex = index + 1;
    }
  }

  let filtered = inMemoryState.events.slice(startIndex);

  if (sinceIso) {
    const sinceTs = Date.parse(sinceIso);
    if (!Number.isNaN(sinceTs)) {
      filtered = filtered.filter((event) => Date.parse(event.timestamp) >= sinceTs);
    }
  }

  return filtered;
};

const ensureCheckpointsDir = async () => {
  await fsp.mkdir(CHECKPOINT_DIR, { recursive: true });
};

const writeAuditEntry = async (entry) => {
  const auditEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };
  inMemoryState.audit.push(auditEntry);
  clampEvents();
  await persistState();
  await ensureDirectory(AUDIT_FILE);
  await fsp.appendFile(AUDIT_FILE, `${JSON.stringify(auditEntry)}\n`, 'utf8');
  return auditEntry;
};

const createCheckpoint = async (runId, snapshot = {}, context = {}) => {
  await ensureCheckpointsDir();
  const checkpointId = context.checkpointId || `chk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const fileName = `${checkpointId}.json`;
  const filePath = path.join(CHECKPOINT_DIR, fileName);
  const payload = recursivelyRedact({
    runId,
    snapshot,
    context
  });
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  await writeAuditEntry({
    action: 'checkpoint.created',
    runId,
    checkpointId,
    actor: context.actor || null,
    reason: context.reason || 'auto',
    diffUrl: context.diffUrl || null
  });
  return {
    checkpointId,
    filePath
  };
};

const recordControlAction = async (action, { runId = null, checkpointId = null, actor = null, notes = null } = {}) => {
  return writeAuditEntry({
    action: `control.${action}`,
    runId,
    checkpointId,
    actor,
    notes
  });
};

const getLatestCheckpointForRun = async (runId) => {
  const entries = [...inMemoryState.audit]
    .filter((entry) => entry.action === 'checkpoint.created' && entry.runId === runId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (entries.length === 0) {
    return null;
  }
  const checkpointId = entries[0].checkpointId;
  const filePath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return {
      checkpointId,
      payload: JSON.parse(raw)
    };
  } catch (error) {
    return {
      checkpointId,
      payload: null,
      error: error.message
    };
  }
};

const appendAndSendEvent = async (req, res, event, sendFn) => {
  try {
    const stored = await recordEvent({
      ...event,
      correlationId: event.correlationId || req?.correlationId,
      payload: event.payload
    });
    sendFn(stored);
    return stored;
  } catch (error) {
    logWithCorrelation(req, 'error', 'autoImprove.store', 'Failed to persist event', {
      error: error.message
    });
    sendFn(event);
    return event;
  }
};

module.exports = {
  recordEvent,
  getEventsSince,
  createCheckpoint,
  recordControlAction,
  getLatestCheckpointForRun,
  appendAndSendEvent,
  recursivelyRedact
};

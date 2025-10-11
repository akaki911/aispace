const { randomUUID } = require('crypto');

const MAX_RUN_HISTORY = 50;
const MAX_EVENTS_PER_RUN = 500;

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /authorization/i,
  /cookie/i,
  /token/i,
  /secret/i,
  /password/i,
  /email/i,
  /phone/i,
  /session/i
];

const SENSITIVE_VALUE_PATTERNS = [
  /(sk|pk|rk|lk)-[a-z0-9]{12,}/i,
  /bearer\s+[a-z0-9._\-+/=]{16,}/i,
  /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.?[A-Za-z0-9._-]*/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b\d{9,}\b/
];

const runs = new Map();
const runOrder = [];
const globalClients = new Set();
const runSpecificClients = new Map();

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '"[unserializable]"';
  }
};

const maskString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  let masked = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    masked = masked.replace(pattern, '***');
  }

  if (masked.length > 1200) {
    return `${masked.slice(0, 1100)}… (+${masked.length - 1100} chars)`;
  }

  return masked;
};

const sanitizeValue = (value, depth = 0) => {
  if (depth > 6) {
    return '***';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return maskString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitized = {};
    const entries = Object.entries(value).slice(0, 50);

    for (const [key, entryValue] of entries) {
      const shouldMaskKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      sanitized[key] = shouldMaskKey ? '***' : sanitizeValue(entryValue, depth + 1);
    }

    return sanitized;
  }

  return String(value);
};

const sanitizePayload = (payload) => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return maskString(payload);
  }

  return sanitizeValue(payload, 0);
};

const trimRuns = () => {
  while (runOrder.length > MAX_RUN_HISTORY) {
    const oldest = runOrder.pop();
    if (oldest) {
      runs.delete(oldest);
      runSpecificClients.delete(oldest);
    }
  }
};

const ensureRun = (runId, defaults = {}) => {
  if (runs.has(runId)) {
    return runs.get(runId);
  }

  const run = {
    runId,
    status: defaults.status || 'running',
    goal: defaults.goal || null,
    actor: defaults.actor || null,
    source: defaults.source || 'unknown',
    metadata: sanitizePayload(defaults.metadata || defaults.inputs || {}),
    startedAt: defaults.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [],
    summary: null,
    completedAt: null,
    metrics: undefined
  };

  runs.set(runId, run);
  runOrder.unshift(runId);
  trimRuns();
  return run;
};

const sendEvent = (res, eventName, payload) => {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${safeStringify(payload)}\n\n`);
  } catch (error) {
    // The client likely disconnected; ignore write errors.
  }
};

const broadcast = (eventName, payload, runId = null) => {
  for (const client of Array.from(globalClients)) {
    sendEvent(client.res, eventName, payload);
  }

  if (runId && runSpecificClients.has(runId)) {
    for (const client of Array.from(runSpecificClients.get(runId))) {
      sendEvent(client.res, eventName, payload);
    }
  }
};

const registerClient = (res, runId = null) => {
  const clientEntry = { res, runId };
  const targetSet = runId ? (runSpecificClients.get(runId) || new Set()) : globalClients;

  if (runId && !runSpecificClients.has(runId)) {
    runSpecificClients.set(runId, targetSet);
  }

  targetSet.add(clientEntry);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeat);
    targetSet.delete(clientEntry);
    res.end();
  });

  res.on('error', () => {
    clearInterval(heartbeat);
    targetSet.delete(clientEntry);
  });

  const initialRuns = runId ? runs.get(runId) ? [runs.get(runId)] : [] : getRecentRuns(MAX_RUN_HISTORY);
  sendEvent(res, 'trace_snapshot', { runs: initialRuns });
};

const startTraceRun = (input = {}) => {
  const runId = input.runId || `run_${randomUUID()}`;
  const run = ensureRun(runId, input);
  broadcast('trace_run', { run });
  return run;
};

const appendTraceEvent = (runId, eventInput = {}) => {
  const run = ensureRun(runId, eventInput);
  const event = {
    id: eventInput.id || `event_${randomUUID()}`,
    runId,
    type: eventInput.type || 'THOUGHT',
    level: eventInput.level || 'info',
    message: eventInput.message || null,
    tool: eventInput.tool || null,
    status: eventInput.status || null,
    metadata: sanitizePayload(eventInput.metadata || eventInput.payload || {}),
    timestamp: eventInput.timestamp || new Date().toISOString()
  };

  run.events.unshift(event);
  if (run.events.length > MAX_EVENTS_PER_RUN) {
    run.events.length = MAX_EVENTS_PER_RUN;
  }
  run.updatedAt = new Date().toISOString();

  broadcast('trace_event', { runId, event });
  return event;
};

const completeTraceRun = (runId, finalInput = {}) => {
  const run = ensureRun(runId, finalInput);
  run.status = finalInput.status || run.status || 'completed';
  run.summary = finalInput.summary ? maskString(String(finalInput.summary)) : run.summary;
  run.completedAt = finalInput.completedAt || new Date().toISOString();
  run.metrics = finalInput.metrics ? sanitizePayload(finalInput.metrics) : run.metrics;
  run.updatedAt = new Date().toISOString();
  broadcast('trace_run', { run });
  return run;
};

const getRecentRuns = (limit = MAX_RUN_HISTORY) => {
  return runOrder.slice(0, limit).map((id) => {
    const run = runs.get(id);
    if (!run) {
      return null;
    }
    return JSON.parse(JSON.stringify(run));
  }).filter(Boolean);
};

const getRun = (runId) => {
  const run = runs.get(runId);
  if (!run) {
    return null;
  }
  return JSON.parse(JSON.stringify(run));
};

module.exports = {
  startTraceRun,
  appendTraceEvent,
  completeTraceRun,
  registerClient,
  getRecentRuns,
  getRun,
  sanitizePayload
};

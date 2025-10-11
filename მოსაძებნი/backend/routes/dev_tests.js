const express = require('express');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { spawn } = require('child_process');
const crypto = require('crypto');
const EventEmitter = require('events');
const { requireSuperAdmin } = require('../middleware/admin_guards');

const rawSuperAdminAllowList =
  process.env.AI_AUTHORIZED_PERSONAL_IDS || process.env.ADMIN_ALLOWED_PERSONAL_ID || '';

const ALLOWED_SUPER_ADMIN_IDS = rawSuperAdminAllowList
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const isAllowListActive = ALLOWED_SUPER_ADMIN_IDS.length > 0;

const router = express.Router();
const readFile = promisify(fs.readFile);
const access = promisify(fs.access);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_LOG_LINES = 2000;

router.use(requireSuperAdmin);
router.use((req, res, next) => {
  const candidate = req.session?.user || req.user;
  const candidateIds = [candidate?.personalId, candidate?.id, candidate?.uid]
    .map((value) => (typeof value === 'string' ? value.trim() : null))
    .filter(Boolean);

  if (!isAllowListActive) {
    return next();
  }

  if (candidateIds.some((id) => ALLOWED_SUPER_ADMIN_IDS.includes(id))) {
    return next();
  }

  console.warn('❌ [DEV_TESTS] Super admin personal ID check failed', {
    candidateIds,
  });
  return res.status(403).json({ success: false, error: 'SUPER_ADMIN personal access required' });
});
router.use(express.json({ limit: '1mb' }));

const activeRuns = new Map();

const resolveProjectRoot = () => {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '..', '..'),
  ];

  for (const candidate of candidates) {
    try {
      const packagePath = path.join(candidate, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const scripts = packageJson?.scripts || {};

      if (
        typeof scripts === 'object' &&
        (typeof scripts['dev:backend'] === 'string' || typeof scripts['dev:frontend'] === 'string')
      ) {
        return candidate;
      }
    } catch (error) {
      // Continue searching other candidates
    }
  }

  return path.resolve(__dirname, '..', '..');
};

const PROJECT_ROOT = resolveProjectRoot();

const getRootPath = (...segments) => path.resolve(PROJECT_ROOT, ...segments);

const safeReadJson = async (filePath) => {
  try {
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
};

const hasDependency = (pkgJson, dependency) => {
  if (!pkgJson) {
    return false;
  }
  const { dependencies = {}, devDependencies = {} } = pkgJson;
  return Boolean(dependencies[dependency] || devDependencies[dependency]);
};

const isTsxAvailable = async () => {
  const tsxBinary = getRootPath('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  try {
    await access(tsxBinary, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
};

const walkTestFiles = async (startDir, matcher) => {
  const results = [];
  const queue = [startDir];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    let stat;
    try {
      stat = await fs.promises.stat(current);
    } catch (error) {
      continue;
    }

    if (stat.isDirectory()) {
      const baseName = path.basename(current);
      if (baseName === 'node_modules' || baseName.startsWith('.')) {
        continue;
      }
      const entries = await fs.promises.readdir(current);
      entries.forEach((entry) => queue.push(path.join(current, entry)));
    } else if (stat.isFile()) {
      if (matcher(current)) {
        results.push(current);
      }
    }
  }

  return results;
};

const normaliseTestItem = (
  type,
  sourceId,
  label,
  pathOrScript,
  detail,
  overrides = {},
) => ({
  id: `${type}:${sourceId}`,
  type,
  label,
  pathOrScript,
  detail: detail ?? pathOrScript,
  runnable: type !== 'legacy',
  ...overrides,
});

const buildCompositeItems = ({
  npmScripts = [],
  nodeTests = [],
  cypressTests = [],
  legacyTests = [],
}) => [...npmScripts, ...nodeTests, ...cypressTests, ...legacyTests];

const loadTests = async () => {
  const repoPackage = await safeReadJson(getRootPath('package.json'));
  const npmScripts = Object.entries(repoPackage?.scripts ?? {})
    .filter(([key]) => key.startsWith('test'))
    .map(([key, value]) =>
      normaliseTestItem('npm', key, key, key, typeof value === 'string' ? value : undefined),
    );

  const backendTestsDir = getRootPath('backend', '__tests__');
  const frontendTestsRoot = getRootPath('src');
  const testMatcher = (filePath) => /__tests__\/.+\.test\.(?:[jt]s|tsx)$/.test(filePath.replace(/\\/g, '/'));

  const nodeTests = [];
  const legacyTests = [];
  const seenNodePaths = new Set();
  const addNodeTest = (relativePath, label) => {
    const normalisedPath = relativePath.replace(/\\/g, '/');
    if (seenNodePaths.has(normalisedPath)) {
      return;
    }
    seenNodePaths.add(normalisedPath);
    nodeTests.push(
      normaliseTestItem(
        'node',
        normalisedPath,
        label ?? path.basename(normalisedPath),
        normalisedPath,
        normalisedPath,
      ),
    );
  };

  const addLegacyTest = (relativePath, label, reason, detail) => {
    const normalisedPath = relativePath.replace(/\\/g, '/');
    legacyTests.push(
      normaliseTestItem(
        'legacy',
        normalisedPath,
        label ?? path.basename(normalisedPath),
        normalisedPath,
        normalisedPath,
        {
          runnable: false,
          outdated: true,
          outdatedReason: reason,
          outdatedDetail: detail ?? null,
        },
      ),
    );
  };

  const backendFiles = await walkTestFiles(backendTestsDir, testMatcher).catch(() => []);
  const frontendFiles = await walkTestFiles(frontendTestsRoot, testMatcher).catch(() => []);

  const allFiles = [...backendFiles, ...frontendFiles];
  allFiles.sort();
  for (const absolutePath of allFiles) {
    const relative = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    addNodeTest(relative, path.basename(relative));
  }

  const testsRoot = getRootPath('tests');
  const hasTestsRoot = await fs.promises
    .stat(testsRoot)
    .then((stat) => stat.isDirectory())
    .catch(() => false);

  if (hasTestsRoot) {
    const testsMatcher = (filePath) => /\.(?:test|spec)\.(?:[jt]sx?)$/i.test(filePath.replace(/\\/g, '/'));
    const testFiles = await walkTestFiles(testsRoot, testsMatcher).catch(() => []);
    testFiles.sort();
    for (const absolutePath of testFiles) {
      const relative = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
      addNodeTest(relative, path.basename(relative));
    }
  }

  const rootEntries = await fs.promises
    .readdir(getRootPath(), { withFileTypes: true })
    .catch(() => []);
  const runnableExtensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx']);
  const testFilePrefixPattern = /^test[-_].+/i;
  for (const entry of rootEntries) {
    if (!entry.isFile() || !testFilePrefixPattern.test(entry.name)) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (runnableExtensions.has(extension)) {
      addNodeTest(entry.name, entry.name);
    } else {
      const reason = extension === '.md' || extension === '.txt' ? 'documentation' : 'unsupported-extension';
      addLegacyTest(entry.name, entry.name, reason, extension);
    }
  }

  const scriptsDir = getRootPath('scripts');
  const scriptEntries = await fs.promises
    .readdir(scriptsDir, { withFileTypes: true })
    .catch(() => []);
  for (const entry of scriptEntries) {
    if (!entry.isFile() || !testFilePrefixPattern.test(entry.name)) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    const relative = path.join('scripts', entry.name).replace(/\\/g, '/');
    if (runnableExtensions.has(extension)) {
      addNodeTest(relative, entry.name);
    } else {
      const reason = extension === '.md' || extension === '.txt' ? 'documentation' : 'unsupported-extension';
      addLegacyTest(relative, entry.name, reason, extension);
    }
  }

  nodeTests.sort((a, b) => a.pathOrScript.localeCompare(b.pathOrScript));
  legacyTests.sort((a, b) => a.pathOrScript.localeCompare(b.pathOrScript));

  const cypressRoot = getRootPath('cypress', 'e2e');
  const cypressMatcher = (filePath) => /\.cy\.(?:[jt]s)$/.test(filePath);
  const hasCypressDir = await fs.promises
    .stat(getRootPath('cypress'))
    .then((stat) => stat.isDirectory())
    .catch(() => false);

  const cypressTests = hasCypressDir
    ? (await walkTestFiles(cypressRoot, cypressMatcher).catch(() => [])).map((absolutePath) => {
        const relative = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
        const label = path.basename(relative).replace(/\.cy\.[jt]s$/, '').replace(/[-_]/g, ' ');
        return normaliseTestItem('cypress', relative, label, relative, relative);
      })
    : [];

  const hasCypressPackage = hasDependency(repoPackage, 'cypress');

  const payload = {
    npmScripts,
    nodeTests,
    cypressTests,
    legacyTests,
    hasCypress: hasCypressDir || hasCypressPackage,
    tsxAvailable: await isTsxAvailable(),
    activeRun: (() => {
      for (const [runId, run] of activeRuns.entries()) {
        if (run.status === 'running') {
          return {
            runId,
            id: run.test.id,
            type: run.test.type,
            label: run.test.label,
            pathOrScript: run.test.pathOrScript,
            startedAt: run.startedAt,
          };
        }
      }
      return null;
    })(),
  };

  return {
    ...payload,
    items: buildCompositeItems(payload),
    summary: {
      totalFiles:
        payload.npmScripts.length +
        payload.nodeTests.length +
        payload.cypressTests.length +
        payload.legacyTests.length,
      runnable:
        payload.npmScripts.length + payload.nodeTests.length + payload.cypressTests.length,
      legacy: payload.legacyTests.length,
      npm: payload.npmScripts.length,
      node: payload.nodeTests.length,
      cypress: payload.cypressTests.length,
    },
  };
};

router.get('/', async (req, res) => {
  const logStatus = (status, meta = {}) => {
    console.log(`🧪 [DEV_TESTS] tests:list status=${status}`, meta);
  };

  try {
    const payload = await loadTests();
    const total = payload.items.length;
    const status = total > 0 ? 'ok' : 'empty';
    logStatus(status, { total, hasCypress: payload?.hasCypress });
    res.status(200).json({ success: true, status, ...payload });
  } catch (error) {
    console.error('❌ [DEV_TESTS] Failed to load test list', error);
    const fallback = {
      npmScripts: [],
      nodeTests: [],
      cypressTests: [],
      legacyTests: [],
      hasCypress: false,
      tsxAvailable: false,
      activeRun: null,
      items: [],
      summary: {
        totalFiles: 0,
        runnable: 0,
        legacy: 0,
        npm: 0,
        node: 0,
        cypress: 0,
      },
    };
    try {
      fallback.tsxAvailable = await isTsxAvailable();
    } catch (tsxError) {
      console.warn('⚠️ [DEV_TESTS] Unable to determine tsx availability', tsxError);
    }
    logStatus('error', {
      error: error instanceof Error ? error.message : String(error ?? 'unknown'),
    });
    res.status(200).json({
      success: false,
      status: 'error',
      message: 'Service warming up — tests will appear shortly.',
      ...fallback,
    });
  }
});

const appendLog = (run, chunk) => {
  const text = chunk.toString();
  const timestamp = Date.now();
  const lines = text.split(/\r?\n/);
  run.logLines.push(...lines);
  if (run.logLines.length > MAX_LOG_LINES) {
    run.logLines.splice(0, run.logLines.length - MAX_LOG_LINES);
  }
  run.emitter.emit('chunk', { text, timestamp });
  run.lastActivity = timestamp;
  if (run.idleTimer) {
    clearTimeout(run.idleTimer);
  }
  run.idleTimer = setTimeout(() => {
    if (run.status === 'running') {
      run.child.kill('SIGTERM');
      setTimeout(() => run.child.kill('SIGKILL'), 2000);
      run.status = 'failed';
      run.exitCode = null;
      run.emitter.emit('status', { status: 'failed', code: null, reason: 'idle-timeout' });
      scheduleCleanup(run.runId);
    }
  }, IDLE_TIMEOUT_MS);
};

const scheduleCleanup = (runId) => {
  const run = activeRuns.get(runId);
  if (!run) {
    return;
  }
  if (run.cleanupTimer) {
    clearTimeout(run.cleanupTimer);
  }
  run.cleanupTimer = setTimeout(() => {
    if (run.child && !run.child.killed) {
      try {
        run.child.kill('SIGTERM');
      } catch (error) {
        // ignore
      }
    }
    activeRuns.delete(runId);
  }, 2 * 60 * 1000);
};

const ensureNoActiveRun = () => {
  for (const run of activeRuns.values()) {
    if (run.status === 'running') {
      return run;
    }
  }
  return null;
};

const resolveCommand = async (type, pathOrScript) => {
  if (type === 'npm') {
    return {
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', pathOrScript],
    };
  }

  if (type === 'node') {
    const isTsFile = /\.(ts|tsx)$/.test(pathOrScript);
    if (isTsFile) {
      if (await isTsxAvailable()) {
        return {
          command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
          args: ['tsx', '--test', pathOrScript],
        };
      }
      const error = new Error('TypeScript test runner not available. Install "tsx" to execute TypeScript node:test files.');
      error.code = 'TSX_MISSING';
      throw error;
    }

    return {
      command: process.execPath,
      args: ['--test', pathOrScript],
    };
  }

  if (type === 'cypress') {
    return {
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['cypress', 'run', '--spec', pathOrScript],
    };
  }

  throw new Error(`Unsupported test type: ${type}`);
};

const respondRunFailure = (res, statusCode, payload) => {
  const response = {
    success: false,
    status: 'failed',
    ...payload,
  };
  if (statusCode >= 500) {
    statusCode = 200;
  }
  return res.status(statusCode).json(response);
};

router.post('/run', async (req, res) => {
  const { id, type, pathOrScript, label } = req.body ?? {};

  if (!id || !type || !pathOrScript) {
    return respondRunFailure(res, 400, { error: 'Invalid request payload' });
  }

  const active = ensureNoActiveRun();
  if (active && active.status === 'running') {
    return respondRunFailure(res, 409, {
      error: 'Another test is already running',
      activeRunId: active.runId,
    });
  }

  const runId = crypto.randomUUID();

  let command;
  try {
    command = await resolveCommand(type, pathOrScript);
  } catch (error) {
    if (error.code === 'TSX_MISSING') {
      return respondRunFailure(res, 400, { error: error.message, needsTsx: true });
    }
    console.error('❌ [DEV_TESTS] Failed to resolve command', error);
    return respondRunFailure(res, 500, { error: 'Failed to prepare test command' });
  }

  const child = spawn(command.command, command.args, {
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const runContext = {
    runId,
    test: { id, type, label: label || id.split(':').slice(-1)[0], pathOrScript },
    child,
    status: 'running',
    exitCode: null,
    startedAt: Date.now(),
    lastActivity: Date.now(),
    emitter: new EventEmitter(),
    logLines: [],
    idleTimer: null,
    cleanupTimer: null,
  };

  activeRuns.set(runId, runContext);

  child.stdout.on('data', (chunk) => appendLog(runContext, chunk));
  child.stderr.on('data', (chunk) => appendLog(runContext, chunk));

  child.on('exit', (code) => {
    runContext.status = code === 0 ? 'passed' : 'failed';
    runContext.exitCode = code;
    if (runContext.idleTimer) {
      clearTimeout(runContext.idleTimer);
      runContext.idleTimer = null;
    }
    runContext.emitter.emit('status', { status: runContext.status, code });
    scheduleCleanup(runId);
  });

  child.on('error', (error) => {
    console.error('❌ [DEV_TESTS] Child process error', error);
    runContext.status = 'failed';
    runContext.emitter.emit('status', { status: 'failed', code: null });
    scheduleCleanup(runId);
  });

  res.status(200).json({ success: true, status: 'running', runId });
});

router.get('/run/stream/:runId', (req, res) => {
  const { runId } = req.params;
  const run = activeRuns.get(runId);

  if (!run) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write('event: status\n');
    res.write(`data: ${JSON.stringify({ status: 'failed', code: null, reason: 'not-found' })}\n\n`);
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('bootstrap', {
    status: run.status,
    runId,
    startedAt: run.startedAt,
    logLines: run.logLines,
    exitCode: run.exitCode,
  });

  const handleChunk = (payload) => {
    sendEvent('chunk', payload);
  };

  const handleStatus = (payload) => {
    sendEvent('status', payload);
  };

  run.emitter.on('chunk', handleChunk);
  run.emitter.on('status', handleStatus);

  req.on('close', () => {
    run.emitter.off('chunk', handleChunk);
    run.emitter.off('status', handleStatus);
    res.end();
  });
});

router.delete('/run/:runId', (req, res) => {
  const { runId } = req.params;
  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({ success: false, error: 'Run not found' });
  }

  if (run.status !== 'running') {
    scheduleCleanup(runId);
    return res.json({ success: true, status: run.status, alreadyFinished: true });
  }

  try {
    run.child.kill('SIGTERM');
    setTimeout(() => run.child.kill('SIGKILL'), 2000);
    run.status = 'failed';
    run.emitter.emit('status', { status: 'failed', code: null, reason: 'terminated' });
    scheduleCleanup(runId);
    return res.json({ success: true, status: 'terminated' });
  } catch (error) {
    console.error('❌ [DEV_TESTS] Failed to terminate run', error);
    return res.status(500).json({ success: false, error: 'Failed to terminate run' });
  }
});

const allowedLocations = {
  node: [
    getRootPath('src', '__tests__'),
    getRootPath('backend', '__tests__'),
  ],
  cypress: [getRootPath('cypress', 'e2e')],
};

const sanitizeName = (name) => {
  if (typeof name !== 'string') {
    return '';
  }
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s_-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
};

router.post('/new', async (req, res) => {
  const { name, type, location } = req.body ?? {};

  if (!name || !type || !location) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  if (!allowedLocations[type]) {
    return res.status(400).json({ success: false, error: 'Unsupported test type' });
  }

  const safeLocation = allowedLocations[type].find((entry) => {
    const resolved = path.resolve(entry);
    return resolved === path.resolve(location) || resolved === path.resolve(process.cwd(), location);
  });

  if (!safeLocation) {
    return res.status(400).json({ success: false, error: 'Invalid location' });
  }

  const slug = sanitizeName(name);
  if (!slug) {
    return res.status(400).json({ success: false, error: 'Invalid test name' });
  }

  const extension = type === 'cypress' ? '.cy.js' : '.test.js';
  const finalLocation = path.resolve(safeLocation);
  const filePath = path.join(finalLocation, `${slug}${extension}`);

  try {
    await mkdir(finalLocation, { recursive: true });
  } catch (error) {
    console.error('❌ [DEV_TESTS] Failed to ensure directory', error);
    return res.status(500).json({ success: false, error: 'Failed to prepare directory' });
  }

  try {
    await access(filePath, fs.constants.F_OK);
    return res.status(409).json({ success: false, error: 'A test with this name already exists' });
  } catch (error) {
    // expected when file does not exist
  }

  const template = type === 'cypress'
    ? `describe('${name}', () => {\n  it('works', () => {\n    cy.visit('/');\n  });\n});\n`
    : `import test from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('${name}', async (t) => {\n  assert.equal(1, 1);\n});\n`;

  try {
    await writeFile(filePath, template, 'utf8');
  } catch (error) {
    console.error('❌ [DEV_TESTS] Failed to create test file', error);
    return res.status(500).json({ success: false, error: 'Failed to create test file' });
  }

  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  res.status(201).json({
    success: true,
    test: normaliseTestItem(
      type === 'cypress' ? 'cypress' : 'node',
      relativePath,
      name,
      relativePath,
      relativePath,
    ),
  });
});

module.exports = router;

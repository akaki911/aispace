const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs/promises');
const path = require('path');

const {
  recordEvent,
  getEventsSince,
  createCheckpoint,
} = require('../services/auto_improve_run_store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'auto_improve_event_store.json');
const AUDIT_FILE = path.join(DATA_DIR, 'auto_improve_audit.log');
const CHECKPOINT_DIR = path.join(DATA_DIR, 'auto_improve_checkpoints');

let originalState = null;
let originalAudit = null;
let baselineCheckpoints = [];

test.before(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });

  originalState = await fs.readFile(STATE_FILE, 'utf8').catch(() => null);
  originalAudit = await fs.readFile(AUDIT_FILE, 'utf8').catch(() => null);
  baselineCheckpoints = await fs.readdir(CHECKPOINT_DIR).catch(() => []);

  const resetState = { lastId: 0, events: [], audit: [] };
  await fs.writeFile(STATE_FILE, JSON.stringify(resetState, null, 2));
  await fs.writeFile(AUDIT_FILE, '', 'utf8');
});

test.after(async () => {
  if (originalState !== null) {
    await fs.writeFile(STATE_FILE, originalState, 'utf8');
  } else {
    await fs.rm(STATE_FILE, { force: true });
  }

  if (originalAudit !== null) {
    await fs.writeFile(AUDIT_FILE, originalAudit, 'utf8');
  } else {
    await fs.rm(AUDIT_FILE, { force: true });
  }

  const currentFiles = await fs.readdir(CHECKPOINT_DIR).catch(() => []);
  const baselineSet = new Set(baselineCheckpoints);
  await Promise.all(
    currentFiles
      .filter((file) => !baselineSet.has(file))
      .map((file) => fs.rm(path.join(CHECKPOINT_DIR, file), { force: true })),
  );
});

test('recordEvent redacts sensitive payloads', async () => {
  const stored = await recordEvent({
    message: 'token sk-abc1234567890XYZ and user test@example.com',
    type: 'status',
  });

  assert.ok(!stored.message.includes('sk-abc'), 'token should be redacted');
  assert.ok(!stored.message.includes('test@example.com'), 'email should be redacted');
  assert.ok(stored.message.includes('[REDACTED]'), 'redaction marker should be present');
});

test('getEventsSince returns events after a given id', async () => {
  const first = await recordEvent({ message: 'first', type: 'status' });
  const second = await recordEvent({ message: 'second', type: 'status' });

  const events = getEventsSince(first.id);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].id, second.id);
});

test('createCheckpoint writes snapshot to disk', async () => {
  const snapshot = { files: ['app.ts'], summary: 'Unit test snapshot' };
  const result = await createCheckpoint('run-test', snapshot, { actor: 'unit-test', reason: 'verification' });

  assert.ok(result.checkpointId, 'checkpoint id should be generated');
  const payloadRaw = await fs.readFile(result.filePath, 'utf8');
  const payload = JSON.parse(payloadRaw);

  assert.strictEqual(payload.runId, 'run-test');
  assert.deepStrictEqual(payload.snapshot, snapshot);
});

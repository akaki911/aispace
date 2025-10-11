const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('timers/promises');

const state = require('./state');
const { ensureEnvironment, shutdownEnvironment, BASE_BACKEND_URL } = require('./environment');
const { CookieJar, performJsonRequest, readSseStream } = require('./httpClient');

const jar = new CookieJar();

after(async () => {
  await shutdownEnvironment();
});

const run = (name, fn) => {
  test(name, async () => {
    await ensureEnvironment();
    try {
      await fn();
      state.recordResult(name, 'passed');
    } catch (error) {
      state.recordResult(name, 'failed', { error: error.message });
      throw error;
    }
  });
};

const ensureSession = async () => {
  if (/bk_admin\.sid=/.test(jar.getCookieHeader())) {
    return;
  }
  await performJsonRequest('auth.me.fallback', `${BASE_BACKEND_URL}/api/admin/auth/me`, {
    jar,
    corrId: state.corrId,
  });
};

run('force fallback streaming returns backup mode events', async () => {
  await ensureSession();

  const headers = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'X-Correlation-Id': state.corrId,
    'X-Gurulo-Client': 'ai-chat-e2e',
  };
  const cookieHeader = jar.getCookieHeader();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const body = {
    message: 'რამდენია 5 + 7?',
    personalId: '01019062020',
    forceFallback: 1,
    metadata: {
      client: 'ai-chat-e2e',
      corrId: state.corrId,
    },
  };

  const response = await fetch(`${BASE_BACKEND_URL}/api/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  assert.equal(response.status, 200, 'Fallback request must return 200');
  const backupHeader = response.headers.get('x-backup-mode');
  assert.equal(backupHeader, 'forced', 'Backup mode header missing');
  const contentType = response.headers.get('content-type') || '';
  assert.ok(contentType.includes('text/event-stream'), 'Fallback must use SSE stream');

  const { events, summary } = await readSseStream('chat.fallback', response, {
    bucket: 'fallback',
  });
  state.writeArtifact('fallback/stream.json', events);

  const chunkEvents = events.filter((event) => event.event === 'chunk');
  assert.ok(chunkEvents.length >= 1, 'Expected fallback chunk events');
  const endEvent = events.find((event) => event.event === 'end');
  assert.ok(endEvent, 'Fallback stream must terminate with end event');

  const textPayloads = chunkEvents
    .map((event) => (typeof event.data === 'string' ? event.data : JSON.stringify(event.data)))
    .join(' \n ')
    .toLowerCase();
  assert.ok(textPayloads.includes('backup'), 'Fallback payload should mention backup mode');
  assert.ok(textPayloads.includes('fallback') || textPayloads.includes('backup'), 'Fallback responder output missing');
  assert.ok(/5\s*\+\s*7/.test(textPayloads), 'Math fallback did not preserve prompt context');

  await delay(200);
  const backendLogPath = path.join(state.ensureArtifactDir(), 'backend.log');
  const backendLog = fs.readFileSync(backendLogPath, 'utf8');
  assert.ok(/ai_chat\.fallback\.forced/.test(backendLog), 'Structured fallback log not found');

  state.summary.fallback = {
    backupHeader,
    events: summary.totalEvents,
  };
});

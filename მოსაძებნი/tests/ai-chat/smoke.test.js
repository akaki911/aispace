const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');

const state = require('./state');
const { ensureEnvironment, shutdownEnvironment, BASE_BACKEND_URL, AI_SERVICE_URL } = require('./environment');
const { CookieJar, performJsonRequest, readSseStream } = require('./httpClient');

const jar = new CookieJar();

after(async () => {
  await shutdownEnvironment();
});

const run = (name, fn) => {
  test(name, async (t) => {
    await ensureEnvironment();
    try {
      await fn(t);
      state.recordResult(name, 'passed');
    } catch (error) {
      state.recordResult(name, 'failed', { error: error.message });
      throw error;
    }
  });
};

run('env vars present for runtime config', async () => {
  assert.ok(BASE_BACKEND_URL, 'Backend base URL missing');
  assert.ok(AI_SERVICE_URL, 'AI service URL missing');
  state.summary.baseUrl = BASE_BACKEND_URL;
  state.summary.aiUrl = AI_SERVICE_URL;
});

run('auth endpoint returns super admin session', async () => {
  const response = await performJsonRequest(
    'admin.auth.me',
    `${BASE_BACKEND_URL}/api/admin/auth/me`,
    { jar, corrId: state.corrId },
  );

  state.writeArtifact('auth_me.json', response.json);

  assert.equal(response.status, 200, 'Expected 200 from /api/admin/auth/me');
  assert.equal(response.json?.authenticated, true, 'User should be authenticated');
  assert.equal(response.json?.user?.role, 'SUPER_ADMIN', 'Role must be SUPER_ADMIN');
  assert.equal(response.json?.user?.personalId, '01019062020');
  const cookieHeader = jar.getCookieHeader();
  assert.ok(/bk_admin\.sid=/.test(cookieHeader), 'Session cookie bk_admin.sid missing');
});

run('version and health endpoints report OK', async () => {
  const version = await performJsonRequest('version', `${BASE_BACKEND_URL}/api/version`, {
    jar,
    corrId: state.corrId,
  });
  state.writeArtifact('version.json', version.json);
  assert.equal(version.status, 200);
  const hasVersionMetadata = Boolean(
    version.json?.version || version.json?.gitSha || version.json?.gitShaShort,
  );
  assert.ok(hasVersionMetadata, 'version metadata missing');
  assert.ok(version.json?.timestamp || version.json?.buildTime, 'No build metadata returned');

  const aiHealth = await performJsonRequest('ai.health', `${BASE_BACKEND_URL}/api/ai/health`, {
    jar,
    corrId: state.corrId,
  });
  state.writeArtifact('ai_health.json', aiHealth.json);
  assert.equal(aiHealth.status, 200);
  assert.ok(aiHealth.json?.status || aiHealth.json?.ok, 'Health payload missing status field');
});

run('chat endpoint streams SSE with latency guarantees', async () => {
  const body = {
    message: 'გამარჯობა! რას შვრები დღეს?',
    personalId: '01019062020',
    metadata: {
      client: 'ai-chat-e2e',
      corrId: state.corrId,
    },
  };

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

  const response = await fetch(`${BASE_BACKEND_URL}/api/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  assert.equal(response.status, 200, 'Expected 200 from chat SSE endpoint');
  const contentType = response.headers.get('content-type') || '';
  assert.ok(contentType.includes('text/event-stream'), 'chat endpoint must return text/event-stream');
  const requestId = response.headers.get('x-request-id');
  assert.equal(requestId, state.corrId, 'Response must echo correlation id');

  const { events, summary } = await readSseStream('chat.stream', response, {
    bucket: 'primary',
  });
  state.streamSummary = summary;
  state.writeArtifact('stream.json', events);

  const chunkEvents = events.filter((event) => event.event === 'chunk');
  assert.ok(chunkEvents.length >= 3, 'Expected at least 3 chunk events');

  const endEvent = events.find((event) => event.event === 'end');
  assert.ok(endEvent, 'Missing end event in stream');

  assert.ok(
    typeof summary.firstChunkDelta === 'number' && summary.firstChunkDelta < 3000,
    `First chunk too slow: ${summary.firstChunkDelta}ms`,
  );
  assert.ok(summary.durationMs < 12000, `Stream exceeded duration threshold: ${summary.durationMs}ms`);

  const firstEventTime = events[0]?.receivedAt ?? events[0]?.at ?? 0;
  const thirdChunk = chunkEvents[2];
  if (thirdChunk) {
    const delta = thirdChunk.receivedAt - firstEventTime;
    assert.ok(delta < 5000, `Third chunk took too long (${delta}ms)`);
  }

  const streamContent = chunkEvents.map((chunk) =>
    typeof chunk.data === 'string' ? chunk.data : JSON.stringify(chunk.data),
  );
  assert.ok(streamContent.some((item) => typeof item === 'string' && item.trim().length > 0), 'Stream had no content');
});

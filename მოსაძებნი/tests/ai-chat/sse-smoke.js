#!/usr/bin/env node
const { setTimeout: delay } = require('node:timers/promises');

const CHAT_BASE_URL = process.env.CHAT_BASE_URL || 'http://localhost:5173';
const MAX_ATTEMPTS = Number.parseInt(process.env.SSE_MAX_ATTEMPTS || '3', 10);
const BACKOFF_BASE_MS = Number.parseInt(process.env.SSE_RETRY_BASE_MS || '750', 10);
const FIRST_CHUNK_DEADLINE_MS = Number.parseInt(process.env.SSE_FIRST_CHUNK_MS || '1200', 10);
const STREAM_DEADLINE_MS = Number.parseInt(process.env.SSE_STREAM_DEADLINE_MS || '10000', 10);
const MESSAGE_PAYLOAD = {
  message: 'გამარჯობა! ეს არის ავტომატური სტრიმის ტესტი.',
  personalId: '01019062020',
  metadata: {
    client: 'ai-chat-sse-smoke',
    corrId: `sse-smoke-${Date.now()}`,
  },
};

const DEFAULT_HEADERS = {
  Accept: 'text/event-stream',
  'Content-Type': 'application/json',
  'X-Gurulo-Client': 'ai-chat-sse-smoke',
};

function parseSseEvent(rawEvent) {
  const event = { event: 'message', data: '' };
  for (const line of rawEvent.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    const colonIndex = line.indexOf(':');
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).trimStart();
    switch (field) {
      case 'event':
        event.event = value || 'message';
        break;
      case 'data':
        event.data += value + '\n';
        break;
      case 'id':
        event.id = value;
        break;
      case 'retry':
        event.retry = Number.parseInt(value || '0', 10);
        break;
      default:
        event[field] = value;
    }
  }
  if (event.data.endsWith('\n')) {
    event.data = event.data.slice(0, -1);
  }
  return event;
}

async function readStream(response, controller) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body reader unavailable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  const metrics = {
    chunkCounter: 0,
    firstChunkLatencyMs: null,
    totalDurationMs: null,
    firstChunkEvent: null,
    endEvent: null,
  };
  const startedAt = Date.now();
  let ended = false;
  let streamTimedOut = false;

  const timeoutId = setTimeout(() => {
    streamTimedOut = true;
    controller.abort();
  }, STREAM_DEADLINE_MS + 500);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        if (!rawEvent.trim()) {
          continue;
        }
        const event = parseSseEvent(rawEvent);
        const receivedAt = Date.now();
        const eventRecord = { ...event, receivedAt };
        events.push(eventRecord);
        if (event.event === 'chunk') {
          metrics.chunkCounter += 1;
          if (metrics.firstChunkLatencyMs === null) {
            metrics.firstChunkLatencyMs = receivedAt - startedAt;
            metrics.firstChunkEvent = eventRecord;
          }
        }
        if (event.event === 'done' || event.event === 'end') {
          metrics.endEvent = eventRecord;
          ended = true;
          break;
        }
      }
      if (ended) {
        controller.abort();
        break;
      }
      if (Date.now() - startedAt > STREAM_DEADLINE_MS && !metrics.endEvent) {
        streamTimedOut = true;
        controller.abort();
        break;
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  metrics.totalDurationMs = Date.now() - startedAt;
  return { events, metrics, streamTimedOut };
}

function createFailure(reason, extras = {}) {
  return {
    success: false,
    reason,
    ...extras,
  };
}

async function runAttempt(attemptNumber) {
  const controller = new AbortController();
  const corrId = `${MESSAGE_PAYLOAD.metadata.corrId}-${attemptNumber}`;
  const headers = {
    ...DEFAULT_HEADERS,
    'X-Correlation-Id': corrId,
  };

  const url = new URL('/api/ai/chat', CHAT_BASE_URL);
  const startedAt = Date.now();
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...MESSAGE_PAYLOAD, metadata: { ...MESSAGE_PAYLOAD.metadata, corrId } }),
      signal: controller.signal,
    });
  } catch (error) {
    return createFailure(`Fetch failed: ${error.cause?.code || error.code || error.message}`, {
      error,
    });
  }

  const totalDurationSoFar = Date.now() - startedAt;
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200) {
    let bodySnippet = '';
    try {
      bodySnippet = await response.text();
      if (bodySnippet.length > 400) {
        bodySnippet = `${bodySnippet.slice(0, 400)}…`;
      }
    } catch (error) {
      bodySnippet = `<<failed to read body: ${error.message}>>`;
    }
    return createFailure(`Unexpected status ${response.status} ${response.statusText}`, {
      status: response.status,
      statusText: response.statusText,
      bodySnippet,
      totalDurationMs: totalDurationSoFar,
    });
  }

  if (!contentType.includes('text/event-stream')) {
    return createFailure('Response is not an event-stream', {
      contentType,
      totalDurationMs: totalDurationSoFar,
    });
  }

  let stream;
  try {
    stream = await readStream(response, controller);
  } catch (error) {
    if (error.name === 'AbortError') {
      return createFailure('Stream aborted (possibly timed out)', { error });
    }
    return createFailure(`Failed to read SSE stream: ${error.message}`, { error });
  }

  const { events, metrics, streamTimedOut } = stream;
  const { chunkCounter, firstChunkLatencyMs, totalDurationMs, endEvent } = metrics;

  if (chunkCounter < 3) {
    return createFailure('Insufficient chunk events', { metrics, events });
  }
  if (firstChunkLatencyMs === null) {
    return createFailure('No chunk events received', { metrics, events });
  }
  if (firstChunkLatencyMs > FIRST_CHUNK_DEADLINE_MS) {
    return createFailure(
      `First chunk latency ${firstChunkLatencyMs}ms exceeds ${FIRST_CHUNK_DEADLINE_MS}ms threshold`,
      { metrics, events },
    );
  }
  if (!endEvent) {
    return createFailure('Missing end/done event', { metrics, streamTimedOut, events });
  }
  if (totalDurationMs > STREAM_DEADLINE_MS) {
    return createFailure(
      `Stream duration ${totalDurationMs}ms exceeds ${STREAM_DEADLINE_MS}ms threshold`,
      { metrics, events },
    );
  }

  return {
    success: true,
    metrics,
  };
}

async function checkUrl(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    const statusInfo = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
    let body = '';
    try {
      body = await response.text();
    } catch (error) {
      body = `<<failed to read body: ${error.message}>>`;
    }
    if (body.length > 400) {
      statusInfo.bodySnippet = `${body.slice(0, 400)}…`;
    } else if (body) {
      statusInfo.bodySnippet = body;
    }
    return statusInfo;
  } catch (error) {
    return {
      ok: false,
      error: error.cause?.code || error.code || error.message,
    };
  }
}

function formatStatus(label, result) {
  if (result.ok) {
    return `${label}: OK (${result.status})`;
  }
  if (result.status) {
    return `${label}: FAIL (${result.status})`;
  }
  return `${label}: ERROR (${result.error || 'unknown'})`;
}

async function printDiagnostics(retries) {
  console.error('--- Diagnostics ---');
  console.error(`Retries attempted: ${retries}`);
  const aiHealthUrl = process.env.AI_HEALTH_URL || 'http://localhost:5001/health';
  const proxyHealthPath = process.env.PROXY_HEALTH_PATH || '/api/health';
  const backendProxyUrl = new URL(proxyHealthPath, CHAT_BASE_URL).toString();

  const [aiStatus, backendProxyStatus] = await Promise.all([
    checkUrl(aiHealthUrl),
    checkUrl(backendProxyUrl),
  ]);

  console.error(formatStatus(`AI service (${aiHealthUrl})`, aiStatus));
  console.error(formatStatus(`Backend proxy (${backendProxyUrl})`, backendProxyStatus));

  if (!backendProxyStatus.ok) {
    const reason = backendProxyStatus.error || backendProxyStatus.statusText || 'unknown';
    const isConnRefused = /ECONNREFUSED/i.test(reason) || /ECONNREFUSED/i.test(backendProxyStatus.bodySnippet || '');
    if (isConnRefused) {
      console.error(
        'Advice: ამოქმედე backend proxy 5002 ან დროებით გადაამისამართე ფრონტ-ჩატი პირდაპირ AI-სერვისზე (5001) მხოლოდ /api/ai/chat-ისთვის.',
      );
    }
  }

  if (backendProxyStatus.bodySnippet) {
    console.error('Backend proxy response snippet:');
    console.error(backendProxyStatus.bodySnippet);
  }
  console.error('--- End Diagnostics ---');
}

(async () => {
  if (Number.isNaN(MAX_ATTEMPTS) || MAX_ATTEMPTS < 1) {
    console.error('Invalid SSE_MAX_ATTEMPTS value.');
    process.exit(2);
  }

  let attempt = 0;
  let result = null;
  const attemptsSummary = [];

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    const attemptLabel = `Attempt ${attempt}/${MAX_ATTEMPTS}`;
    console.log(`${attemptLabel} → starting`);
    result = await runAttempt(attempt);
    attemptsSummary.push({ attempt, result });
    if (result.success) {
      break;
    }
    console.warn(`${attemptLabel} failed: ${result.reason}`);
    if (attempt < MAX_ATTEMPTS) {
      const backoffMs = Math.min(5000, BACKOFF_BASE_MS * 2 ** (attempt - 1));
      console.log(`Retrying in ${backoffMs}ms...`);
      await delay(backoffMs);
    }
  }

  const retries = Math.max(0, attempt - 1);
  if (result && result.success) {
    console.log('SSE smoke test passed ✅');
    console.log(
      JSON.stringify(
        {
          chunkCounter: result.metrics.chunkCounter,
          firstChunkLatencyMs: result.metrics.firstChunkLatencyMs,
          totalDurationMs: result.metrics.totalDurationMs,
          retries,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.error('SSE smoke test failed ❌');
  const last = attemptsSummary[attemptsSummary.length - 1];
  if (last?.result?.reason) {
    console.error(`Last failure reason: ${last.result.reason}`);
  }
  if (last?.result?.metrics) {
    console.error('Last attempt metrics:', last.result.metrics);
  }
  await printDiagnostics(retries);
  process.exit(1);
})();

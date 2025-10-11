const state = require('./state');

class CookieJar {
  constructor() {
    this.store = new Map();
  }

  addFromSetCookie(setCookieHeaders = []) {
    for (const header of setCookieHeaders) {
      if (!header) continue;
      const [pair] = header.split(';');
      if (!pair) continue;
      const [name, value] = pair.split('=');
      if (!name) continue;
      this.store.set(name.trim(), value ?? '');
    }
  }

  getCookieHeader() {
    if (!this.store.size) {
      return '';
    }
    return Array.from(this.store.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }
}

const performJsonRequest = async (name, url, { method = 'GET', headers = {}, body, jar, corrId }) => {
  const started = Date.now();
  const payload = typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;
  const requestHeaders = {
    Accept: 'application/json',
    ...(payload ? { 'Content-Type': 'application/json' } : {}),
    'X-Correlation-Id': corrId,
    ...headers,
  };
  if (jar) {
    const cookieHeader = jar.getCookieHeader();
    if (cookieHeader) {
      requestHeaders.Cookie = cookieHeader;
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  if (jar && typeof response.headers.getSetCookie === 'function') {
    jar.addFromSetCookie(response.headers.getSetCookie());
  }

  const latencyMs = Date.now() - started;
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  state.recordNetworkTrace({
    name,
    url,
    method,
    status: response.status,
    latencyMs,
    requestHeaders,
    responseHeaders: Object.fromEntries(response.headers.entries()),
  });

  return {
    status: response.status,
    ok: response.ok,
    json: parsed,
    headers: response.headers,
    latencyMs,
  };
};

const readSseStream = async (name, response, { corrId, jar, bucket = 'primary' } = {}) => {
  if (!response.body) {
    throw new Error('Missing response body for SSE stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  let firstChunkAt = null;
  const startedAt = Date.now();

  const readLoop = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseSseBlock(raw);
        if (event) {
          const receivedAt = Date.now();
          events.push({ ...event, receivedAt });
          state.recordStreamEvent(bucket, event);
          if (event.event === 'chunk' && firstChunkAt === null) {
            firstChunkAt = receivedAt;
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  };

  await readLoop();
  const endedAt = Date.now();
  const summary = {
    totalEvents: events.length,
    firstChunkDelta: firstChunkAt !== null ? firstChunkAt - startedAt : null,
    durationMs: endedAt - startedAt,
    eventTypes: events.map((event) => event.event),
  };
  state.recordNetworkTrace({
    name,
    url: response.url,
    method: 'POST',
    status: response.status,
    latencyMs: summary.durationMs,
    responseHeaders: Object.fromEntries(response.headers.entries()),
  });
  return { events, summary };
};

const parseSseBlock = (block) => {
  if (!block.trim()) {
    return null;
  }
  const lines = block.split('\n');
  let eventType = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5));
    }
  }
  let dataPayload = dataLines.join('\n').trim();
  let data;
  if (!dataPayload) {
    data = null;
  } else {
    try {
      data = JSON.parse(dataPayload);
    } catch {
      data = dataPayload;
    }
  }
  return { event: eventType, data };
};

module.exports = {
  CookieJar,
  performJsonRequest,
  readSseStream,
};

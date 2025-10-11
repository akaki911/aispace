const express = require('express');
const fetch = global.fetch || require('node-fetch');

const streamingService = require('../services/streaming_service');
const { generateFallbackResponse } = require('../services/fallbackResponder');
const { sanitizeResponse, flattenStructured } = require('../../ai-service/utils/enhanced_sanitizer');
const { createServiceToken, getServiceAuthConfigs } = require('../../shared/serviceToken');

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';
const SERVICE_PERMISSIONS = ['chat', 'fs'];
const REQUEST_TIMEOUT_MS = 30000;
const ALLOW_ANONYMOUS_AI_CHAT = process.env.ALLOW_ANONYMOUS_AI_CHAT !== 'false';
let hasLoggedAnonymousChatNotice = false;
const SENSITIVE_KEYS = new Set(['timestamp', 'generatedAt', 'createdAt', 'updatedAt']);
const BANNED_VALUE_PATTERNS = [/(\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:)/i];
const AUTH_ERROR_STATUSES = new Set([401, 403]);
const SERVICE_AUTH_CONFIG = getServiceAuthConfigs()[0] || null;
const USING_FALLBACK_SERVICE_SECRET = SERVICE_AUTH_CONFIG?.isFallback;

if (USING_FALLBACK_SERVICE_SECRET) {
  console.warn('⚠️ [AI Chat] Using fallback service auth secret. Configure AI_SERVICE_SHARED_SECRET for secure setups.');
}
const QUOTA_STATUS_CODES = new Set([429, 509]);
const QUOTA_KEYWORDS = [
  'resource_exhausted',
  'quota exceeded',
  'insufficient_quota',
  'rate limit exceeded',
];
const TEST_CLIENT_HEADER_VALUE = 'chat-tests';
const TEST_SERVICE_KEY = process.env.TEST_SERVICE_KEY;

const GREETING_RE = /\b(გამარჯობა|გაუმარჯოს|სალამ(?:ი)?|მოგესალმ(?:ებ(?:ი|ათ))?|hi|hello)\b/i;
const SHORT_GREETING_RE = /^\s*გამარჯ(ობა|ობათ)?\s*$/i;

const inferQueryTypeFromMessage = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 12 && SHORT_GREETING_RE.test(trimmed)) {
    return 'greeting';
  }

  if (GREETING_RE.test(trimmed)) {
    return 'greeting';
  }

  return null;
};

const assignTestServiceIdentity = (req) => {
  req.user = {
    id: 'service:chat-tests',
    role: 'SYSTEM_BOT',
    permissions: [...SERVICE_PERMISSIONS],
    isServiceAccount: true,
    isTestClient: true,
  };

  if (!req.headers['x-user-role']) {
    req.headers['x-user-role'] = 'SYSTEM_BOT';
  }
};

const applyTestServiceBypass = (req, requestId) => {
  if (req.session?.user || req.user) {
    return false;
  }

  const clientId = req.headers['x-gurulo-client'];
  if (clientId !== TEST_CLIENT_HEADER_VALUE) {
    return false;
  }

  const providedKey = req.headers['x-test-service-key'];
  if (!TEST_SERVICE_KEY || !providedKey) {
    console.warn('⚠️ [AI Chat] Test client bypass requested but missing service key', {
      requestId,
      hasEnvKey: Boolean(TEST_SERVICE_KEY),
      hasHeader: Boolean(providedKey),
    });
    return false;
  }

  if (providedKey !== TEST_SERVICE_KEY) {
    console.warn('⚠️ [AI Chat] Test client bypass denied due to invalid key', {
      requestId,
    });
    return false;
  }

  assignTestServiceIdentity(req);
  console.info('✅ [AI Chat] Test client bypass granted', { requestId });
  return true;
};

const sanitizeProxyPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map((entry) => sanitizeProxyPayload(entry));
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (SENSITIVE_KEYS.has(key)) {
        return acc;
      }

      const sanitizedValue = sanitizeProxyPayload(value);
      if (sanitizedValue !== undefined) {
        acc[key] = sanitizedValue;
      }
      return acc;
    }, {});
  }

  if (typeof payload === 'string' && BANNED_VALUE_PATTERNS.some((pattern) => pattern.test(payload))) {
    return '[redacted]';
  }

  return payload;
};
const resolveStreamingMode = () => {
  if (process.env.AI_PROXY_STREAMING_MODE) {
    return process.env.AI_PROXY_STREAMING_MODE;
  }

  const hasRealtimeProvider = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );

  return hasRealtimeProvider ? 'auto' : 'disabled';
};

const AI_PROXY_STREAMING_MODE = resolveStreamingMode();

const generateCorrelationId = () => `ai-live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resetServiceTokenCache = () => {};

const getServiceToken = () => {
  try {
    return createServiceToken({
      svc: 'backend',
      service: 'backend',
      role: 'SYSTEM_BOT',
      permissions: SERVICE_PERMISSIONS,
    });
  } catch (error) {
    console.error('❌ [AI Chat] Failed to issue service token', { message: error.message });
    return null;
  }
};

const buildServiceHeaders = (req, requestId) => {
  const token = getServiceToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'X-Service-Name': 'backend',
    'X-Correlation-Id': requestId,
    'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
    'User-Agent': req.headers['user-agent'] || 'Bakhmaro-Backend-Service',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (req.headers['x-gurulo-client']) {
    headers['X-Gurulo-Client'] = req.headers['x-gurulo-client'];
  }

  if (req.headers['x-user-role']) {
    headers['X-User-Role'] = req.headers['x-user-role'];
  }

  return headers;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractTextFromPayload = (payload, depth = 0) => {
  if (payload == null || depth > 6) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item) => extractTextFromPayload(item, depth + 1))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof payload === 'object') {
    if (typeof payload.response === 'string') {
      return payload.response;
    }

    if (payload.response) {
      const nestedResponse = extractTextFromPayload(payload.response, depth + 1);
      if (nestedResponse) {
        return nestedResponse;
      }
    }

    const candidateKeys = [
      'content',
      'text',
      'message',
      'answer',
      'value',
      'body',
      'output',
      'result',
      'assistant',
      'summary',
      'prompt',
    ];

    for (const key of candidateKeys) {
      if (key in payload) {
        const nested = extractTextFromPayload(payload[key], depth + 1);
        if (nested) {
          return nested;
        }
      }
    }

    if (payload.metadata) {
      const metadataContent = extractTextFromPayload(payload.metadata, depth + 1);
      if (metadataContent) {
        return metadataContent;
      }
    }

    if (payload.data) {
      const dataContent = extractTextFromPayload(payload.data, depth + 1);
      if (dataContent) {
        return dataContent;
      }
    }
  }

  return '';
};

const splitTextIntoChunks = (text) => {
  const normalized = (text || '').toString().replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const maxLength = 280;
  const chunks = [];
  const sentences = normalized.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let buffer = '';

  const flushBuffer = () => {
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = '';
    }
  };

  const pushLargePiece = (piece) => {
    if (!piece) {
      return;
    }
    if (piece.length <= maxLength) {
      chunks.push(piece.trim());
      return;
    }
    for (let index = 0; index < piece.length; index += maxLength) {
      chunks.push(piece.slice(index, index + maxLength).trim());
    }
  };

  if (!sentences.length) {
    pushLargePiece(normalized);
    return chunks.filter(Boolean).slice(0, 6);
  }

  for (const sentence of sentences) {
    if (!buffer) {
      if (sentence.length > maxLength) {
        pushLargePiece(sentence);
      } else {
        buffer = sentence;
      }
      continue;
    }

    if ((`${buffer} ${sentence}`).length <= maxLength) {
      buffer = `${buffer} ${sentence}`;
    } else {
      flushBuffer();
      if (sentence.length > maxLength) {
        pushLargePiece(sentence);
      } else {
        buffer = sentence;
      }
    }
  }

  flushBuffer();

  if (!chunks.length) {
    pushLargePiece(normalized);
  }

  return chunks.filter(Boolean).slice(0, 6);
};

const detectQuotaExceeded = (result) => {
  if (!result) {
    return false;
  }

  if (typeof result.status === 'number' && QUOTA_STATUS_CODES.has(result.status)) {
    return true;
  }

  const textCandidates = [];
  if (typeof result.text === 'string') {
    textCandidates.push(result.text);
  }
  const data = result.data;

  if (data && typeof data === 'object') {
    const errorSection = data.error && typeof data.error === 'object' ? data.error : null;
    const code = (errorSection && errorSection.code) || data.code || errorSection?.status;
    if (typeof code === 'string' && code.toUpperCase() === 'RESOURCE_EXHAUSTED') {
      return true;
    }
    const message = errorSection?.message || data.message;
    if (typeof message === 'string') {
      textCandidates.push(message);
    }
  } else if (typeof data === 'string') {
    textCandidates.push(data);
  }

  return textCandidates.some((candidate) => {
    try {
      const lowered = candidate.toLowerCase();
      return QUOTA_KEYWORDS.some((keyword) => lowered.includes(keyword));
    } catch {
      return false;
    }
  });
};

const fetchUpstreamResponse = async (req, requestId, signal, options = {}) => {
  const { retryOnAuthError = true } = options;

  const performFetch = async () => {
    try {
      const upstreamResponse = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          ...buildServiceHeaders(req, requestId),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
        signal,
      });

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const text = await upstreamResponse.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        ok: upstreamResponse.ok,
        status: upstreamResponse.status,
        contentType,
        data,
        text,
      };
    } catch (error) {
      return {
        ok: false,
        status: null,
        error,
      };
    }
  };

  let attemptResult = await performFetch();

  if (
    retryOnAuthError &&
    attemptResult &&
    typeof attemptResult.status === 'number' &&
    AUTH_ERROR_STATUSES.has(attemptResult.status)
  ) {
    console.warn('⚠️ [AI Chat] Upstream rejected service token, refreshing cache', {
      requestId,
      status: attemptResult.status,
    });
    resetServiceTokenCache();
    const retryResult = await performFetch();
    if (retryResult) {
      retryResult.authRetryAttempted = true;
      retryResult.previousAuthStatus = attemptResult.status;
    }
    return retryResult;
  }

  if (attemptResult) {
    attemptResult.authRetryAttempted = false;
  }
  return attemptResult;
};

const streamChatResponse = async (req, res, requestId, { forceFallback = false } = {}) => {
  const startedAt = Date.now();
  const userId = req.session?.user?.id || req.user?.id || 'anonymous';
  let fallbackUsed = Boolean(forceFallback);
  const audienceTag =
    req.body?.audience ||
    (req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata.audience : undefined);
  const isPublicAudience = audienceTag === 'public_front';

  streamingService.addStream(requestId, userId, 'chat');

  if (forceFallback) {
    console.warn('ai_chat.fallback.forced', {
      requestId,
      userId,
    });
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('X-Backup-Mode', forceFallback ? 'forced' : 'auto');
  res.setHeader('X-Content-Format', 'text');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  console.info('[ai_chat] sse_open', {
    requestId,
    userId,
    mode: forceFallback ? 'forced_fallback' : 'standard',
  });

  let streamEnded = false;
  let completionNotified = false;
  let chunkSeq = 0;
  let latestUpstreamStatus = null;
  let firstChunkLatency = null;
  let heartbeatInterval;
  const fallbackMetaReasons = new Set();
  const inferredQueryType = inferQueryTypeFromMessage(req.body?.message || '');

  const finalizeStream = (status, meta = {}) => {
    if (completionNotified) {
      return;
    }
    completionNotified = true;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    streamingService.completeStream(requestId, status, {
      ...meta,
      duration: Date.now() - startedAt,
      chunks: chunkSeq,
      fallback: fallbackUsed,
      firstChunkMs: firstChunkLatency,
    });
  };

  const safeWrite = (payload) => {
    if (streamEnded) {
      return false;
    }
    try {
      res.write(payload);
      return true;
    } catch (error) {
      streamEnded = true;
      console.error('❌ [AI Chat] SSE write failed', { requestId, error: error.message });
      finalizeStream('error', { reason: 'write_failed', message: error.message });
      return false;
    }
  };

  heartbeatInterval = setInterval(() => {
    if (streamEnded) {
      return;
    }
    const heartbeatPayload = JSON.stringify({ ts: Date.now() });
    if (!safeWrite('event: heartbeat\n')) {
      return;
    }
    if (!safeWrite(`data: ${heartbeatPayload}\n\n`)) {
      return;
    }
    if (!safeWrite('event: ping\n')) {
      return;
    }
    safeWrite(`data: ${heartbeatPayload}\n\n`);
  }, 1000);

  const sendMeta = (metaPayload) => {
    if (isPublicAudience) {
      return;
    }
    if (!metaPayload || typeof metaPayload !== 'object') {
      return;
    }
    if (!safeWrite('event: meta\n')) {
      return;
    }
    safeWrite(`data: ${JSON.stringify(metaPayload)}\n\n`);
  };

  const markFallback = (reason = 'fallback', meta = {}) => {
    const normalizedReason =
      typeof reason === 'string' && reason.trim().length
        ? reason.trim()
        : 'fallback';
    fallbackUsed = true;
    if (!fallbackMetaReasons.has(normalizedReason)) {
      fallbackMetaReasons.add(normalizedReason);
      sendMeta({
        requestId,
        mode: 'backup',
        reason: normalizedReason,
        ...meta,
      });
    }
  };

  const ensureFallbackReason = (reason = 'fallback', meta = {}) => {
    if (!fallbackMetaReasons.size) {
      markFallback(reason, meta);
      return;
    }
    fallbackUsed = true;
  };

  const writeTextData = (textPayload) => {
    const lines = textPayload.split(/\r?\n/);
    for (const line of lines) {
      if (!safeWrite(`data: ${line}\n`)) {
        return false;
      }
    }
    return safeWrite('\n');
  };

  const sendChunk = (payload) => {
    const originalPayload = payload;

    if (isPublicAudience) {
      const flattened = flattenStructured(originalPayload);
      const normalized = (flattened ?? '').toString();
      const sanitizedText = sanitizeResponse(normalized, req.body?.message || '');
      if (!sanitizedText || !sanitizedText.trim()) {
        return true;
      }
      if (firstChunkLatency === null) {
        firstChunkLatency = Date.now() - startedAt;
      }
      if (!safeWrite('event: chunk\n')) {
        return false;
      }
      chunkSeq += 1;
      if (!writeTextData(sanitizedText)) {
        return false;
      }
      streamingService.recordChunk(requestId, sanitizedText.length);
      console.info('[ai_chat] chunk_write', {
        requestId,
        seq: chunkSeq,
        length: sanitizedText.length,
      });
      return true;
    }

    let serialized;
    if (typeof originalPayload === 'string') {
      serialized = originalPayload;
    } else {
      try {
        serialized = JSON.stringify(originalPayload);
      } catch (serializationError) {
        console.warn('[ai_chat] chunk_serialize_fallback', {
          requestId,
          error: serializationError.message,
        });
        const flattened = flattenStructured(originalPayload);
        serialized = (flattened ?? '').toString();
      }
    }

    const sanitizedText = sanitizeResponse(serialized || '', req.body?.message || '');
    if (!sanitizedText || !sanitizedText.trim()) {
      return true;
    }
    if (firstChunkLatency === null) {
      firstChunkLatency = Date.now() - startedAt;
    }
    if (!safeWrite('event: chunk\n')) {
      return false;
    }
    chunkSeq += 1;
    if (!writeTextData(sanitizedText)) {
      return false;
    }
    streamingService.recordChunk(requestId, sanitizedText.length);
    console.info('[ai_chat] chunk_write', {
      requestId,
      seq: chunkSeq,
      length: sanitizedText.length,
      structured: typeof originalPayload === 'object',
    });
    return true;
  };

  const sendDone = (ok, meta = {}) => {
    if (streamEnded) {
      return;
    }
    if (firstChunkLatency === null) {
      firstChunkLatency = Date.now() - startedAt;
    }

    const donePayload = {
      ok,
      chunks: chunkSeq,
      firstChunkMs: firstChunkLatency,
      fallback: fallbackUsed,
      ...meta,
    };
    if (inferredQueryType) {
      donePayload.queryType = inferredQueryType;
    }
    if (fallbackMetaReasons.size) {
      donePayload.fallbackReasons = Array.from(fallbackMetaReasons);
    }
    safeWrite('event: done\n');
    safeWrite(`data: ${JSON.stringify(donePayload)}\n\n`);
    streamEnded = true;
    console.info('[ai_chat] done_write', {
      requestId,
      ok,
      chunks: chunkSeq,
    });
    console.info('[ai_chat.telemetry]', {
      event: 'sse_complete',
      requestId,
      chunks: chunkSeq,
      firstChunkMs: firstChunkLatency,
      fallback: fallbackUsed,
    });
    finalizeStream(ok ? 'completed' : 'failed', meta);
    res.end();
  };

  req.on('close', () => {
    if (streamEnded) {
      return;
    }
    streamEnded = true;
    console.warn('[ai_chat] client_closed', { requestId, chunks: chunkSeq });
    finalizeStream('aborted', { reason: 'client_disconnect' });
  });

  try {
    const initialMeta = {
      requestId,
      corrId: requestId,
      mode: forceFallback ? 'fallback' : 'live',
    };
    if (inferredQueryType) {
      initialMeta.queryType = inferredQueryType;
    }
    sendMeta(initialMeta);
    if (forceFallback) {
      markFallback('forced');
    }
    const stubPromise = Promise.resolve();

    let upstreamResult = null;

    if (!forceFallback) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, 1200));
      const abortOnClose = () => controller.abort();
      req.once('close', abortOnClose);

      try {
        upstreamResult = await fetchUpstreamResponse(req, requestId, controller.signal);
      } finally {
        clearTimeout(timeoutHandle);
        if (typeof req.off === 'function') {
          req.off('close', abortOnClose);
        } else {
          req.removeListener('close', abortOnClose);
        }
      }

      if (upstreamResult) {
        latestUpstreamStatus = upstreamResult.status ?? null;
        if (!upstreamResult.ok) {
          if (detectQuotaExceeded(upstreamResult)) {
            console.warn('⚠️ [AI Chat] Upstream quota exhausted - switching to fallback', {
              requestId,
              status: upstreamResult.status ?? null,
            });
            markFallback('quota', {
              upstreamStatus: upstreamResult.status ?? null,
            });
          } else if (upstreamResult.error) {
            const errorName = upstreamResult.error?.name || 'upstream_error';
            const reason = errorName === 'AbortError' ? 'timeout' : 'upstream_fetch_error';
            console.warn('⚠️ [AI Chat] Upstream fetch error - activating fallback', {
              requestId,
              reason,
              status: upstreamResult.status ?? null,
              message: upstreamResult.error?.message,
            });
            markFallback(reason, {
              upstreamStatus: upstreamResult.status ?? null,
              message: upstreamResult.error?.message,
            });
          } else if (typeof upstreamResult.status === 'number' && upstreamResult.status >= 500) {
            console.warn('⚠️ [AI Chat] Upstream responded with server error - activating fallback', {
              requestId,
              status: upstreamResult.status,
            });
            markFallback('upstream_error', { upstreamStatus: upstreamResult.status });
          } else if (typeof upstreamResult.status === 'number' && upstreamResult.status >= 400) {
            console.warn('⚠️ [AI Chat] Upstream rejected request - activating fallback', {
              requestId,
              status: upstreamResult.status,
            });
            markFallback('upstream_rejected', { upstreamStatus: upstreamResult.status });
          }
        }
      }
    }

    await stubPromise;

    let resolvedText = '';

    if (upstreamResult && upstreamResult.ok) {
      resolvedText = extractTextFromPayload(upstreamResult.data).trim();
      if (!resolvedText && typeof upstreamResult.text === 'string') {
        resolvedText = upstreamResult.text.trim();
      }
    }

    if (!resolvedText) {
      const fallbackMessage = generateFallbackResponse(req.body?.message || '').trim();
      if (fallbackMessage) {
        ensureFallbackReason('fallback_response');
        resolvedText = fallbackMessage;
      }
    }

    if (!resolvedText) {
      ensureFallbackReason('fallback_default');
      resolvedText = 'გთხოვ მოგვაწოდო მეტი დეტალი, რათა უკეთ დაგეხმარო.';
    }

    if (fallbackUsed) {
      if (!sendChunk('🔁 Backup mode აქტიურია — გთავაზობ სარეზერვო პასუხს.')) {
        return;
      }
      await wait(60);
    }

    const responseChunks = splitTextIntoChunks(resolvedText);
    if (!responseChunks.length) {
      responseChunks.push(resolvedText);
    }

    for (const chunk of responseChunks) {
      if (!sendChunk(chunk)) {
        return;
      }
      await wait(60);
    }

    sendDone(true, {
      upstreamStatus: latestUpstreamStatus,
    });
  } catch (error) {
    console.error('❌ [AI Chat] SSE streaming error', { requestId, error: error.message });
    markFallback('exception', { error: error.message });
    const fallbackMessage = generateFallbackResponse(req.body?.message || '').trim() ||
      'ბოდიში, AI პასუხი დროებით მიუწვდომელია. გთხოვ სცადო ცოტა ხანში.';

    if (sendChunk(fallbackMessage)) {
      sendDone(false, { error: error.message });
    } else {
      finalizeStream('failed', { error: error.message });
    }
  }
};

router.post('/chat', async (req, res) => {
  const requestId = req.headers['x-correlation-id'] || generateCorrelationId();
  const testBypassActive = applyTestServiceBypass(req, requestId);

  if (!req.session?.user && !req.user) {
    if (!ALLOW_ANONYMOUS_AI_CHAT) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasLoggedAnonymousChatNotice) {
      console.info('ℹ️ [AI Chat] Anonymous chat enabled (no active session detected)');
      hasLoggedAnonymousChatNotice = true;
    }
  }

  console.log('Groq relay active', { requestId, testBypassActive });

  try {
    if (AI_PROXY_STREAMING_MODE === 'disabled') {
      console.warn('⚠️ [AI Chat] Streaming disabled - serving fallback stream', { requestId });
      await streamChatResponse(req, res, requestId, { forceFallback: true });
      return;
    }

    if (req.body?.forceFallback) {
      await streamChatResponse(req, res, requestId, { forceFallback: true });
      return;
    }
    await streamChatResponse(req, res, requestId);
  } catch (error) {
    console.error('❌ [AI Chat] Unexpected proxy error', { requestId, error: error.message });
    if (!res.headersSent) {
      res.status(502).json({ error: 'AI chat proxy failed', requestId });
    }
  }
});

module.exports = router;

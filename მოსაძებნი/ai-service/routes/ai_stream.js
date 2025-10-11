const express = require('express');
const router = express.Router();

const { sanitizeResponse, flattenStructured } = require('../utils/enhanced_sanitizer');

// Import AI services with fallback
let groqService;
try {
  groqService = require('../services/groq_service');
} catch (error) {
  console.warn('⚠️ Groq service not available for streaming:', error.message);
}

// SOL-203: POST /api/ai/stream - Server-Sent Events streaming endpoint

const writeSseData = (res, raw) => {
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }
  res.write('\n');
};

const sendTextChunk = (res, text, userQuery) => {
  const flattened = flattenStructured(text);
  const normalized = typeof flattened === 'string' ? flattened : String(flattened ?? '');
  const sanitized = sanitizeResponse(normalized, userQuery || '');
  if (!sanitized || !sanitized.trim()) {
    return;
  }
  res.write('event: chunk\n');
  writeSseData(res, sanitized);
};

const sendMetaEvent = (res, payload) => {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  res.write('event: meta\n');
  writeSseData(res, JSON.stringify(payload));
};

const splitFallbackIntoSegments = (content) => {
  const normalized = (content || '').toString().trim();
  if (!normalized) {
    return [''];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length >= 3) {
    return paragraphs.slice(0, 4);
  }

  const approxSize = Math.max(1, Math.ceil(normalized.length / 3));
  const segments = [];
  for (let index = 0; index < normalized.length; index += approxSize) {
    segments.push(normalized.slice(index, index + approxSize));
  }
  return segments.filter(Boolean);
};

const resolveContent = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => resolveContent(item))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    const contentLikeKeys = ['content', 'response', 'message', 'text', 'value'];
    for (const key of contentLikeKeys) {
      if (key in value) {
        const resolved = resolveContent(value[key]);
        if (resolved) return resolved;
      }
    }
    if ('ka' in value && typeof value.ka === 'string') {
      return value.ka;
    }
    if ('en' in value && typeof value.en === 'string') {
      return value.en;
    }
    const firstString = Object.values(value).find((item) => typeof item === 'string');
    if (typeof firstString === 'string') {
      return firstString;
    }
    return JSON.stringify(value);
  }
  return '';
};

router.post('/stream', async (req, res) => {
  console.log('🌊 AI Stream endpoint accessed');
  
  try {
    const { message, personalId = '01019062020', params = {} } = req.body;
    
    console.log('🔍 Stream Request:', { 
      message: message?.substring(0, 50), 
      personalId,
      streaming: true
    });

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required for streaming'
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    res.write('event: start\n');
    writeSseData(res, 'streaming');

    sendMetaEvent(res, { channel: 'direct-ai', mode: groqService ? 'live' : 'fallback' });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      const payload = JSON.stringify({ ts: Date.now() });
      res.write('event: ping\n');
      writeSseData(res, payload);
    }, 1000);

    if (!groqService || typeof groqService.askGroq !== 'function') {
      const fallbackMessage = [
        '🔌 **Offline რეჟიმი აქტიურია** – პირდაპირი Groq კავშირი დროებით მიუწვდომელია.',
        message
          ? `მიღებული შეტყობინება: "${message.slice(0, 120)}${message.length > 120 ? '…' : ''}"`
          : 'შეტყობინება ვერ იქნა ამოღებული.',
        'გაგიწევთ დახმარებას ლოკალური ცოდნით სანამ რეალურ დროში სტრიმინგი აღდგება.'
      ].join('\n\n');

      const segments = splitFallbackIntoSegments(fallbackMessage);
      const safeSegments = segments.length ? segments : [''];
      const total = safeSegments.length;

      res.setHeader('X-Stream-Mode', 'fallback-offline');

      for (let index = 0; index < total; index += 1) {
        const content = safeSegments[index] ?? '';
        sendMetaEvent(res, {
          chunk: index + 1,
          total,
          mode: 'offline-fallback'
        });
        sendTextChunk(res, content, message);
        // Provide a brief delay to preserve streaming semantics for consumers and tests
        // even when we are synthesizing the stream locally.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      res.write('event: end\n');
      writeSseData(res, 'complete');

      clearInterval(heartbeat);
      res.end();
      return;
    }

    // Georgian system prompt for streaming
    const systemPrompt = `გამარჯობა! თქვენ ხართ გურულო AI - ბახმაროს გაქირავების პლატფორმის ოფიციალური Developer-ასისტენტი.
პლატფორმა ეკუთვნის აკაკი ცინცაძეს (კაკი) პირადი ნომრით 01019062020 და თქვენ ზრუნავთ სისტემის ტექნიკურ სიზუსტეზე.

**STREAMING MODE ACTIVE** - You are responding with real-time chunks.

Language: ყველა პასუხი ქართულ ენაზე 🇬🇪
Response style: პირდაპირი, ტექნიკური, კონკრეტული

Role: Senior Full-Stack Engineer for ouranos/Bakhmaro platform
Grammar: თითოეული წინადადება იყოს გრამატიკულად გამართული და ბუნებრივ ქართულ ენაზე.
File Guidance: თუ კონკრეტული ფაილის ნახვა ვერ ხერხდება, ნათლად აუხსენით შეზღუდვა და სთხოვეთ ზუსტი ბილიკი ან დამატებითი დეტალი.`;

    try {
      // Use streaming mode from Groq service
      const streamResponse = await groqService.askGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ], true); // Enable streaming

      if (typeof streamResponse === 'string') {
        // Simple string response - chunk it
        const chunks = streamResponse.match(/.{1,50}/g) || [streamResponse];

        for (let i = 0; i < chunks.length; i++) {
          sendTextChunk(res, chunks[i], message);

          // Small delay for natural streaming effect
          await new Promise(resolve => setTimeout(resolve, 90));
        }
      } else {
        // Full response fallback
        const fallbackContent = resolveContent(streamResponse) || 'No response';
        const segments = splitFallbackIntoSegments(fallbackContent);
        const safeSegments = segments.length ? segments : [''];
        const total = safeSegments.length;
        for (let index = 0; index < total; index += 1) {
          sendMetaEvent(res, {
            chunk: index + 1,
            total,
            mode: 'offline'
          });
          sendTextChunk(res, safeSegments[index], message);
          // Slight delay for natural streaming effect
          await new Promise((resolve) => setTimeout(resolve, 90));
        }
      }

      // Send completion event without leaking forbidden markers
      res.write('event: end\n');
      writeSseData(res, 'complete');

    } catch (streamError) {
      console.error('🌊 Streaming error:', streamError.message);
      res.write('event: error\n');
      const safeError = sanitizeResponse(`Streaming failed: ${streamError.message}`, message);
      writeSseData(res, safeError || 'Streaming failed');
    }

    clearInterval(heartbeat);
    res.end();

  } catch (error) {
    console.error('❌ Stream endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Stream endpoint failed',
      message: error.message
    });
  }
});

module.exports = router;
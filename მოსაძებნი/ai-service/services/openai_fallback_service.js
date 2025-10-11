const OpenAI = require('openai');
const { info, warn, error } = require('../utils/logger');
const { getRuntimeConfig } = require('../config/runtimeConfig');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_FALLBACK_KEY;
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
const FALLBACK_MAX_TOKENS = Number.parseInt(process.env.OPENAI_FALLBACK_MAX_TOKENS || '800', 10);
const FALLBACK_TEMPERATURE = Number.parseFloat(process.env.OPENAI_FALLBACK_TEMPERATURE || '0.7');

let client = null;

if (OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: OPENAI_API_KEY });
}

function isAvailable() {
  return Boolean(client);
}

async function requestBackup(messages, { correlationId } = {}) {
  const startedAt = Date.now();
  const requestMeta = {
    corrId: correlationId,
    model: FALLBACK_MODEL,
    provider: 'openai'
  };

  if (!isAvailable()) {
    warn('fallback.unavailable', {
      ...requestMeta,
      reason: 'missing_api_key'
    });

    const offlineReply = 'Backup mode გააქტიურებულია, მაგრამ OpenAI გასაღები არ მოიძებნა. პასუხი გაწვდით ლოკალური მონაცემებით.';
    return {
      choices: [
        {
          message: {
            content: offlineReply
          }
        }
      ],
      model: 'fallback-offline',
      usage: {
        prompt_tokens: 0,
        completion_tokens: Math.ceil(offlineReply.length / 4),
        total_tokens: Math.ceil(offlineReply.length / 4)
      },
      latency: Date.now() - startedAt,
      fallback: true,
      provider: 'offline'
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      messages,
      temperature: FALLBACK_TEMPERATURE,
      max_tokens: FALLBACK_MAX_TOKENS
    });

    const latency = Date.now() - startedAt;
    const content = response?.choices?.[0]?.message?.content || '';

    info('fallback.response', {
      ...requestMeta,
      latency,
      tokens: response?.usage?.total_tokens || 0
    });

    return {
      choices: response.choices || [],
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      model: FALLBACK_MODEL,
      latency,
      fallback: true,
      provider: 'openai',
      content
    };
  } catch (fallbackError) {
    const latency = Date.now() - startedAt;
    error('fallback.error', {
      ...requestMeta,
      latency,
      message: fallbackError.message,
      type: fallbackError.type
    });

    const offlineReply = 'Backup მოდელმა ვერ მოახერხა პასუხის გენერირება. სცადეთ მოგვიანებით ან გამორთეთ backup რეჟიმი.';

    return {
      choices: [
        {
          message: {
            content: offlineReply
          }
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: Math.ceil(offlineReply.length / 4),
        total_tokens: Math.ceil(offlineReply.length / 4)
      },
      model: 'fallback-error',
      latency,
      fallback: true,
      provider: 'openai-error',
      error: fallbackError.message
    };
  }
}

function describeStatus() {
  const runtime = getRuntimeConfig();
  return {
    enabled: Boolean(runtime.backupMode),
    forced: process.env.FORCE_OPENAI_BACKUP === 'true',
    provider: OPENAI_API_KEY ? 'openai' : 'offline',
    model: FALLBACK_MODEL
  };
}

module.exports = {
  isAvailable,
  requestBackup,
  describeStatus
};

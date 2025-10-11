const modelAnalytics = require('./model_analytics');
const connectionManager = require('./groq_connection_manager');
const fallbackService = require('./openai_fallback_service');
const { getModelStrategy, isBackupModeEnabled } = require('../config/runtimeConfig');
const logger = require('../utils/logger');
const { resolveGroqApiKey } = require('../../shared/secretResolver');

const { key: resolvedGroqKey } = resolveGroqApiKey();
if (resolvedGroqKey && process.env.GROQ_API_KEY !== resolvedGroqKey) {
  process.env.GROQ_API_KEY = resolvedGroqKey;
}

const GROQ_API_KEY = resolvedGroqKey;
const FORCE_OFFLINE_MODE = process.env.AI_OFFLINE_MODE === 'true';
const isGroqConfigured = Boolean(GROQ_API_KEY) && !FORCE_OFFLINE_MODE;

if (!isGroqConfigured) {
  logger.warn('groq.configuration', {
    corrId: 'startup',
    reason: GROQ_API_KEY ? 'offline_mode' : 'missing_key'
  });
} else {
  logger.info('groq.configuration', { corrId: 'startup', status: 'ready' });
}

function buildOfflineResponse(messages = [], correlationId = 'offline') {
  const userMessage = messages[messages.length - 1]?.content || '';
  const preview = userMessage.replace(/\s+/g, ' ').slice(0, 160);
  const timestamp = new Date().toISOString();

  const offlineReply = [
    '🔌 **Offline Mode აქტიურია** – გურულო მუშაობს ლოკალური ცოდნით.',
    userMessage
      ? `შენი ბოლო შეტყობინება: "${preview}${userMessage.length > 160 ? '…' : ''}"`
      : 'შეტყობინება არ არის მოწოდებული.',
    'მიმდინარეობს სრული LLM კავშირის აღდგენა. ამ პერიოდში შეგვიძლია მოგაწოდოთ ზოგადი გზამკვლევი ან მივუთითოთ სისტემის ფაილები.'
  ].join('\n\n');

  logger.warn('groq.offline_response', {
    corrId: correlationId,
    timestamp,
    preview,
    messageLength: userMessage.length
  });

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
    model: 'offline-mock',
    latency: 12,
    content: offlineReply,
    offline: true,
    timestamp
  };
}

function selectOptimalModel(messages) {
  const strategy = getModelStrategy();
  const smallModel = strategy?.smallModel?.model || 'llama-3.1-8b-instant';
  const largeModel = strategy?.largeModel?.model || 'llama-3.3-70b-versatile';
  const threshold = Number.parseInt(
    process.env.GROQ_LARGE_MODEL_THRESHOLD || strategy?.largeModel?.thresholdChars || 220,
    10
  );
  const keywords = (strategy?.largeModel?.keywords || []).map((word) => word.toLowerCase());

  const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const messageLength = userMessage.length;
  const containsKeyword = keywords.some((keyword) => keyword && userMessage.includes(keyword));

  const needsComplexAnalysis = messageLength > threshold || containsKeyword;

  if (process.env.GROQ_FORCE_MODEL) {
    return process.env.GROQ_FORCE_MODEL;
  }

  return needsComplexAnalysis ? largeModel : smallModel;
}

function createCorrelationId(prefix = 'groq') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function askGroq(messages, enableStreaming = 'auto', retryCount = 0) {
  const MAX_RETRIES = 3;
  const RATE_LIMIT_DELAY = [2000, 5000, 10000]; // Progressive backoff delays
  const correlationId = createCorrelationId('groq');

  if (!isGroqConfigured) {
    return buildOfflineResponse(messages, correlationId);
  }

  // Validate request format before sending
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid messages array: must be non-empty array');
  }

  // Validate each message structure
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      throw new Error('Invalid message format: each message must have role and content');
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw new Error(`Invalid role: ${msg.role}. Must be system, user, or assistant`);
    }
    if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
      throw new Error('Invalid content: must be non-empty string');
    }
  }

  if (isBackupModeEnabled()) {
    logger.info('groq.fallback_active', { corrId: correlationId, reason: 'manual_backup_mode' });
    return fallbackService.requestBackup(messages, { correlationId });
  }

  try {
    const selectedModel = selectOptimalModel(messages);
    const userMessage = messages[messages.length - 1]?.content || '';

    // ავტომატური სტრიმინგის ჩართვა უმეტეს შემთხვევაში
    let shouldStream = enableStreaming === true;

    if (enableStreaming === 'auto') {
      // სტრიმინგი ყოველთვის ჩართული, გარდა ძალიან მოკლე მესიჯებისა
      shouldStream = userMessage.length > 15; // მხოლოდ 15+ სიმბოლოიანი მესიჯებისთვის
    }

    logger.info('groq.request', {
      corrId: correlationId,
      model: selectedModel,
      messagesCount: messages.length,
      streaming: shouldStream,
      messageLength: userMessage.length
    });

    // SOL-204: Enhanced model parameters with ENV control
    const temperature = Number(process.env.GURULO_TEMP ?? 0.7);
    const requestConfig = {
      model: selectedModel,
      messages: messages,
      temperature: temperature,     // SOL-204: ENV controlled temperature (default 0.7)
      max_tokens: Math.min(selectedModel === 'llama-3.3-70b-versatile' ? 4000 : 2200, 4000), // SOL-203: 2200-4000 range
      top_p: 0.9,          // SOL-203: 0.9 as specified
      presence_penalty: 0.0, // SOL-203: 0.0 presence penalty
      stream: shouldStream,
      stop: null
    };

    const startTime = Date.now();

    // Get optimal warm connection
    const warmClient = await connectionManager.getOptimalConnection();

    if (shouldStream) {
      // Return streaming response with warm connection
      const streamResponse = await warmClient.post('/chat/completions', requestConfig, {
        responseType: 'stream',
        timeout: 60000 // Increased to 60 seconds for streaming to handle slow connections
      });

      // Add model info to stream response
      streamResponse.model = selectedModel;
      return streamResponse;
    }

    const response = await warmClient.post('/chat/completions', requestConfig, {
      timeout: 45000 // Increased to 45 seconds for regular requests
    });
    const latency = Date.now() - startTime;

    // Enhanced response validation with comprehensive error handling
    if (!response?.data) {
      logger.error('groq.empty_response', { corrId: correlationId, hasResponse: Boolean(response) });
      throw new Error('Groq API: ცარიელი ან არასწორი რესპონსი');
    }
    // Ultra-safe access to choices array with fallback protection
    const choices = response?.data?.choices;
    if (!response?.data) {
      logger.error('groq.empty_response', { corrId: correlationId });
      throw new Error('Groq API: პასუხი არ მიღებულა');
    }

    if (!Array.isArray(choices) || choices.length === 0) {
      logger.error('groq.invalid_choices', {
        corrId: correlationId,
        hasData: !!response.data,
        length: choices?.length || 0
      });
      throw new Error('Groq API: choices მასივი არ არის ან ცარიელია');
    }

    // Safe access to first choice with null checking
    const choice = choices[0];
    if (!choice?.message?.content) {
      logger.error('groq.invalid_choice_structure', {
        corrId: correlationId,
        hasMessage: !!choice?.message,
        contentType: typeof choice?.message?.content
      });
      throw new Error('Groq API: არასწორი choice სტრუქტურა ან ცარიელი content');
    }

    const aiReply = choice.message.content;

    // Record analytics
    modelAnalytics.recordRequest(
      selectedModel,
      latency,
      true,
      response.data.usage?.total_tokens || 0
    );

    logger.info('groq.response', {
      corrId: correlationId,
      model: selectedModel,
      latency,
      tokens: response.data.usage?.total_tokens || 0
    });

    // Return both formats for compatibility
    const responseObject = {
      choices: [{
        message: {
          content: aiReply
        }
      }],
      usage: response.data.usage,
      model: selectedModel,
      latency: latency
    };

    // Also add the content directly for backward compatibility
    responseObject.content = aiReply;

    return responseObject;

  } catch (error) {
    const currentModel = selectOptimalModel(messages); // Get model in error context
    logger.error('groq.error', {
      corrId: correlationId,
      status: error.response?.status,
      message: error.message,
      code: error.code,
      retryCount,
      hasApiKey: !!GROQ_API_KEY,
      isTimeout: error.code === 'ECONNABORTED',
      isNetworkError: error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED',
      selectedModel: currentModel
    });

    // Enhanced retry logic for transient errors with rate limiting handling
    const isRetryableError = 
      error.response?.status === 429 || // Rate limit
      error.response?.status >= 500 || // Server errors
      error.code === 'ECONNABORTED' || // Timeout
      error.code === 'ENOTFOUND' || // DNS resolution failed
      error.code === 'ECONNREFUSED' || // Connection refused
      error.message?.includes('Cannot read properties of undefined') ||
      error.message?.includes('Network Error');

    if (isRetryableError && retryCount < MAX_RETRIES) {
      let delay;

      // Special handling for rate limits
      if (error.response?.status === 429) {
        // Use rate limit specific delays
        delay = RATE_LIMIT_DELAY[retryCount] || 10000;
        logger.warn('groq.retry_rate_limit', {
          corrId: correlationId,
          delay,
          attempt: retryCount + 1
        });

        connectionManager.recordFailure();
      } else {
        // Regular exponential backoff for other errors
        delay = Math.min(2000 * Math.pow(2, retryCount), 10000);
        logger.warn('groq.retry', {
          corrId: correlationId,
          delay,
          attempt: retryCount + 1,
          error: error.code || 'Unknown'
        });
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      return askGroq(messages, enableStreaming, retryCount + 1);
    }

    // More specific error messages with connection diagnostics and user guidance
    if (error.response?.status === 401) {
      throw new Error('🔑 Groq API: არასწორი API Key - გთხოვთ შეამოწმოთ კონფიგურაცია');
    } else if (error.response?.status === 429) {
      throw new Error('⏰ AI სერვისი დროებით გადატვირთულია. გთხოვთ, რამდენიმე წუთში კვლავ სცადოთ. (Rate limit მიღწეულია)');
    } else if (error.response?.status === 502 || error.response?.status === 503) {
      throw new Error('🔧 AI სერვისი დროებით მიუწვდომელია ტექნიკური სამუშაოების გამო. კვლავ სცადეთ რამდენიმე წუთში.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('⏱️ პასუხის მოლოდინის დრო გავიდა. შეიძლება ინტერნეტ კავშირი ნელია. კვლავ სცადეთ.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('🌐 ინტერნეტ კავშირის პრობლემა - გთხოვთ შეამოწმოთ კავშირი და კვლავ სცადოთ');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('🚫 კავშირი უარყოფილია - შეიძლება ფაიარვოლის ან პროქსის პრობლემა');
    } else {
      // Provide fallback response for unknown errors
      if (fallbackService.isAvailable()) {
        logger.warn('groq.error_fallback', { corrId: correlationId, reason: 'unknown_error' });
        return fallbackService.requestBackup(messages, { correlationId });
      }

      const fallbackMessage = '🤖 AI ასისტენტი დროებით მიუწვდომელია. გთხოვთ, მოკლე ხანში კვლავ სცადოთ.';
      throw new Error(fallbackMessage);
    }
  }
}

// Enhanced Groq health check function
async function checkGroqHealth() {
  if (!isGroqConfigured) {
    return { status: GROQ_API_KEY ? 'offline_mode' : 'no_api_key', available: false, offline: true };
  }

  try {
    const healthMessages = [
      {
        role: 'user',
        content: 'test'
      }
    ];

    const startTime = Date.now();
    const response = await askGroq(healthMessages);
    const latency = Date.now() - startTime;

    // Get connection pool statistics safely
    let poolStats = { warmConnections: 0, activeConnections: 0 };
    try {
      if (connectionManager && typeof connectionManager.getPoolStats === 'function') {
        poolStats = connectionManager.getPoolStats();
      }
    } catch (error) {
      logger.warn('groq.pool_stats_unavailable', { error: error.message });
    }

    const status = {
      status: 'connected',
      available: true,
      latency: latency,
      model: 'hybrid_8b_70b',
      responseReceived: !!response.choices?.[0],
      architecture: 'Smart model selection based on query complexity',
      connectionPool: poolStats,
      warmConnections: poolStats.warmConnections || 0,
      optimization: 'Connection pooling active'
    };

    logger.info('groq.health', status);
    return status;
  } catch (error) {
    logger.error('groq.health_failed', { message: error.message });

    return {
      status: 'failed',
      available: false,
      error: error.message,
      code: error.status || error.code || 'unknown'
    };
  }
}

// Simplified and natural system prompt
const SYSTEM_PROMPT = `You are an AI developer assistant for the Bakhmaro booking platform. 
Answer user questions in natural Georgian, using clear and concise language. 
When asked for general information about the site, read the relevant code and describe the structure and features (e.g. cottages, hotels, booking system). 
Only list capabilities if explicitly asked about them.

Context: Node.js/React full-stack application with Firebase integration.`;

module.exports = {
  askGroq,
  checkGroqHealth
};
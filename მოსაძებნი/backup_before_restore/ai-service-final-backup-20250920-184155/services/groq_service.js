const axios = require('axios');
const modelAnalytics = require('./model_analytics');
const connectionManager = require('./groq_connection_manager');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY is not set in environment variables');
  console.error('🔧 Please add GROQ_API_KEY to your environment variables');
  console.error('🌐 Check Groq Console: https://console.groq.com/keys');
} else {
  const keyLength = GROQ_API_KEY.length;
  const maskedKey = GROQ_API_KEY.substring(0, 7) + '***' + GROQ_API_KEY.substring(keyLength - 4);
  console.log(`✅ Groq API key configured: ${maskedKey} (${keyLength} chars)`);
  
  // Validate key format
  if (!GROQ_API_KEY.startsWith('gsk_')) {
    console.warn('⚠️ Groq API key format warning: Expected format starts with "gsk_"');
  }
}

// Smart model selection with three tiers: small, medium, large
function selectOptimalModel(messages) {
  const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const messageLength = userMessage.length;

  // Import model router for intelligent decisions
  const { routeQuery } = require('../policy/model_router');
  const routingDecision = routeQuery(userMessage);

  console.log(`🎯 Model Router Decision:`, routingDecision);

  // Enhanced model selection based on routing policy
  if (routingDecision.model === 'none') {
    return null; // Static response, no model needed
  }
  
  if (routingDecision.model === 'large') {
    // Use most powerful model for complex tasks
    return 'llama-3.3-70b-versatile';
  }
  
  if (routingDecision.model === 'small') {
    // Use fastest model for simple tasks
    return 'llama-3.1-8b-instant';
  }

  // Default fallback
  return 'llama-3.1-8b-instant';
}

async function askGroq(messages, enableStreaming = 'auto', retryCount = 0) {
  const MAX_RETRIES = 3;
  const RATE_LIMIT_DELAY = [2000, 5000, 10000]; // Progressive backoff delays

  if (!GROQ_API_KEY) {
    throw new Error('Groq API key არ არის კონფიგურირებული');
  }

  // Validate request format before sending
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid messages array: must be non-empty array');
  }

  // Check if we need a model at all
  const selectedModel = selectOptimalModel(messages);
  if (selectedModel === null) {
    // Return static greeting response without calling Groq
    const userMessage = messages[messages.length - 1]?.content || '';
    const greetingResponses = [
      'გამარჯობა! 👋 მე ვარ გურულო - ბახმაროს AI ასისტენტი. როგორ შემიძლია დაგეხმარო?',
      'გაუმარჯოს! 🤖 მზად ვარ კოდის ანალიზისა და ტექნიკური დახმარებისთვის.',
      'სალამი! ✨ რით შეგიძლია დაგეხმარო დღეს?'
    ];
    
    const response = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
    
    return {
      choices: [{
        message: {
          content: response
        }
      }],
      model: 'gurulo_static',
      usage: { total_tokens: 0 },
      latency: 0,
      content: response
    };
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

  try {
    const selectedModel = selectOptimalModel(messages);
    const userMessage = messages[messages.length - 1]?.content || '';

    // ავტომატური სტრიმინგის ჩართვა უმეტეს შემთხვევაში
    let shouldStream = enableStreaming === true;

    if (enableStreaming === 'auto') {
      // სტრიმინგი ყოველთვის ჩართული, გარდა ძალიან მოკლე მესიჯებისა
      shouldStream = userMessage.length > 15; // მხოლოდ 15+ სიმბოლოიანი მესიჯებისთვის
    }

    console.log('🚀 Groq API Request:', {
      model: selectedModel,
      messagesCount: messages.length,
      streaming: shouldStream,
      messageLength: userMessage.length,
      timestamp: new Date().toISOString(),
      reasoning: selectedModel === 'llama3-70b-8192' ? 'Critical complex analysis' : 'Fast 8B model',
      streamingReason: shouldStream ? 'Auto-enabled for better UX' : 'Disabled for short queries'
    });

    // SOL-204: Enhanced model parameters with ENV control
    const temperature = Number(process.env.GURULO_TEMP ?? 0.6);
    const requestConfig = {
      model: selectedModel,
      messages: messages,
      temperature: temperature,     // SOL-204: ENV controlled temperature (default 0.6)
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
      console.error('❌ Groq API: Empty or invalid response', { response });
      throw new Error('Groq API: ცარიელი ან არასწორი რესპონსი');
    }

    // Debug log full response structure for troubleshooting
    // SOL-203: Compact Response Logging (only in debug mode)
    if (process.env.DEBUG_MODE === 'true') {
      console.log('🔍 Groq Response:', {
        status: !!response.data,
        choices: response.data?.choices?.length || 0,
        tokens: response.data?.usage?.total_tokens || 0
      });
    }

    // Ultra-safe access to choices array with fallback protection
    const choices = response?.data?.choices;
    if (!response?.data) {
      console.error('❌ Groq API: No response data received');
      throw new Error('Groq API: პასუხი არ მიღებულა');
    }

    if (!Array.isArray(choices) || choices.length === 0) {
      console.error('❌ Groq API: Invalid choices structure', {
        hasData: !!response.data,
        choices,
        type: typeof choices,
        length: choices?.length,
        responseKeys: Object.keys(response.data || {}),
        fullData: JSON.stringify(response.data, null, 2)
      });
      throw new Error('Groq API: choices მასივი არ არის ან ცარიელია');
    }

    // Safe access to first choice with null checking
    const choice = choices[0];
    if (!choice?.message?.content) {
      console.error('❌ Groq API: Invalid choice structure', {
        choice,
        hasMessage: !!choice?.message,
        hasContent: !!choice?.message?.content,
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

    console.log('✅ Groq API Response Success:', {
      model: selectedModel,
      responseLength: aiReply.length,
      latency: `${latency}ms`,
      usage: response.data.usage,
      efficiency: selectedModel === 'llama3-8b-8192' ? 'Fast Model' : 'Precision Model'
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
    console.error('❌ Groq API Error Details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      retryCount,
      timestamp: new Date().toISOString(),
      hasApiKey: !!GROQ_API_KEY,
      apiKeyLength: GROQ_API_KEY ? GROQ_API_KEY.length : 0,
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
        console.log(`⏰ Rate limit detected. Waiting ${delay}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);

        // Record rate limit for connection manager
        connectionManager.recordFailure();
      } else {
        // Regular exponential backoff for other errors
        delay = Math.min(2000 * Math.pow(2, retryCount), 10000);
        console.log(`🔄 Retrying Groq API call in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        console.log(`🔧 Error type: ${error.code || 'Unknown'} - ${error.message}`);
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
      const fallbackMessage = '🤖 AI ასისტენტი დროებით მიუწვდომელია. გთხოვთ, მოკლე ხანში კვლავ სცადოთ.';
      throw new Error(fallbackMessage);
    }
  }
}

// Enhanced Groq health check function
async function checkGroqHealth() {
  console.log('🤖 [Groq Health] Starting Groq health check...');

  if (!process.env.GROQ_API_KEY) {
    console.log('🤖 [Groq Health] No API key found');
    return { status: 'no_api_key', available: false };
  }

  try {
    console.log('🤖 [Groq Health] Testing Groq API connection...');

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
      console.warn('⚠️ Pool stats unavailable:', error.message);
    }

    console.log('🤖 [Groq Health] Groq health check passed');

    return {
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
  } catch (error) {
    console.error('🤖 [Groq Health] Groq health check failed:', error);

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
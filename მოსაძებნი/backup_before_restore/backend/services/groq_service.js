const axios = require('axios');
const modelAnalytics = require('./model_analytics');
const connectionManager = require('./groq_connection_manager');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn('⚠️ GROQ_API_KEY is not set in environment variables');
}

// Ultra-aggressive model selection for maximum performance
function selectOptimalModel(messages) {
  const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const messageLength = userMessage.length;

  // მხოლოდ ᲠᲔᲐᲚᲣᲠᲐᲓ რთული კოდის ანალიზისთვის 70B მოდელი
  const criticalComplexPatterns = [
    /სრული\s*(კოდის|პროექტის|სისტემის)\s*ანალიზი/,
    /რომელი?\s*ფუნქციები?.*?(შეიცავს|მუშაობს).*?(ფაილ|მოდულ|კლას)/,
    /როგორ\s*მუშაობს.*?(backend|frontend|database|integration)/,
    /ახსენი\s*დეტალურად.*?(არქიტექტურა|იმპლემენტაცია)/,
    /ანალიზი.*?(typescript|javascript|react|node\.js)/
  ];

  // Simple queries - 95% ყველაფერი
  const ultraSimplePatterns = [
    /^(გამარჯობა|hello|hi|გამარჯობათ|სალამი)/,
    /^(მადლობა|thanks|thank you|გმადლობთ)/,
    /^(მომწერე|write|დაწერე)\s*(მოკლე|short)?\s*(აღწერა|description)/,
    /საიტის?\s*(აღწერა|ინფორმაცია|overview)/,
    /რა\s*არის\s*ეს?\s*საიტი?/,
    /რას\s*აკეთებს?\s*(ეს\s*)?(პლატფორმა|საიტი)?/,
    /^[\d\+\-\*\/\s\(\)]+[\s\?\!]*$/, // მათემატიკა
    /^რამდენია/,
    /როგორ\s*ხარ/
  ];

  // მარტივი კითხვები
  const isUltraSimple = ultraSimplePatterns.some(pattern => pattern.test(userMessage));
  const isCriticalComplex = criticalComplexPatterns.some(pattern => pattern.test(userMessage));
  
  // ძალიან მოკლე მესიჯები - ყოველთვის 8B
  if (messageLength < 30) {
    return 'llama3-8b-8192';
  }

  // მარტივი კითხვები - ყოველთვის 8B
  if (isUltraSimple) {
    return 'llama3-8b-8192';
  }
  
  // მხოლოდ 5% კითხვებისთვის 70B (მართლაც რთული კოდის ანალიზი)
  if (isCriticalComplex && messageLength > 100) {
    return 'llama3-70b-8192';
  }

  // ყველაფერი სხვა - 8B მოდელი (95% შემთხვევა)
  return 'llama3-8b-8192';
}

async function askGroq(messages, enableStreaming = 'auto') {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key არ არის კონფიგურირებული');
  }

  try {
    const selectedModel = selectOptimalModel(messages);
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // ავტომატური სტრიმინგის ჩართვა უმეტეს შემთხვევაში
    let shouldStream = enableStreaming === true;
    
    if (enableStreaming === 'auto') {
      // სტრიმინგი ყოველთვის ჩართული, გარდა ძალიან მოკლე მესიჯებისა
      shouldStream = userMessage.length > 15; // მხოლოდ 15+ სიმბოლოიანი მესიჯებისთვის
      
      // მარტივი გამოთვლებისთვისაც არ გვჭირდება სტრიმინგი
      if (/^[\d\+\-\*\/\s\(\)]+[\s\?\!]*$/.test(userMessage)) {
        shouldStream = false;
      }
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

    // Ultra-optimized configuration
    const requestConfig = {
      model: selectedModel,
      messages: messages,
      temperature: 0.4, // ყველასთვის დაბალი ტემპერატურა სტაბილურობისთვის
      max_tokens: selectedModel === 'llama3-8b-8192' ? 400 : 1200, // შემცირებული ტოკენები სისწრაფისთვის
      top_p: 0.85, // ფოკუსირებული პასუხები
      stream: shouldStream,
      stop: null
    };

    const startTime = Date.now();

    // Get optimal warm connection
    const warmClient = await connectionManager.getOptimalConnection();

    if (shouldStream) {
      // Return streaming response with warm connection
      return warmClient.post('/chat/completions', requestConfig, {
        responseType: 'stream',
        timeout: 10000 // 10 წამიანი timeout სტრიმინგისთვის
      });
    }

    const response = await warmClient.post('/chat/completions', requestConfig, {
      timeout: 5000 // 5 წამიანი timeout არა-სტრიმინგისთვის
    });
    const latency = Date.now() - startTime;

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('Groq API: უმისაღებო რესპონსი');
    }

    const aiReply = response.data.choices[0].message.content;

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
    console.error('❌ Groq API Error Details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      timestamp: new Date().toISOString()
    });

    // More specific error messages
    if (error.response?.status === 401) {
      throw new Error('Groq API: არასწორი API Key');
    } else if (error.response?.status === 429) {
      throw new Error('Groq API: Rate limit გადაცილება');
    } else if (error.response?.status === 502 || error.response?.status === 503) {
      throw new Error('Groq API: სერვერი დროებით მიუწვდომელია');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Groq API: კავშირის timeout');
    } else {
      throw new Error(`Groq API: ${error.response?.data?.error?.message || error.message}`);
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

    // Get connection pool statistics
    const poolStats = connectionManager.getPoolStats();

    console.log('🤖 [Groq Health] Groq health check passed');

    return {
      status: 'connected',
      available: true,
      latency: latency,
      model: 'hybrid_8b_70b',
      responseReceived: !!response.choices?.[0],
      architecture: 'Smart model selection based on query complexity',
      connectionPool: poolStats,
      warmConnections: poolStats.warmConnections,
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
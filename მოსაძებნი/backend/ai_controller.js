const express = require('express');
const { getMemory, addToMemory, storeGrammarCorrection, getGrammarFixes } = require('./memory_controller');
const { ensureNaturalGeorgian, analyzeGeorgianGrammar } = require('./utils/enhanced_georgian_validator');
const { askGroq, checkGroqHealth } = require('./services/groq_service');
const resourceOptimizer = require('./services/resource_optimizer');
const connectionManager = require('./services/groq_connection_manager');
// const translationService = require('./services/translation_service'); // Disabled - causes text duplication

const router = express.Router();

// Pending operations storage (in-memory for simplicity)
const pendingOps = {};

// Greeting cadence controls
const userGreetingTimestamps = new Map();
const GREETING_THROTTLE_MS = 5 * 60 * 60 * 1000; // 5 hours
const ASSISTANT_GREETING_RE = /^(?:👋\s*)?(?:დილა მშვიდობისა|შუადღე მშვიდობისა|საღამო მშვიდობისა|ღამე მშვიდობისა|გამარჯობა|გამარჯობათ|გაუმარჯოს)/i;
const GREETING_TOKEN_SET = new Set([
  'გამარჯობა',
  'გამარჯობათ',
  'გაუმარჯოს',
  'გაგიმარჯო',
  'სალამი',
  'დილა',
  'შუადღე',
  'საღამო',
  'ღამე',
  'მშვიდობისა',
  'მშვიდობის',
  'hello',
  'hi',
  'hey',
]);

// Simplified health check endpoint - always returns 200
router.get('/health', (req, res) => {
  console.log('[AI Health Check] Simple health check called');

  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    ai_controller: 'loaded',
    endpoints: {
      chat: '/api/ai/chat',
      status: '/api/ai/status',
      health: '/api/ai/health'
    },
    version: '2.1'
  };

  res.json(healthStatus);
});

// Groq status check endpoint
router.get('/status', async (req, res) => {
  try {
    const apiKeyExists = !!process.env.GROQ_API_KEY;
    const apiKeyLength = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0;

    console.log('🔍 GROQ API Key Status:', {
      exists: apiKeyExists,
      length: apiKeyLength,
      preview: process.env.GROQ_API_KEY ? `${process.env.GROQ_API_KEY.substring(0, 8)}...` : 'None'
    });

    let groqHealth = { status: 'not_configured', available: false };

    if (apiKeyExists) {
      groqHealth = await checkGroqHealth();
    }

    res.json({
      groq: {
        configured: apiKeyExists,
        apiKeyLength: apiKeyLength,
        status: groqHealth.status,
        available: groqHealth.available,
        model: 'llama3-70b-8192',
        latency: groqHealth.latency || null,
        fallbackMode: !groqHealth.available
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasEnvFile: require('fs').existsSync('.env')
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
      groq: {
        configured: !!process.env.GROQ_API_KEY,
        status: 'error',
        available: false
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Streaming chat endpoint
router.post('/stream', async (req, res) => {
  try {
    const { message, userId = '01019062020' } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[AI Stream] Processing streaming message from user ${userId}:`, message);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Check cache first for streaming too
    const cacheKey = cacheService.generateCacheKey(message, userId);
    const cachedResponse = cacheService.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(`🎯 [AI Stream] Cache hit for user ${userId}`);
      res.write(`data: ${JSON.stringify({ type: 'complete', content: cachedResponse.response, cached: true })}\n\n`);
      res.end();
      return;
    }

    // Get user memory for context (limited)
    const userMemory = await getMemory(userId);

    if (process.env.GROQ_API_KEY) {
      try {
        // Natural system prompt for streaming
        const memoryContext = userMemory?.data ? userMemory.data.substring(0, 100) : '';
        const systemPrompt = `You are an AI assistant for the Bakhmaro booking platform. Answer in natural Georgian. 
${memoryContext ? `Previous context: ${memoryContext}` : ''}`;

        const groqStream = await askGroq([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ], true);

        let fullResponse = '';

        groqStream.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                res.write(`data: ${JSON.stringify({ type: 'done', content: fullResponse })}\n\n`);
                res.end();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';

                if (content) {
                  fullResponse += content;
                  res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
                }
              } catch (parseError) {
                console.log('Parse error (non-critical):', parseError.message);
              }
            }
          }
        });

        groqStream.data.on('end', async () => {
          console.log('✅ [AI Stream] Stream completed');

          // Cache the completed response
          cacheService.cacheResponse(cacheKey, fullResponse, {
            service: 'groq_stream',
            timestamp: new Date().toISOString(),
            userId: userId
          });

          // Store conversation in memory (summarized)
          const memoryEntry = `Q: ${message.substring(0, 100)}\nA: ${fullResponse.substring(0, 150)}`;
          await addToMemory(userId, memoryEntry);

          res.write(`data: ${JSON.stringify({ type: 'complete', fullResponse })}\n\n`);
          res.end();
        });

        groqStream.data.on('error', (error) => {
          console.error('❌ [AI Stream] Stream error:', error);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        });

      } catch (groqError) {
        console.error('❌ [AI Stream] Groq error:', groqError.message);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI სისტემა დროებით მიუწვდომელია' })}\n\n`);
        res.end();
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Groq API არ არის კონფიგურირებული' })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[AI Stream] Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Import cache service
const cacheService = require('./services/ai_cache_service');

// Resource optimization status endpoint
router.get('/resources', (req, res) => {
  try {
    const resourceStats = resourceOptimizer.getResourceStats();
    const connectionStats = connectionManager.getPoolStats();
    const recommendations = resourceOptimizer.getOptimizationRecommendations();

    res.json({
      resources: resourceStats,
      connections: connectionStats,
      optimization: recommendations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Resource stats error:', error);
    res.status(500).json({
      error: 'Resource monitoring error',
      message: error.message
    });
  }
});

// Import file access service
const fileAccessService = require('./services/fileService');

// Chat endpoint - with ultra-aggressive streaming for maximum performance
router.post('/chat', async (req, res) => {
  try {
    const { message, userId = '01019062020', conversationHistory = [], enableStreaming = 'auto' } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[AI Chat] Processing message from user ${userId}:`, message);

    // PRIORITY: Check for pending operations first
    const pendingOp = pendingOps[userId];
    if (pendingOp) {
      const msg = message.toLowerCase().trim();
      
      // Check for confirmation
      if (/^(დიახ|კი|შეცვალე)\b/i.test(msg)) {
        try {
          const result = await performLabelEdit(pendingOp);
          delete pendingOps[userId];
          
          return res.json({
            response: `✅ ტექსტი წარმატებით შეიცვალა ${result.filesModified} ფაილში. "${pendingOp.oldLabel}" -> "${pendingOp.newLabel}"`,
            type: 'label_edit_completed',
            filesModified: result.filesModified
          });
        } catch (error) {
          delete pendingOps[userId];
          return res.json({
            response: `❌ შეცდომა ტექსტის შეცვლისას: ${error.message}`,
            type: 'label_edit_error'
          });
        }
      } 
      // Check for cancellation
      else if (/^(არა|გაუქმ|არა\s*შეცვალო|ნუ)/i.test(msg)) {
        delete pendingOps[userId];
        return res.json({
          response: '❌ ცვლილება გაუქმდა.',
          type: 'label_edit_cancelled'
        });
      }
      // Neither confirmation nor cancellation
      else {
        return res.json({
          response: `⏳ გთხოვთ, დაადასტუროთ ცვლილება:\n\n"${pendingOp.oldLabel}" -> "${pendingOp.newLabel}"\n\nპასუხისთვის: "კი" ან "არა"`,
          type: 'label_edit_confirmation_needed',
          pendingOperation: pendingOp
        });
      }
    }

    // ავტომატური სტრიმინგი დიდი უმრავლესობისთვის (80-90% შემცირება perceived latency-ში)
    const shouldStream = enableStreaming === 'auto' ? message.length > 15 : enableStreaming;

    // 🎯 Enhanced query classification with better pattern matching
    const queryType = classifyQuery(message, conversationHistory, userId);
    console.log('🔍 Query classified as:', queryType);

    // Handle label edit requests
    if (typeof queryType === 'object' && queryType.type === 'label_edit_request') {
      const { oldLabel, newLabel } = queryType;
      const searchResults = await fileAccessService.searchInFiles(oldLabel);

      if (searchResults.length > 0) {
        const foundFiles = searchResults.map(result => 
          `${result.file}:${result.line} - ${result.content}`
        ).slice(0, 5).join('\n');

        // Store pending operation
        pendingOps[userId] = {
          oldLabel,
          newLabel,
          searchResults,
          timestamp: Date.now()
        };

        const response = `✅ ვიპოვე "${oldLabel}" შემდეგ ადგილებში:\n\n${foundFiles}\n\nგსურთ ყველა ადგილას შეცვლა "${newLabel}"-ით?\n\nპასუხისთვის: "კი" ან "არა"`;

        return res.json({
          response,
          type: 'label_edit_confirmation',
          searchResults: searchResults.slice(0, 10),
          oldLabel,
          newLabel,
          pendingOperation: true
        });
      } else {
        const response = `❌ ტექსტი "${oldLabel}" ვერ ვიპოვე პროექტში. გთხოვთ, შეამოწმოთ სწორად იყოს დაწერილი, ან მიუთითოთ ფაილის სახელი სადაც უნდა მოხდეს ცვლილება.`;

        return res.json({
          response,
          type: 'label_edit_not_found',
          oldLabel,
          newLabel
        });
      }
    }

    // Handle confirmation for label edits
    if (queryType === 'label_edit_request' && (message.includes('კი') || message.includes('შეცვალე'))) {
      // This would need additional context from previous request - implement session storage
      const response = 'განხორციელების ფუნქცია მზადდება...';
      return res.json({ response, type: 'label_edit_executing' });
    }

    // Handle static information queries with predefined responses
    if (queryType === 'static_info') {
      const siteSummary = require('./services/site_summary');
      let staticResponse = siteSummary.getStaticResponse('platform_overview');

      console.log(`📋 [Static Info] Serving predefined platform information`);

      return res.json({
        response: staticResponse,
        timestamp: new Date().toISOString(),
        service: 'static_info_predefined',
        cached: false,
        queryType: queryType,
        grammar: { score: 100, errors: [], suggestions: [] },
        enhanced: true,
        static: true
      });
    }

    // Handle general site overview queries
    if (queryType === 'site_overview') {
      const siteSummaryBulletList = `🏔️ **ბახმაროს ბუკინგ პლატფორმა**

• **კატეგორიები:**
  - კოტეჯები (Cottages)
  - სასტუმროები (Hotels)
  - ტრანსპორტი (Vehicles)
  - ცხენები (Horses)
  - სნოუმობილები (Snowmobiles)

• **ძირითადი ფუნქციები:**
  - ონლაინ ჯავშნის სისტემა
  - რეალურ დროში ხელმისაწვდომობის შემოწმება
  - ავტომატური ფასების გამოთვლა
  - კომისიის სისტემა პროვაიდერებისთვის
  - შიდა მესიჯინგ სისტემა
  - ადმინისტრაციული პანელი

• **ტექნოლოგიები:**
  - Frontend: React + TypeScript + Vite
  - Backend: Node.js + Express
  - Database: Firebase Firestore
  - AI Assistant: Groq (Llama3)
  - Styling: Tailwind CSS`;

      console.log(`📋 [Site Overview] Serving predefined bullet-point overview`);

      return res.json({
        response: siteSummaryBulletList,
        timestamp: new Date().toISOString(),
        service: 'site_overview_predefined',
        cached: false,
        queryType: queryType,
        grammar: { score: 100, errors: [], suggestions: [] },
        enhanced: true,
        static: true
      });
    }

    // Handle general how-it-works queries
    if (queryType === 'general_how_it_works') {
      const howItWorksResponse = `🔧 **როგორ მუშაობს ბახმაროს საიტი:**

🏗️ **არქიტექტურა:** React/Node.js/Firebase-ის კომბინაცია

📋 **ძირითადი პროცესი:**
1. მომხმარებლები ირჩევენ კოტეჯებს/სასტუმროებს/ტრანსპორტს
2. სისტემა ამოწმებს ხელმისაწვდომობას რეალურ დროში
3. ავტომატურად ითვლის ფასებს (სეზონური, ღამეების რაოდენობა, ადამიანები)
4. ჯავშნის შექმნის შემდეგ აგზავნის შეტყობინებებს
5. პროვაიდერებს აქვთ საკუთარი დაშბორდი მართვისთვის
6. ადმინები ხედავენ სრულ სტატისტიკას

💻 **მთავარი ფაილები:**
• BookingService.ts - ჯავშნის ლოგიკა
• BookingForm.tsx - ჯავშნის ფორმა
• AdminDashboard.tsx - ადმინ პანელი
• UserService.ts - მომხმარებლების მართვა
• PricingManager.tsx - ფასების გამოთვლა

🤖 **AI ასისტენტი:** კოდის ანალიზისა და დეველოპერების დახმარებისთვის`;

      console.log(`🔧 [How It Works] Serving predefined system explanation`);

      return res.json({
        response: howItWorksResponse,
        timestamp: new Date().toISOString(),
        service: 'general_how_it_works_predefined',
        cached: false,
        queryType: queryType,
        grammar: { score: 100, errors: [], suggestions: [] },
        enhanced: true,
        static: true
      });
    }

    // Check cache first
    const cacheKey = cacheService.generateCacheKey(message, userId, queryType);
    const cachedResponse = cacheService.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(`🎯 [AI Chat] Cache hit for user ${userId} (${queryType})`);
      return res.json({
        response: cachedResponse.response,
        timestamp: new Date().toISOString(),
        service: 'cache',
        cached: true,
        queryType: queryType,
        grammar: { score: 100, errors: [], suggestions: [] },
        enhanced: true
      });
    }

    // Get user memory for context (limited)
    const userMemory = await getMemory(userId);
    const grammarFixes = await getGrammarFixes(userId);

    // Limit conversation history to last 3 messages only
    const limitedHistory = conversationHistory.slice(-3);

    let response;
    let usedService = 'fallback';

    // Handle different query types with RAG system
    if (queryType === 'project_structure' || queryType === 'full_info') {
      console.log('🔍 [RAG] Processing comprehensive information request');
      response = await handleRAGQuery(message, userId, conversationHistory);
      usedService = 'rag_comprehensive_analysis';
    } else if (queryType === 'code_explanation' || queryType === 'how_it_works') {
      console.log('🔍 [RAG] Processing code analysis request');
      response = await handleRAGQuery(message, userId, conversationHistory);
      usedService = 'rag_code_analysis';
    } else if (queryType === 'greeting') {
      response = handleGreetingQuery(message, userId);
      usedService = 'simple_greeting';
    } else {
      // For general queries, also use RAG if they contain technical terms
      if (containsTechnicalTerms(message)) {
        console.log('🔍 [RAG] Processing technical query with RAG');
        response = await handleRAGQuery(message, userId, conversationHistory);
        usedService = 'rag_technical_query';
      }
    }

    // Try Groq first if available  
    console.log('🔑 API Key Check:', {
      exists: !!process.env.GROQ_API_KEY,
      length: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0,
      message: message.substring(0, 50)
    });

    if (process.env.GROQ_API_KEY) {
      try {
        // ზუსტად მიზანმიმართული პრომპტების გენერაცია
        const optimizedPrompt = generateOptimizedPrompt(queryType, userMemory, grammarFixes, {
          originalMessage: message,
          moduleContext: limitedHistory.length > 0 ? limitedHistory[0].content : '',
          codeSnippets: null, // ეს შეიძლება დაემატოს RAG-დან
          errorContext: null  // ეს შეიძლება დაემატოს error detection-დან
        });
        const systemPrompt = optimizedPrompt;

        // ტოკენების ოპტიმიზაცია კლასის მიხედვით
        const tokenLimits = {
          'project_structure': { system: 100, history: 0, user: 150 },
          'code_explanation': { system: 80, history: 100, user: 200 },
          'greeting': { system: 50, history: 0, user: 100 },
          'calculation': { system: 30, history: 0, user: 50 },
          'general': { system: 120, history: 150, user: 200 }
        };

        const limits = tokenLimits[queryType] || tokenLimits['general'];

        const messages = [
          { role: 'system', content: systemPrompt.substring(0, limits.system) },
          ...(limits.history > 0 ? limitedHistory.slice(-1).map(h => ({ 
            role: h.role, 
            content: h.content.substring(0, limits.history) 
          })) : []),
          { role: 'user', content: message.substring(0, limits.user) }
        ];

        // ავტომატური სტრიმინგით Groq-ის გამოძახება
        const groqResponse = await askGroq(messages, 'auto');

        response = groqResponse.choices[0].message.content;
        usedService = `groq_${groqResponse.model || 'unknown'}_specialized_prompt`;

        // Prompt performance logging
        const promptStats = promptManager.getUsageStats();
        console.log('✅ [AI Chat] Groq response with specialized prompt', {
          model: groqResponse.model,
          responseLength: response.length,
          queryType: queryType,
          promptOptimization: 'Specialized prompts for better accuracy',
          availablePromptTypes: promptStats.totalPrompts
        });
      } catch (groqError) {
        console.error('❌ [AI Chat] Groq error:', groqError.message);

        // Enhanced fallback response with Georgian validation
        let fallbackResponse;

        // Check if this might be a label edit request that wasn't caught
        if (/(?:ჩანაცვლ|შეცვლ|გადარქ|ამოიღ|შეცვალ|გადამარქვ|ტექსტ|წარწერ)/i.test(message)) {
          fallbackResponse = `მგონი გსურთ ტექსტის შეცვლა UI-ში. გთხოვთ, სწორად დაწეროთ ძველი და ახალი ტექსტი ბრჭყალებში:\n\nმაგალითად: "ძველი ტექსტი" შეცვლა "ახალი ტექსტი"-ით\n\nან: "ძველი" ჩანაცვლება "ახალი"-ით`;
        } else {
          fallbackResponse = generateFallbackResponse(message);
        }

        console.log('🔄 Switching to enhanced fallback mode');
        response = fallbackResponse;
        usedService = 'fallback_after_groq_error';
      }
    } else {
      console.warn('⚠️ [AI Chat] No GROQ_API_KEY found - using fallback mode');
      response = generateFallbackResponse(message);
      usedService = 'fallback_no_groq';
    }

    // Enhanced Georgian grammatical correction with fallback
    let validatedResponse = response;

    try {
      // Primary: Use Groq for advanced grammar correction
      const { validateAndFix } = require('./utils/enhanced_georgian_validator');
      validatedResponse = await validateAndFix(response);
      console.log('🇬🇪 Groq grammar correction applied successfully');
    } catch (groqError) {
      console.log('⚠️ Groq grammar correction failed, using sync fallback:', groqError.message);
      // Fallback: Use synchronous basic validator
      try {
        const { validateAndFixSync } = require('./utils/enhanced_georgian_validator');
        validatedResponse = validateAndFixSync(response);
        console.log('🔧 Sync grammar correction applied as fallback');
      } catch (syncError) {
        console.log('⚠️ Sync correction also failed, using raw response:', syncError.message);
        validatedResponse = response; // Last resort: use original response
      }
    }

    const grammarValidation = analyzeGeorgianGrammar(validatedResponse);

    // Cache the response for future use
    cacheService.cacheResponse(cacheKey, validatedResponse, {
      service: usedService,
      timestamp: new Date().toISOString(),
      userId: userId
    });

    // Store conversation in memory (summarized)
    const memoryEntry = `Q: ${message.substring(0, 100)}\nA: ${validatedResponse.substring(0, 150)}`;
    await addToMemory(userId, memoryEntry);

    // Store grammar corrections if found
    if (grammarValidation.errors && grammarValidation.errors.length > 0) {
      for (const error of grammarValidation.errors) {
        await storeGrammarCorrection(userId, error.found, error.suggestion);
      }
    }

    res.json({
      response: validatedResponse,
      timestamp: new Date().toISOString(),
      service: usedService,
      cached: false,
      grammar: {
        score: grammarValidation.score || 100,
        errors: grammarValidation.errors || [],
        suggestions: grammarValidation.suggestions || []
      },
      enhanced: true
    });

  } catch (error) {
    console.error('[AI Chat] Chat error:', error);
    res.status(500).json({
      error: 'Chat service error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ზუსტად მიზანმიმართული პრომპტების გენერატორი
const promptManager = require('./services/prompt_manager');

function generateOptimizedPrompt(queryType, userMemory, grammarFixes, additionalContext = {}) {
  const memoryContext = userMemory?.data ? userMemory.data.substring(0, 100) : '';

  // Context-ის მომზადება prompt manager-ისთვის
  const contextData = {
    message: additionalContext.originalMessage || '',
    siteContext: memoryContext,
    moduleContext: additionalContext.moduleContext,
    codeSnippets: additionalContext.codeSnippets,
    errorContext: additionalContext.errorContext,
    technicalContext: additionalContext.technicalContext
  };

  // მიზანმიმართული პრომპტის მიღება
  const promptData = promptManager.classifyAndGetPrompt(
    additionalContext.originalMessage || '', 
    contextData
  );

  // Token optimization
  const optimizedPrompt = promptManager.optimizeForTokens(promptData, 150);

  console.log(`🎯 Using specialized prompt type: ${queryType}`);

  return optimizedPrompt.system;
}

const getGreetingCacheKey = (userId) => {
  if (typeof userId === 'string' && userId.trim()) {
    return userId.trim();
  }
  return 'anonymous';
};

const canSendGreetingToUser = (userId) => {
  const key = getGreetingCacheKey(userId);
  const lastGreeting = userGreetingTimestamps.get(key);
  if (!lastGreeting) {
    return true;
  }
  return Date.now() - lastGreeting >= GREETING_THROTTLE_MS;
};

const markGreetingForUser = (userId) => {
  const key = getGreetingCacheKey(userId);
  userGreetingTimestamps.set(key, Date.now());
};

const hasRecentAssistantGreeting = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    return false;
  }

  return history.slice(-6).some((entry) => {
    if (!entry || entry.role !== 'assistant') {
      return false;
    }

    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    if (!content) {
      return false;
    }

    return ASSISTANT_GREETING_RE.test(content.split('\n')[0]);
  });
};

const isPureGreetingMessage = (message = '') => {
  if (typeof message !== 'string') {
    return false;
  }

  const normalized = message
    .toLowerCase()
    .replace(/[!¡?¿.,…:;\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  const tokens = normalized.split(' ');
  if (tokens.length === 0 || tokens.length > 5) {
    return false;
  }

  return tokens.every((token) => GREETING_TOKEN_SET.has(token));
};

// Enhanced query classification system
function classifyQuery(message, conversationHistory = [], userId = 'anonymous') {
  const safeMessage = typeof message === 'string' ? message : '';
  const lowerMessage = safeMessage.toLowerCase();

  if (isPureGreetingMessage(safeMessage)) {
    const recentlyGreeted = hasRecentAssistantGreeting(conversationHistory);
    if (!recentlyGreeted && canSendGreetingToUser(userId)) {
      return 'greeting';
    }
  }


  // Enhanced classification with better patterns
  const patterns = {
    label_edit_request: [
      /შეცვალე/, /change/, /დაარქვი/, /rename/, /მაგივრად/, /instead of/,
      /ტექსტის/, /text/, /ლეიბლი/, /label/, /სახელწოდება/, /title/,
      /რედაქტირება/, /edit/, /მოდიფიკაცია/, /modify/, /გადარქმევა/,
      /ეწეროს/, /should say/, /წერია/, /says/, /სათაური/, /header/
    ],

    code_help: [
      /როგორ/, /how to/, /ვერ მუშაობს/, /not working/, /error/, /შეცდომა/,
      /debug/, /fix/, /problem/, /issue/, /გაუმართე/, /გასწორება/
    ],

    site_overview: [
      /რა არის/, /what is/, /გითხარით/, /tell me/, /ახსენით/, /explain/,
      /სრული ინფორმაცია/, /full information/, /როგორ მუშაობს/, /how.*work/,
      /overview/, /summary/, /ზოგადი/, /general/
    ],

    booking_help: [
      /ჯავშანი/, /booking/, /რეზერვაცია/, /reservation/, /ჯავშნა/, /book/
    ],

    pricing_question: [
      /ფასი/, /price/, /ღირებულება/, /cost/, /ფასების/, /pricing/
    ]
  };

    // Label edit request (enhanced with normalization)
    const normalizeLabelEditMessage = (msg) => {
      const replacements = {
        'პნელი': 'პანელი',
        'ტექსტის': '',
        'ამ ': '',
        'ტექსტით': '',
        'გადარქმევა': 'შეცვლა',
        'ჩანაცვლება': 'შეცვლა'
      };
      let cleaned = msg.toLowerCase();
      Object.entries(replacements).forEach(([k, v]) => {
        cleaned = cleaned.replace(new RegExp(k, 'gi'), v);
      });
      return cleaned.trim();
    };

    // More flexible regex for label editing - looks for two quoted texts
    const normalizedMessage = normalizeLabelEditMessage(safeMessage);
    const editPattern = /["'„"]([^"'„"]+)["'„"][^"'„"]*?["'„"]([^"'„"]+)["'„"]/i;
    const labelEditMatches = normalizedMessage.match(editPattern);

    if (labelEditMatches) {
        return {
            type: 'label_edit_request',
            oldLabel: labelEditMatches[1].trim(),
            newLabel: labelEditMatches[2].trim()
        };
    }

  for (const type in patterns) {
    if (patterns.hasOwnProperty(type)) {
      const regexes = patterns[type];
      for (const regex of regexes) {
        if (regex.test(safeMessage)) {
          return type;
        }
      }
    }
  }

  // Static information queries - highest priority
  const siteSummary = require('./services/site_summary');
  if (siteSummary.isStaticInfoQuery(safeMessage)) {
    return 'static_info';
  }

  // Site overview queries (bullet-point format)
  if (/მოკლე\s*(აღწერა|შეჯამება|ინფორმაცია)|საიტის\s*(აღწერა|ინფორმაცია)|რა\s*არის\s*(ეს|ბახმარო)|ბახმაროს\s*შესახებ/i.test(safeMessage)) {
    return 'site_overview';
  }

  // General how-it-works queries (system explanation)
  if (/როგორ\s*მუშაობს\s*(საიტი|სისტემა|ყველაფერი)|როგორ\s*ფუნქციონირებს|როგორ\s*არის\s*მოწყობილი/i.test(safeMessage)) {
    return 'general_how_it_works';
  }

  // Project structure queries (technical details)
  if (/სრული\s*ინფორმაცია|სტრუქტურ|პლატფორმ|მთლიანი|არქიტექტურ|ტექნიკური\s*დეტალები/i.test(safeMessage)) {
    return 'project_structure';
  }

  // Code explanation queries  
  if (/რომელი?\s*(კოდი|ფაილი|ფუნქცია|კომპონენტი)|რა\s*(აქვს|არის|მუშაობს|შეიცავს|გვიჩვენებს)/i.test(safeMessage)) {
    return 'code_explanation';
  }

  // Specific how it works queries (module-level)
  if (/როგორ\s*(მუშაობს|ფუნქციონირებს|იმუშავებს)\s+[a-zA-Z]/i.test(safeMessage)) {
    return 'how_it_works';
  }

  // Math/calculation queries
  if (lowerMessage.includes('+') || lowerMessage.includes('-') || 
      lowerMessage.includes('*') || lowerMessage.includes('/') || 
      lowerMessage.includes('რამდენია') || lowerMessage.includes('გამოითვალე')) {
    return 'calculation';
  }

  // Default general query
  return 'general';
}

// Specialized handlers for different query types
// Main RAG query handler
async function handleRAGQuery(message, userId, conversationHistory = []) {
  try {
    console.log('🤖 [RAG Handler] Processing query with full RAG pipeline...');

    const codeAnalyzer = require('./services/codeAnalyzer');

    // Use the enhanced RAG system
    const ragResponse = await codeAnalyzer.analyzeForQuery(message, conversationHistory);

    if (ragResponse) {
      console.log('✅ [RAG Handler] RAG analysis successful');
      return ragResponse;
    } else {
      console.log('⚠️ [RAG Handler] RAG analysis failed, using enhanced fallback');
      return await generateEnhancedFallback(message, userId);
    }

  } catch (error) {
    console.error('❌ [RAG Handler] Failed:', error);
    return await generateEnhancedFallback(message, userId);
  }
}

// Enhanced fallback with basic RAG principles
async function generateEnhancedFallback(message, userId) {
  try {
    console.log('🔄 [Enhanced Fallback] Generating intelligent fallback...');

    const fileService = require('./services/fileService');

    // Try to get some basic project info even without full RAG
    let fallbackInfo = '🏗️ ბახმაროს ბუკინგ პლატფორმის ინფორმაცია:\n\n';

    // Search for relevant files
    const searchResults = await fileService.searchInFiles(message);
    if (searchResults.length > 0) {
      fallbackInfo += `📁 **მოძებნული ფაილები:**\n`;
      searchResults.slice(0, 5).forEach(result => {
        fallbackInfo += `• ${result.file}: ${result.content.substring(0, 100)}...\n`;
      });
      fallbackInfo += '\n';
    }

    // Get project structure overview
    try {
      const structure = await fileService.getProjectStructure();
      if (structure && Object.keys(structure).length > 0) {
        fallbackInfo += `📊 **პროექტის ძირითადი სტრუქტურა:**\n`;
        const mainDirs = Object.keys(structure).filter(path => 
          !path.includes('/') && structure[path].type === 'directory'
        );
        mainDirs.forEach(dir => {
          fallbackInfo += `📁 ${dir}/\n`;
        });
        fallbackInfo += '\n';
      }
    } catch (structureError) {
      console.log('⚠️ [Enhanced Fallback] Could not get structure');
    }

    fallbackInfo += `🔧 **ტექნიკური დეტალები:**\n`;
    fallbackInfo += `• React/TypeScript Frontend\n`;
    fallbackInfo += `• Node.js/Express Backend\n`;
    fallbackInfo += `• Firebase Integration\n`;
    fallbackInfo += `• AI Assistant (Groq)\n\n`;

    fallbackInfo += `⚠️ სრული RAG ანალიზისთვის Groq API საჭიროა.`;

    return fallbackInfo;

  } catch (error) {
    console.error('❌ [Enhanced Fallback] Failed:', error);
    return generateProjectStructureFallback();
  }
}

function containsTechnicalTerms(message) {
  const technicalTerms = [
    'კოდი', 'code', 'ფაილი', 'file', 'ფუნქცია', 'function',
    'კომპონენტი', 'component', 'სერვისი', 'service', 'api',
    'backend', 'frontend', 'react', 'typescript', 'firebase',
    'database', 'ბაზა', 'სისტემა', 'system', 'მონაცემ', 'data'
  ];

  return technicalTerms.some(term => 
    message.toLowerCase().includes(term.toLowerCase())
  );
}

async function handleCodeExplanationQuery(message, userId, conversationHistory) {
  try {
    console.log('💻 Processing code explanation query');

    const codeAnalyzer = require('./services/codeAnalyzer');
    const explanation = await codeAnalyzer.analyzeForQuery(message, conversationHistory);    return explanation || generateFallbackResponse(message);
  } catch (error) {
    console.error('❌ Code explanation failed:', error);
    return generateFallbackResponse(message);
  }
}

async function handleHowItWorksQuery(message, userId) {
  try {
    console.log('🔧 Processing how-it-works query');

    // Extract the main subject from the query
    const subject = extractSubjectFromQuery(message);

    if (subject) {
      const explanation = await explainModule(subject);
      return explanation || generateFallbackResponse(message);
    }

    return generateFallbackResponse(message);
  } catch (error) {
    console.error('❌ How-it-works explanation failed:', error);
    return generateFallbackResponse(message);
  }
}

function handleGreetingQuery(message, userId) {
  const now = new Date();
  const georgianHour = (now.getUTCHours() + 4) % 24;

  let timeGreeting;
  if (georgianHour >= 5 && georgianHour < 12) {
    timeGreeting = 'დილა მშვიდობისა';
  } else if (georgianHour >= 12 && georgianHour < 18) {
    timeGreeting = 'შუადღე მშვიდობისა';
  } else if (georgianHour >= 18 && georgianHour < 23) {
    timeGreeting = 'საღამო მშვიდობისა';
  } else {
    timeGreeting = 'ღამე მშვიდობისა';
  }

  markGreetingForUser(userId);

  return `${timeGreeting}! 👋 მე ვარ ბახმაროს AI ასისტენტი. რით შემიძლია დაგეხმარო?`;
}

function extractSubjectFromQuery(message) {
  // Extract key terms from "როგორ მუშაობს X" type queries
  const matches = message.match(/როგორ\s*(მუშაობს|ფუნქციონირებს)\s*([^\?]*)/i);
  if (matches && matches[2]) {
    return matches[2].trim();
  }

  // Look for common subjects
  const subjects = ['ბრონირების', 'ფასების', 'კოტეჯების', 'მომხმარებლების', 'ადმინ', 'სასტუმროების'];
  for (const subject of subjects) {
    if (message.includes(subject)) {
      return subject;
    }
  }

  return null;
}

async function explainModule(term) {
  try {
    const { searchInFiles, getFileContext } = require('./services/fileService');

    console.log(`🔍 Searching for files related to: ${term}`);

    // Search for relevant files
    const searchResults = await searchInFiles(term, ['.ts', '.tsx', '.js', '.jsx']);

    if (searchResults.length === 0) {
      return `${term}-ის შესახებ ინფორმაცია ვერ მოიძებნა კოდბეისში.`;
    }

    // Get content from top 3 most relevant files
    const topFiles = searchResults.slice(0, 3);
    const fileContents = await Promise.all(
      topFiles.map(result => getFileContext(result.file))
    );

    // Build context for Groq
    let context = `📁 შესაბამისი ფაილები "${term}"-ის შესახებ:\n\n`;
    fileContents.forEach(file => {
      if (file.content) {
        context += `**${file.path}**\n\`\`\`${file.type}\n${file.content.substring(0, 2000)}\n\`\`\`\n\n`;
      }
    });

    // Ask Groq to explain
    const { askGroq } = require('./services/groq_service');
    const prompt = `შეაჯამე და ახსენი როგორ მუშაობს "${term}" ამ კოდში:\n\n${context}`;

    const response = await askGroq([
      { 
        role: 'system', 
        content: 'თქვენ ხართ კოდის ექსპერტი. ახსენით ფუნქციონალობა ქართულად, გასაგებად და დეტალურად.' 
      },
      { role: 'user', content: prompt }
    ]);

    return response.choices[0].message.content;

  } catch (error) {
    console.error('❌ Module explanation failed:', error);
    return `${term}-ის ახსნა ვერ მოხერხდა: ${error.message}`;
  }
}

function generateProjectStructureFallback() {
  return `🏗️ ბახმაროს პლატფორმის სტრუქტურა:

📁 **Frontend (React/TypeScript)**
• src/components/ - UI კომპონენტები
• src/services/ - ბიზნეს ლოგიკა
• src/pages/ - გვერდების კომპონენტები

📁 **Backend (Node.js/Express)**  
• backend/services/ - სერვისების ლოგიკა
• backend/controllers/ - API კონტროლერები
• backend/middleware/ - შუალედური პროგრამები

🔧 **ძირითადი მოდულები:**
• ბრონირების სისტემა (BookingService)
• ფასების მენეჯმენტი (PricingService) 
• მომხმარებლების მართვა (UserService)
• AI ასისტენტი (AI Controller)

⚠️ სრული ანალიზისთვის Groq API საჭიროა.`;
}

// Enhanced fallback response generator with better intelligence
function generateFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();

  console.log('⚠️ Using fallback response for:', message);

  // Programming/Technical questions with intelligent responses
  if (/რომელი?\s*(კოდი|ფაილი|ფუნქცია|კომპონენტი)/i.test(message) ||
      /რა\s*(აქვს|არის|მუშაობს|შეიცავს|გვიჩვენებს)/i.test(message)) {

    // Detect specific files mentioned
    if (lowerMessage.includes('bookingservice') || lowerMessage.includes('booking service')) {
      return `📋 BookingService.ts ძირითადი ფუნქციები:
• createBooking() - ბრონირების შექმნა
• updateBooking() - ბრონირების განახლება  
• cancelBooking() - ბრონირების გაუქმება
• getBookingsByUser() - მომხმარებლის ბრონირებები
• validateBookingDates() - თარიღების ვალიდაცია

სრული ანალიზისთვის Groq API საჭიროა.`;
    }

    if (lowerMessage.includes('bookingmodal') || lowerMessage.includes('booking modal')) {
      return `🏠 BookingModal.tsx კომპონენტი:
• useState hooks ფასებისთვის
• handleSubmit() ფუნქცია
• ვალიდაცია და ფორმის მართვა
• Firebase integration
• TypeScript interfaces

დეტალური ანალიზისთვის Groq API საჭიროა.`;
    }

    return `📁 ფაილის სახელი მითხარი სრული ანალიზისთვის:
• React კომპონენტები (.tsx)
• TypeScript სერვისები (.ts) 
• Backend კონტროლერები (.js)

მაგალითი: "რა ფუნქციებია userService.ts-ში?"

⚠️ Groq API არ მუშაობს - ვიყენებ ძირითად ლოგიკას.`;
  }

  // Math calculations with better handling
  if (lowerMessage.includes('+') || lowerMessage.includes('-') || 
      lowerMessage.includes('*') || lowerMessage.includes('/') || 
      lowerMessage.includes('რამდენია') || lowerMessage.includes('გამოითვალე')) {
    const mathResult = calculateMath(message);
    if (mathResult) return `🧮 ${mathResult}`;
    return `🧮 მათემატიკური გამოსათვლელი: "${message.replace(/რამდენია\s*/gi, '').trim()}"
ვცდილობ გამოვთვალო, მაგრამ ფორმატი არასწორია.`;
  }

  // Natural greeting responses
  if (lowerMessage.includes('გამარჯობა') || lowerMessage.includes('hello') || lowerMessage.includes('გამარჯობათ')) {
    return `გამარჯობა! 👋 როგორ შემიძლია დაგეხმარო?`;
  }

  // How-to questions with contextual help
  if (/როგორ\s*(გავაკეთო|მუშაობს|დავაყენო|დავწერო)/i.test(message)) {
    return `🔧 "${message}" - სრული ახსნისთვის Groq AI საჭიროა.

ძირითადი რჩევები:
• React კომპონენტებისთვის: useState, useEffect
• TypeScript: interfaces და types
• Firebase: auth, firestore methods
• Backend: Express.js routes

კონკრეტული ფაილის სახელი მითხარი უკეთესი დახმარებისთვის.`;
  }

  // Service/Logic questions
  if (lowerMessage.includes('სერვისი') || lowerMessage.includes('ლოგიკა') || lowerMessage.includes('service')) {
    return `⚙️ სერვისების ლოგიკისთვის სრული AI ანალიზი საჭიროა.

არსებული სერვისები:
• bookingService.ts - ბრონირების მართვა
• userService.ts - მომხმარებლების მართვა  
• notificationService.ts - შეტყობინებები
• auditService.ts - აუდიტი

⚠️ Groq API გამორთულია - დეტალური ანალიზი შეუძლებელია.`;
  }

  // Simple default response
  return `ვერ გავიგე რას ამბობ. შემიძლია დაგეხმარო კოდის ანალიზში, ფაილების შემოწმებაში ან ტექნიკურ საკითხებში. 

კონკრეტული კითხვა დამისვი - მაგალითად: "რა ფუნქციებია BookingService-ში?" ან "როგორ მუშაობს ბრონირების სისტემა?"`;
}

// Simple math calculator
function calculateMath(expression) {
  try {
    // Remove Georgian question words
    let mathExpr = expression
      .replace(/რამდენია\s*/gi, '')
      .replace(/რა\s*არის\s*/gi, '')
      .trim();

    // Basic safety check - only allow numbers, operators, and spaces
    if (!/^[\d+\-*/().\s]+$/.test(mathExpr)) {
      return null;
    }

    // Use Function constructor instead of eval for safety
    const result = Function(`"use strict"; return (${mathExpr})`)();

    if (typeof result === 'number' && !isNaN(result)) {
      return result.toString();
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Enhanced Groq validation with anti-pattern prevention
async function validateAndFixWithGroq(text, validationType = 'comprehensive_grammar') {
  try {
    const { askGroq } = require('./services/groq_service');

    // Define specific prompts for different validation types
    const validationPrompts = {
      basic: 'გასწორე ქართული გრამატიკა ამ ტექსტში და დააბრუნე მხოლოდ გასწორებული ტექსტი.',
      comprehensive: 'ჩაატარე სრული ქართული ენის ვალიდაცია, გასწორე გრამატიკა, ორთოგრაფია და გახადე ტექსტი ბუნებრივი. დააბრუნე მხოლოდ გასწორებული ტექსტი.',
      technical: 'გასწორე ქართული გრამატიკა და ტექნიკური ტერმინოლოგია ამ ტექსტში. დააბრუნე მხოლოდ გასწორებული ტექსტი.',
      comprehensive_grammar: 'გასწორე ქართული გრამატიკა და ორთოგრაფია. თავიდან აიცილე "მე ვარ..." სტილის თვითაღმოჩენები. შეცვალე "ჩემი საიტი" -> "ბახმაროს Booking პლატფორმა". გახადე ტექსტი ბუნებრივი და პროფესიონალური. დააბრუნე მხოლოდ გასწორებული ტექსტი.'
    };

    const prompt = validationPrompts[validationType] || validationPrompts.basic;

    // Call Groq with increased temperature
    const groqResponse = await askGroq([
      { role: 'system', content: 'თქვენ ხართ ქართული ენის გრამატიკის კორექტორი.' },
      { role: 'user', content: `${prompt} ტექსტი: ${text}` }
    ], 'auto');

    const correctedText = groqResponse.choices[0].message.content;
    return correctedText;

  } catch (error) {
    console.error('❌ Groq validation error:', error);
    throw error;
  }
}

// Export the router - this should be the ONLY module.exports in this file
module.exports = router;

// --- Helper functions ---
async function searchFilesForLabel(label) {
  const fileService = require('./services/fileService');
  const searchResults = await fileService.searchInFiles(label);

  // Structure the results for easier handling
  const formattedResults = searchResults.map(result => ({
    file: result.file,
    matches: 1, // Simplify to just number of matching lines
    locations: [{
      line: result.line,
      context: result.content
    }]
  }));

  return formattedResults;
}

async function performLabelEdit(operation) {
  const fileService = require('./services/fileService');
  const { oldLabel, newLabel } = operation;

  const searchResults = await fileService.searchInFiles(oldLabel);

  let filesModified = 0;

  for (const result of searchResults) {
    const fileContent = await fileService.getFileContent(result.file);
    const newContent = fileContent.replace(new RegExp(escapeRegExp(oldLabel), 'g'), newLabel);
    await fileService.writeFileContent(result.file, newContent);
    filesModified++;
  }

  return { filesModified };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
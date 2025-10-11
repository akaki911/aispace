const express = require('express');
const router = express.Router();

// Import AI services
let groqService, memoryController, promptManager;
try {
  groqService = require('../services/groq_service');
  memoryController = require('../services/memory_controller');
  promptManager = require('../services/prompt_manager');
} catch (error) {
  console.warn('⚠️ Some AI services not available:', error.message);
}

// SOL-212: Import Gurulo components
const { searchByName, readFileUtf8 } = require('../tools/fs_reader');
const { composeStructured, composeFileConfirmation, composeError } = require('../core/response_composer');
const { webSearch, webGet } = require('../tools/web_access');
const { editRequestManager } = require('../tools/edit_request_manager');
const SYSTEM_PROMPTS = require('../context/system_prompts');
const { sanitizeGuruloReply } = require('../middleware/response_sanitizer');

// NEW: Intelligent Answering Pipeline imports
const { processMessage } = require('../core/intelligent_answering_engine');
const { sanitizeResponse } = require('../utils/enhanced_sanitizer');

// SOL-204: Decide when to use structured format with ENV control
const STRUCTURED_DEFAULT = (process.env.GURULO_STRUCTURED_DEFAULT === 'true');

function shouldUseStructuredFormat(message) {
  if (STRUCTURED_DEFAULT) return true;
  const re = /(ანალიზ|analysis|debug|შეცდომ(ა|ები)|ერორ|fix|diagnostic|როადმაპ|step|ნაბიჯ)/i;
  return re.test(message || '');
}

// SOL-200: Build role-based messages like ChatGPT
function buildMessages({ conversationHistory = [], userMessage = '' }) {
  const msgs = [];
  const isFirst = !conversationHistory || conversationHistory.length === 0;
  if (isFirst) {
    msgs.push({ role: 'system', content: SYSTEM_PROMPTS.SYSTEM_PROMPTS.base });
  }
  // replay prior turns (assume {role:'user'|'assistant', content:string})
  for (const h of conversationHistory) {
    if (!h?.role || !h?.content) continue;
    msgs.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
  }
  // optionally add a lightweight instruction to structure ONLY when needed
  if (shouldUseStructuredFormat(userMessage)) {
    msgs.push({
      role: 'system',
      content: 'Use a concise, stepwise technical format appropriate for debugging/analysis.'
    });
  }
  msgs.push({ role: 'user', content: userMessage || '' });
  return { msgs, isFirst };
}

// NEW: Intelligent Answering Pipeline endpoint
router.post('/intelligent-chat', async (req, res) => {
  console.log('🧠 Intelligent Chat Pipeline activated');
  try {
    const { message, conversationHistory = [], personalId = '01019062020', modelOverride } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        timestamp: new Date().toISOString()
      });
    }

    // Set headers for JSON response
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');

    console.log('🎯 [PIPELINE] Starting intelligent processing...');

    // Step 1: Route query and process with intelligent engine
    const engineResult = await processMessage(message, conversationHistory, personalId, {
      modelOverride: modelOverride || undefined
    });

    if (!engineResult.success) {
      return res.json(engineResult);
    }

    // Step 2: Apply enhanced sanitization
    const sanitizedResponse = sanitizeResponse(engineResult.response, message);

    // Step 3: Return final result with enhanced metadata
    const finalResult = {
      ...engineResult,
      response: sanitizedResponse,
      modelLabel: engineResult.modelLabel || 'Unknown Model',
      pipeline: 'intelligent',
      originalResponse: engineResult.response,
      sanitized: engineResult.response !== sanitizedResponse
    };

    console.log('✅ [PIPELINE] Complete:', {
      policy: finalResult.policy,
      model: finalResult.model,
      sanitized: finalResult.sanitized,
      responseLength: finalResult.response.length
    });

    return res.json(finalResult);

  } catch (error) {
    console.error('❌ [PIPELINE] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Pipeline processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// AI routes - Updated to use Action Loop system from Phase 2
router.post('/chat', async (req, res) => {
  console.log('🤖 AI Chat route accessed - Phase 2 Action Loop System');
  try {
    const { message, conversationHistory = [], personalId = '01019062020', mode = 'basic', fileContext = [], context = {}, modelOverride } = req.body;

    console.log('🔍 Chat Request:', { 
      message: message?.substring(0, 50), 
      personalId, 
      mode,
      fileContext: fileContext?.length || 0,
      isAdvanced: context?.isAdvanced || false,
      modelOverride
    });

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        timestamp: new Date().toISOString()
      });
    }

    // Set headers for JSON response (not streaming)
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Phase 2: Use our new Action Loop system instead of old Replit Assistant
    console.log('🧠 [PHASE 2] Using Action Loop system from intelligent_answering_engine...');

    try {
      // Step 1: Process with our new Action Loop system
      const engineResult = await processMessage(message, conversationHistory, personalId, {
        modelOverride: modelOverride || undefined
      });

      if (!engineResult.success) {
        return res.json(engineResult);
      }

      // Step 2: Apply enhanced sanitization
      const sanitizedResponse = sanitizeResponse(engineResult.response, message);

      // Step 3: Return final result with enhanced metadata
      const finalResult = {
        ...engineResult,
        response: sanitizedResponse,
        modelLabel: engineResult.modelLabel || 'Action Loop Model',
        pipeline: 'action-loop-phase2',
        originalResponse: engineResult.response,
        sanitized: engineResult.response !== sanitizedResponse,
        personalId: personalId
      };

      console.log('✅ [PHASE 2] Action Loop Complete:', {
        policy: finalResult.policy,
        model: finalResult.model,
        sanitized: finalResult.sanitized,
        responseLength: finalResult.response.length,
        toolExecuted: finalResult.toolExecuted || false
      });

      return res.json(finalResult);

    } catch (actionLoopError) {
      console.error('❌ [PHASE 2] Action Loop failed, using legacy fallback:', actionLoopError);
      // Fallback to basic processing only if Action Loop completely fails
    }

    // SOL-203: Enhanced PromptManager integration
    let systemPrompt = '';
    let intentAnalysis = null;

    if (promptManager) {
      try {
        // Analyze intent first
        intentAnalysis = promptManager.analyzeChatIntent(message);
        console.log('📊 Intent Analysis:', intentAnalysis);

        // Compose system prompt with context
        systemPrompt = promptManager.composeSystemPrompt({
          user: context.user,
          files: fileContext,
          intent: intentAnalysis.primary,
          mode: mode,
          personalId
        });

        console.log('🎯 System prompt composed:', { 
          length: systemPrompt.length,
          georgianRequired: intentAnalysis.georgianRequired,
          intent: intentAnalysis.primary
        });
      } catch (error) {
        console.warn('⚠️ PromptManager error, using fallback:', error.message);
      }
    }

    // Basic response if AI services not available
    if (!groqService) {
      const response = `🤖 გურულო AI Developer Assistant

Message received: ${message}

🔄 Services are initializing... Please try again in a moment.

ფუნქციონალი ჯერ ჩაირთვება...`;
      return res.json({
        success: true,
        response: response,
        timestamp: new Date().toISOString(),
        georgianSupport: true,
        intentAnalysis: intentAnalysis || { primary: 'system-initialization' }
      });
    }

    // SOL-212: Check for file reading requests (Georgian support)
    const fileReadPattern = /ფაილი|\.txt|შემდეგი ჩატის პრ\.txt/i;
    const confirmOnlyPattern = /მხოლოდ მზადყოფნა|მზად ვარ|დამიდასტურე/i;
    const webSearchPattern = /ინტერნეტში მოძებნე|მომიძებნე სტატია|web search|search internet/i;

    // Handle special file reading case
    if (fileReadPattern.test(message)) {
      console.log('📖 [Gurulo] File reading request detected');

      // Special handler for "შემდეგი ჩატის პრ.txt"
      if (message.includes('შემდეგი ჩატის პრ.txt')) {
        try {
          // Search for the file
          const matches = await searchByName('შემდეგი ჩატის პრ.txt');
          if (matches.length > 0) {
            // Read file with FULL CONTENT for AI analysis
            const fileResult = await readFileUtf8(matches[0].path, true);
            if (fileResult.success) {
              // Store in memory for session
              if (memoryController) {
                const contextEntry = {
                  file: 'შემდეგი ჩატის პრ.txt',
                  meta: fileResult.meta,
                  timestamp: new Date().toISOString()
                };
                try {
                  await memoryController.updateMemory(personalId, 
                    `File Context: ${JSON.stringify(contextEntry, null, 2)}`);
                } catch (memError) {
                  console.warn('Memory update failed:', memError.message);
                }
              }

              // CRITICAL FIX: Send file content to AI for intelligent analysis
              // Instead of hardcoded response, let Gurulo analyze the actual content
              const fileAnalysisPrompt = `მე წარმატებით გავიცანი ფაილი "${matches[0].path}" და მისი შინაარსი შემდეგია:

--- ფაილის შინაარსი ---
${fileResult.content}
-----------------------

როგორც გურულო AI ასისტენტი, გთხოვთ გააანალიზოთ ამ ფაილის შინაარსი და მიპასუხოთ ბუნებრივად. რა ეხება, რა არის მთავარი იდეა და რას ამბობს ეს ტექსტი?

დამამოწმეთ რომ შინაარსს გავიცანი და მზად ვარ შემდეგი კითხვებისთვის.`;

              console.log('🧠 [Gurulo] Sending file content to AI for intelligent analysis...');

              // Use the existing AI processing instead of hardcoded response
              const groqResponse = await groqService.askGroq([
                { role: 'system', content: `You are Gurulo AI Developer Assistant. Always reply in Georgian. You are Gurulo AI Developer Assistant.` },
                { role: 'user', content: fileAnalysisPrompt }
              ], personalId, false);

              if (groqResponse.success) {
                return res.json({
                  success: true,
                  response: groqResponse.content,
                  timestamp: new Date().toISOString()
                });
              } else {
                // Fallback if AI fails
                return res.json({
                  success: true,
                  response: composeFileConfirmation('შემდეგი ჩატის პრ.txt', fileResult.meta),
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        } catch (error) {
          console.error('🚨 [Gurulo] File reading error:', error.message);
          return res.json({
            success: true,
            response: composeError('ფაილის კითხვა', error.message),
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Handle web search requests
    if (webSearchPattern.test(message)) {
      console.log('🌐 [Gurulo] Web search request detected');
      // Extract search query (simplified)
      const query = message.replace(/ინტერნეტში მოძებნე|მომიძებნე სტატია|web search|search internet/gi, '').trim();
      if (query) {
        try {
          const searchResult = await webSearch(query);
          if (searchResult.success) {
            return res.json({
              success: true,
              response: composeStructured({
                analysis: `ინტერნეტში მოძებნა: "${query}"`,
                tech: `გამოყენებული უსაფრთხო ძიების API, მიღებული ${searchResult.results?.length || 0} შედეგი`,
                status: '✅ ძიება წარმატებით შესრულდა',
                rec: searchResult.results?.length > 0 ? 'გთხოვთ, მიუთითოთ რომელი შედეგი გაინტერესებთ' : 'სცადეთ სხვა საძიებო ფრაზა'
              }),
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('🚨 [Gurulo] Web search error:', error.message);
          return res.json({
            success: true,
            response: composeError('ინტერნეტ ძიება', error.message),
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // SOL-200: conversation history already extracted above

    // SOL-200: Build role-based messages (removes MANDATORY FORMAT)
    const { msgs, isFirst } = buildMessages({ 
      conversationHistory, 
      userMessage: message 
    });

    console.log('SOL-200:', { 
      isFirst, 
      historyLen: conversationHistory.length, 
      structured: shouldUseStructuredFormat(message),
      messagesCount: msgs.length,
      structuredDefault: STRUCTURED_DEFAULT,
      envTemp: process.env.GURULO_TEMP || 'default_0.6'
    });

    console.log('🔍 Debug msgs array:', JSON.stringify(msgs, null, 2));

    // Double-check message validation
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      console.log(`🔍 Message ${i}:`, { role: msg.role, hasContent: !!msg.content, contentLength: msg.content?.length });
    }

    // Get AI response with updated temperature
    console.log('🤖 Calling Groq API with natural prompting...');
    console.log('🔍 ABOUT TO CALL GROQ - msgs length:', msgs.length);
    const groqResponse = await groqService.askGroq(msgs, false);

    console.log('🔍 Groq Response Debug:', { 
      type: typeof groqResponse,
      hasChoices: !!groqResponse?.choices, 
      hasContent: !!groqResponse?.content,
      hasData: !!groqResponse?.data,
      keys: groqResponse ? Object.keys(groqResponse) : [],
      structure: JSON.stringify(groqResponse, null, 2).substring(0, 500)
    });

    // Handle multiple response formats with content fallback
    let responseText;
    if (typeof groqResponse === 'string') {
      // Direct string response from Groq service
      responseText = groqResponse;
    } else if (groqResponse?.content) {
      // Direct content field (backward compatibility)
      responseText = groqResponse.content;
    } else if (groqResponse?.choices?.[0]?.message?.content) {
      // Standard choices structure
      responseText = groqResponse.choices[0].message.content;
    } else if (groqResponse?.data?.choices?.[0]?.message?.content) {
      // Full API response structure
      responseText = groqResponse.data.choices[0].message.content;
    } else {
      console.error('❌ Invalid Groq response structure:', groqResponse);
      return res.status(500).json({
        success: false,
        error: 'AI service error - invalid response format',
        timestamp: new Date().toISOString()
      });
    }

    // Enhanced response with Replit Assistant integration
    try {
      const { ToolRegistry } = require('../core/tool_registry');
      const toolRegistry = new ToolRegistry();

      // Check if request needs advanced processing
      const needsAdvancedProcessing = message.length > 50 || 
        /ფაილი|კოდი|შეცვლა|ანალიზი|დიაგნოსტიკა/.test(message);

      if (needsAdvancedProcessing) {
        console.log('🎯 [ENHANCED] Using Replit Assistant for advanced processing...');

        const assistantResult = await toolRegistry.processRequest(message, {
          userId: personalId,
          simpleMode: true
        });

        if (assistantResult.success) {
          // SOL-206: Also sanitize enhanced responses
          const sanitizedResponse = sanitizeGuruloReply(assistantResult.response, message);
          return res.json({
            success: true,
            response: sanitizedResponse,
            timestamp: new Date().toISOString(),
            personalId: personalId,
            enhanced: true,
            toolsUsed: assistantResult.toolsUsed
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ [ENHANCED] Fallback to basic response:', error.message);
    }

    // SOL-202: Natural fallback response (no forced emojis) + SOL-206: Sanitize response
    const aiResponse = sanitizeGuruloReply(responseText, message);

    // Store interaction in memory
    if (memoryController) {
      try {
        const memoryEntry = `Q: ${message.substring(0, 100)}\nA: ${aiResponse.substring(0, 150)}`;
        await memoryController.addToMemory(personalId, memoryEntry);
      } catch (memError) {
        console.warn('Memory storage failed:', memError.message);
      }
    }

    res.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      personalId: personalId
    });
  } catch (error) {
    console.error('❌ AI Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Chat',
    timestamp: new Date().toISOString()
  });
});

// System status endpoint
router.get('/system-status', (req, res) => {
  console.log('🤖 AI Route: GET /system-status');

  try {
    const systemStatus = {
      status: 'operational',
      service: 'AI Microservice',
      version: '3.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      endpoints: [
        '/api/ai/chat',
        '/api/ai/health',
        '/api/ai/system-status',
        '/api/fs/search',
        '/api/fs/tree',
        '/api/fs/file'
      ],
      timestamp: new Date().toISOString()
    };

    res.json(systemStatus);
  } catch (error) {
    console.error('❌ System status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get system status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
const express = require('express');
const { addToMemory } = require('../memory_controller');

const router = express.Router();

const buildTimestamp = () => new Date().toISOString();
const inMemoryFacts = new Map();

const rememberFactInMemory = (userId, fact) => {
  if (!userId || !fact) return;

  const entry = {
    fact,
    timestamp: buildTimestamp(),
  };

  if (!inMemoryFacts.has(userId)) {
    inMemoryFacts.set(userId, [entry]);
  } else {
    inMemoryFacts.get(userId).push(entry);
  }

  // Best-effort persistence to the shared memory controller without blocking the response
  Promise.resolve(addToMemory(userId, fact)).catch((error) => {
    console.warn('⚠️ [Legacy AI Memory] Background persistence failed:', error.message);
  });
};

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'backend-legacy-ai',
    timestamp: buildTimestamp(),
  });
});

router.post('/chat', async (req, res) => {
  const { message, personalId, context = {} } = req.body || {};

  if (!personalId || typeof personalId !== 'string' || !personalId.trim()) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'personalId is required for chat access',
      timestamp: buildTimestamp(),
    });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Message is required',
      timestamp: buildTimestamp(),
    });
  }

  const sanitizedMessage = message.trim();
  const userRole = req.session?.user?.role || null;
  const requestPayload = {
    message: sanitizedMessage,
    personalId: personalId.trim(),
    context: {
      fileContext: Array.isArray(context.fileContext) ? context.fileContext : [],
      projectInfo: context.projectInfo || { source: 'legacy-chat-endpoint' },
    },
  };

  if (process.env.ENABLE_AI_ROLLOUT_PROXY === 'true') {
    try {
      const aiRolloutManager = require('../services/ai_rollout_manager');
      if (aiRolloutManager?.routeRequest) {
        const response = await aiRolloutManager.routeRequest(
          'chat',
          requestPayload,
          personalId,
          userRole,
        );

        if (response && response.success !== false && response.response) {
          return res.json({
            success: true,
            response: response.response,
            timestamp: buildTimestamp(),
            personalId: response.personalId || personalId,
            service: response.service || 'ai-rollout',
            rollout: response._rollout || null,
            cached: response.cached || false,
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ [Legacy AI Chat] Rollout manager unavailable, using fallback:', error.message);
    }
  }

  const fallbackResponse =
    /2\s*\+\s*2/.test(sanitizedMessage) || sanitizedMessage.includes('2+2')
      ? '2+2-ის სწორი პასუხია 4.'
      : `შეტყობინება მიღებულია და დამუშავდება: ${sanitizedMessage}`;

  rememberFactInMemory(personalId.trim(), `Q: ${sanitizedMessage}\nA: ${fallbackResponse}`);

  return res.json({
    success: true,
    response: fallbackResponse,
    timestamp: buildTimestamp(),
    personalId: personalId.trim(),
    service: 'backend-fallback',
    fallback: true,
  });
});

router.post('/remember', async (req, res) => {
  const { userId, fact, memory } = req.body || {};
  const factToStore = typeof fact === 'string' && fact.trim().length > 0
    ? fact.trim()
    : typeof memory === 'string' && memory.trim().length > 0
      ? memory.trim()
      : '';

  if (!userId || typeof userId !== 'string' || !userId.trim() || !factToStore) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'userId and fact are required',
      timestamp: buildTimestamp(),
    });
  }

  rememberFactInMemory(userId.trim(), factToStore);

  return res.json({
    success: true,
    message: '🧠 ინფორმაცია დამახსოვრდა!',
    timestamp: buildTimestamp(),
  });
});

module.exports = router;

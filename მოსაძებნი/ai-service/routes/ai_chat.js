const express = require('express');
const { z } = require('zod');

const router = express.Router();

const { detectIntent } = require('../services/gurulo_intent_router');
const {
  buildGreetingResponse,
  buildSmalltalkResponse,
  buildParamRequestResponse,
  buildAvailabilityResults,
  buildPricingInfoResponse,
  buildWeatherInfoResponse,
  buildTripPlanResponse,
  buildPoliciesFaqResponse,
  buildContactSupportResponse,
  buildTransportResponse,
  buildLocalAttractionsResponse,
  buildCottageDetailsResponse,
  buildOffTopicResponse,
} = require('../services/gurulo_response_builder');

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  personalId: z.string().trim().min(1).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']).default('user'),
        content: z.string().min(1, 'Content cannot be empty'),
      }),
    )
    .optional()
    .default([]),
  selectedModel: z.string().trim().min(1).optional(),
  modelOverride: z.string().trim().min(1).optional(),
  metadata: z.record(z.any()).optional(),
  audience: z.enum(['public_front', 'admin_dev']).optional(),
}).passthrough();

const validateChatRequest = (req, res, next) => {
  const parsed = chatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.set('X-Content-Format', 'text');
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: parsed.error.issues,
      timestamp: new Date().toISOString(),
    });
  }

  req.chatRequest = parsed.data;
  return next();
};

const normalizeConversationHistory = (history = []) => {
  const allowedRoles = new Set(['user', 'assistant', 'system']);

  return (Array.isArray(history) ? history : [])
    .filter((entry) => entry && typeof entry.content === 'string' && entry.content.trim().length > 0)
    .map((entry) => ({
      role: allowedRoles.has(entry.role) ? entry.role : 'user',
      content: entry.content.trim(),
    }))
    .slice(-20);
};

const normalizeIntentName = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  const mapping = {
    check_availability: 'availability',
  };

  return mapping[normalized] || normalized;
};

const buildSuccessResponse = (intent, payload, historyLength, audience) => {
  if (audience === 'public_front') {
    const base = {
      success: true,
      response: payload.response,
      conversationHistoryLength: historyLength,
    };

    if (Array.isArray(payload.quickPicks) && payload.quickPicks.length) {
      base.quickPicks = payload.quickPicks;
    }

    return base;
  }

  const telemetry = { ...(payload.telemetry || {}) };
  if (typeof telemetry.intent_detected === 'string') {
    telemetry.intent_detected = normalizeIntentName(telemetry.intent_detected);
  }

  const metadata = {
    intent: intent.name,
    confidence: intent.confidence,
    telemetry,
  };

  const normalizedIntent = normalizeIntentName(intent.name);
  if (typeof normalizedIntent === 'string' && normalizedIntent !== intent.name) {
    metadata.intentNormalized = normalizedIntent;
  }

  if (Array.isArray(payload.quickPicks)) {
    metadata.quickPicks = payload.quickPicks;
  }

  return {
    success: true,
    response: payload.response,
    metadata,
    conversationHistoryLength: historyLength,
  };
};

const handleChatRequest = async (req, res) => {
  const body = req.chatRequest || req.body;
  const {
    message,
    personalId = 'anonymous',
    conversationHistory = [],
    metadata = {},
    audience: audienceCandidate,
  } = body;

  const normalizedHistory = normalizeConversationHistory(conversationHistory);
  const historyLength = normalizedHistory.length;

  const metadataAudience =
    metadata && typeof metadata === 'object' && typeof metadata.audience === 'string'
      ? metadata.audience
      : undefined;
  const audience =
    audienceCandidate === 'public_front' || audienceCandidate === 'admin_dev'
      ? audienceCandidate
      : metadataAudience === 'public_front' || metadataAudience === 'admin_dev'
        ? metadataAudience
        : 'admin_dev';
  const builderOptions = { audience };

  try {
    console.log('🤖 AI Chat endpoint hit', {
      hasHistory: historyLength > 0,
      personalId,
      messageLength: message.length,
    });

    const intent = detectIntent(message, { metadata });

    const respondWithPayload = (payload) => {
      res.set('X-Content-Format', 'text');
      return res.status(200).json(buildSuccessResponse(intent, payload, historyLength, audience));
    };

    if (intent.name === 'off_topic_consumer_block') {
      return respondWithPayload(buildOffTopicResponse(metadata, builderOptions));
    }

    if (intent.name === 'greeting') {
      return respondWithPayload(buildGreetingResponse(metadata, builderOptions));
    }

    if (intent.name === 'smalltalk') {
      return respondWithPayload(buildSmalltalkResponse(metadata, builderOptions));
    }

    if (intent.name === 'check_availability') {
      if (intent.missingParams.length) {
        return respondWithPayload(buildParamRequestResponse(intent.missingParams, metadata, builderOptions));
      }
      return respondWithPayload(buildAvailabilityResults(intent.params, metadata, builderOptions));
    }

    if (intent.name === 'pricing_info') {
      return respondWithPayload(buildPricingInfoResponse(metadata, builderOptions));
    }

    if (intent.name === 'weather_info') {
      return respondWithPayload(buildWeatherInfoResponse(metadata, builderOptions));
    }

    if (intent.name === 'trip_plan') {
      return respondWithPayload(buildTripPlanResponse(metadata, builderOptions));
    }

    if (intent.name === 'policies_faq') {
      return respondWithPayload(buildPoliciesFaqResponse(metadata, builderOptions));
    }

    if (intent.name === 'contact_support') {
      return respondWithPayload(buildContactSupportResponse(metadata, builderOptions));
    }

    if (intent.name === 'transport') {
      return respondWithPayload(buildTransportResponse(metadata, builderOptions));
    }

    if (intent.name === 'local_attractions') {
      return respondWithPayload(buildLocalAttractionsResponse(metadata, builderOptions));
    }

    if (intent.name === 'cottage_details') {
      return respondWithPayload(buildCottageDetailsResponse(metadata, builderOptions));
    }

    return respondWithPayload(buildOffTopicResponse(metadata, builderOptions));
  } catch (error) {
    console.error('❌ AI Chat error:', error);
    const fallbackMessage = metadata.language === 'en'
      ? 'Sorry, the AI helper is temporarily unavailable. Please try again soon.'
      : 'ბოდიში, AI სისტემა დროებით მიუწვდომელია. სცადეთ ცოტა ხანში კვლავ.';

    res.set('X-Content-Format', 'text');
    return res.status(500).json({
      success: false,
      error: 'AI Chat service unavailable',
      details: error.message,
      response: fallbackMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

router.post('/chat', validateChatRequest, handleChatRequest);
router.post('/intelligent-chat', validateChatRequest, handleChatRequest);

module.exports = router;
module.exports.handleChatRequest = handleChatRequest;
module.exports.validateChatRequest = validateChatRequest;


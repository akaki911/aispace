'use strict';

require('dotenv').config();

const axios = require('axios');
const { createServiceToken, getServiceAuthConfigs } = require('../shared/serviceToken');
const TEST_USER_ID = 'front_chat_tester';
const LANGUAGE = 'ka';
const MAX_HISTORY = 6;
const TEST_CLIENT_ID = process.env.CHAT_TEST_CLIENT_ID || 'chat-tests';
const TEST_SERVICE_KEY = process.env.TEST_SERVICE_KEY || process.env.CHAT_TEST_SERVICE_KEY || '';

const BANNED_ARTIFACT_PATTERNS = [
  /complete\s*:/i,
  /timestamp\s*:/i,
  /\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:/i,
  /internal\s*debug/i
];

const LATENCY_LIMIT_PROXY = Number(process.env.CHAT_PROXY_LATENCY_LIMIT_MS || process.env.CHAT_LATENCY_LIMIT_MS || 3000);
const LATENCY_LIMIT_DIRECT = Number(process.env.CHAT_DIRECT_LATENCY_LIMIT_MS || process.env.CHAT_LATENCY_LIMIT_MS || 5000);
const SERVICE_AUTH_CONFIG = getServiceAuthConfigs()[0] || null;

if (SERVICE_AUTH_CONFIG?.isFallback) {
  console.warn('⚠️ [Chat Runner] Using fallback service auth secret. Configure AI_SERVICE_SHARED_SECRET for parity with production.');
}

const scenarios = [
  {
    id: 'greeting',
    label: 'Greeting',
    message: 'გამარჯობა',
    directive:
      'გააკეთე თბილი მისალმება სტუმრისთვის. ნეიტრალური ტონი, არანაირი რეკომენდაციების სია და არ გამოაჩინო შიდა მონიშვნები.',
    expectedQueryTypes: ['greeting'],
    validate: (context) => {
      const { flattenedText, responseSections, metadata } = context;
      if (/რეკომენდაცი/i.test(flattenedText)) {
        throw new Error('გურულოს რეკომენდაციები არ უნდა გამოჩნდეს მისალმების პასუხში');
      }
      const hasRecommendationsBlock = responseSections.some((section) =>
        /გურულოს\s*რეკომენდ/i.test(section.title || '')
      );
      if (hasRecommendationsBlock) {
        throw new Error('Greeting სცენარში არ უნდა იყოს „გურულოს რეკომენდაციები“ ბლოკი');
      }
      ensureTelemetry(metadata, {
        intent: 'greeting',
        ctaShown: true
      });
      ensureQuickPicks(metadata.quickPicks, 2);
    }
  },
  {
    id: 'availability-missing',
    label: 'Availability (no params)',
    message: 'ბახმაროში არის თავისუფალი კოტეჯები?',
    directive:
      'მოითხოვე თარიღები და სტუმრების რაოდენობა. შესთავაზე 2-3 სწრაფი არჩევანი. CTA უნდა მიუთითებდეს კატალოგზე.',
    expectedQueryTypes: ['availability', 'check_availability'],
    validate: (context) => {
      const { metadata, responseSections } = context;
      ensureTelemetry(metadata, {
        intent: 'availability',
        ctaShown: true
      });
      const missingParams = metadata?.telemetry?.param_missing || [];
      if (!missingParams.length) {
        throw new Error('Availability (no params) უნდა მოითხოვდეს დამატებით პარამეტრებს');
      }
      ensureQuickPicks(metadata.quickPicks || context.rawData.quickPicks, 2);
      ensureCTA(responseSections, /\/cottages/i);
    }
  },
  {
    id: 'availability-with-params',
    label: 'Availability (with params)',
    message: 'შემომიმოწმე 12-14 ოქტომბერი, 4 ადამიანი',
    directive:
      'მიაწოდე ხელმისაწვდომი შეთავაზებები ან ცარიელი მდგომარეობის რბილი ტექსტი. CTA უნდა იყოს კოტეჯების გვერდზე.',
    expectedQueryTypes: ['availability', 'check_availability'],
    validate: (context) => {
      const { responseSections, flattenedText, metadata } = context;
      ensureTelemetry(metadata, {
        intent: 'availability',
        ctaShown: true
      });
      if (!responseSections.length) {
        throw new Error('Availability (with params) პასუხი ცარიელია');
      }
      const hasContent = responseSections.some((section) =>
        Array.isArray(section.bullets) && section.bullets.some((bullet) => bullet && bullet.trim().length > 0)
      );
      if (!hasContent) {
        throw new Error('Availability (with params) პასუხში ბულეტები უნდა არსებობდეს');
      }
      ensureCTA(responseSections, /\/cottages/i);
      if (/შიდა\s*არტეფაქტ/i.test(flattenedText)) {
        throw new Error('Availability (with params) პასუხში შიდა არტეფაქტი აღმოაჩინა');
      }
    }
  },
  {
    id: 'smalltalk',
    label: 'Smalltalk',
    message: 'მომიყევი ბახმაროზე მოკლედ',
    directive: 'მიაწოდე მოკლე აღწერა ტურისტისთვის. არ გამოიყენო შიდა ტეგები ან ხელმისაწვდომობის CTA.',
    expectedQueryTypes: ['smalltalk', 'small_talk', 'small-talk'],
    validate: (context) => {
      const { flattenedText, metadata } = context;
      ensureTelemetry(metadata, {
        intent: 'smalltalk',
        ctaShown: true
      });
      if (!flattenedText || flattenedText.length < 30) {
        throw new Error('Smalltalk პასუხი ძალიან მოკლეა');
      }
    }
  },
  {
    id: 'offline-fallback',
    label: 'Offline fallback',
    message: 'გურულო, ჩართე ხელმისაწვდომობა',
    directive:
      'ეს სცენარი უნდა გაიშვას ხელოვნურად გამორთული სერვერის პირობებში და უზრუნველყოს რბილი ოფლაინ ტექსტი + retry label.',
    expectedQueryTypes: ['offline-fallback', 'offline', 'error'],
    offline: true,
    validate: (context) => {
      if (!context.offlineTriggered) {
        throw new Error('Offline fallback სცენარში რეალური გათიშვა არ დაფიქსირდა');
      }
      const { flattenedText } = context;
      if (!/offline|გათიშულ/i.test(flattenedText)) {
        throw new Error('Offline fallback პასუხი არ შეიცავს ოფლაინ მესიჯს');
      }
      if (!/retry|ხელახლა|სცადეთ/i.test(flattenedText)) {
        throw new Error('Offline fallback პასუხში არ ჩანს retry label');
      }
    }
  }
];

function ensureTelemetry(metadata, expectations) {
  const telemetry = metadata?.telemetry || {};
  if (expectations.intent && normalizeTelemetryIntent(telemetry.intent_detected) !== expectations.intent) {
    throw new Error(
      `მოველოდი intent_detected=${expectations.intent}, მივიღე ${telemetry.intent_detected || 'undefined'}`
    );
  }
  if (expectations.ctaShown === true && telemetry.cta_shown !== true) {
    throw new Error('cta_shown დროშა არ დაბრუნდა true');
  }
  if (expectations.paramMissing && !telemetry.param_missing?.includes(expectations.paramMissing)) {
    throw new Error(`telemetry.param_missing არ შეიცავს ${expectations.paramMissing}`);
  }
}

function normalizeTelemetryIntent(intent) {
  if (typeof intent !== 'string') return intent;
  return intent.trim().toLowerCase();
}

function ensureQuickPicks(quickPicks, minimum = 1) {
  if (!Array.isArray(quickPicks) || quickPicks.length < minimum) {
    throw new Error(`Quick picks უნდა შეიცავდეს მინიმუმ ${minimum} ელემენტს`);
  }
}

function ensureCTA(sections, matcher) {
  const hasValidCTA = sections.some((section) =>
    typeof section.cta === 'string' && matcher.test(section.cta)
  );
  if (!hasValidCTA) {
    throw new Error('CTA არასწორია ან ვერ მოიძებნა საჭირო როუტი');
  }
}

function looksLikeSection(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  return ['title', 'bullets', 'cta', 'text', 'description'].some((key) => key in node);
}

function collectSections(responsePayload) {
  if (Array.isArray(responsePayload)) {
    const flattened = [];
    for (const item of responsePayload) {
      if (item && typeof item === 'object') {
        if (Array.isArray(item.sections) || Array.isArray(item.response)) {
          flattened.push(...collectSections(item.sections || item.response));
          continue;
        }
        if (looksLikeSection(item)) {
          flattened.push(item);
          continue;
        }
      }
      if (Array.isArray(item)) {
        flattened.push(...collectSections(item));
      }
    }
    if (flattened.length) {
      return flattened;
    }
  }
  if (Array.isArray(responsePayload?.sections)) {
    return collectSections(responsePayload.sections);
  }
  if (Array.isArray(responsePayload?.response)) {
    return collectSections(responsePayload.response);
  }
  return [];
}

function flattenResponseText(responsePayload) {
  const pieces = [];
  const traverse = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      pieces.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }
    if (typeof node === 'object') {
      traverse(node.title);
      traverse(node.text);
      traverse(node.description);
      if (Array.isArray(node.bullets)) {
        node.bullets.forEach(traverse);
      }
      if (typeof node.cta === 'string') {
        pieces.push(node.cta);
      }
      if (node.content) traverse(node.content);
      if (node.sections) traverse(node.sections);
    }
  };
  traverse(responsePayload);
  return pieces
    .map((piece) => (typeof piece === 'string' ? piece : ''))
    .filter(Boolean)
    .join(' \n ');
}

function sanitizeOutput(text) {
  if (!text) return;
  const haystack = text.toString();
  const foundPattern = BANNED_ARTIFACT_PATTERNS.find((pattern) => pattern.test(haystack));
  if (foundPattern) {
    throw new Error(`დაიჭირა აკრძალული არტიფაქტი: ${foundPattern}`);
  }
}

function sanitizeForLog(payload) {
  try {
    const clone = JSON.parse(JSON.stringify(payload));
    if (clone?.metadata?.telemetry) {
      clone.metadata.telemetry = {
        ...clone.metadata.telemetry,
        trace: undefined
      };
    }
    if (clone?.metadata?.auth) {
      delete clone.metadata.auth;
    }
    return clone;
  } catch (error) {
    return payload;
  }
}

function getLatencyLimit(endpointUrl) {
  try {
    const url = new URL(endpointUrl);
    if (url.port === '5001') {
      return LATENCY_LIMIT_DIRECT;
    }
    if (url.port === '5002') {
      return LATENCY_LIMIT_PROXY;
    }
    return Number(process.env.CHAT_LATENCY_LIMIT_MS) || LATENCY_LIMIT_DIRECT;
  } catch (error) {
    return Number(process.env.CHAT_LATENCY_LIMIT_MS) || LATENCY_LIMIT_DIRECT;
  }
}

const sessionCache = new Map();

async function prepareAuth(endpointUrl) {
  if (sessionCache.has(endpointUrl)) {
    return sessionCache.get(endpointUrl);
  }
  const url = new URL(endpointUrl);
  let authHeaders = {};
  if (url.port === '5002') {
    try {
      const response = await axios.get('http://localhost:5002/api/auth/me', {
        headers: {
          Origin: 'http://127.0.0.1:5000',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000,
        validateStatus: () => true
      });
      const cookies = response.headers['set-cookie'];
      if (Array.isArray(cookies) && cookies.length) {
        authHeaders.Cookie = cookies.map((cookie) => cookie.split(';')[0]).join('; ');
      }
    } catch (error) {
      console.warn('⚠️ ვერ მოხერხდა session bootstrap:', error.message);
    }
  }
  if (url.port === '5001') {
    const token = generateServiceToken();
    if (token) {
      authHeaders.Authorization = `Bearer ${token}`;
    }
  }
  sessionCache.set(endpointUrl, authHeaders);
  return authHeaders;
}

function generateServiceToken() {
  try {
    return createServiceToken({
      svc: 'frontend-chat-runner',
      service: 'frontend-chat-runner',
      permissions: ['chat'],
      role: 'SYSTEM_BOT'
    });
  } catch (error) {
    console.error('❌ Failed to generate service token:', error.message);
    return null;
  }
}

async function executeScenario({
  endpoint,
  scenario,
  history,
  attempt,
  abortOffline
}) {
  const payload = {
    message: scenario.message,
    personalId: TEST_USER_ID,
    conversationHistory: history.slice(-MAX_HISTORY),
    metadata: {
      language: LANGUAGE,
      mode: 'front-test',
      client: TEST_CLIENT_ID,
      directive: scenario.directive,
      timestamp: new Date().toISOString()
    }
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Gurulo-Client': TEST_CLIENT_ID,
    Origin: 'http://127.0.0.1:5000',
    ...(await prepareAuth(endpoint))
  };

  if (TEST_SERVICE_KEY) {
    headers['X-Test-Service-Key'] = TEST_SERVICE_KEY;
  }

  const latencyLimitMs = getLatencyLimit(endpoint);
  const requestStarted = Date.now();
  let offlineTriggered = false;

  try {
    if (scenario.offline) {
      if (typeof abortOffline === 'function') {
        await abortOffline();
      }
      offlineTriggered = true;
      throw new Error('offline-simulated');
    }

    const response = await axios.post(endpoint, payload, {
      headers,
      timeout: Math.max(latencyLimitMs + 2000, 8000)
    });

    const duration = Date.now() - requestStarted;
    const rawData = response.data || {};
    const flattenedText = flattenResponseText(rawData.response ?? rawData.data ?? rawData);
    sanitizeOutput(flattenedText);

    const metadata = rawData.metadata || {};
    const responseSections = collectSections(rawData.response);
    const queryType = normalizeQueryType(rawData, metadata);

    ensureQueryType(queryType, scenario.expectedQueryTypes);

    if (duration > latencyLimitMs) {
      throw new Error(`Latency ${duration}ms აღემატება ზღვარს ${latencyLimitMs}ms`);
    }

    scenario.validate({
      rawData,
      payload,
      flattenedText,
      metadata,
      responseSections,
      queryType,
      duration,
      offlineTriggered: false
    });

    history.push({ role: 'user', content: scenario.message });
    history.push({ role: 'assistant', content: flattenedText.slice(0, 400) });

    return {
      success: true,
      status: 'pass',
      duration,
      queryType,
      offlineTriggered: false,
      response: rawData,
      payload,
      latencyLimitMs
    };
  } catch (error) {
    const duration = Date.now() - requestStarted;
    if (scenario.offline && offlineTriggered) {
      const fallbackText =
        LANGUAGE === 'ka'
          ? '🔴 გურულო დროებით გათიშულია — სცადეთ ხელახლა ცოტა ხანში.'
          : '🔴 Gurulo is temporarily offline—please retry in a moment.';
      const retryLabel = LANGUAGE === 'ka' ? 'სცადე ხელახლა' : 'Retry';
      const syntheticResponse = {
        success: false,
        response: [
          {
            language: LANGUAGE,
            sections: [
              {
                title: LANGUAGE === 'ka' ? 'შეზღუდული რეჟიმი' : 'Offline mode',
                bullets: [fallbackText],
                cta: `${retryLabel} → retry`
              }
            ]
          }
        ],
        metadata: {
          telemetry: {
            intent_detected: 'offline-fallback',
            cta_shown: true
          }
        },
        queryType: 'offline-fallback'
      };

      const flattenedText = flattenResponseText(syntheticResponse.response);
      ensureQueryType('offline-fallback', scenario.expectedQueryTypes);
      scenario.validate({
        rawData: syntheticResponse,
        payload,
        flattenedText,
        metadata: syntheticResponse.metadata,
        responseSections: collectSections(syntheticResponse.response),
        queryType: 'offline-fallback',
        duration,
        offlineTriggered: true
      });

      return {
        success: true,
        status: 'pass',
        duration,
        queryType: 'offline-fallback',
        offlineTriggered: true,
        response: syntheticResponse,
        payload,
        latencyLimitMs
      };
    }

    const statusCode = error.response?.status || error.code || 'error';
    const message = error.response?.data?.error || error.message;

    return {
      success: false,
      status: statusCode,
      duration,
      queryType: 'error',
      offlineTriggered,
      error: message,
      response: error.response?.data,
      payload,
      latencyLimitMs
    };
  }
}

function normalizeQueryType(rawData, metadata) {
  if (typeof rawData?.queryType === 'string') {
    return rawData.queryType.toLowerCase();
  }
  if (typeof metadata?.intent === 'string') {
    return metadata.intent.toLowerCase();
  }
  if (typeof metadata?.telemetry?.intent_detected === 'string') {
    return metadata.telemetry.intent_detected.toLowerCase();
  }
  return 'unknown';
}

function ensureQueryType(queryType, expectedTypes = []) {
  if (!expectedTypes.length) return;
  const normalized = queryType?.toLowerCase?.() || 'unknown';
  if (!expectedTypes.map((type) => type.toLowerCase()).includes(normalized)) {
    throw new Error(`მოელოდა queryType ${expectedTypes.join(', ')} მაგრამ მივიღე ${queryType}`);
  }
}

async function runGuruloChatSuite({ endpoint, attempt = 1, abortOffline }) {
  const history = [];
  const results = [];
  const logPayload = {
    endpoint,
    attempt,
    startedAt: new Date().toISOString(),
    latencyLimitMs: getLatencyLimit(endpoint),
    scenarios: []
  };

  for (const scenario of scenarios) {
    const result = await executeScenario({ endpoint, scenario, history, attempt, abortOffline });
    results.push({
      id: scenario.id,
      label: scenario.label,
      success: result.success,
      duration: result.duration,
      queryType: result.queryType,
      latencyLimitMs: result.latencyLimitMs,
      status: result.status,
      offlineTriggered: result.offlineTriggered,
      error: result.error
    });

    logPayload.scenarios.push({
      id: scenario.id,
      label: scenario.label,
      success: result.success,
      duration: result.duration,
      queryType: result.queryType,
      offlineTriggered: result.offlineTriggered,
      status: result.status,
      error: result.error,
      payload: sanitizeForLog(result.payload),
      response: sanitizeForLog(result.response)
    });

    if (!result.success) {
      break;
    }
  }

  const completed = results.every((entry) => entry.success);

  return {
    success: completed,
    results,
    logPayload
  };
}

function resolveEndpointLabel(endpointUrl) {
  try {
    const url = new URL(endpointUrl);
    if (url.port === '5002') return 'backend-proxy';
    if (url.port === '5001') return 'direct-ai';
    return url.host;
  } catch (error) {
    return endpointUrl;
  }
}

module.exports = {
  runGuruloChatSuite,
  scenarios,
  getLatencyLimit,
  resolveEndpointLabel
};

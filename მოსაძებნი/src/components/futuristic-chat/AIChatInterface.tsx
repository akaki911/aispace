import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import {
  FuturisticChatPanel,
  ChatMessage,
  ChatStructuredContent,
  ChatSection,
} from './FuturisticChatPanel';
import { ChatCloud } from './ChatCloud';
import { useAuth } from '../../contexts/useAuth';
import { useAIMode } from '../../contexts/useAIMode';
import kaTranslations from '../../i18n/locales/ka.json';
import enTranslations from '../../i18n/locales/en.json';

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type BrowserSpeechRecognitionResult = {
  length: number;
  isFinal: boolean;
  [index: number]: BrowserSpeechRecognitionAlternative;
};

type BrowserSpeechRecognitionEvent = Event & {
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
};

type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const THEME_KEY = 'bakhmaro_ai_cloud_theme';
const LANGUAGE_KEY = 'bakhmaro_ai_cloud_language';
const LISTENING_KEY = 'bakhmaro_ai_cloud_voice_enabled';
const PREDICTIVE_KEY = 'bakhmaro_ai_cloud_predictive';

const REQUEST_COOLDOWN_MS = 2500;
const SERVER_RATE_LIMIT_MIN_PENALTY_MS = 15000;
const PUBLIC_AUDIENCE_TAG = 'public_front' as const;
type AudienceTag = typeof PUBLIC_AUDIENCE_TAG | 'admin_dev';

type DangerReason = 'secrets' | 'privileged' | 'dangerous';

type StatusBadge = {
  id: string;
  label: string;
  tone: 'live' | 'fallback' | 'blocked' | 'offline';
};

type StreamTelemetryRecord = {
  telemetry?: Record<string, unknown>;
  chunkCount?: number;
  firstChunkMs?: number;
};

const DANGEROUS_INPUT_RULES: Array<{ pattern: RegExp; reason: DangerReason }> = [
  { pattern: /(api[\s_-]*key|access[\s_-]*token|secret[\s_-]*key|private[\s_-]*key)/i, reason: 'secrets' },
  { pattern: /(bearer\s+[a-z0-9\-_.]+)/i, reason: 'secrets' },
  { pattern: /(\.env|dotenv|credentials?\.json|firebaseConfig|service[-_ ]?account)/i, reason: 'secrets' },
  { pattern: /show\s+(api\s*key|secrets?)/i, reason: 'secrets' },
  { pattern: /\/api\/[\w/-]*(delete|write|update|patch|put|admin|secrets?)/i, reason: 'privileged' },
  { pattern: /(drop|truncate|delete|alter)[^\n]+(table|database|collection)/i, reason: 'privileged' },
  { pattern: /dump\s+(db|database|logs?|config|secrets?|env)/i, reason: 'privileged' },
  { pattern: /(eval\(|exec\(|spawn\(|system\(|process\.env)/i, reason: 'dangerous' },
  { pattern: /(curl\s+|wget\s+|rm\s+-rf|sudo\s+|chmod\s+|chown\s+)/i, reason: 'dangerous' },
  { pattern: /(fetch|axios|http)\s*\(['\"]https?:/i, reason: 'dangerous' },
  { pattern: /(apply|run|execute)\s+(patch|script|command|migration)/i, reason: 'dangerous' },
  { pattern: /(upload|download|read|write)\s+(file|filesystem|storage)/i, reason: 'privileged' },
  { pattern: /(backend\s+access|root\s+access|admin\s+panel|super[_\s-]?admin)/i, reason: 'privileged' },
];

const DANGEROUS_OUTPUT_RULES: Array<{ pattern: RegExp; reason: DangerReason }> = [
  { pattern: /(apply\s+patch|git\s+apply|run\s+(tests?|commands?))/i, reason: 'dangerous' },
  { pattern: /```[\s\S]*?(bash|sh|shell|python|node|sql)[\s\S]*?```/i, reason: 'dangerous' },
  { pattern: /\/api\/[\w/-]*(delete|write|update|patch|put)/i, reason: 'privileged' },
  { pattern: /(secret|token|credential|private\s+key)/i, reason: 'secrets' },
  { pattern: /(DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM)/i, reason: 'privileged' },
  { pattern: /(fetch\(['\"]https?:|curl\s+|rm\s+-rf|sudo\s+)/i, reason: 'dangerous' },
];

const SECURITY_MESSAGES = {
  ka: {
    secrets:
      '🚫 უსაფრთხოების პოლიტიკა: გურულო არ ამუშავებს გასაღებებს, ტოკენებს ან საიდუმლო კონფიგურაციებს. გთხოვთ, მიმართოთ სისტემის ადმინისტრატორს საჭიროების შემთხვევაში.',
    privileged:
      '🔒 ეს მოქმედება შეზღუდულია. გურულო მხოლოდ UI-ს ახსნის და ვერ გასცემს ადმინისტრაციულ ან სენსიტიურ ინფორმაციას.',
    dangerous:
      '🛡️ უსაფრთხოების გაფრთხილება: გურულო არ ასრულებს ბრძანებებს, კოდის ცვლილებებს ან ქსელურ მოთხოვნებს. შემოგთავაზებთ მხოლოდ პროდუქტის გამოყენების რჩევებს.',
    rate:
      '⏱️ გთხოვთ, დაელოდოთ რამდენიმე წამს შემდეგი მოთხოვნისთვის. უსაფრთხოების მიზნით შეკითხვებს ვამუშავებთ თანმიმდევრულად.',
  },
  en: {
    secrets:
      '🚫 Security policy: Gurulo never handles keys, tokens, or private configuration. Please contact a platform administrator for privileged assistance.',
    privileged:
      '🔒 This action is restricted. Gurulo can only explain the UI and cannot reveal admin-only or sensitive data.',
    dangerous:
      '🛡️ Safety notice: Gurulo does not execute commands, change code, or make network calls. I can only share product guidance.',
    rate:
      '⏱️ Please wait a moment before sending another request. For safety we process questions sequentially.',
  },
} as const;

const CONSUMER_DENYLIST_PATTERNS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bcode\b/i, token: 'code' },
  { pattern: /\benv\b/i, token: 'env' },
  { pattern: /\btoken\b/i, token: 'token' },
  { pattern: /\bapi\s*key\b/i, token: 'api key' },
  { pattern: /\bconsole\b/i, token: 'console' },
  { pattern: /stack\s*trace/i, token: 'stacktrace' },
  { pattern: /ci\/?cd/i, token: 'ci/cd' },
  { pattern: /\breplit\b/i, token: 'replit' },
  { pattern: /\bgit\b/i, token: 'git' },
  { pattern: /\bwebauthn\b/i, token: 'webauthn' },
  { pattern: /\badmin\b/i, token: 'admin' },
  { pattern: /\brole\b/i, token: 'role' },
  { pattern: /\btelemetry\b/i, token: 'telemetry' },
  { pattern: /\blog\b/i, token: 'log' },
  { pattern: /\bdb\b/i, token: 'db' },
  { pattern: /firestore/i, token: 'firestore' },
  { pattern: /\bsecret\b/i, token: 'secret' },
  { pattern: /\bvariable\b/i, token: 'variable' },
  { pattern: /\bconfig\b/i, token: 'config' },
  { pattern: /\bendpoint\b/i, token: 'endpoint' },
  { pattern: /\/api\//i, token: '/api/' },
  { pattern: /\.env/i, token: '.env' },
  { pattern: /\bopenai\b/i, token: 'openai' },
  { pattern: /\bgroq\b/i, token: 'groq' },
  { pattern: /\banthropic\b/i, token: 'anthropic' },
];

const CONSUMER_ALLOWLIST_KEYWORDS = [
  'ბახმარ',
  'კოტეჯ',
  'თავისუფალი',
  'დაჯავშნ',
  'ჯავშნ',
  'ფას',
  'ბიუჯეტ',
  'availability',
  'available',
  'book',
  'booking',
  'cottage',
  'price',
  'rent',
  'weather',
  'forecast',
  'road',
  'route',
  'გზა',
  'მარშრუტ',
  'ტურ',
  'tour',
  'trip',
  'plan',
  'stay',
  'guest',
  'სტუმრ',
  'ამინდი',
  'policy',
  'პოლიტიკა',
  'წეს',
  'transport',
  'გზები',
  'attraction',
  'სანახ',
  'activity',
  'გასართობ',
  'snow',
  'road condition',
];

const GREETING_KEYWORDS = ['გამარჯ', 'hello', 'hi', 'hey', 'gamarjoba'];

const STRUCTURED_PAYLOAD_HINT = /"sections"|"telemetry"|"metadata"|"cta"|"recommendations"|"bullets"/i;

const GUARD_SAMPLE_REQUEST: Record<'ka' | 'en', string> = {
  ka: '10 აგვისტო - 13 აგვისტო, 4 სტუმარი',
  en: '10 August - 13 August, 4 guests',
};

const detectConsumerDenylist = (value: string): string | null => {
  const normalized = value.toLowerCase();
  for (const entry of CONSUMER_DENYLIST_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.token;
    }
  }
  return null;
};

const isConsumerTopic = (value: string): boolean => {
  const normalized = value.toLowerCase();
  if (!normalized.trim()) {
    return false;
  }
  if (GREETING_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }
  return CONSUMER_ALLOWLIST_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const DEFAULT_SECTION_TITLE: Record<'ka' | 'en', string> = {
  ka: 'გურულოს რეკომენდაციები',
  en: 'Gurulo Highlights',
};

const DEFAULT_SECTION_CTA: Record<'ka' | 'en', string> = {
  ka: 'კითხეთ დამატებითი მიმართულება ან სთხოვეთ სხვა რჩევა.',
  en: 'Ask for more details or request another suggestion.',
};

type ContentFormat = 'text' | 'json';

const normalizeContentFormat = (value: unknown): ContentFormat => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'json' ? 'json' : 'text';
  }
  return 'text';
};

const USER_MESSAGE_TITLE: Record<'ka' | 'en', string> = {
  ka: '',
  en: '',
};

type UnavailableCopy = {
  user: string;
  adminTitle: string;
  adminAnalysis: string;
  offlineBadge: string;
  retry: string;
};

type UnavailableDetails = {
  code: string;
  status?: number;
  latencyMs: number;
  endpoint: string;
  retryInSeconds: number;
};

const DEFAULT_UNAVAILABLE_COPY: Record<'ka' | 'en', UnavailableCopy> = {
  ka: {
    user: 'გურულო დროებით ხელმიუწვდომელია. სცადეთ მოგვიანებით.',
    adminTitle: 'გურულო დროებით ხელმიუწვდომელია.',
    adminAnalysis:
      'კოდი: {{code}} • სტატუსი: {{status}} • ლატენცია: {{latency}}ms • ენდპოინტი: {{endpoint}} • ხელახლა სცადე ≈{{retryIn}}წმ-ში.',
    offlineBadge: '🔴 Offline',
    retry: 'სცადე თავიდან',
  },
  en: {
    user: 'Gurulo is temporarily unavailable. Please try again later.',
    adminTitle: 'Gurulo is temporarily unavailable.',
    adminAnalysis:
      'Code: {{code}} • Status: {{status}} • Latency: {{latency}}ms • Endpoint: {{endpoint}} • Retry ≈{{retryIn}}s.',
    offlineBadge: '🔴 Offline',
    retry: 'Try again',
  },
};

const getRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
};

const extractAvailabilityCopy = (
  translations: unknown,
  fallback: UnavailableCopy,
): UnavailableCopy => {
  const root = getRecord(translations);
  const availability = getRecord(root ? root['availability'] : undefined);

  if (!availability) {
    return fallback;
  }

  const pickString = (value: unknown, fallbackValue: string) =>
    typeof value === 'string' && value.trim() ? value : fallbackValue;

  return {
    user: pickString(availability['user'], fallback.user),
    adminTitle: pickString(availability['adminTitle'], fallback.adminTitle),
    adminAnalysis: pickString(availability['adminAnalysis'], fallback.adminAnalysis),
    offlineBadge: pickString(availability['offlineBadge'], fallback.offlineBadge),
    retry: pickString(availability['retry'], fallback.retry),
  };
};

const kaTranslationRoot = getRecord(kaTranslations);
const enTranslationRoot = getRecord(enTranslations);

const GURULO_UNAVAILABLE_COPY: Record<'ka' | 'en', UnavailableCopy> = {
  ka: extractAvailabilityCopy(getRecord(kaTranslationRoot?.['futuristicChat']), DEFAULT_UNAVAILABLE_COPY.ka),
  en: extractAvailabilityCopy(getRecord(enTranslationRoot?.['futuristicChat']), DEFAULT_UNAVAILABLE_COPY.en),
};

const GUARD_FALLBACK = {
  ka: 'მე გიდგავარ გვერდში სტუმრის თემებზე — ბახმაროს კოტეჯები, ფასები, ამინდი, გზები, მარშრუტები. ტექნიკურ კითხვებზე პასუხს ვერ გაგიტარებ.',
  en: "I'm here to help with guest topics only—Bakhmaro cottages, pricing, weather, routes, and tours. I can't assist with technical questions.",
} as const;

const GUARD_CTA_FALLBACK = {
  ka: 'დამიწერე თარიღები და ხალხის რაოდენობა',
  en: 'Share dates and guest count',
} as const;

const CTA_LABEL_FALLBACK = {
  availability: {
    ka: 'ნახე ხელმისაწვდომობა',
    en: 'Check availability',
  },
  pricing: {
    ka: 'ფასების წესები',
    en: 'Pricing rules',
  },
  weather: {
    ka: 'ამინდის დეტალური ნახვა',
    en: 'View detailed weather',
  },
  tripPlan: {
    ka: 'გეგმა 3 ნაბიჯში',
    en: 'Plan in 3 steps',
  },
} as const;

const AVAILABILITY_PARAMS_FALLBACK = {
  ka: 'მომაწოდე ჩასვლის და გასვლის თარიღები და სტუმრების რაოდენობა, რომ ხელმისაწვდომობა შეგიმოწმო.',
  en: 'Let me know arrival and departure dates plus guest count so I can check availability.',
} as const;

const getChatLocaleRoot = (language: 'ka' | 'en') =>
  getRecord((language === 'ka' ? kaTranslationRoot : enTranslationRoot)?.['chat']);

const getGuardCopy = (language: 'ka' | 'en') => {
  const chatRoot = getChatLocaleRoot(language);
  const guard = getRecord(chatRoot?.['guard']);
  const message = typeof guard?.onlyConsumerTopics === 'string' && guard.onlyConsumerTopics.trim()
    ? guard.onlyConsumerTopics.trim()
    : GUARD_FALLBACK[language];
  const cta = typeof guard?.retryAskDates === 'string' && guard.retryAskDates.trim()
    ? guard.retryAskDates.trim()
    : GUARD_CTA_FALLBACK[language];
  return { message, cta };
};

const getChatCtas = (language: 'ka' | 'en') => {
  const chatRoot = getChatLocaleRoot(language);
  const availability = getRecord(chatRoot?.['availability']);
  const tripPlan = getRecord(chatRoot?.['tripPlan']);
  const pricing = getRecord(chatRoot?.['pricing']);
  const weather = getRecord(chatRoot?.['weather']);

  return {
    availability:
      typeof availability?.cta === 'string' && availability.cta.trim()
        ? availability.cta.trim()
        : CTA_LABEL_FALLBACK.availability[language],
    availabilityAsk:
      typeof availability?.askParams === 'string' && availability.askParams.trim()
        ? availability.askParams.trim()
        : AVAILABILITY_PARAMS_FALLBACK[language],
    tripPlan:
      typeof tripPlan?.cta === 'string' && tripPlan.cta.trim()
        ? tripPlan.cta.trim()
        : CTA_LABEL_FALLBACK.tripPlan[language],
    pricing:
      typeof pricing?.cta === 'string' && pricing.cta.trim()
        ? pricing.cta.trim()
        : CTA_LABEL_FALLBACK.pricing[language],
    weather:
      typeof weather?.cta === 'string' && weather.cta.trim()
        ? weather.cta.trim()
        : CTA_LABEL_FALLBACK.weather[language],
  };
};

const renderTemplate = (template: string, replacements: Record<string, string>): string =>
  template.replace(/{{(\w+)}}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    return Object.prototype.hasOwnProperty.call(replacements, key)
      ? replacements[key] ?? ''
      : '';
  });

const buildUnavailableLines = (
  language: 'ka' | 'en',
  isAdmin: boolean,
  details: UnavailableDetails,
): string[] => {
  const copy = GURULO_UNAVAILABLE_COPY[language];
  if (!isAdmin) {
    return [copy.user];
  }

  const sanitizedLatency = Math.max(0, Math.round(details.latencyMs));
  const sanitizedRetry = Math.max(1, Math.round(details.retryInSeconds));
  const statusText = typeof details.status === 'number' && Number.isFinite(details.status)
    ? String(details.status)
    : '—';

  const analysis = renderTemplate(copy.adminAnalysis, {
    code: details.code,
    status: statusText,
    latency: String(sanitizedLatency),
    endpoint: details.endpoint,
    retryIn: String(sanitizedRetry),
  });

  return [copy.adminTitle, analysis];
};

const formatPolicyMessage = (
  reason: DangerReason | 'rate',
  language: 'ka' | 'en',
  options?: { waitMs?: number },
): string => {
  if (reason === 'rate' && options?.waitMs && options.waitMs > 0) {
    const seconds = Math.max(1, Math.ceil(options.waitMs / 1000));
    const waitMessage =
      language === 'ka'
        ? `ხელახლა სცადეთ დაახლოებით ${seconds} წამში.`
        : `Try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`;
    return `${SECURITY_MESSAGES[language].rate}\n\n${waitMessage}`;
  }
  return SECURITY_MESSAGES[language][reason];
};

const normalizeKaPunctuation = (text: string, language: 'ka' | 'en'): string => {
  if (!text || language !== 'ka') {
    return text;
  }

  let normalized = text.replace(/ {2,}/g, ' ');
  normalized = normalized.replace(/\. {2,}/g, '. '); // guard against dot-space duplication
  normalized = normalized.replace(/\.{2,}/g, (match) => (match.length === 2 ? '.' : '...'));
  normalized = normalized.replace(/([„“”"']){2,}/g, '$1');
  normalized = normalized.replace(/(^|\s)([„“”"'])(?=\s|$)/g, '$1');

  return normalized;
};

const normalizeChatContent = (value: unknown, language: 'ka' | 'en'): string => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeChatContent(item, language))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    const localized = record[language];
    if (typeof localized === 'string') {
      return localized;
    }

    const fallbackLocale = language === 'ka' ? record.en : record.ka;
    if (typeof fallbackLocale === 'string') {
      return fallbackLocale;
    }

    const prioritizedKeys = ['content', 'response', 'message', 'text', 'value'];
    for (const key of prioritizedKeys) {
      if (key in record) {
        const normalized = normalizeChatContent(record[key], language);
        if (normalized) {
          return normalized;
        }
      }
    }

    for (const entry of Object.values(record)) {
      const normalized = normalizeChatContent(entry, language);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  return '';
};

const structuredContentToPlainText = (content: ChatStructuredContent[]): string => {
  const lines: string[] = [];
  for (const block of content) {
    for (const section of block.sections) {
      if (section.title) {
        lines.push(section.title);
      }
      for (const bullet of section.bullets) {
        if (bullet) {
          lines.push(bullet);
        }
      }
      if (section.cta) {
        lines.push(section.cta);
      }
    }
  }
  return lines.join('\n');
};

const createStructuredFromText = (
  text: string,
  language: 'ka' | 'en',
  overrides?: { title?: string; cta?: string },
): ChatStructuredContent[] => {
  const sanitized = text.replace(/\r/g, '').trim();
  const title = overrides?.title ?? DEFAULT_SECTION_TITLE[language];
  const cta = overrides?.cta ?? DEFAULT_SECTION_CTA[language];

  if (!sanitized) {
    return [
      {
        language,
        sections: [
          {
            title,
            bullets: [],
            cta,
          },
        ],
      },
    ];
  }

  const paragraphChunks = sanitized
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const bulletCandidates = (paragraphChunks.length > 1 ? paragraphChunks : sanitized.split(/\n+/))
    .map((entry) => entry.replace(/^[•*\-]\s*/, '').trim())
    .filter(Boolean);

  return [
    {
      language,
      sections: [
        {
          title,
          bullets: bulletCandidates,
          cta,
        },
      ],
    },
  ];
};

const sanitizeSectionFromPayload = (section: unknown, language: 'ka' | 'en'): ChatSection | null => {
  if (!section || typeof section !== 'object') {
    return null;
  }

  const record = section as Record<string, unknown>;
  const rawTitle = typeof record.title === 'string' ? record.title.trim() : '';
  const rawCta = typeof record.cta === 'string' ? record.cta.trim() : '';
  const bulletSource = Array.isArray(record.bullets) ? record.bullets : [];

  const bullets = bulletSource
    .map((entry) => normalizeChatContent(entry, language).trim())
    .filter(Boolean);

  if (!rawTitle && bullets.length === 0 && !rawCta) {
    return null;
  }

  return {
    title: rawTitle || DEFAULT_SECTION_TITLE[language],
    bullets,
    cta: rawCta || DEFAULT_SECTION_CTA[language],
  };
};

const sanitizeStructuredBlockFromPayload = (
  block: unknown,
  language: 'ka' | 'en',
): ChatStructuredContent | null => {
  if (!block || typeof block !== 'object') {
    return null;
  }

  const record = block as Record<string, unknown>;
  const blockLanguage = record.language === 'ka' || record.language === 'en' ? record.language : language;
  const sectionsSource = Array.isArray(record.sections) ? record.sections : [];
  const sections = sectionsSource
    .map((section) => sanitizeSectionFromPayload(section, blockLanguage))
    .filter((section): section is ChatSection => Boolean(section));

  if (!sections.length) {
    return null;
  }

  return {
    language: blockLanguage,
    sections,
  };
};

type ParsedAssistantPayload = {
  content: ChatStructuredContent[];
  derivedFrom: 'structured' | 'text';
  plainText: string;
};

type ParseFinalizeContext = {
  audience?: AudienceTag;
  language: 'ka' | 'en';
  source: unknown;
  derivedFromStructured: boolean;
};

const finalizeParsedPayload = (
  result: ParsedAssistantPayload,
  context: ParseFinalizeContext,
): ParsedAssistantPayload => {
  if (context.audience !== PUBLIC_AUDIENCE_TAG) {
    return result;
  }

  const plainCandidate = result.plainText.trim()
    ? result.plainText
    : result.content.length
      ? structuredContentToPlainText(result.content)
      : '';

  if (!plainCandidate.trim()) {
    return {
      content: [],
      derivedFrom: 'text',
      plainText: '',
    };
  }

  const shouldLogSanitized =
    context.derivedFromStructured ||
    (typeof context.source === 'string' && STRUCTURED_PAYLOAD_HINT.test(context.source));

  if (shouldLogSanitized) {
    console.info('[GuruloPublicChat] sanitized_structured_reply', {
      preview: plainCandidate.slice(0, 140),
    });
  }

  return {
    content: createStructuredFromText(plainCandidate, context.language, { title: '', cta: '' }),
    derivedFrom: 'text',
    plainText: plainCandidate,
  };
};

const parseAssistantPayload = (
  value: unknown,
  language: 'ka' | 'en',
  format: ContentFormat,
  options: { audience?: AudienceTag } = {},
): ParsedAssistantPayload => {
  const audience = options.audience;
  if (
    audience === PUBLIC_AUDIENCE_TAG &&
    typeof value === 'string' &&
    STRUCTURED_PAYLOAD_HINT.test(value)
  ) {
    try {
      const parsed = JSON.parse(value);
      return parseAssistantPayload(parsed, language, 'json', options);
    } catch {
      // fall through to standard normalization when JSON parsing fails
    }
  }

  if (format === 'json') {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parseAssistantPayload(parsed, language, 'json', options);
      } catch {
        // fall through to text normalization when payload is not valid JSON
      }
    }

    if (Array.isArray(value)) {
      const structured = value
        .map((entry) => sanitizeStructuredBlockFromPayload(entry, language))
        .filter((entry): entry is ChatStructuredContent => Boolean(entry));

      if (structured.length > 0) {
        return finalizeParsedPayload(
          {
            content: structured,
            derivedFrom: 'structured',
            plainText: structuredContentToPlainText(structured),
          },
          {
            audience,
            language,
            source: value,
            derivedFromStructured: true,
          },
        );
      }
    }

    if (typeof value === 'object' && value !== null) {
      const structured = sanitizeStructuredBlockFromPayload(value, language);
      if (structured) {
        const plainText = structuredContentToPlainText([structured]);
        return finalizeParsedPayload(
          {
            content: [structured],
            derivedFrom: 'structured',
            plainText,
          },
          {
            audience,
            language,
            source: value,
            derivedFromStructured: true,
          },
        );
      }
    }
  }

  const normalizedText = normalizeChatContent(value, language);
  return finalizeParsedPayload(
    {
      content: normalizedText ? createStructuredFromText(normalizedText, language) : [],
      derivedFrom: 'text',
      plainText: normalizedText,
    },
    {
      audience,
      language,
      source: value,
      derivedFromStructured: false,
    },
  );
};

const messageContentToPlainText = (
  content: ChatStructuredContent[],
  language: 'ka' | 'en',
): string => {
  if (!content.length) {
    return '';
  }

  const normalized = content.map((block) => ({
    language: block.language === 'ka' || block.language === 'en' ? block.language : language,
    sections: block.sections.map((section) => ({
      title: section.title,
      bullets: section.bullets,
      cta: section.cta,
    })),
  }));

  return structuredContentToPlainText(normalized);
};

const createPolicyMessage = (
  reason: DangerReason | 'rate',
  language: 'ka' | 'en',
  options?: { waitMs?: number },
): ChatMessage => ({
  id: uuid(),
  role: 'assistant',
  content: createStructuredFromText(formatPolicyMessage(reason, language, options), language),
  timestamp: Date.now(),
  status: 'error',
  contentType: 'text',
});

const parseRetryAfterHeader = (value: string | null): number | null => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric * 1000;
  }
  const dateTime = Date.parse(value);
  if (!Number.isNaN(dateTime)) {
    const delta = dateTime - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
};

const detectDangerousInput = (value: string): { blocked: boolean; reason: DangerReason | null } => {
  const text = value.toLowerCase();
  const rule = DANGEROUS_INPUT_RULES.find(({ pattern }) => pattern.test(text));
  if (!rule) {
    return { blocked: false, reason: null };
  }
  return { blocked: true, reason: rule.reason };
};

const NON_SITE_INTENT_PATTERNS: RegExp[] = [
  /\b(weather|forecast|temperature|rain|snow|climate|stock|crypto|bitcoin|recipe|poem|story|lyrics|movie|news|politics|biology|chemistry|physics|math|algebra)\b/i,
  /ამინდ/i,
  /რესეპტ/i,
  /რეცეპტ/i,
  /სიმღერ/i,
  /პოემ/i,
  /ვიქტორინ/i,
  /კრიპტო/i,
  /ბიტკოინ/i,
  /ფილმ/i,
  /სპორტ/i,
  /ისტორიის გამოცდ/i,
];

const NON_SITE_OUTPUT_PATTERNS: RegExp[] = [
  /\b(chatgpt|gpt|openai|deep learning|machine learning|neural network|python|javascript|java|c\+\+|sql)\b/i,
  /\b(recipe|poem|story|lyrics|weather|forecast|bitcoin|crypto|stock)\b/i,
  /ამინდი/i,
  /პროგრამირების/i,
  /რეცეპტ/i,
  /პოემ/i,
  /სიმღერ/i,
  /ფილმ/i,
];

const OFF_TOPIC_RESPONSE = {
  ka: 'ბოდიში, გურულო პასუხობს მხოლოდ საიტის ფუნქციებზე. იხილეთ [Contact/Help](/contact-help).',
  en: 'Sorry, Gurulo only covers site functionality. Visit [Contact/Help](/contact-help).',
} as const;

const isNonSiteIntent = (query: string | undefined): boolean => {
  if (!query) return false;
  const normalized = query.toLowerCase();
  return NON_SITE_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
};

const isNonSiteOutput = (text: string): boolean => {
  return NON_SITE_OUTPUT_PATTERNS.some((pattern) => pattern.test(text));
};

const sanitizeAssistantOutput = (
  candidate: ChatStructuredContent[] | null,
  plainText: string,
  language: 'ka' | 'en',
): { content: ChatStructuredContent[]; blocked: boolean; reason?: DangerReason } => {
  const normalizedText = plainText.trim()
    ? plainText
    : candidate && candidate.length
      ? structuredContentToPlainText(candidate)
      : '';

  if (!normalizedText.trim()) {
    const fallbackText =
      language === 'ka'
        ? 'გურულომ ვერ მიიღო პასუხი. სცადეთ ხელახლა ან გადაამოწმეთ კითხვა.'
        : 'Gurulo could not retrieve a response. Please retry with another question.';
    return {
      content: createStructuredFromText(fallbackText, language),
      blocked: false,
    };
  }

  const lower = normalizedText.toLowerCase();
  const unsafeRule = DANGEROUS_OUTPUT_RULES.find(({ pattern }) => pattern.test(lower));
  if (unsafeRule) {
    const safeContent = SECURITY_MESSAGES[language][unsafeRule.reason];
    return {
      content: createStructuredFromText(safeContent, language),
      blocked: true,
      reason: unsafeRule.reason,
    };
  }

  return {
    content:
      candidate && candidate.length > 0
        ? candidate
        : createStructuredFromText(normalizedText, language),
    blocked: false,
  };
};

const BASE_SUGGESTIONS = {
  ka: [
    'ბახმაროში რომელი კოტეჯები გაქვთ თავისუფალი?',
    'რამდენი ჯდება 4 სტუმარზე კომფორტული კოტეჯი?',
    'როგორია ამ კვირის ამინდი ბახმაროში?',
    'რომელი გზაა საუკეთესო ქუთაისიდან ბახმარომდე?',
    'რა აქტივობებია საღამოს ბახმაროში?',
  ],
  en: [
    'Which cottages are free in Bakhmaro this month?',
    'What is the nightly rate for a cottage for 4 guests?',
    'How is the weather in Bakhmaro this week?',
    'What is the best route to Bakhmaro from Kutaisi?',
    'What activities can we plan for evenings in Bakhmaro?',
  ],
};

const SUPER_ADMIN_SUGGESTIONS = {
  ka: [
    'მაჩვენე ლოგური გეგმა 3 დღიანი მოგზაურობისთვის ბახმაროში.',
    'გვითხარი რა წესებია წინასწარ გადახდაზე და გაუქმებაზე?',
    'რა ტრანსპორტის ვარიანტები გვაქვს ბათუმიდან ბახმარომდე?',
    'რომელი კოტეჯი ჯდება 6 სტუმარზე და რა არის ფასები?',
    'გაქირავებისას რა ადგილობრივ ატრაქციონებს მირჩევ?',
  ],
  en: [
    'Outline a 3-day plan for staying in Bakhmaro.',
    'What are the advance payment and cancellation rules?',
    'Which transport options work from Batumi to Bakhmaro?',
    'Which cottage fits 6 guests and what are the prices?',
    'Which local attractions do you recommend during a rental?',
  ],
} as const;

const LANGUAGE_LABEL = {
  ka: 'ქართ.',
  en: 'ENG',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function AIChatInterface() {
  const { user, updateUserPreferences } = useAuth();
  const userRole = (user?.role ?? 'CUSTOMER') as string;
  const activePersonalId = user?.personalId?.trim();
  const isSuperAdmin = userRole === 'SUPER_ADMIN' && activePersonalId === '01019062020';
  const { isLive: isLiveMode } = useAIMode();

  const panelRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const targetPositionRef = useRef<{ x: number; y: number } | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorValue] = useState<string | null>(null);
  const [errorTone, setErrorTone] = useState<'error' | 'info'>('error');
  const [retryLabelOverride, setRetryLabelOverride] = useState<string | null>(null);
  const [retryHandler, setRetryHandler] = useState<(() => void) | null>(null);
  const setError = useCallback(
    (message: string | null, tone: 'error' | 'info' = 'error') => {
      setErrorTone(tone);
      setErrorValue(message);
      if (message === null) {
        setRetryLabelOverride(null);
        setRetryHandler(null);
      }
    },
    [],
  );
  const getStoredLanguage = useCallback((): 'ka' | 'en' => {
    if (typeof window === 'undefined') return 'ka';
    const stored = localStorage.getItem(LANGUAGE_KEY);
    return stored === 'en' ? 'en' : 'ka';
  }, []);

  const preferredLanguage = user?.preferences?.language;

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') ?? 'dark';
  });
  const [language, setLanguageState] = useState<'ka' | 'en'>(() => {
    if (preferredLanguage === 'ka' || preferredLanguage === 'en') {
      return preferredLanguage;
    }
    return getStoredLanguage();
  });
  const [isListening, setIsListening] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LISTENING_KEY) === 'true';
  });
  const [predictiveEnabled, setPredictiveEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(PREDICTIVE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [cloudPosition, setCloudPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - 96 : 24,
    y: typeof window !== 'undefined' ? window.innerHeight - 140 : 24,
  }));
  const audienceTag: AudienceTag = PUBLIC_AUDIENCE_TAG;
  const isPublicAudience = audienceTag === PUBLIC_AUDIENCE_TAG;
  const [telemetryCounters, setTelemetryCounters] = useState({ blocked: 0, fallback: 0 });
  const [unavailableDetails, setUnavailableDetails] = useState<UnavailableDetails | null>(null);
  const [isRealtimeHealthy, setIsRealtimeHealthy] = useState(true);
  const [heartbeatTimestamp, setHeartbeatTimestamp] = useState(() => Date.now());
  const lastRequestRef = useRef<number>(0);
  const rateLimitUntilRef = useRef<number>(0);

  useEffect(() => {
    const preferred = user?.preferences?.language;

    if (preferred === 'ka' || preferred === 'en') {
      setLanguageState((current) => (current === preferred ? current : preferred));
      return;
    }

    if (!user) {
      const fallback = getStoredLanguage();
      setLanguageState((current) => (current === fallback ? current : fallback));
    }
  }, [user, user?.preferences?.language, getStoredLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) {
      localStorage.setItem(LANGUAGE_KEY, language);
    }
    if (recognitionRef.current) {
      recognitionRef.current.lang = language === 'ka' ? 'ka-GE' : 'en-US';
    }
  }, [language, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LISTENING_KEY, String(isListening));
  }, [isListening]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PREDICTIVE_KEY, String(predictiveEnabled));
  }, [predictiveEnabled]);

  const handleLanguageChange = useCallback(
    (nextLanguage: 'ka' | 'en') => {
      setLanguageState(nextLanguage);

      if (user) {
        if (typeof updateUserPreferences === 'function') {
          void updateUserPreferences({ language: nextLanguage });
        }
      }
    },
    [user, updateUserPreferences],
  );

  useEffect(() => {
    if (!messageContainerRef.current) return;
    messageContainerRef.current.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = window.setInterval(() => {
      setHeartbeatTimestamp(Date.now());
    }, 12000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.info('[GuruloTelemetry]', {
      role: userRole || 'ANONYMOUS',
      fallbackResponses: telemetryCounters.fallback,
      blockedRequests: telemetryCounters.blocked,
    });
  }, [telemetryCounters, userRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setCloudPosition((prev) => ({
        x: clamp(prev.x, 16, window.innerWidth - 120),
        y: clamp(prev.y, 16, window.innerHeight - 120),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateLoop = () => {
      if (targetPositionRef.current) {
        setCloudPosition((current) => {
          const dx = targetPositionRef.current!.x - current.x;
          const dy = targetPositionRef.current!.y - current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 0.2) {
            return current;
          }

          const easing = isHovered ? 0.2 : 0.08;
          return {
            x: current.x + dx * easing,
            y: current.y + dy * easing,
          };
        });
      }
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animationFrameRef.current = requestAnimationFrame(updateLoop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isHovered]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePointerMove = (event: MouseEvent) => {
      const buffer = 90;
      const x = clamp(event.clientX + 24, 16, window.innerWidth - buffer);
      const y = clamp(event.clientY + 24, 16, window.innerHeight - buffer);
      targetPositionRef.current = { x, y };
    };

    const handleScroll = () => {
      const baseY = window.innerHeight - 120 + window.scrollY;
      targetPositionRef.current = {
        x: clamp(window.innerWidth - 110 + window.scrollX, 16, window.innerWidth - 110),
        y: baseY,
      };
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scopedWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    const SpeechRecognitionAPI = scopedWindow.SpeechRecognition || scopedWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === 'ka' ? 'ka-GE' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputValue((prev) => `${prev}${prev ? ' ' : ''}${transcript}`.trim());
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const predictiveHint = useMemo(() => {
    if (!predictiveEnabled) return null;
    const heartbeatPhrase =
      language === 'ka'
        ? `სერვისის სტატუსი განახლდა: ${new Date(heartbeatTimestamp).toLocaleTimeString('ka-GE')}`
        : `Service heartbeat updated: ${new Date(heartbeatTimestamp).toLocaleTimeString('en-US')}`;

    if (unavailableDetails) {
      const offlineNotice =
        language === 'ka'
          ? '🔴 გურულო დროებით გათიშულია — სცადეთ ხელახლა ცოტა ხანში.'
          : '🔴 Gurulo is temporarily offline—please retry in a moment.';
      return `${offlineNotice} ${heartbeatPhrase}`;
    }

    if (!isRealtimeHealthy && isLiveMode) {
      const degradedNotice =
        language === 'ka'
          ? '⚠️ რეალურ სერვერთან კავშირი შეფერხებულია — პასუხი შეიძლება შეწყდეს.'
          : '⚠️ Live service connectivity is degraded — replies may pause.';
      return `${degradedNotice} ${heartbeatPhrase}`;
    }

    const roleNotice = isSuperAdmin
      ? language === 'ka'
        ? 'სუპერ ადმინის ახსნა-რეჟიმი: კოდი ან მონაცემები არ იცვლება.'
        : 'Super admin explain-only mode: no code or data changes.'
      : language === 'ka'
        ? 'სტანდარტული რეჟიმი: ჰკითხეთ ნავიგაციასა და ფუნქციებზე.'
        : 'Standard mode: ask about navigation and feature usage.';

    if (messages.length === 0) {
      return `${roleNotice} ${heartbeatPhrase}`;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant') {
      const followUp =
        language === 'ka'
          ? 'კითხეთ სერვისის მუშაობის შესახებ დამატებითი დეტალებისთვის.'
          : 'Ask for more clarity about the product experience.';
      return `${followUp} ${heartbeatPhrase}`;
    }

    const preparing =
      language === 'ka'
        ? 'გურულო ამზადებს ახსნას თქვენი შეკითხვის მიხედვით.'
        : 'Gurulo is preparing an explanatory answer to your question.';
    return `${preparing} ${heartbeatPhrase}`;
  }, [
    heartbeatTimestamp,
    isSuperAdmin,
    language,
    messages,
    predictiveEnabled,
    isRealtimeHealthy,
    isLiveMode,
    unavailableDetails,
  ]);

  const suggestions = useMemo(() => {
    const source = isSuperAdmin ? SUPER_ADMIN_SUGGESTIONS[language] : BASE_SUGGESTIONS[language];
    return [...source];
  }, [isSuperAdmin, language]);

  const statusBadges = useMemo<StatusBadge[]>(() => {
    if (isPublicAudience) {
      return [];
    }

    if (unavailableDetails) {
      const badges: StatusBadge[] = [
        {
          id: 'offline',
          label: GURULO_UNAVAILABLE_COPY[language].offlineBadge,
          tone: 'offline',
        },
      ];

      if (telemetryCounters.blocked > 0) {
        badges.push({
          id: 'blocked',
          label:
            language === 'ka'
              ? `შეზღუდული ×${telemetryCounters.blocked}`
              : `Blocked ×${telemetryCounters.blocked}`,
          tone: 'blocked',
        });
      }

      return badges;
    }

    const badges: StatusBadge[] = [];

    if (!isRealtimeHealthy) {
      badges.push({
        id: 'fallback',
        label:
          language === 'ka'
            ? '⚠️ დროებითი ფოლბექი აქტიურია'
            : '⚠️ Temporary fallback active',
        tone: 'fallback',
      });
    }

    if (telemetryCounters.blocked > 0) {
      badges.push({
        id: 'blocked',
        label:
          language === 'ka'
            ? `შეზღუდული ×${telemetryCounters.blocked}`
            : `Blocked ×${telemetryCounters.blocked}`,
        tone: 'blocked',
      });
    }
    return badges;
  }, [
    isPublicAudience,
    isRealtimeHealthy,
    language,
    telemetryCounters.blocked,
    unavailableDetails,
  ]);

  const sendMessage = useCallback(
    async (content: string, historyOverride?: ChatMessage[]) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const timestamp = Date.now();
      const userMessage: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: createStructuredFromText(trimmed, language, {
          title: USER_MESSAGE_TITLE[language],
          cta: '',
        }),
        timestamp,
        contentType: 'text',
      };

      const baseHistory = historyOverride ?? messages;
      const normalizedHistory = baseHistory.map((message) => ({
        ...message,
        content: message.content ?? [],
        contentType: message.contentType ?? 'text',
      }));

      const nextHistory = [...normalizedHistory, userMessage];
      const guardCopy = getGuardCopy(language);
      const matchedDenylist = detectConsumerDenylist(trimmed);
      const consumerTopicAllowed = isConsumerTopic(trimmed);

      const handleConsumerGuard = (reason: 'denylist' | 'off_topic' | 'auth') => {
        const guardResponse: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: createStructuredFromText(guardCopy.message, language, { title: '', cta: guardCopy.cta }),
          timestamp: Date.now(),
          status: 'error',
          contentType: 'text',
        };
        setMessages(() => [...nextHistory, guardResponse]);
        setInputValue('');
        setTelemetryCounters((prev) => ({ ...prev, blocked: prev.blocked + 1 }));
        setError(guardCopy.message, 'info');
        setRetryLabelOverride(guardCopy.cta);
        setRetryHandler(() => () => {
          setInputValue(GUARD_SAMPLE_REQUEST[language]);
          setError(null);
        });
        if (isSuperAdmin) {
          console.info('[ai-chat.guard]', { reason, token: matchedDenylist ?? null, language, userRole });
          console.info('[ai-chat.telemetry]', { event: 'blocked_off_topic', reason, token: matchedDenylist ?? null });
        }
      };

      if (matchedDenylist) {
        handleConsumerGuard('denylist');
        return;
      }

      if (!consumerTopicAllowed) {
        handleConsumerGuard('off_topic');
        return;
      }

      setMessages(nextHistory);
      setInputValue('');
      setError(null);

      const now = Date.now();
      const elapsed = now - lastRequestRef.current;
      const serverCooldownRemaining = Math.max(0, rateLimitUntilRef.current - now);
      if (serverCooldownRemaining > 0) {
        setMessages((prev) => [
          ...prev,
          createPolicyMessage('rate', language, { waitMs: serverCooldownRemaining }),
        ]);
        setTelemetryCounters((prev) => ({ ...prev, blocked: prev.blocked + 1 }));
        setError(formatPolicyMessage('rate', language, { waitMs: serverCooldownRemaining }));
        return;
      }

      if (elapsed > 0 && elapsed < REQUEST_COOLDOWN_MS) {
        const waitMs = REQUEST_COOLDOWN_MS - elapsed;
        setMessages((prev) => [
          ...prev,
          createPolicyMessage('rate', language, { waitMs }),
        ]);
        setTelemetryCounters((prev) => ({ ...prev, blocked: prev.blocked + 1 }));
        setError(formatPolicyMessage('rate', language, { waitMs }));
        return;
      }

      const dangerCheck = detectDangerousInput(trimmed);
      if (dangerCheck.blocked && dangerCheck.reason) {
        const reason = dangerCheck.reason;
        setMessages((prev) => [...prev, createPolicyMessage(reason, language)]);
        setTelemetryCounters((prev) => ({ ...prev, blocked: prev.blocked + 1 }));
        setError(SECURITY_MESSAGES[language][reason]);
        return;
      }

      lastRequestRef.current = now;

      const assistantMessageId = uuid();
      const placeholder: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: [],
        timestamp: Date.now(),
        status: 'success',
        contentType: 'text',
      };

      setMessages((prev) => [...prev, placeholder]);

      setIsLoading(true);

      let shouldUseFallback = false;
      const endpointPath = '/api/ai/chat';
      const requestStartedAt = performance.now();
      let responseStatus: number | undefined;
      let responseTelemetry: StreamTelemetryRecord | null = null;
      let sseChunkCount = 0;
      let sseFirstChunkMs: number | null = null;

      try {
        const recentContext = normalizedHistory
          .filter((message) => message.role !== 'system')
          .slice(-3)
          .map((message) => {
            const speakerLabel =
              message.role === 'assistant'
                ? language === 'ka'
                  ? 'გურულო'
                  : 'Gurulo'
                : language === 'ka'
                  ? 'მომხმარებელი'
                  : 'User';
            const condensed = messageContentToPlainText(message.content, language)
              .replace(/\s+/g, ' ')
              .slice(0, 140);
            return `${speakerLabel}: ${condensed}`;
          })
          .join(' • ');
        const directiveBlocks = language === 'ka'
          ? [
              '🎯 მიზანი: მიაწოდე ერთი მოკლე და მოქმედი რეკომენდაცია.',
              recentContext
                ? `ℹ️ კონტექსტი: ${recentContext}`
                : 'ℹ️ კონტექსტი: გამოიყენე ბოლო კითხვა და შენახული ფაქტები.',
              '📝 სტილი: მოკლე წინადადებები და UI ნაბიჯები (მაგ. "გადადით: მენიუ → კალენდარი → “+”").',
            ]
          : [
              'Objective: Deliver one concise actionable recommendation.',
              recentContext
                ? `Context: ${recentContext}`
                : 'Context: Lean on the latest question and any key facts.',
              'Style: Short sentences with UI navigation steps (e.g., "Go to: Menu → Calendar → +").',
            ];
        const formattedHistory = normalizedHistory
          .filter((message) => message.role !== 'system')
          .slice(-6)
          .map((message) => ({
            role: message.role,
            content: messageContentToPlainText(message.content, language).slice(0, 320),
          }));

        const response = await fetch(endpointPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gurulo-Client': 'gurulo-ui',
            ...(userRole
              ? {
                  'X-User-Role': userRole,
                }
              : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            message: trimmed,
            personalId: activePersonalId ?? undefined,
            conversationHistory: formattedHistory,
            audience: audienceTag,
            metadata: {
              language,
              mode: 'explain',
              client: 'gurulo-ui',
              directive: directiveBlocks.join('\n'),
              timestamp: new Date().toISOString(),
              audience: audienceTag,
            },
          }),
        });
        responseStatus = response.status;

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterHeader(response.headers.get('retry-after'));
          const penaltyMs = Math.max(
            SERVER_RATE_LIMIT_MIN_PENALTY_MS,
            retryAfterMs ?? SERVER_RATE_LIMIT_MIN_PENALTY_MS,
          );
          rateLimitUntilRef.current = Date.now() + penaltyMs;
          setTelemetryCounters((prev) => ({ ...prev, blocked: prev.blocked + 1 }));
          const rateLimitMessage = formatPolicyMessage('rate', language, { waitMs: penaltyMs });
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: createStructuredFromText(rateLimitMessage, language),
                    status: 'error',
                    contentType: 'text',
                  }
                : message,
            ),
          );
          setError(rateLimitMessage);
          setUnavailableDetails(null);
          setIsRealtimeHealthy(true);
          return;
        }

        if (!response.ok) {
          if (response.status >= 500) {
            shouldUseFallback = true;
            throw new Error(`proxy_error_${response.status}`);
          }

          const failureMessage =
            language === 'ka'
              ? response.status === 401 || response.status === 403
                ? 'ავტორიზაცია საჭიროა Gurulo-ს რეალურ პასუხებამდე. გთხოვთ, შეხვიდეთ და სცადეთ თავიდან.'
                : `მოთხოვნა ვერ შესრულდა (${response.status}). გთხოვთ, გადაამოწმოთ მონაცემები და სცადოთ ხელახლა.`
              : response.status === 401 || response.status === 403
                ? 'Authentication is required before Gurulo can respond. Please sign in and try again.'
                : `Request failed (${response.status}). Please verify the details and try again.`;

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: createStructuredFromText(failureMessage, language),
                    status: 'error',
                    contentType: 'text',
                  }
                : message,
            ),
          );
          setError(failureMessage);
          setUnavailableDetails(null);
          setIsRealtimeHealthy(true);
          return;
        }

        const contentType = response.headers.get('content-type') ?? '';
        const initialFormat = normalizeContentFormat(response.headers.get('x-content-format'));
        let activeContentFormat: ContentFormat = isPublicAudience ? 'text' : initialFormat;
        let aggregatedPlainText = '';
        let aggregatedStructured: ChatStructuredContent[] | null = null;
        let blockedReported = false;
        let finalSanitized: ReturnType<typeof sanitizeAssistantOutput> | null = null;

        const applySanitized = (
          structuredCandidate: ChatStructuredContent[] | null,
          plainText: string,
        ) => {
          const shouldUseStructured = activeContentFormat === 'json';
          const sanitized = sanitizeAssistantOutput(
            shouldUseStructured ? structuredCandidate : null,
            plainText,
            language,
          );
          const nextContentType: ChatMessage['contentType'] =
            sanitized.blocked || !shouldUseStructured ? 'text' : 'markdown';
          finalSanitized = sanitized;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: sanitized.content,
                    status: sanitized.blocked ? 'error' : 'success',
                    contentType: nextContentType,
                  }
                : message,
            ),
          );
          if (sanitized.blocked && sanitized.reason && !blockedReported) {
            blockedReported = true;
            setTelemetryCounters((prev) => ({ ...prev, blocked: prev.blocked + 1 }));
            setError(SECURITY_MESSAGES[language][sanitized.reason]);
          }
        };

        if (contentType.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader ? response.body.getReader() : null;
          if (reader) {
            const decoder = new TextDecoder();
            let buffer = '';
            let streamCompleted = false;

            while (!streamCompleted) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              buffer += decoder.decode(value, { stream: true });

              let boundary = buffer.indexOf('\n\n');
              while (boundary !== -1) {
                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const lines = block.split('\n');
                let eventType: string | null = null;
                let dataPayload = '';

                for (const line of lines) {
                  if (line.startsWith('event:')) {
                    eventType = line.slice(6).trim();
                  } else if (line.startsWith('data:')) {
                    dataPayload += line.slice(5).trim();
                  }
                }

                if (dataPayload) {
                  if (eventType === 'error') {
                    throw new Error(dataPayload);
                  }

                  if (eventType === 'meta') {
                    let metaPayload: unknown = dataPayload;
                    try {
                      metaPayload = JSON.parse(dataPayload);
                    } catch {
                      // ignore parse errors and treat as raw string meta
                    }

                    if (metaPayload && typeof metaPayload === 'object') {
                      const metaRecord = metaPayload as Record<string, unknown>;
                      if (typeof metaRecord.format === 'string') {
                        const nextFormat = isPublicAudience
                          ? 'text'
                          : normalizeContentFormat(metaRecord.format);
                        if (nextFormat !== activeContentFormat) {
                          activeContentFormat = nextFormat;
                          aggregatedPlainText = '';
                          aggregatedStructured = null;
                        }
                      }
                    }

                    continue;
                  }

                  let parsed: unknown;
                  try {
                    parsed = JSON.parse(dataPayload);
                  } catch {
                    parsed = { content: dataPayload };
                  }

                  const payload = parsed as
                    | { content?: string; response?: string; type?: string; error?: string; final?: boolean }
                    | string;

                  if (typeof payload === 'object' && payload?.type === 'error') {
                    throw new Error(payload?.error || 'stream_error');
                  }

                  if (eventType === 'heartbeat') {
                    setHeartbeatTimestamp(Date.now());
                    continue;
                  }

                  if (eventType === 'meta') {
                    setHeartbeatTimestamp(Date.now());
                    continue;
                  }

                  if (eventType === 'done') {
                    if (typeof payload === 'object' && payload) {
                      const record = payload as Record<string, unknown>;
                      const telemetryRecord = getRecord(record.telemetry);
                      const previousTelemetry = responseTelemetry as (StreamTelemetryRecord | null);
                      const chunkCandidate =
                        typeof record.chunks === 'number'
                          ? record.chunks
                          : typeof record.chunkCount === 'number'
                            ? record.chunkCount
                            : undefined;
                      const firstChunkCandidate =
                        typeof record.firstChunkMs === 'number'
                          ? record.firstChunkMs
                          : typeof record.firstChunk === 'number'
                            ? record.firstChunk
                            : undefined;
                      let previousChunkCount: number | undefined;
                      if (previousTelemetry && typeof previousTelemetry.chunkCount === 'number') {
                        previousChunkCount = previousTelemetry.chunkCount as number;
                      }
                      let previousFirstChunk: number | undefined;
                      if (previousTelemetry && typeof previousTelemetry.firstChunkMs === 'number') {
                        previousFirstChunk = previousTelemetry.firstChunkMs as number;
                      }

                      responseTelemetry = {
                        telemetry: telemetryRecord ? { ...telemetryRecord } : undefined,
                        chunkCount: chunkCandidate ?? previousChunkCount,
                        firstChunkMs: firstChunkCandidate ?? previousFirstChunk,
                      };
                      if (responseTelemetry.chunkCount !== undefined) {
                        sseChunkCount = responseTelemetry.chunkCount;
                      }
                      if (responseTelemetry.firstChunkMs !== undefined) {
                        sseFirstChunkMs = responseTelemetry.firstChunkMs;
                      }
                    }
                    if (sseChunkCount === 0 && sseFirstChunkMs === null) {
                      sseFirstChunkMs = Math.max(0, Math.round(performance.now() - requestStartedAt));
                    }
                    setHeartbeatTimestamp(Date.now());
                    streamCompleted = true;
                    continue;
                  }

                  if (eventType === 'chunk') {
                    if (sseChunkCount === 0) {
                      sseFirstChunkMs = Math.max(0, Math.round(performance.now() - requestStartedAt));
                    }
                    sseChunkCount += 1;
                    setHeartbeatTimestamp(Date.now());
                  }

                  const parsedChunk = parseAssistantPayload(payload, language, activeContentFormat, {
                    audience: audienceTag,
                  });
                  const trimmedChunk = parsedChunk.plainText.trim();
                  const isLifecycleEvent = eventType === 'start' || eventType === 'heartbeat';
                  const isTerminalEvent = eventType === 'end' || eventType === 'done';
                  const isStatusChunk = /^(?:complete|done)(?::.*)?$/i.test(trimmedChunk);

                  const hasStructuredContent = parsedChunk.content.length > 0;
                  const hasPlainText = Boolean(parsedChunk.plainText.trim());
                  const hasMeaningfulChunk = hasStructuredContent || hasPlainText;

                  if (!isLifecycleEvent && hasMeaningfulChunk) {
                    if (parsedChunk.derivedFrom === 'structured') {
                      aggregatedStructured = parsedChunk.content;
                      aggregatedPlainText = parsedChunk.plainText;
                    } else if (parsedChunk.plainText) {
                      aggregatedPlainText += parsedChunk.plainText;
                      aggregatedStructured = aggregatedPlainText
                        ? createStructuredFromText(
                            aggregatedPlainText,
                            language,
                            isPublicAudience ? { title: '', cta: '' } : undefined,
                          )
                        : [];
                    }

                    applySanitized(
                      aggregatedStructured && aggregatedStructured.length > 0 ? aggregatedStructured : null,
                      aggregatedPlainText,
                    );
                  } else if (isTerminalEvent && !isStatusChunk && (aggregatedPlainText || aggregatedStructured)) {
                    applySanitized(
                      aggregatedStructured && aggregatedStructured.length > 0 ? aggregatedStructured : null,
                      aggregatedPlainText,
                    );
                  }

                  if (
                    (typeof payload === 'object' && (payload.final || payload.type === 'complete')) ||
                    eventType === 'end' ||
                    eventType === 'done'
                  ) {
                    streamCompleted = true;
                  }
                }

                boundary = buffer.indexOf('\n\n');
              }
            }
          } else {
            const textFallback = await response.text();
            const parsed = parseAssistantPayload(textFallback, language, activeContentFormat, {
              audience: audienceTag,
            });
            aggregatedPlainText = parsed.plainText;
            aggregatedStructured =
              parsed.derivedFrom === 'structured'
                ? parsed.content
                : aggregatedPlainText
                  ? createStructuredFromText(
                      aggregatedPlainText,
                      language,
                      isPublicAudience ? { title: '', cta: '' } : undefined,
                    )
                  : [];
            sseChunkCount = aggregatedPlainText || (aggregatedStructured && aggregatedStructured.length > 0) ? 1 : 0;
            sseFirstChunkMs = Math.max(0, Math.round(performance.now() - requestStartedAt));
            applySanitized(
              aggregatedStructured && aggregatedStructured.length > 0 ? aggregatedStructured : null,
              aggregatedPlainText,
            );
          }
        } else {
          const data = await response.json();
          const metadataRecord = getRecord((data as Record<string, unknown> | undefined)?.metadata);
          const telemetryRecord = getRecord(metadataRecord?.telemetry);
          if (telemetryRecord) {
            responseTelemetry = {
              telemetry: { ...telemetryRecord },
              chunkCount: typeof metadataRecord?.chunkCount === 'number' ? metadataRecord.chunkCount : undefined,
              firstChunkMs:
                typeof metadataRecord?.firstChunkMs === 'number'
                  ? metadataRecord.firstChunkMs
                  : undefined,
            };
          }
          const messageText = data?.response ?? data?.message ?? data?.content ?? data;
          const parsed = parseAssistantPayload(messageText, language, activeContentFormat, {
            audience: audienceTag,
          });
          aggregatedPlainText = parsed.plainText;
          aggregatedStructured =
            parsed.derivedFrom === 'structured'
              ? parsed.content
              : aggregatedPlainText
                ? createStructuredFromText(
                    aggregatedPlainText,
                    language,
                    isPublicAudience ? { title: '', cta: '' } : undefined,
                  )
                : [];
          sseChunkCount = aggregatedPlainText || (aggregatedStructured && aggregatedStructured.length > 0) ? 1 : 0;
          sseFirstChunkMs = Math.max(0, Math.round(performance.now() - requestStartedAt));
          applySanitized(
            aggregatedStructured && aggregatedStructured.length > 0 ? aggregatedStructured : null,
            aggregatedPlainText,
          );
        }

        if (
          !aggregatedPlainText &&
          (!aggregatedStructured || aggregatedStructured.length === 0) &&
          finalSanitized === null
        ) {
          applySanitized(null, '');
        }

        if (!responseTelemetry) {
          responseTelemetry = {
            telemetry: undefined,
            chunkCount: sseChunkCount,
            firstChunkMs:
              sseFirstChunkMs ?? (sseChunkCount > 0 ? Math.max(0, Math.round(performance.now() - requestStartedAt)) : undefined),
          };
        } else {
          if (responseTelemetry.chunkCount === undefined) {
            responseTelemetry.chunkCount = sseChunkCount;
          }
          if (responseTelemetry.firstChunkMs === undefined && sseFirstChunkMs !== null) {
            responseTelemetry.firstChunkMs = sseFirstChunkMs;
          }
        }

        if (isSuperAdmin) {
          console.info('[ai-chat.telemetry]', {
            event: 'response',
            chunkCount: responseTelemetry.chunkCount ?? sseChunkCount,
            firstChunkMs: responseTelemetry.firstChunkMs ?? sseFirstChunkMs ?? null,
            telemetry: responseTelemetry.telemetry ?? null,
          });
        }

        setUnavailableDetails(null);
        setError(null);
        setIsRealtimeHealthy(true);
      } catch (apiError) {
        console.error('Gurulo proxy error:', apiError);
        const error = apiError instanceof Error ? apiError : new Error(String(apiError));
        const networkFailure =
          error.name === 'TypeError' || /networkerror|failed to fetch/i.test(error.message);
        const timeoutFailure = error.name === 'AbortError';
        const statusMatch = /proxy_error_(\d+)/.exec(error.message ?? '');
        const statusFromError = statusMatch ? Number.parseInt(statusMatch[1], 10) : undefined;
        const derivedStatus = typeof responseStatus === 'number' ? responseStatus : statusFromError;
        const serverFailure = typeof derivedStatus === 'number' && derivedStatus >= 500;
        const fallbackEligible = shouldUseFallback || networkFailure || timeoutFailure || serverFailure;

        if (fallbackEligible) {
          const latencyMs = Math.max(0, Math.round(performance.now() - requestStartedAt));
          const fallbackStatus = serverFailure ? derivedStatus : undefined;
          const sanitizedStatus =
            typeof fallbackStatus === 'number' && Number.isFinite(fallbackStatus) ? fallbackStatus : undefined;
          const retryInSeconds = Math.max(5, Math.min(60, Math.round(latencyMs / 1000) + 5));
          const details: UnavailableDetails = {
            code: networkFailure
              ? 'NETWORK'
              : timeoutFailure
                ? 'TIMEOUT'
                : sanitizedStatus
                  ? `HTTP_${sanitizedStatus}`
                  : 'UNKNOWN',
            status: sanitizedStatus,
            latencyMs,
            endpoint: endpointPath,
            retryInSeconds,
          };

          setUnavailableDetails(details);
          setIsRealtimeHealthy(false);
          const heartbeatNow = Date.now();
          setHeartbeatTimestamp(heartbeatNow);
          setTelemetryCounters((prev) => ({ ...prev, fallback: prev.fallback + 1 }));

          const lines = buildUnavailableLines(language, isSuperAdmin, details);
          const fallbackText = lines.join('\n');

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: createStructuredFromText(fallbackText, language, { title: '', cta: '' }),
                    status: 'error',
                    contentType: 'text',
                  }
                : message,
            ),
          );

          setError(fallbackText);

          if (isSuperAdmin) {
            console.info('ai_unavailable', {
              code: details.code,
              status: details.status ?? null,
              latency: details.latencyMs,
            });
          } else {
            console.info('ai_unavailable', { occurred: true });
          }
        } else {
          setUnavailableDetails(null);
          setIsRealtimeHealthy(true);
          const fallbackMessage =
            language === 'ka'
              ? 'მოთხოვნა ვერ შესრულდა. სცადეთ თავიდან.'
              : 'Request failed. Please try again.';
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: createStructuredFromText(fallbackMessage, language, { title: '', cta: '' }),
                    status: 'error',
                    contentType: 'text',
                  }
                : message,
            ),
          );
          setError(fallbackMessage);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [activePersonalId, isSuperAdmin, language, messages, setError, userRole],
  );

  const handleToggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setIsListening(false);
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (startError) {
        console.warn('Voice recognition failed to start', startError);
        setIsListening(false);
      }
    }
  }, [isListening]);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    lastRequestRef.current = 0;
  }, []);

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <ChatCloud
            key="ai-chat-cloud"
            position={cloudPosition}
            onOpen={() => setIsOpen(true)}
            onHoverChange={setIsHovered}
            isHovered={isHovered}
            isListening={isListening}
            languageLabel={LANGUAGE_LABEL[language]}
          />
        )}
      </AnimatePresence>

      <FuturisticChatPanel
        isOpen={isOpen}
        messages={messages}
        onClose={() => setIsOpen(false)}
        onSend={sendMessage}
        isLoading={isLoading}
        inputValue={inputValue}
        onInputChange={setInputValue}
        suggestions={suggestions}
        onSuggestionSelect={setInputValue}
        theme={theme}
        onThemeToggle={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        language={language}
        onLanguageChange={handleLanguageChange}
        predictiveHint={predictiveHint}
        predictiveEnabled={predictiveEnabled}
        onTogglePredictive={(value) => setPredictiveEnabled(value)}
        isListening={isListening}
        onToggleListening={handleToggleListening}
        error={error}
        errorTone={errorTone}
        onRetry={
          retryHandler
            ? () => retryHandler()
            : () => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === 'user') {
                  const sanitizedHistory = messages.filter((message) => message.id !== lastMessage.id);
                  lastRequestRef.current = 0;
                  const retryContent = messageContentToPlainText(lastMessage.content, language);
                  void sendMessage(retryContent, sanitizedHistory);
                }
              }
        }
        onClearHistory={handleClearHistory}
        panelRef={panelRef}
        messagesRef={messageContainerRef}
        statusBadges={statusBadges}
        retryLabel={retryLabelOverride ?? GURULO_UNAVAILABLE_COPY[language].retry}
        audience={audienceTag}
      />
    </>
  );
}

export default AIChatInterface;

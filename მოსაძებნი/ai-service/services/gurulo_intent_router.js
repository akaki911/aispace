'use strict';

const { isGreetingMessage, normalizeMessageForGreeting } = require('../utils/greeting_utils');

const DATE_REGEX = /(\d{4}-\d{2}-\d{2})/g;
const GUEST_REGEX = /(\d+)\s*(სტუმ(არ|რ)(ი|ზე|ებზე|ებს|ს)?|ადამიან(ი|ებ(ი|ს)?)|guest(s)?)/i;

const AVAILABILITY_KEYWORDS = [
  'ხელმისაწვდომ',
  'თავისუფალ',
  'დაჯავშნ',
  'availability',
  'available',
  'free cottage',
  'cottages',
  'კოტეჯ',
  'შემოწმ',
  'შემომიმოწმე',
  'შემამოწმე'
];

const TECH_DENYLIST_PATTERNS = [
  /\bcode\b/i,
  /\benv\b/i,
  /\btoken\b/i,
  /api\s*key/i,
  /stack\s*trace/i,
  /ci\/?cd/i,
  /\breplit\b/i,
  /\bgit\b/i,
  /\bwebauthn\b/i,
  /\badmin\b/i,
  /\btelemetry\b/i,
  /\blog\b/i,
  /\bdb\b/i,
  /firestore/i,
  /\bsecret\b/i,
  /\.env/i,
  /\/api\//i,
  /openai/i,
  /groq/i,
  /anthropic/i,
];

const PRICING_KEYWORDS = ['ფას', 'ღირებულ', 'price', 'cost', 'nightly', 'rate', 'გადახდ', 'ბიუჯეტ'];
const WEATHER_KEYWORDS = ['ამინდ', 'თოვლ', 'ტემპერატურ', 'rain', 'snow', 'weather', 'forecast'];
const TRIP_PLAN_KEYWORDS = ['გეგმა', 'გადათ', 'ინტინერ', 'plan', 'itinerary', 'schedule', 'route', 'მარშრუტ'];
const POLICIES_KEYWORDS = ['წესი', 'პოლიტიკა', 'გაუქმ', 'cancel', 'deposit', 'prepay', 'rules'];
const CONTACT_KEYWORDS = ['კონტაქტ', 'დაგვიკავშირდ', 'support', 'call', 'phone', 'help', 'contact'];
const TRANSPORT_KEYWORDS = ['გზა', 'ტრანსპორტ', 'how to get', 'drive', 'road', 'bus', 'route', 'marshrut', 'transport'];
const ATTRACTIONS_KEYWORDS = ['სანახ', 'აქტივობ', 'what to do', 'attraction', 'activity', 'excursion', 'hike', 'sight'];
const COTTAGE_DETAIL_KEYWORDS = ['დეტალ', 'ინფო', 'amenity', 'bed', 'bath', 'kitchen', 'wifi', 'capacity', 'size'];
const GENERAL_CONSUMER_KEYWORDS = ['ბახმარ', 'cottag', 'შესვენ', 'holiday', 'stay', 'guest'];

const GEORGIAN_MONTH_PATTERNS = [
  { regex: /იანვ(?:არი)?(?:ში|ს)?/i, month: 0 },
  { regex: /თებ(?:ერვალი)?(?:ში|ს)?/i, month: 1 },
  { regex: /მარტ(?:ი)?(?:ში|ს)?/i, month: 2 },
  { regex: /აპრ(?:ილი)?(?:ში|ს)?/i, month: 3 },
  { regex: /მაის(?:ი)?(?:ში|ს)?/i, month: 4 },
  { regex: /ივნ(?:ისი)?(?:ში|ს)?/i, month: 5 },
  { regex: /ივლ(?:ისი)?(?:ში|ს)?/i, month: 6 },
  { regex: /აგვისტ(?:ო)?(?:ში|ს)?/i, month: 7 },
  { regex: /სექტემბ(?:ერი)?(?:ში|ს)?/i, month: 8 },
  { regex: /ოქტომბ(?:ერი)?(?:ში|ს)?/i, month: 9 },
  { regex: /ნოემბ(?:ერი)?(?:ში|ს)?/i, month: 10 },
  { regex: /დეკემბ(?:ერი)?(?:ში|ს)?/i, month: 11 }
];
const GEORGIAN_RANGE_REGEX = /(\d{1,2})(?:\s*(?:[-–~]|დან|იდან)\s*(\d{1,2}))?\s*([ა-ჰ]+)/i;

const DEFAULT_CONFIDENCE = 0.6;

const getLower = (value = '') => String(value || '').toLowerCase();

const matchesDenylist = (normalized = '') => TECH_DENYLIST_PATTERNS.some((pattern) => pattern.test(normalized));

const hasKeyword = (normalized = '', keywords = []) => keywords.some((keyword) => normalized.includes(keyword));

const toISODate = (date) => date.toISOString().slice(0, 10);

const parseGeorgianDateRange = (message = '') => {
  if (typeof message !== 'string' || !message.trim()) {
    return null;
  }

  const cleaned = message.replace(/[,.]/g, ' ');
  const rangeMatch = cleaned.match(GEORGIAN_RANGE_REGEX);
  if (!rangeMatch) {
    return null;
  }

  const [, fromRaw, toRaw, monthSegment] = rangeMatch;
  if (!monthSegment) {
    return null;
  }

  const monthEntry = GEORGIAN_MONTH_PATTERNS.find(({ regex }) => regex.test(monthSegment));
  if (!monthEntry) {
    return null;
  }

  const fromDay = Number.parseInt(fromRaw, 10);
  if (!Number.isFinite(fromDay) || fromDay <= 0) {
    return null;
  }

  const toDayCandidate = Number.parseInt(toRaw, 10);
  const rawToDay = Number.isFinite(toDayCandidate) ? toDayCandidate : fromDay + 1;

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let year = now.getUTCFullYear();

  const buildUTCDate = (day) => new Date(Date.UTC(year, monthEntry.month, day));

  let fromDate = buildUTCDate(fromDay);
  if (fromDate.getTime() < todayUtc) {
    year += 1;
    fromDate = new Date(Date.UTC(year, monthEntry.month, fromDay));
  }

  let toDate = new Date(Date.UTC(year, monthEntry.month, rawToDay));
  if (toDate.getTime() <= fromDate.getTime()) {
    toDate = new Date(Date.UTC(year, monthEntry.month, fromDay + 1));
  }

  return {
    from: toISODate(fromDate),
    to: toISODate(toDate)
  };
};

function extractParams(message = '', metadata = {}) {
  const slots = {
    from: undefined,
    to: undefined,
    guests: undefined
  };

  const metaParams = metadata?.params || metadata;
  if (metaParams) {
    if (metaParams.from && typeof metaParams.from === 'string') {
      slots.from = metaParams.from;
    }
    if (metaParams.to && typeof metaParams.to === 'string') {
      slots.to = metaParams.to;
    }
    if (metaParams.guests) {
      const numeric = Number(metaParams.guests);
      if (Number.isFinite(numeric) && numeric > 0) {
        slots.guests = numeric;
      }
    }
  }

  const dateMatches = Array.from(message.matchAll(DATE_REGEX), (match) => match[1]);
  if (!slots.from && dateMatches[0]) {
    slots.from = dateMatches[0];
  }
  if (!slots.to && dateMatches[1]) {
    slots.to = dateMatches[1];
  }

  const guestMatch = message.match(GUEST_REGEX);
  if (!slots.guests && guestMatch) {
    const numeric = Number(guestMatch[1]);
    if (Number.isFinite(numeric) && numeric > 0) {
      slots.guests = numeric;
    }
  }

  if ((!slots.from || !slots.to) && typeof message === 'string') {
    const parsedRange = parseGeorgianDateRange(message);
    if (parsedRange) {
      if (!slots.from) {
        slots.from = parsedRange.from;
      }
      if (!slots.to) {
        slots.to = parsedRange.to;
      }
    }
  }

  return slots;
}

function detectIntent(message, options = {}) {
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  const normalizedLower = getLower(safeMessage);
  const normalizedGreeting = normalizeMessageForGreeting(safeMessage);

  if (!safeMessage) {
    return {
      name: 'off_topic_consumer_block',
      confidence: 0.4,
      params: {},
      missingParams: [],
    };
  }

  if (matchesDenylist(normalizedLower)) {
    return {
      name: 'off_topic_consumer_block',
      confidence: 0.95,
      params: {},
      missingParams: [],
      reason: 'denylist',
    };
  }

  if (isGreetingMessage(safeMessage, normalizedGreeting)) {
    return {
      name: 'greeting',
      confidence: 0.95,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, AVAILABILITY_KEYWORDS)) {
    const params = extractParams(normalizedLower, options.metadata?.params || options.metadata);
    const missingParams = ['from', 'to', 'guests'].filter((key) => !params[key]);

    return {
      name: 'check_availability',
      confidence: 0.88,
      params,
      missingParams,
    };
  }

  if (hasKeyword(normalizedLower, PRICING_KEYWORDS)) {
    return {
      name: 'pricing_info',
      confidence: 0.82,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, WEATHER_KEYWORDS)) {
    return {
      name: 'weather_info',
      confidence: 0.82,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, TRIP_PLAN_KEYWORDS)) {
    return {
      name: 'trip_plan',
      confidence: 0.8,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, POLICIES_KEYWORDS)) {
    return {
      name: 'policies_faq',
      confidence: 0.78,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, CONTACT_KEYWORDS)) {
    return {
      name: 'contact_support',
      confidence: 0.76,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, TRANSPORT_KEYWORDS)) {
    return {
      name: 'transport',
      confidence: 0.8,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, ATTRACTIONS_KEYWORDS)) {
    return {
      name: 'local_attractions',
      confidence: 0.78,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, COTTAGE_DETAIL_KEYWORDS)) {
    return {
      name: 'cottage_details',
      confidence: 0.76,
      params: {},
      missingParams: [],
    };
  }

  if (hasKeyword(normalizedLower, GENERAL_CONSUMER_KEYWORDS)) {
    return {
      name: 'trip_plan',
      confidence: DEFAULT_CONFIDENCE,
      params: {},
      missingParams: [],
    };
  }

  return {
    name: 'off_topic_consumer_block',
    confidence: 0.3,
    params: {},
    missingParams: [],
  };
}

module.exports = {
  detectIntent,
  extractParams
};

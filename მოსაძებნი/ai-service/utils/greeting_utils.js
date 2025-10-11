const PUNCTUATION_SYMBOLS_REGEX = new RegExp('[\\p{P}\\p{S}\\p{Extended_Pictographic}]', 'gu');
const GREETING_EMOJI_REGEX = /[\u{1F44B}\u{1F91D}\u{1F64F}\u{1F44F}\u{1F44C}]/u;

const GREETING_PATTERNS = [
  /^(გამარჯ(ობ(ა+|ათ|ას)?)|გამარჯო)$/,
  /^გაუმარჯ(ო|ოს|ობ(ა+|ათ|ას)?)$/,
  /^გაგიმარჯო$/,
  /^სალამ(ი|ა)?$/,
  /^მოგესალმ(ე|ებ(ი|ით))$/,
  /^სალუტ$/,
  /^(ჰეი|ჰაი|ჰელლო)$/,
  /^(hello|hi|hey|yo|sup|ciao|hola|greetings|gamarjoba|gamarjo|salam|salaam)$/,
  /^good (morning|afternoon|evening)$/,
  /^(hey|hi|hello) there$/,
  /^whats up$/,
  /^what up$/,
  /^wassup$/,
  /^morning$/,
  /^evening$/,
  /^afternoon$/
];

const GREETING_WORDS = new Set([
  'გამარჯობა',
  'გამარჯობათ',
  'გამარჯობაც',
  'გამარჯო',
  'გაუმარჯო',
  'გაუმარჯოს',
  'გაუმარჯობა',
  'გაუმარჯობათ',
  'გაგიმარჯო',
  'სალამ',
  'სალამი',
  'სალამა',
  'მოგესალმები',
  'მოგესალმებით',
  'ალო',
  'ჰეი',
  'ჰაი',
  'ჰელლო',
  'hello',
  'hi',
  'hey',
  'yo',
  'sup',
  'ciao',
  'hola',
  'greetings',
  'gamarjoba',
  'gamarjo',
  'salam',
  'salaam',
  'bonjour'
]);

const GREETING_TRAILING_WORDS = new Set([
  'ყველას',
  'მეგობრებო',
  'გუნდო',
  'გუნდს',
  'team',
  'there',
  'friends',
  'folks',
  'people',
  'crew',
  'guys',
  'girls',
  'buddy',
  'buddies',
  'საყვარელო',
  'ხალხო',
  'ბიჭებო',
  'გოგონებო',
  'დეველოპერებო'
]);

function normalizeMessageForGreeting(message) {
  if (!message || typeof message !== 'string') {
    return '';
  }

  return message
    .toLowerCase()
    .normalize('NFKC')
    .replace(PUNCTUATION_SYMBOLS_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGreetingMessage(message, normalizedOverride) {
  if (!message) {
    return false;
  }

  const normalized = typeof normalizedOverride === 'string'
    ? normalizedOverride
    : normalizeMessageForGreeting(message);

  if (!normalized && GREETING_EMOJI_REGEX.test(message)) {
    return true;
  }

  if (!normalized) {
    return false;
  }

  if (GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const words = normalized.split(' ');
  if (words.length === 0) {
    return false;
  }

  const firstWord = words[0].replace(/ა+$/u, 'ა');

  if (GREETING_WORDS.has(firstWord)) {
    if (words.length === 1) {
      return true;
    }

    const remainingWords = words.slice(1);
    if (
      remainingWords.length > 0 &&
      remainingWords.length <= 2 &&
      remainingWords.every((word) => GREETING_TRAILING_WORDS.has(word))
    ) {
      return true;
    }
  }

  return false;
}

module.exports = {
  normalizeMessageForGreeting,
  isGreetingMessage
};

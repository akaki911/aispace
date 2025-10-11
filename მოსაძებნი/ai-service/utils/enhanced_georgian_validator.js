/**
 * Enhanced Georgian Language Validator 
 * ქართული ენის გაფართოებული ვალიდატორი
 * 
 * Uses Groq API (Llama 3) for advanced grammar correction
 * Groq API-ს (Llama 3) იყენებს გაფართოებული გრამატიკული შესწორებისთვის
 */

const { askGroq } = require('../services/groq_service');

/**
 * Advanced Georgian text validation and correction using Groq API
 * გაფართოებული ქართული ტექსტის ვალიდაცია და შესწორება Groq API-ს გამოყენებით
 */
async function validateAndFixWithGroq(text, useGroq = true) {
  if (!text || typeof text !== 'string') return text;

  try {
    // Apply basic local fixes first
    let processedText = applyBasicFixes(text);
    processedText = validateTechnicalTerms(processedText);
    processedText = ensureNaturalGeorgian(processedText);

    // Use Groq for advanced correction if available
    if (useGroq && process.env.GROQ_API_KEY) {
      const messages = [
        { 
          role: 'system', 
          content: 'შენ ხარ ქართული ენის ექსპერტი. გასწორე გრამატიკული და ორთოგრაფიული შეცდომები ამ ტექსტში. მთლიანად ამოიღე ყველა "მე ვარ AI ასისტენტი", "მე ვარ ხელოვნური ინტელექტი" ან მსგავსი თვითაღმოჩენა. ტექსტი უნდა იყოს ბუნებრივი და მეგობრული.' 
        },
        { 
          role: 'user', 
          content: processedText 
        }
      ];

      const correctedText = await askGroq(messages, 'llama3-8b-8192', false);
      console.log('🇬🇪 Georgian validation completed via Groq');
      return correctedText;
    } else {
      console.warn('⚠️ Groq API key missing, skipping advanced validation');
      return processedText; // Return with only basic fixes
    }
  } catch (error) {
    console.error('❌ Georgian validation error:', error.message);
    return text; // Safe fallback
  }
}

// Common Georgian grammar mistakes and their corrections
const GEORGIAN_GRAMMAR_FIXES = {
  // Verb form corrections
  'შეგირია': 'შეგიძლია',
  'შესანიშნავი': 'შესანიშნავი',
  'მე დაგეხმაროთ': 'შემიძლია დაგეხმაროთ',
  'მე დამეხმაროს': 'შემიძლია დამეხმარო',
  'შეასრულებს': 'შეასრულო',
  'გავაანალიზებ': 'დავანალიზებ',
  'მოგეწონოს': 'მოგეწონო',
  'შეიძლება დამეხმარო': 'შეგიძლია დამეხმარო',

  // Case corrections (bruna)
  'კაკის': 'კაკი',
  'კაკო': 'კაკი',
  'ფაილების მდებარეობის': 'ფაილების მდებარეობა',
  'კოდის შესწორება': 'კოდის შეცვლა',
  'ინფორმაციის მიღება': 'ინფორმაცია',
  'ანალიზის ჩატარება': 'ანალიზი',
  'მოქმედების განხორციელება': 'მოქმედება',

  // Natural language improvements
  'შესრულება მოხდა': 'შესრულდა',
  'ანალიზს უკეთებს': 'ანალიზს ასრულებს',
  'ფუნქციას იძახებს': 'ფუნქციას ამუშავებს',
  'დამუშავებას ახდენს': 'ამუშავებს',
  'შეცვლას უკეთებს': 'ცვლის',

  // Common typos
  'კავ': 'კაკი',
  'ავტომატურად': 'ავტომატურად',
  'გრამატიკულად': 'გრამატიკულად',
  'შეცდომების': 'შეცდომების'
};

// Technical terms Georgian translations - Enhanced
const TECH_TERM_FIXES = {
  'get_project_structure()': 'get_project_structure() ფუნქცია',
  'function call': 'ფუნქციის გამოძახება',
  'error handling': 'შეცდომების დამუშავება',
  'performance monitoring': 'პერფორმანსის მონიტორინგი',
  'file content': 'ფაილის კონტენტი',
  'project structure': 'პროექტის სტრუქტურა',
  'code review': 'კოდის მიმოხილვა',
  'user interface': 'მომხმარებლის ინტერფეისი',
  'database connection': 'მონაცემთა ბაზის კავშირი',
  'API endpoint': 'API ბოლო წერტილი',
  'authentication': 'ავტორიზაცია',
  'validation': 'შემოწმება',
  
  // Enhanced technical terms for Replit Assistant
  'strict patch mode': 'ზუსტი ფაილის რედაქტირების რეჟიმი',
  'task decomposition': 'ამოცანის დაყოფა',
  'verification pipeline': 'შემოწმების ოტოლი',
  'rollback system': 'უკუქცევის სისტემა',
  'typescript validation': 'TypeScript-ის შემოწმება',
  'build verification': 'აგების შემოწმება',
  'backup creation': 'რეზერვური ასლის შექმნა',
  'file restoration': 'ფაილის აღდგენა',
  'checkpoint management': 'checkpoint-ების მართვა',
  'recovery system': 'აღდგენის სისტემა',
  'georgian content': 'ქართული კონტენტი',
  'utf-8 encoding': 'UTF-8 კოდირება',
  'language validation': 'ენის შემოწმება',
  'patch verification': 'ფაილის ცვლილების შემოწმება',
  'real-time diagnostics': 'რეალურ დროში დიაგნოსტიკა',
  'enhanced file operations': 'გაუმჯობესებული ფაილის ოპერაციები'
};

// Unnatural translation patterns to fix
const UNNATURAL_PATTERNS = {
  'მე შეგიძლია დამეხმაროს': 'შემიძლია დაგეხმაროთ',
  'თუ გსურს მე დამეხმაროს': 'თუ გსურთ დახმარება',
  'იქნება შესრულება': 'შესრულდება',
  'მოხდება ჩატარება': 'ჩატარდება',
  'იქნება გამოყენება': 'გამოიყენება'
};

// Self-identification patterns to avoid (anti-patterns)
const SELF_IDENTIFICATION_PATTERNS = {
  'მე ვარ AI ასისტენტი, რომელიც მუშაობს ბახმაროს პლატფორმაზე': 'ბახმაროს ასისტენტი ვარ',
  'მე ვარ ასისტენტი ბახმაროს პლატფორმაზე': 'ბახმაროს ასისტენტი ვარ',
  'მე ვარ AI, რომელიც დაგეხმარებათ': 'დაგეხმარებათ',
  'მე ვარ ასისტენტი რომელიც': 'ასისტენტი ვარ, რომელიც',
  'ჩემი საიტი': 'ბახმაროს Booking პლატფორმა',
  'ჩემი სისტემა': 'ბახმაროს სისტემა',
  'ჩემი ფუნქცია': 'სისტემის ფუნქცია',
  'ჩემი მიზანი': 'მიზანი',
  'მე შემიძლია გითხრათ': 'შეგიძლიათ იხილოთ',
  'მე ვცდილობ': 'სისტემა ცდილობს',
  'მე ვმუშაობ': 'სისტემა მუშაობს'
};

// Advanced Georgian validation patterns
const GEORGIAN_PATTERNS = {
  // Check for proper Georgian sentence structure
  verbEndingPattern: /[ა-ჰ]+(ება|ება|ობა|ავს|ია|ენ|ან)$/,
  casePattern: /[ა-ჰ]+(ის|ში|დან|ზე|თან|სთან)$/,
  georgianOnly: /^[ა-ჰ\s\.,!?;:\-\(\)0-9]+$/,
  mixedLanguage: /[a-zA-Z].*[ა-ჰ]|[ა-ჰ].*[a-zA-Z]/
};

/**
 * Main validation and correction function using Groq API
 * ძირითადი ვალიდაციისა და შესწორების ფუნქცია Groq API-ს გამოყენებით
 * @param {string} text - Input text to validate and fix
 * @returns {Promise<string>} - Corrected text
 */
async function validateAndFix(text, useGroq = true) {
  try {
    if (!text || typeof text !== 'string') return text;

    console.log('🔍 Georgian validator: Processing text:', text.substring(0, 100));

    // Minimal local fixes only
    let processedText = normalizeGeorgianText(text);

    // Skip translation and detailed fixes - let Groq handle everything

    // Use Groq for advanced validation if available
    if (useGroq && process.env.GROQ_API_KEY) {

      // Enhanced system prompt for better grammar correction and natural language
      const messages = [
        { 
          role: 'system', 
          content: 'შენ ხარ ქართული ენის ექსპერტი. გასწორე გრამატიკული და ორთოგრაფიული შეცდომები ამ ტექსტში. მთლიანად ამოიღე ყველა "მე ვარ AI ასისტენტი", "მე ვარ ხელოვნური ინტელექტი" ან მსგავსი თვითაღმოჩენა. ტექსტი უნდა იყოს უშუალო, ბუნებრივი და ინფორმაციული. დააბრუნე მხოლოდ გასწორებული ტექსტი, არანაირი დამატებითი კომენტარი.' 
        },
        { role: 'user', content: processedText }
      ];

      const result = await askGroq(messages);

      // Enhanced response handling
      let correctedText = text; // Default fallback

      if (result && typeof result === 'object') {
        if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
          correctedText = result.choices[0].message.content.trim();
        } else if (result.content) {
          correctedText = result.content.trim();
        }
      } else if (typeof result === 'string') {
        correctedText = result.trim();
      }

      // Validate that we got a meaningful correction
      if (!correctedText || correctedText.length < text.length * 0.5) {
        console.warn('⚠️ Groq correction seems incomplete, using fallback');
        throw new Error('Incomplete Groq correction');
      }

      console.log('✅ Georgian validation completed via Groq');
      return correctedText;
    } else {
      console.warn('⚠️ Groq API key missing, skipping advanced validation');
      return processedText; // Return with only basic fixes
    }
  } catch (error) {
    console.error('❌ Georgian validation error:', error.message);
    return text; // Safe fallback
  }
}

/**
 * Apply contextual grammar fixes based on sentence structure
 * კონტექსტუალური გრამატიკული შესწორებების გამოყენება
 */
function applyContextualFixes(text) {
  let fixed = text;

  // Remove self-identification patterns
  fixed = fixed
    .replace(/მე ვარ AI ასისტენტი[^.]*\./g, '')
    .replace(/მე ვარ ხელოვნური ინტელექტი[^.]*\./g, '')
    .replace(/მე ვარ ბახმარო[^.]*\./g, '')
    .replace(/როგორც AI[^,]*,/g, '')
    .replace(/როგორც ხელოვნური ინტელექტი[^,]*,/g, '');

  // Fix common sentence patterns
  fixed = fixed
    .replace(/მე ვ([ა-ჰ]+)/g, 'ვ$1')  // Remove unnecessary "მე"
    .replace(/შეგიძლიათ რომ/g, 'შეგიძლიათ')  // Simplify modal constructions
    .replace(/არის შესაძლებელი/g, 'შეიძლება')  // More natural possibility expression
    .replace(/იქნება განხორციელებული/g, 'განხორციელდება')  // Natural future passive
    .replace(/(\w+) ფუნქციის გამოძახება/g, '$1 ფუნქციის გამოყენება'); // Better tech language

  return fixed;
}

/**
 * Validate technical terms specifically
 * ტექნიკური ტერმინების სპეციალური ვალიდაცია
 */
function validateTechnicalTerms(text) {
  if (!text) return text;

  let validated = text;

  // Common tech term patterns
  const techPatterns = {
    'function': 'ფუნქცია',
    'file': 'ფაილი',
    'directory': 'დირექტორია',
    'structure': 'სტრუქტურა',
    'content': 'კონტენტი',
    'search': 'ძებნა',
    'system': 'სისტემა',
    'error': 'შეცდომა',
    'success': 'წარმატება'
  };

  Object.entries(techPatterns).forEach(([en, ka]) => {
    // Replace standalone English tech terms
    const standaloneRegex = new RegExp(`\\b${en}\\b`, 'gi');
    validated = validated.replace(standaloneRegex, ka);
  });

  return validated;
}

/**
 * Ensure natural Georgian language patterns
 * ქართული ენის ბუნებრივი ნიმუშების უზრუნველყოფა
 */
function ensureNaturalGeorgian(text) {
  if (!text) return text;

  let natural = text;

  // Apply self-identification pattern fixes first
  Object.entries(SELF_IDENTIFICATION_PATTERNS).forEach(([artificial, natural_form]) => {
    const regex = new RegExp(artificial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    natural = natural.replace(regex, natural_form);
  });

  // Apply unnatural pattern fixes
  Object.entries(UNNATURAL_PATTERNS).forEach(([artificial, natural_form]) => {
    const regex = new RegExp(artificial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    natural = natural.replace(regex, natural_form);
  });

  // Critical fixes that Groq might miss
  const criticalFixes = {
    'შესრულება მოხდა': 'შესრულდა',
    'ანალიზის ჩატარება': 'ანალიზი',
    'მე ვარ ბახმაროს რეგიონში': 'ბახმაროს რეგიონში',
    'მე ვარ მეგობრული AI': 'მეგობრული AI ასისტენტი ვარ'
  };

  Object.entries(criticalFixes).forEach(([artificial, natural_form]) => {
    const regex = new RegExp(artificial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    natural = natural.replace(regex, natural_form);
  });

  return natural;
}

/**
 * Comprehensive grammar analysis (for debugging)
 * ყოვლისმომცველი გრამატიკული ანალიზი (დებაგირებისთვის)
 */
function analyzeGeorgianGrammar(text) {
  const analysis = {
    isValid: true,
    errors: [],
    suggestions: [],
    score: 100,
    metrics: {
      georgianRatio: 0,
      englishRatio: 0,
      mixedLanguage: false,
      naturalness: 'high'
    }
  };

  if (!text) return analysis;

  // Language ratio analysis
  const georgianChars = (text.match(/[ა-ჰ]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = georgianChars + englishChars;

  if (totalChars > 0) {
    analysis.metrics.georgianRatio = (georgianChars / totalChars * 100).toFixed(1);
    analysis.metrics.englishRatio = (englishChars / totalChars * 100).toFixed(1);
    analysis.metrics.mixedLanguage = GEORGIAN_PATTERNS.mixedLanguage.test(text);
  }

  // Check for common errors
  Object.entries(GEORGIAN_GRAMMAR_FIXES).forEach(([error, correction]) => {
    if (text.includes(error)) {
      analysis.errors.push({
        type: 'grammar',
        found: error,
        suggestion: correction,
        severity: 'medium'
      });
      analysis.score -= 10;
    }
  });

  // Check for unnatural patterns
  Object.entries(UNNATURAL_PATTERNS).forEach(([unnatural, natural]) => {
    if (text.includes(unnatural)) {
      analysis.suggestions.push({
        type: 'naturalness',
        found: unnatural,
        suggestion: natural,
        severity: 'low'
      });
      analysis.score -= 5;
    }
  });

  analysis.isValid = analysis.errors.length === 0;
  analysis.score = Math.max(0, analysis.score);

  // Determine naturalness
  if (analysis.score >= 90) analysis.metrics.naturalness = 'high';
  else if (analysis.score >= 70) analysis.metrics.naturalness = 'medium';
  else analysis.metrics.naturalness = 'low';

  return analysis;
}

/**
 * Quick validation check (returns boolean)
 * სწრაფი ვალიდაციის შემოწმება
 */
function isValidGeorgian(text) {
  if (!text) return true;

  const analysis = analyzeGeorgianGrammar(text);
  return analysis.isValid && analysis.score >= 70;
}

/**
 * Synchronous version for backward compatibility
 * სინქრონული ვერსია უკუთავსებადობისთვის
 */
function validateAndFixSync(text) {
  if (!text || typeof text !== 'string') return text;

  console.log('🔧 Using sync Georgian validator as fallback');

  // Minimal sync processing - avoid duplication
  let result = normalizeGeorgianText(text);
  // Skip detailed fixes that cause duplication

  return result;
}

// Enhanced translation service integration - DISABLED to prevent duplication
function applyBasicTranslations(text) {
  if (!text || typeof text !== 'string') return text;

  // Translation disabled - Groq handles Georgian better
  // Keeping function for fallback only
  return text;
}

/**
 * Normalize Georgian text - remove excessive spaces, etc.
 * ქართული ტექსტის ნორმალიზება
 */
function normalizeGeorgianText(text) {
  if (!text || typeof text !== 'string') return text;

  // Remove redundant spaces
  let normalized = text.replace(/\s+/g, ' ').trim();
  return normalized;
}

/**
 * Fix common Georgian grammar errors
 * ქართული ენის გავრცელებული შეცდომების გასწორება
 */
function fixCommonErrors(text) {
  if (!text) return text;

  let corrected = text;

  // Apply basic grammar fixes
  Object.entries(GEORGIAN_GRAMMAR_FIXES).forEach(([incorrect, correct]) => {
    const regex = new RegExp(incorrect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    corrected = corrected.replace(regex, correct);
  });

    // Minimal cleanup only - most translation disabled
  const criticalFixes = {
    'შესრულება მოხდა': 'შესრულდა',
    'ანალიზს უკეთებს': 'ანალიზს ასრულებს',
  };

  Object.entries(criticalFixes).forEach(([artificial, natural_form]) => {
    const regex = new RegExp(artificial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    corrected = corrected.replace(regex, natural_form);
  });
  
  return corrected;
}

module.exports = {
  validateAndFix, // Async version with Groq
  validateAndFixSync, // Sync version for compatibility
  validateTechnicalTerms,
  ensureNaturalGeorgian,
  analyzeGeorgianGrammar,
  isValidGeorgian,

  // Export constants for external use
  GEORGIAN_GRAMMAR_FIXES,
  TECH_TERM_FIXES,
  UNNATURAL_PATTERNS,
  SELF_IDENTIFICATION_PATTERNS
};
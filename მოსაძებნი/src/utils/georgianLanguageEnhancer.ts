/**
 * 🇬🇪 Georgian Language Enhancement System
 * PHASE 4: Georgian-Specific Features Implementation
 * 
 * Features:
 * ✅ autoCorrection: ქართული ორთოგრაფიის correction service
 * ✅ transliteration: ლათინური -> ქართული auto-convert system  
 * ✅ mixedLanguageFormatting: ქართული text + English code support
 * ✅ georgianCodeComments: ქართული კომენტარები highlighting
 */

// ===== GEORGIAN LANGUAGE ENHANCEMENT INTERFACES =====

import GeorgianGrammarParser, { type GeorgianParseResult } from './georgianGrammarParser';

export interface GeorgianEnhancementOptions {
  enableAutoCorrection: boolean;
  enableTransliteration: boolean;
  enableMixedLanguageFormatting: boolean;
  enableCodeCommentHighlighting: boolean;
  preserveEnglishTerms: boolean;
  regionalDialect: 'standard' | 'megrelian' | 'svan' | 'laz';
  enableStrictGrammarMode?: boolean;
  grammarExampleLimit?: number;
}

export interface GeorgianTextAnalysis {
  originalText: string;
  correctedText: string;
  correctionsApplied: boolean;
  hasGeorgianText: boolean;
  hasEnglishText: boolean;
  hasCodeBlocks: boolean;
  georgianPercentage: number;
  detectedDialect: string;
  suggestedCorrections: Array<{
    original: string;
    corrected: string;
    confidence: number;
    rule: string;
  }>;
  georgianEnhanced?: boolean;
  grammarBreakdown?: GeorgianParseResult | null;
}

export interface TransliterationResult {
  originalText: string;
  transliteratedText: string;
  confidence: number;
  ambiguousChars: Array<{char: string, alternatives: string[]}>;
}

// ===== GEORGIAN ORTHOGRAPHY CORRECTION SERVICE =====

/**
 * 🔧 Georgian Auto-Correction System
 * ქართული ორთოგრაფიის ავტოматური გასწორება
 */
export class GeorgianAutoCorrection {
  private commonMistakes: Map<string, string> = new Map([
    // Common typos
    ['გამარობა', 'გამარჯობა'],
    ['მადლობა', 'მადლობა'],
    ['კომპიუტერი', 'კომპიუტერი'],
    ['ინტერნეტი', 'ინტერნეტი'],
    ['პროგრამა', 'პროგრამა'],
    ['ფუნქცია', 'ფუნქცია'],
    ['ვარიაბელი', 'ცვლადი'],
    ['ობიექტი', 'ობიექტი'],
    
    // Technical terms corrections
    ['კომპონენტი', 'კომპონენტი'],
    ['ინტერფეისი', 'ინტერფეისი'],
    ['მეთოდი', 'მეთოდი'],
    ['კლასი', 'კლასი'],
    ['მასივი', 'მასივი'],
    ['სტრინგი', 'სტრიქონი'],
    ['ნამბერი', 'რიცხვი'],
    ['ბულეანი', 'ლოგიკური']
  ]);

  private technicalTermsCorrections: Map<string, string> = new Map([
    // Development terms
    ['component-ი', 'კომპონენტი'],
    ['function-ი', 'ფუნქცია'],
    ['variable-ი', 'ცვლადი'],
    ['array-ი', 'მასივი'],
    ['object-ი', 'ობიექტი'],
    ['method-ი', 'მეთოდი'],
    ['interface-ი', 'ინტერფეისი'],
    ['props-ები', 'Props-ები (თვისებები)'],
    ['state-ი', 'State (მდგომარეობა)'],
    ['hook-ი', 'Hook (ჰუკი)']
  ]);

  correctText(text: string, options: Partial<GeorgianEnhancementOptions> = {}): GeorgianTextAnalysis {
    let correctedText = text;
    const suggestedCorrections: Array<{original: string, corrected: string, confidence: number, rule: string}> = [];

    // Apply common mistake corrections
    this.commonMistakes.forEach((correct, mistake) => {
      const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
      if (regex.test(correctedText)) {
        correctedText = correctedText.replace(regex, correct);
        suggestedCorrections.push({
          original: mistake,
          corrected: correct,
          confidence: 0.95,
          rule: 'common_mistake'
        });
      }
    });

    // Apply technical terms corrections
    if (options.preserveEnglishTerms !== false) {
      this.technicalTermsCorrections.forEach((correct, incorrect) => {
        const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
        if (regex.test(correctedText)) {
          correctedText = correctedText.replace(regex, correct);
          suggestedCorrections.push({
            original: incorrect,
            corrected: correct,
            confidence: 0.9,
            rule: 'technical_term'
          });
        }
      });
    }

    // Fix common Georgian case suffix hyphenation mistakes (e.g. "გურულო -მ" → "გურულომ")
    const baseSuffixes = [
      'თვის',
      'ისთვის',
      'სთვის',
      'ებამდე',
      'ებიდან',
      'ებით',
      'ებში',
      'ებზე',
      'ებს',
      'იდან',
      'დან',
      'გან',
      'თან',
      'ვით',
      'ით',
      'თაც',
      'დაც',
      'ად',
      'ამდე',
      'მდე',
      'ზე',
      'ზეც',
      'ში',
      'შიც',
      'მაც',
      'საც',
      'მა',
      'მ',
      'ს'
    ];

    const hyphenPattern = /(["'«»„“”]?)([ა-ჰ]{2,})(["'»”]?)(?:\s*-\s*)([ა-ჰ]{1,4})/g;

    correctedText = correctedText.replace(
      hyphenPattern,
      (match, openingQuote: string, word: string, closingQuote: string, suffix: string) => {
        const normalizedSuffix = suffix.trim();
        if (!normalizedSuffix) {
          return match;
        }

        const isCaseSuffix = baseSuffixes.some(base => normalizedSuffix.startsWith(base));
        if (!isCaseSuffix) {
          return match;
        }

        const corrected = `${openingQuote || ''}${word}${normalizedSuffix}${closingQuote || ''}`;

        if (!suggestedCorrections.some(entry => entry.original === match && entry.corrected === corrected)) {
          suggestedCorrections.push({
            original: match.trim(),
            corrected,
            confidence: 0.92,
            rule: 'case_suffix_hyphen'
          });
        }

        return corrected;
      }
    );

    return this.analyzeText(text, correctedText, suggestedCorrections);
  }

  private analyzeText(
    originalText: string,
    correctedText: string,
    corrections: Array<{original: string, corrected: string, confidence: number, rule: string}>
  ): GeorgianTextAnalysis {
    const georgianChars = correctedText.match(/[\u10A0-\u10FF]/g) || [];
    const englishChars = correctedText.match(/[a-zA-Z]/g) || [];
    const totalChars = georgianChars.length + englishChars.length;

    return {
      originalText,
      correctedText,
      correctionsApplied: originalText !== correctedText,
      hasGeorgianText: georgianChars.length > 0,
      hasEnglishText: englishChars.length > 0,
      hasCodeBlocks: /```[\s\S]*?```/.test(correctedText),
      georgianPercentage: totalChars > 0 ? (georgianChars.length / totalChars) * 100 : 0,
      detectedDialect: 'standard', // Future enhancement
      suggestedCorrections: corrections,
      georgianEnhanced: corrections.length > 0
    };
  }
}

// ===== TRANSLITERATION SERVICE =====

/**
 * 🔤 Latin to Georgian Transliteration
 * ლათინური -> ქართული ავტო-კონვერტაცია
 */
export class GeorgianTransliterator {
  private transliterationMap: Map<string, string> = new Map([
    // Single characters
    ['a', 'ა'], ['b', 'ბ'], ['g', 'გ'], ['d', 'დ'], ['e', 'ე'], 
    ['v', 'ვ'], ['z', 'ზ'], ['t', 'თ'], ['i', 'ი'], ['k', 'კ'],
    ['l', 'ლ'], ['m', 'მ'], ['n', 'ნ'], ['o', 'ო'], ['p', 'პ'],
    ['j', 'ჟ'], ['r', 'რ'], ['s', 'ს'], ['u', 'უ'], ['f', 'ფ'],
    ['q', 'ქ'], ['y', 'ყ'], ['w', 'წ'], ['c', 'ც'], ['x', 'ხ'],
    ['h', 'ჰ'],
    
    // Digraphs and complex combinations
    ['gh', 'ღ'], ['kh', 'ხ'], ['ph', 'ფ'], ['qh', 'ქ'], ['sh', 'შ'],
    ['ch', 'ჩ'], ['ck', 'კ'], ['dz', 'ძ'], ['ts', 'ც'], ['tch', 'ჭ'],
    ['zh', 'ჟ'],
    
    // Common word patterns
    ['gamarjoba', 'გამარჯობა'],
    ['madloba', 'მადლობა'],
    ['kargi', 'კარგი'],
    ['cxadi', 'ცხადი'],
    ['sakartvelo', 'საქართველო'],
    ['tbilisi', 'თბილისი']
  ]);

  private ambiguousPatterns: Map<string, string[]> = new Map([
    ['k', ['კ', 'ქ']],
    ['t', ['თ', 'ტ']],
    ['p', ['პ', 'ფ']],
    ['ch', ['ჩ', 'ჭ']],
    ['dz', ['ძ', 'ც']]
  ]);

  transliterate(text: string, preserveCodeBlocks: boolean = true): TransliterationResult {
    let processedText = text;
    const ambiguousChars: Array<{char: string, alternatives: string[]}> = [];

    // Preserve code blocks if requested
    const codeBlocks: string[] = [];
    if (preserveCodeBlocks) {
      processedText = processedText.replace(/```[\s\S]*?```/g, (match, offset) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
      });
    }

    // Apply transliteration
    let transliteratedText = processedText.toLowerCase();
    
    // Sort by length (longest first) to handle digraphs correctly
    const sortedEntries = Array.from(this.transliterationMap.entries())
      .sort(([a], [b]) => b.length - a.length);

    sortedEntries.forEach(([latin, georgian]) => {
      const regex = new RegExp(`\\b${latin}\\b`, 'gi');
      transliteratedText = transliteratedText.replace(regex, georgian);
    });

    // Check for ambiguous patterns
    this.ambiguousPatterns.forEach((alternatives, pattern) => {
      if (text.includes(pattern)) {
        ambiguousChars.push({
          char: pattern,
          alternatives
        });
      }
    });

    // Restore code blocks
    if (preserveCodeBlocks) {
      codeBlocks.forEach((block, index) => {
        transliteratedText = transliteratedText.replace(`__CODE_BLOCK_${index}__`, block);
      });
    }

    // Calculate confidence based on successful transliterations
    const georgianChars = transliteratedText.match(/[\u10A0-\u10FF]/g) || [];
    const confidence = georgianChars.length > 0 ? Math.min(0.95, georgianChars.length / text.length * 2) : 0;

    return {
      originalText: text,
      transliteratedText,
      confidence,
      ambiguousChars
    };
  }
}

// ===== MIXED LANGUAGE FORMATTING =====

/**
 * 🌐 Mixed Language Formatter
 * ქართული text + English code support
 */
export class MixedLanguageFormatter {
  private technicalTerms: Set<string> = new Set([
    'component', 'function', 'variable', 'array', 'object', 'method',
    'interface', 'props', 'state', 'hook', 'API', 'database', 'server',
    'client', 'frontend', 'backend', 'React', 'JavaScript', 'TypeScript',
    'HTML', 'CSS', 'JSON', 'HTTP', 'HTTPS', 'URL', 'DOM', 'npm', 'git'
  ]);

  formatMixedContent(content: unknown): string {
    let safeContent: string;

    if (content == null) {
      safeContent = '';
    } else if (typeof content === 'string') {
      safeContent = content;
    } else {
      try {
        safeContent = JSON.stringify(content, null, 2);
      } catch (error) {
        safeContent = String(content);
      }
    }

    let formatted = safeContent;

    // Preserve technical terms in English within Georgian text
    this.technicalTerms.forEach(term => {
      const georgianContext = new RegExp(`([\\u10A0-\\u10FF\\s]+)\\b${term}\\b([\\u10A0-\\u10FF\\s]+)`, 'gi');
      formatted = formatted.replace(georgianContext, (match, before, after) => {
        return `${before}**${term}**${after}`;
      });
    });

    // Format code blocks with Georgian comments
    formatted = formatted.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
      const formattedCode = this.highlightGeorgianComments(code);
      return `\`\`\`${language || ''}\n${formattedCode}\`\`\``;
    });

    // Format inline code with context awareness
    formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
      // Don't translate if it's clearly code
      if (this.isCodeContent(code)) {
        return match;
      }
      return match;
    });

    return formatted;
  }

  private highlightGeorgianComments(code: string): string {
    // Highlight Georgian text in comments
    return code.replace(/(\/\/\s*|\/\*[\s\S]*?\*\/|#\s*|<!--[\s\S]*?-->)([\u10A0-\u10FF\s\p{P}]*)/gu, 
      (match, commentStart, georgianText) => {
        if (georgianText.trim()) {
          return `${commentStart}🇬🇪 ${georgianText}`;
        }
        return match;
      });
  }

  private isCodeContent(text: string): boolean {
    // Check if text contains typical code patterns
    const codePatterns = [
      /\w+\(\)/,           // function calls
      /\w+\.\w+/,          // object.property
      /[\[\]{}]/,          // brackets
      /[=<>!&|]+/,         // operators
      /\w+:\s*\w+/,        // key: value
      /import|export|const|let|var|function|class/
    ];

    return codePatterns.some(pattern => pattern.test(text));
  }
}

// ===== GEORGIAN CODE COMMENTS HIGHLIGHTER =====

/**
 * 💬 Georgian Code Comments Enhancement
 * ქართული კომენტარების highlighting
 */
export class GeorgianCodeCommentsHighlighter {
  private commentPatterns = [
    /\/\/\s*([\u10A0-\u10FF\s\p{P}]+)/gu,     // Single line comments
    /\/\*[\s\S]*?([\u10A0-\u10FF\s\p{P}]+)[\s\S]*?\*\//gu, // Multi-line comments
    /#\s*([\u10A0-\u10FF\s\p{P}]+)/gu,        // Python/shell comments
    /<!--[\s\S]*?([\u10A0-\u10FF\s\p{P}]+)[\s\S]*?-->/gu   // HTML comments
  ];

  highlightGeorgianComments(code: string): string {
    let highlighted = code;

    this.commentPatterns.forEach(pattern => {
      highlighted = highlighted.replace(pattern, (match) => {
        // Add Georgian flag emoji to comments containing Georgian text
        if (/[\u10A0-\u10FF]/.test(match)) {
          return match.replace(/^(\s*\/\/|\s*\/\*|\s*#|\s*<!--)/, '$1 🇬🇪');
        }
        return match;
      });
    });

    return highlighted;
  }

  extractGeorgianComments(code: string): Array<{
    line: number;
    comment: string;
    translation?: string;
  }> {
    const comments: Array<{line: number, comment: string, translation?: string}> = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      this.commentPatterns.forEach(pattern => {
        const match = pattern.exec(line);
        if (match && /[\u10A0-\u10FF]/.test(match[0])) {
          comments.push({
            line: index + 1,
            comment: match[0].trim(),
            // Future: add automatic translation
          });
        }
      });
    });

    return comments;
  }
}

// ===== MAIN GEORGIAN LANGUAGE ENHANCER =====

/**
 * 🇬🇪 Main Georgian Language Enhancement Service
 * ყველა Georgian feature-ის integration
 */
export class GeorgianLanguageEnhancer {
  private autoCorrection = new GeorgianAutoCorrection();
  private transliterator = new GeorgianTransliterator();
  private mixedFormatter = new MixedLanguageFormatter();
  private commentsHighlighter = new GeorgianCodeCommentsHighlighter();
  private grammarParser = new GeorgianGrammarParser();

  constructor(private options: GeorgianEnhancementOptions = {
    enableAutoCorrection: true,
    enableTransliteration: true,
    enableMixedLanguageFormatting: true,
    enableCodeCommentHighlighting: true,
    preserveEnglishTerms: true,
    regionalDialect: 'standard',
    enableStrictGrammarMode: false,
    grammarExampleLimit: 8
  }) {}

  enhanceContent(content: string): {
    enhanced: string;
    analysis: GeorgianTextAnalysis;
    corrections: TransliterationResult | null;
    grammar: GeorgianParseResult | null;
  } {
    let enhanced = content;
    let analysis: GeorgianTextAnalysis;
    let corrections: TransliterationResult | null = null;
    let grammar: GeorgianParseResult | null = null;

    // Step 1: Auto-correction
    if (this.options.enableAutoCorrection) {
      analysis = this.autoCorrection.correctText(enhanced, this.options);
      if (analysis.correctionsApplied && analysis.correctedText) {
        enhanced = analysis.correctedText;
      }
    } else {
      analysis = this.autoCorrection.correctText(enhanced, { ...this.options, preserveEnglishTerms: true });
    }

    // Step 2: Transliteration (if needed)
    if (this.options.enableTransliteration && analysis.georgianPercentage < 10 && /[a-zA-Z]/.test(enhanced)) {
      corrections = this.transliterator.transliterate(enhanced);
      if (corrections.confidence > 0.7) {
        enhanced = corrections.transliteratedText;
      }
    }

    // Step 3: Mixed language formatting
    if (this.options.enableMixedLanguageFormatting) {
      enhanced = this.mixedFormatter.formatMixedContent(enhanced);
    }

    // Step 4: Georgian comments highlighting
    if (this.options.enableCodeCommentHighlighting && analysis.hasCodeBlocks) {
      enhanced = this.commentsHighlighter.highlightGeorgianComments(enhanced);
    }

    // Step 5: Grammar-aware parsing
    grammar = this.grammarParser.parseSentence(enhanced, {
      strict: this.options.enableStrictGrammarMode,
      preserveEnglishTerms: this.options.preserveEnglishTerms
    });

    if (this.options.enableStrictGrammarMode && grammar.correctedText !== enhanced) {
      enhanced = grammar.correctedText;
    }

    const grammarClean = grammar.errors.length === 0;
    analysis = {
      ...analysis,
      grammarBreakdown: grammar,
      georgianEnhanced: grammarClean ? (analysis.georgianEnhanced ?? true) : false
    };

    return {
      enhanced,
      analysis,
      corrections,
      grammar
    };
  }

  updateOptions(newOptions: Partial<GeorgianEnhancementOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  getCapabilities(): string[] {
    return [
      '🔧 ქართული ორთოგრაფიის გასწორება',
      '🔤 ლათინური → ქართული ტრანსლიტერაცია',
      '🌐 ქართული + English კოდის მხარდაჭერა',
      '💬 ქართული კომენტარების highlighting',
      '📚 ტექნიკური ტერმინების ქართული თარგმანი',
      '🎯 შერეული ენების ფორმატირება',
      '📐 გრამატიკული სტრუქტურის ანალიზი'
    ];
  }

  parseGeorgianSentence(input: string): {
    correctedText: string;
    errors: GeorgianParseResult['errors'];
    suggestions: GeorgianParseResult['suggestions'];
    breakdown: GeorgianParseResult;
  } {
    const breakdown = this.grammarParser.parseSentence(input, {
      strict: this.options.enableStrictGrammarMode,
      preserveEnglishTerms: this.options.preserveEnglishTerms
    });

    return {
      correctedText: breakdown.correctedText,
      errors: breakdown.errors,
      suggestions: breakdown.suggestions,
      breakdown
    };
  }
}

// ===== EXPORT =====
export default GeorgianLanguageEnhancer;
/**
 * 🇬🇪 Georgian Grammar Parser and Morphological Analyzer
 *
 * This module augments Gurulo's Georgian support with:
 * - Morphological analysis (cases, numbers, verb conjugations)
 * - Syntax validation with lightweight parse tree generation
 * - Rule-based error detection combined with heuristic ML-style scoring
 * - Reference dataset for in-context grammar calibration
 */

export type GeorgianCase =
  | 'nominative'
  | 'ergative'
  | 'dative'
  | 'genitive'
  | 'instrumental'
  | 'adverbial'
  | 'vocative'
  | 'accusative';

export type GeorgianPartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'particle'
  | 'postposition'
  | 'unknown';

export interface GeorgianMorphologicalToken {
  original: string;
  normalized: string;
  lemma: string;
  partOfSpeech: GeorgianPartOfSpeech;
  case?: GeorgianCase;
  number?: 'singular' | 'plural';
  person?: 1 | 2 | 3;
  tense?: 'present' | 'past' | 'future' | 'perfect';
  mood?: 'indicative' | 'imperative' | 'conditional';
  rootConfidence: number;
  mlScore: number;
  notes?: string[];
}

export interface GeorgianGrammarError {
  type: 'case' | 'agreement' | 'syntax' | 'spelling' | 'unknown';
  token: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  rule: string;
  suggestion?: string;
  confidence: number;
}

export interface GeorgianGrammarSuggestion {
  message: string;
  replacement?: string;
  rule: string;
  confidence: number;
}

export interface GeorgianSyntaxNode {
  label: string;
  tokens: string[];
  children?: GeorgianSyntaxNode[];
}

export interface GeorgianParseResult {
  tokens: GeorgianMorphologicalToken[];
  syntaxTree: GeorgianSyntaxNode[];
  errors: GeorgianGrammarError[];
  suggestions: GeorgianGrammarSuggestion[];
  correctedText: string;
  datasetExamples: typeof GEORGIAN_GRAMMAR_DATASET;
}

interface GrammarParserOptions {
  strict?: boolean;
  preserveEnglishTerms?: boolean;
}

interface GrammarDatasetEntry {
  input: string;
  corrected: string;
  explanation: string;
  focus: 'case' | 'agreement' | 'syntax' | 'spelling';
}

const GEORGIAN_CASE_RULES: Array<{
  case: GeorgianCase;
  suffixes: string[];
  description: string;
}> = [
  {
    case: 'nominative',
    suffixes: ['', 'ები', 'ები'],
    description: 'საწყისი ბრუნვა – მარჯვენა სუფიქსი არ აქვს ან აქვს -ები მრავლობითისთვის.'
  },
  {
    case: 'ergative',
    suffixes: ['მა', 'ებმა', 'ებმა'],
    description: 'მოქმედის ბრუნვა – ხშირდ აკავშირებს მოვლენის მოქმედს (-მა).' 
  },
  {
    case: 'dative',
    suffixes: ['ს', 'ებს', 'სთვის', 'ებსთვის'],
    description: 'მიცემითი ბრუნვა – -ს/-სთვის, მიზნის ან მიმღების აღსანიშნავად.'
  },
  {
    case: 'genitive',
    suffixes: ['ის', 'ების', 'თა'],
    description: 'ნათესაობითი ბრუნვა – კუთვნილების ან წარმომავლობის აღმნიშვნელი.'
  },
  {
    case: 'instrumental',
    suffixes: ['ით', 'ებით'],
    description: 'მოქმედებითი ბრუნვა – მოქმედების იარაღი ან საშუალება.'
  },
  {
    case: 'adverbial',
    suffixes: ['ად'],
    description: 'ვითარებითი ბრუნვა – მდგომარეობის ან თვისების აღმნიშვნელი.'
  },
  {
    case: 'vocative',
    suffixes: ['ო'],
    description: 'მოცობითი ბრუნვა – მიმართვისას გამოყენებული ფორმა.'
  },
  {
    case: 'accusative',
    suffixes: ['ს', 'ს', 'ებს'],
    description: 'საგნობითი ბრუნვა – გადადის ობიექტზე (-ს/-ებს).' 
  }
];

const COMMON_PRONOUNS: Record<string, { person: 1 | 2 | 3; number: 'singular' | 'plural' }> = {
  'მე': { person: 1, number: 'singular' },
  'ჩვენ': { person: 1, number: 'plural' },
  'შენ': { person: 2, number: 'singular' },
  'თქვენ': { person: 2, number: 'plural' },
  'ის': { person: 3, number: 'singular' },
  'ისინი': { person: 3, number: 'plural' }
};

const VERB_PATTERNS: Array<{
  lemma: string;
  forms: string[];
  tense: GeorgianMorphologicalToken['tense'];
  personGuesses: Array<{ startsWith: string; person: 1 | 2 | 3 }>;
}> = [
  {
    lemma: 'ხედვა',
    forms: ['ვხედავ', 'ხედავ', 'ხედავს', 'ვნახე', 'ნახა', 'ვხედავთ', 'ხედავენ'],
    tense: 'present',
    personGuesses: [
      { startsWith: 'ვ', person: 1 },
      { startsWith: 'გ', person: 2 },
      { startsWith: '', person: 3 }
    ]
  },
  {
    lemma: 'წერა',
    forms: ['ვწერ', 'წერ', 'წერს', 'ვწერდი', 'წერდა', 'დავწერ', 'დაწერა'],
    tense: 'present',
    personGuesses: [
      { startsWith: 'ვ', person: 1 },
      { startsWith: 'დ', person: 1 },
      { startsWith: 'წერ', person: 2 }
    ]
  },
  {
    lemma: 'ვლა',
    forms: ['მოვედი', 'მივდივარ', 'მივედი', 'მივიდა', 'მივდივართ'],
    tense: 'past',
    personGuesses: [
      { startsWith: 'მო', person: 1 },
      { startsWith: 'მი', person: 1 },
      { startsWith: 'ა', person: 3 }
    ]
  }
];

const ADJECTIVE_AGREEMENT_RULES: Array<{
  singular: string[];
  plural: string[];
  description: string;
}> = [
  {
    singular: ['ი', 'ე'],
    plural: ['ები', 'ური'],
    description: 'შესაბამისი ზედსართავი – მრავლობითში ხშირად -ები/-ური ემატება.'
  },
  {
    singular: ['ული'],
    plural: ['ულები'],
    description: 'ზედსართავი, რომელიც არსებითს მიჰყვება (მაგ. კულტურული → კულტურულები).'
  }
];

export const GEORGIAN_GRAMMAR_DATASET: GrammarDatasetEntry[] = [
  {
    input: 'მე ვხედავ ხე-ს',
    corrected: 'მე ვხედავ ხეს',
    explanation: 'საგნობითი ბრუნვის სუფიქსი -ს ჰიფენის გარეშე იწერება.',
    focus: 'case'
  },
  {
    input: 'ის წავიდა სკოლაში',
    corrected: 'ის წავიდა სკოლაში',
    explanation: 'სწორი სტრუქტურა – მოქმედი + ზმნა + დანიშნულება.',
    focus: 'syntax'
  },
  {
    input: 'ჩვენ ვნახე ფილმი',
    corrected: 'ჩვენ ვნახეთ ფილმი',
    explanation: 'ზმნის პირი უნდა დაემთხვეს მრავლობით სუბიექტს.',
    focus: 'agreement'
  },
  {
    input: 'შენ დაწერე კოდი',
    corrected: 'შენ დაწერე კოდი',
    explanation: 'მეორე პირის ერთ. ფორმა სწორადაა გამოყენებული.',
    focus: 'syntax'
  },
  {
    input: 'ისინი კითხულობს წიგნს',
    corrected: 'ისინი კითხულობენ წიგნს',
    explanation: 'მრავლობითი სუბიექტი მოითხოვს ზმნის მრავლობით ფორმას.',
    focus: 'agreement'
  },
  {
    input: 'მე მივდივარ ბათუმში',
    corrected: 'მე მივდივარ ბათუმში',
    explanation: 'დაცული სიტყვათწყობა: სუბიექტი + ზმნა + დანიშნულება.',
    focus: 'syntax'
  },
  {
    input: 'დედამ გააკეთეს ვახშამი',
    corrected: 'დედამ გააკეთა ვახშამი',
    explanation: 'მოქმედის ბრუნვა მოითხოვს მესამე პირის ერთ. ზმნას.',
    focus: 'agreement'
  },
  {
    input: 'კარგი ბავშვები',
    corrected: 'კარგი ბავშვები',
    explanation: 'ზედსართავი ეთანხმება არსებითს მრავლობითში.',
    focus: 'agreement'
  },
  {
    input: 'სტუდენტმა დაწერა წერილი კალმით',
    corrected: 'სტუდენტმა დაწერა წერილი კალმით',
    explanation: 'ინსტრუმენტალური ბრუნვა (-ით) სწორადაა გამოყენებული.',
    focus: 'case'
  },
  {
    input: 'სახლთან მივედი სწრაფად',
    corrected: 'სახლთან მივედი სწრაფად',
    explanation: 'ვითარებითი გარემოება ზმნასთან ჰარმონიაშია.',
    focus: 'syntax'
  },
  {
    input: 'გიორგო წავიდა სამსახურამდე',
    corrected: 'გიორგო წავიდა სამსახურში',
    explanation: 'დანიშნულების გამოხატვა მოითხოვს ლოკატივს -ში.',
    focus: 'case'
  },
  {
    input: 'მასწავლებელს უპასუხეს მოსწავლეები',
    corrected: 'მასწავლებელს უპასუხეს მოსწავლეებმა',
    explanation: 'მოქმედის ბრუნვა აუცილებელია მოქმედის აღსანიშნავად (-მა).',
    focus: 'case'
  },
  {
    input: 'ისინი ბედნიერი ბიჭებია',
    corrected: 'ისინი ბედნიერი ბიჭები არიან',
    explanation: 'მრავლობით სუბიექტს სჭირდება ზმნა "არიან".',
    focus: 'agreement'
  },
  {
    input: 'შენ ხარ კარგო მეგობარი',
    corrected: 'შენ ხარ კარგი მეგობარი',
    explanation: 'მიმართვის ფორმა "კარგო" საჭირო არაა უცვლელ ზედსართავთან.',
    focus: 'case'
  },
  {
    input: 'ეს არის ბახმაროს კოტეჯის კარები',
    corrected: 'ეს არის ბახმაროს კოტეჯის კარი',
    explanation: 'ერთეულში – კარის ნაცვლად კარი.',
    focus: 'spelling'
  },
  {
    input: 'ჩვენ გავაკეთებთ პროექტი ერთად',
    corrected: 'ჩვენ გავაკეთებთ პროექტს ერთად',
    explanation: 'საგნობით ობიექტი მოითხოვს -ს სუფიქსს.',
    focus: 'case'
  },
  {
    input: 'დალევ ყავას?',
    corrected: 'დალევ ყავას?',
    explanation: 'მეორე პირის მომავალი ფორმა სწორია.',
    focus: 'syntax'
  },
  {
    input: 'თინამ იყიდა წიგნები',
    corrected: 'თინამ იყიდა წიგნები',
    explanation: 'გრამატიკულად გამართული წინადადება.',
    focus: 'syntax'
  },
  {
    input: 'ბავშვი წავიდა სახლზე',
    corrected: 'ბავშვი წავიდა სახლში',
    explanation: 'დანიშნულების აღსანიშნავად გამოიყენეთ -ში.',
    focus: 'case'
  },
  {
    input: 'მათ მოვიდნენ დროულად',
    corrected: 'ისინი მოვიდნენ დროულად',
    explanation: 'მათ არის დათ. ბრუნვა; სუბიექტისთვის გამოიყენეთ ისინი.',
    focus: 'case'
  }
];

class GeorgianMorphModel {
  constructor(private dataset: GrammarDatasetEntry[]) {}

  scoreSequence(words: string[]): number {
    if (!words.length) return 0;
    const matches = words.filter(word =>
      this.dataset.some(example => example.corrected.includes(word))
    ).length;
    return Math.min(1, matches / words.length + 0.2);
  }

  suggestCorrection(words: string[]): string | null {
    const joined = words.join(' ');
    const candidate = this.dataset.find(example => example.input === joined);
    return candidate?.corrected ?? null;
  }
}

export class GeorgianGrammarParser {
  private mlModel = new GeorgianMorphModel(GEORGIAN_GRAMMAR_DATASET);

  parseSentence(sentence: string, options: GrammarParserOptions = {}): GeorgianParseResult {
    const tokens = this.tokenize(sentence, options.preserveEnglishTerms !== false);
    const morphTokens = tokens.map(token => this.analyzeToken(token));
    const syntaxTree = this.buildSyntaxTree(morphTokens);

    const errors: GeorgianGrammarError[] = [];

    this.detectCaseErrors(morphTokens, errors);
    this.detectAgreementIssues(morphTokens, errors);
    this.detectSyntaxIssues(morphTokens, syntaxTree, errors);

    const suggestions = this.buildSuggestions(tokens, morphTokens, errors, options);
    const correctedTokens = this.applySuggestions(tokens, suggestions);

    const mlCorrection = this.mlModel.suggestCorrection(tokens);
    if (mlCorrection && options.strict) {
      return {
        tokens: morphTokens,
        syntaxTree,
        errors,
        suggestions,
        correctedText: mlCorrection,
        datasetExamples: GEORGIAN_GRAMMAR_DATASET
      };
    }

    const correctedText = correctedTokens.join(' ').replace(/\s+([,.!?;])/g, '$1');

    return {
      tokens: morphTokens,
      syntaxTree,
      errors,
      suggestions,
      correctedText,
      datasetExamples: GEORGIAN_GRAMMAR_DATASET
    };
  }

  private tokenize(sentence: string, preserveEnglishTerms: boolean): string[] {
    if (!sentence) return [];
    const tokens = sentence
      .replace(/([,.!?;])/g, ' $1 ')
      .split(/\s+/)
      .filter(Boolean);

    if (preserveEnglishTerms) {
      return tokens.map(token => {
        if (/^[A-Za-z0-9_]+$/.test(token)) {
          return token;
        }
        return token;
      });
    }

    return tokens;
  }

  private analyzeToken(token: string): GeorgianMorphologicalToken {
    const normalized = token.replace(/[^\u10A0-\u10FFa-zA-Z0-9]/g, '');
    const base: GeorgianMorphologicalToken = {
      original: token,
      normalized,
      lemma: normalized,
      partOfSpeech: 'unknown',
      rootConfidence: 0.3,
      mlScore: 0
    };

    if (!normalized) {
      return base;
    }

    if (/^[A-Za-z0-9]+$/.test(normalized)) {
      return {
        ...base,
        partOfSpeech: 'unknown',
        lemma: normalized,
        notes: ['ინგლისური ან ტექნიკური ტერმინი შენარჩუნებულია.']
      };
    }

    if (COMMON_PRONOUNS[normalized]) {
      const pronoun = COMMON_PRONOUNS[normalized];
      return {
        ...base,
        partOfSpeech: 'pronoun',
        lemma: normalized,
        person: pronoun.person,
        number: pronoun.number,
        rootConfidence: 0.95,
        mlScore: 0.9
      };
    }

    const verbPattern = VERB_PATTERNS.find(pattern =>
      pattern.forms.includes(normalized)
    );

    if (verbPattern) {
      const guess = verbPattern.personGuesses.find(entry =>
        entry.startsWith === '' ? true : normalized.startsWith(entry.startsWith)
      );
      return {
        ...base,
        partOfSpeech: 'verb',
        lemma: verbPattern.lemma,
        tense: verbPattern.tense,
        person: guess?.person,
        rootConfidence: 0.85,
        mlScore: 0.88
      };
    }

    const detectedCase = this.detectCase(normalized);

    if (detectedCase) {
      const number = /ები$|ებით$|ებს$/.test(normalized) ? 'plural' : 'singular';
      return {
        ...base,
        partOfSpeech: 'noun',
        lemma: this.stripSuffix(normalized, detectedCase),
        case: detectedCase,
        number,
        rootConfidence: 0.7,
        mlScore: 0.75
      };
    }

    if (this.looksLikeAdjective(normalized)) {
      return {
        ...base,
        partOfSpeech: 'adjective',
        lemma: normalized.replace(/(ი|ე|ული|ური|ული)$/g, ''),
        rootConfidence: 0.65,
        mlScore: 0.7
      };
    }

    return base;
  }

  private detectCase(word: string): GeorgianCase | undefined {
    for (const rule of GEORGIAN_CASE_RULES) {
      if (rule.suffixes.some(suffix => suffix && word.endsWith(suffix))) {
        return rule.case;
      }
    }

    if (/[ა-ჰ]+ს$/.test(word)) {
      return 'accusative';
    }

    return undefined;
  }

  private stripSuffix(word: string, caseType: GeorgianCase): string {
    const rule = GEORGIAN_CASE_RULES.find(entry => entry.case === caseType);
    if (!rule) return word;

    const suffix = rule.suffixes.find(suffix => suffix && word.endsWith(suffix));
    if (!suffix) return word;
    return word.slice(0, word.length - suffix.length);
  }

  private looksLikeAdjective(word: string): boolean {
    return ADJECTIVE_AGREEMENT_RULES.some(rule =>
      rule.singular.some(suffix => word.endsWith(suffix)) ||
      rule.plural.some(suffix => word.endsWith(suffix))
    );
  }

  private buildSyntaxTree(tokens: GeorgianMorphologicalToken[]): GeorgianSyntaxNode[] {
    const subjectTokens = tokens.filter(token =>
      token.partOfSpeech === 'pronoun' || (token.partOfSpeech === 'noun' && token.case !== 'dative')
    );
    const predicateTokens = tokens.filter(token => token.partOfSpeech === 'verb');
    const objectTokens = tokens.filter(token => token.case === 'accusative' || token.case === 'dative');

    const tree: GeorgianSyntaxNode = {
      label: 'S',
      tokens: tokens.map(token => token.original),
      children: []
    };

    if (subjectTokens.length) {
      tree.children?.push({
        label: 'NP-SUBJ',
        tokens: subjectTokens.map(token => token.original)
      });
    }

    if (predicateTokens.length) {
      tree.children?.push({
        label: 'VP',
        tokens: predicateTokens.map(token => token.original)
      });
    }

    if (objectTokens.length) {
      tree.children?.push({
        label: 'NP-OBJ',
        tokens: objectTokens.map(token => token.original)
      });
    }

    return [tree];
  }

  private detectCaseErrors(tokens: GeorgianMorphologicalToken[], errors: GeorgianGrammarError[]): void {
    tokens.forEach(token => {
      if (token.partOfSpeech !== 'noun') return;

      if (token.original.includes('-ს')) {
        errors.push({
          type: 'case',
          token: token.original,
          message: 'საგნობითი სუფიქსი -ს ჰიფენის გარეშე იწერება.',
          severity: 'medium',
          rule: 'case.hyphenation',
          suggestion: token.original.replace('-', ''),
          confidence: 0.95
        });
      }

      if (token.case === 'dative' && !token.original.endsWith('ს') && !token.original.endsWith('ებს')) {
        errors.push({
          type: 'case',
          token: token.original,
          message: 'მიცემითი ბრუნვა ითხოვს სუფიქსს -ს ან -ებს.',
          severity: 'low',
          rule: 'case.dativeSuffix',
          suggestion: `${token.original}ს`,
          confidence: 0.7
        });
      }

      if (token.case === 'accusative' && !token.original.endsWith('ს')) {
        errors.push({
          type: 'case',
          token: token.original,
          message: 'საგნობითი ბრუნვა მოითხოვს -ს დასრულებას.',
          severity: 'medium',
          rule: 'case.accusativeSuffix',
          suggestion: `${token.original}ს`,
          confidence: 0.75
        });
      }
    });
  }

  private detectAgreementIssues(tokens: GeorgianMorphologicalToken[], errors: GeorgianGrammarError[]): void {
    const subjects = tokens.filter(token => token.partOfSpeech === 'pronoun' || (token.partOfSpeech === 'noun' && token.case !== 'dative'));
    const verbs = tokens.filter(token => token.partOfSpeech === 'verb');

    if (!subjects.length || !verbs.length) return;

    const subject = subjects[0];
    const verb = verbs[0];

    if (subject.person && verb.person && subject.person !== verb.person) {
      errors.push({
        type: 'agreement',
        token: verb.original,
        message: 'ზმნის პირი უნდა დაემთხვეს სუბიექტს.',
        severity: 'high',
        rule: 'agreement.person',
        suggestion: this.adjustVerbPerson(verb.original, subject.person),
        confidence: 0.9
      });
    }

    if (subject.number === 'plural' && (!verb.original.endsWith('თ') && !verb.original.endsWith('ნენ') && !verb.original.endsWith('ენ'))) {
      errors.push({
        type: 'agreement',
        token: verb.original,
        message: 'მრავლობითი სუბიექტი მოითხოვს ზმნის მრავლობით ფორმას.',
        severity: 'high',
        rule: 'agreement.number',
        suggestion: verb.original + 'თ',
        confidence: 0.85
      });
    }
  }

  private adjustVerbPerson(verb: string, person: 1 | 2 | 3): string {
    if (person === 1 && !verb.startsWith('ვ')) {
      return `ვ${verb}`;
    }
    if (person === 2 && !verb.startsWith('გ') && !verb.startsWith('დ')) {
      return `გ${verb}`;
    }
    if (person === 3 && verb.startsWith('ვ')) {
      return verb.slice(1);
    }
    return verb;
  }

  private detectSyntaxIssues(tokens: GeorgianMorphologicalToken[], syntaxTree: GeorgianSyntaxNode[], errors: GeorgianGrammarError[]): void {
    const tree = syntaxTree[0];
    if (!tree) return;

    const hasSubject = tree.children?.some(child => child.label === 'NP-SUBJ');
    const hasVerb = tree.children?.some(child => child.label === 'VP');

    if (!hasSubject || !hasVerb) {
      errors.push({
        type: 'syntax',
        token: tree.tokens.join(' '),
        message: 'წინადადება უნდა შეიცავდეს სუბიექტსა და ზმნას.',
        severity: 'medium',
        rule: 'syntax.svStructure',
        confidence: 0.6
      });
    }
  }

  private buildSuggestions(
    rawTokens: string[],
    morphTokens: GeorgianMorphologicalToken[],
    errors: GeorgianGrammarError[],
    options: GrammarParserOptions
  ): GeorgianGrammarSuggestion[] {
    const suggestions: GeorgianGrammarSuggestion[] = [];

    errors.forEach(error => {
      if (!error.suggestion) return;
      suggestions.push({
        message: error.message,
        replacement: error.suggestion,
        rule: error.rule,
        confidence: error.confidence
      });
    });

    const mlScore = this.mlModel.scoreSequence(rawTokens);
    if (mlScore < 0.65 && options.strict) {
      suggestions.push({
        message: 'საწყისი მონაცემების მიხედვით საჭიროა წინადადების სრული გადამოწმება.',
        rule: 'ml.review',
        confidence: 0.5
      });
    }

    if (!suggestions.length && morphTokens.length > 0) {
      suggestions.push({
        message: 'წინადადება გრამატიკულად სწორია.',
        rule: 'validation.ok',
        confidence: 0.8
      });
    }

    return suggestions;
  }

  private applySuggestions(tokens: string[], suggestions: GeorgianGrammarSuggestion[]): string[] {
    const replacements = new Map<string, string>();
    suggestions.forEach(suggestion => {
      if (suggestion.replacement) {
        replacements.set(suggestion.rule, suggestion.replacement);
      }
    });

    return tokens.map(token => {
      if (token.includes('-ს')) {
        return token.replace('-', '');
      }

      if (replacements.has('agreement.number')) {
        const replacement = replacements.get('agreement.number')!;
        if (/ვ\w+/.test(token)) {
          return replacement;
        }
      }

      return token;
    });
  }
}

export default GeorgianGrammarParser;

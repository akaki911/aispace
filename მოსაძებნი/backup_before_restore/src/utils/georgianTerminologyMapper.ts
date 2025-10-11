/**
 * 🇬🇪 Georgian Terminology Mapping System
 * PHASE 4: Advanced Georgian terminology system with context-aware mappings
 * 
 * Features:
 * ✅ Technical terms mapping with explanations
 * ✅ Context-aware translations
 * ✅ Industry-specific terminologies
 * ✅ Adaptive learning system
 */

// ===== TERMINOLOGY MAPPING INTERFACES =====

export interface TerminologyMapping {
  english: string;
  georgian: string;
  transliteration: string;
  definition: string;
  contextExamples: ContextExample[];
  relatedTerms: string[];
  industryCategory: IndustryCategory;
  confidenceScore: number;
  lastUpdated: Date;
}

export interface ContextExample {
  context: string;
  englishExample: string;
  georgianExample: string;
  explanation: string;
}

export type IndustryCategory = 
  | 'web-development' 
  | 'mobile-development'
  | 'data-science'
  | 'devops'
  | 'ui-ux'
  | 'backend'
  | 'frontend'
  | 'database'
  | 'security'
  | 'general';

export interface AdaptiveLearningData {
  termUsageFrequency: Map<string, number>;
  userPreferences: {
    preferredTranslationStyle: 'literal' | 'explanatory' | 'mixed';
    industryFocus: IndustryCategory[];
    complexityLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  contextualPatterns: Array<{
    pattern: string;
    preferredTranslation: string;
    confidence: number;
  }>;
}

// ===== COMPREHENSIVE TERMINOLOGY DATABASE =====

export class GeorgianTerminologyDatabase {
  private terminology: Map<string, TerminologyMapping> = new Map();
  private adaptiveLearning: AdaptiveLearningData = {
    termUsageFrequency: new Map(),
    userPreferences: {
      preferredTranslationStyle: 'explanatory',
      industryFocus: ['web-development', 'frontend'],
      complexityLevel: 'intermediate'
    },
    contextualPatterns: []
  };

  constructor() {
    this.initializeTerminology();
  }

  private initializeTerminology(): void {
    const terms: TerminologyMapping[] = [
      // Frontend Development
      {
        english: 'component',
        georgian: 'კომპონენტი',
        transliteration: 'komponenti',
        definition: 'მისაღები და ხელახლა გამოყენებადი UI ელემენტი',
        contextExamples: [
          {
            context: 'React development',
            englishExample: 'Create a Button component',
            georgianExample: 'შექმენით Button კომპონენტი',
            explanation: 'React-ში UI კომპონენტები დამოუკიდებელი ელემენტებია'
          },
          {
            context: 'Vue.js development',
            englishExample: 'Register the component globally',
            georgianExample: 'დარეგისტრირეთ კომპონენტი გლობალურად',
            explanation: 'Vue.js-ში კომპონენტების გლობალური რეგისტრაცია'
          }
        ],
        relatedTerms: ['element', 'widget', 'module', 'part'],
        industryCategory: 'frontend',
        confidenceScore: 0.98,
        lastUpdated: new Date()
      },

      {
        english: 'state',
        georgian: 'მდგომარეობა',
        transliteration: 'mdgomareoba',
        definition: 'კომპონენტის ცვლადი მონაცემები რომლებიც კონტროლს უწევენ რენდერს',
        contextExamples: [
          {
            context: 'React hooks',
            englishExample: 'const [count, setCount] = useState(0)',
            georgianExample: 'const [რიცხვი, setრიცხვი] = useState(0)',
            explanation: 'React-ის useState hook კომპონენტის მდგომარეობის მართვისთვის'
          },
          {
            context: 'State management',
            englishExample: 'Update the application state',
            georgianExample: 'განაახლეთ აპლიკაციის მდგომარეობა',
            explanation: 'აპლიკაციის მდგომარეობის მენეჯმენტი'
          }
        ],
        relatedTerms: ['data', 'variable', 'property', 'value'],
        industryCategory: 'frontend',
        confidenceScore: 0.95,
        lastUpdated: new Date()
      },

      {
        english: 'hook',
        georgian: 'ჰუკი',
        transliteration: 'huki',
        definition: 'React-ის ფუნქცია რომელიც კომპონენტს სტეიტის და სხვა React ფუნქციების გამოყენების საშუალებას აძლევს',
        contextExamples: [
          {
            context: 'Custom hooks',
            englishExample: 'Create a custom hook for data fetching',
            georgianExample: 'შექმენით custom ჰუკი მონაცემების ჩატვირთვისთვის',
            explanation: 'კასტომ ჰუკები ლოგიკის ხელახლა გამოყენებისთვის'
          }
        ],
        relatedTerms: ['function', 'utility', 'helper'],
        industryCategory: 'frontend',
        confidenceScore: 0.90,
        lastUpdated: new Date()
      },

      // Backend Development
      {
        english: 'endpoint',
        georgian: 'ბოლო წერტილი',
        transliteration: 'bolo tsertili',
        definition: 'API-ს კონკრეტული URL მისამართი რომელზეც შესაძლებელია HTTP მოთხოვნების გაგზავნა',
        contextExamples: [
          {
            context: 'REST API',
            englishExample: 'Create a new API endpoint',
            georgianExample: 'შექმენით ახალი API ბოლო წერტილი',
            explanation: 'REST API-ში endpoint-ები განსაზღვრავენ რა მონაცემებზე წვდომა აქვს კლიენტს'
          }
        ],
        relatedTerms: ['route', 'url', 'path', 'resource'],
        industryCategory: 'backend',
        confidenceScore: 0.92,
        lastUpdated: new Date()
      },

      {
        english: 'middleware',
        georgian: 'შუამავალი ПO',
        transliteration: 'shuamavali PO',
        definition: 'ფუნქცია რომელიც მუშავდება HTTP მოთხოვნასა და პასუხს შორის',
        contextExamples: [
          {
            context: 'Express.js',
            englishExample: 'Add authentication middleware',
            georgianExample: 'დაამატეთ ავთენტიფიკაციის შუამავალი ПO',
            explanation: 'Express.js-ში middleware ავთენტიფიკაციისთვის'
          }
        ],
        relatedTerms: ['function', 'interceptor', 'filter'],
        industryCategory: 'backend',
        confidenceScore: 0.88,
        lastUpdated: new Date()
      },

      // Database
      {
        english: 'query',
        georgian: 'მოთხოვნა',
        transliteration: 'motkhovna',
        definition: 'მონაცემთა ბაზისადმი მიმართული ინსტრუქცია მონაცემების მისაღებად ან შესაცვლელად',
        contextExamples: [
          {
            context: 'SQL',
            englishExample: 'Execute a SELECT query',
            georgianExample: 'შეასრულეთ SELECT მოთხოვნა',
            explanation: 'SQL SELECT მოთხოვნა მონაცემების მისაღებად'
          },
          {
            context: 'GraphQL',
            englishExample: 'Write a GraphQL query',
            georgianExample: 'დაწერეთ GraphQL მოთხოვნა',
            explanation: 'GraphQL მოთხოვნა მონაცემების ზუსტი სპეციფიკაციისთვის'
          }
        ],
        relatedTerms: ['request', 'command', 'statement'],
        industryCategory: 'database',
        confidenceScore: 0.96,
        lastUpdated: new Date()
      },

      // UI/UX
      {
        english: 'responsive',
        georgian: 'ადაპტიური',
        transliteration: 'adaptiuri',
        definition: 'დიზაინი რომელიც თავს იყენებს სხვადასხვა ეკრანის ზომებთან',
        contextExamples: [
          {
            context: 'Web design',
            englishExample: 'Create a responsive layout',
            georgianExample: 'შექმენით ადაპტიური განლაგება',
            explanation: 'CSS-ით responsive დიზაინის შექმნა'
          }
        ],
        relatedTerms: ['adaptive', 'flexible', 'mobile-friendly'],
        industryCategory: 'ui-ux',
        confidenceScore: 0.94,
        lastUpdated: new Date()
      },

      // DevOps
      {
        english: 'deployment',
        georgian: 'გავრცელება',
        transliteration: 'gavrtseleba',
        definition: 'აპლიკაციის production გარემოში განთავსება',
        contextExamples: [
          {
            context: 'CI/CD',
            englishExample: 'Automate the deployment process',
            georgianExample: 'ავტომატიზირებული გავრცელების პროცესი',
            explanation: 'CI/CD pipeline-ით ავტომატური deployment'
          }
        ],
        relatedTerms: ['release', 'publish', 'launch'],
        industryCategory: 'devops',
        confidenceScore: 0.93,
        lastUpdated: new Date()
      },

      // General Programming
      {
        english: 'algorithm',
        georgian: 'ალგორითმი',
        transliteration: 'algoritmi',
        definition: 'ამოცანის გადაჭრის ნაბიჯობრივი ინსტრუქციების თანმიმდევრობა',
        contextExamples: [
          {
            context: 'Problem solving',
            englishExample: 'Implement a sorting algorithm',
            georgianExample: 'იმპლემენტირება სორტირების ალგორითმი',
            explanation: 'მონაცემების დალაგების ალგორითმი'
          }
        ],
        relatedTerms: ['method', 'procedure', 'logic', 'process'],
        industryCategory: 'general',
        confidenceScore: 0.99,
        lastUpdated: new Date()
      }
    ];

    terms.forEach(term => {
      this.terminology.set(term.english.toLowerCase(), term);
    });
  }

  // Core functionality methods
  getTermMapping(englishTerm: string): TerminologyMapping | null {
    const term = this.terminology.get(englishTerm.toLowerCase());
    if (term) {
      // Track usage frequency
      this.adaptiveLearning.termUsageFrequency.set(
        englishTerm.toLowerCase(),
        (this.adaptiveLearning.termUsageFrequency.get(englishTerm.toLowerCase()) || 0) + 1
      );
    }
    return term || null;
  }

  searchTerminology(query: string, category?: IndustryCategory): TerminologyMapping[] {
    const lowerQuery = query.toLowerCase();
    let results = Array.from(this.terminology.values()).filter(term =>
      term.english.toLowerCase().includes(lowerQuery) ||
      term.georgian.includes(query) ||
      term.transliteration.toLowerCase().includes(lowerQuery) ||
      term.definition.includes(query)
    );

    if (category) {
      results = results.filter(term => term.industryCategory === category);
    }

    // Sort by confidence score and usage frequency
    return results.sort((a, b) => {
      const aUsage = this.adaptiveLearning.termUsageFrequency.get(a.english.toLowerCase()) || 0;
      const bUsage = this.adaptiveLearning.termUsageFrequency.get(b.english.toLowerCase()) || 0;
      return (b.confidenceScore + bUsage * 0.1) - (a.confidenceScore + aUsage * 0.1);
    });
  }

  getTermsByCategory(category: IndustryCategory): TerminologyMapping[] {
    return Array.from(this.terminology.values())
      .filter(term => term.industryCategory === category)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  // Context-aware translation
  translateInContext(text: string, context?: string): string {
    let translated = text;
    const detectedTerms: TerminologyMapping[] = [];

    // Find all applicable terms
    this.terminology.forEach(term => {
      const regex = new RegExp(`\\b${term.english}\\b`, 'gi');
      if (regex.test(text)) {
        detectedTerms.push(term);
      }
    });

    // Apply context-aware translations
    detectedTerms.forEach(term => {
      const contextExample = context 
        ? term.contextExamples.find(ex => 
            ex.context.toLowerCase().includes(context.toLowerCase())
          )
        : null;

      const translation = this.getContextualTranslation(term, context);
      const regex = new RegExp(`\\b${term.english}\\b`, 'gi');
      translated = translated.replace(regex, translation);
    });

    return translated;
  }

  private getContextualTranslation(term: TerminologyMapping, context?: string): string {
    const userPrefs = this.adaptiveLearning.userPreferences;
    
    switch (userPrefs.preferredTranslationStyle) {
      case 'literal':
        return term.georgian;
      
      case 'explanatory':
        return `${term.georgian} (${term.english})`;
      
      case 'mixed':
      default:
        // Use context to decide
        if (context && term.contextExamples.some(ex => 
          ex.context.toLowerCase().includes(context.toLowerCase())
        )) {
          return `**${term.georgian}** (${term.english})`;
        }
        return term.georgian;
    }
  }

  // Adaptive learning methods
  updateUserPreferences(preferences: Partial<AdaptiveLearningData['userPreferences']>): void {
    this.adaptiveLearning.userPreferences = {
      ...this.adaptiveLearning.userPreferences,
      ...preferences
    };
  }

  addContextualPattern(pattern: string, preferredTranslation: string, confidence: number = 0.8): void {
    this.adaptiveLearning.contextualPatterns.push({
      pattern,
      preferredTranslation,
      confidence
    });
  }

  getUsageStatistics(): Array<{term: string, frequency: number}> {
    return Array.from(this.adaptiveLearning.termUsageFrequency.entries())
      .map(([term, frequency]) => ({ term, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  // Term management
  addCustomTerm(term: TerminologyMapping): boolean {
    if (this.terminology.has(term.english.toLowerCase())) {
      return false; // Term already exists
    }
    
    this.terminology.set(term.english.toLowerCase(), {
      ...term,
      lastUpdated: new Date()
    });
    return true;
  }

  updateTerm(englishTerm: string, updates: Partial<TerminologyMapping>): boolean {
    const existingTerm = this.terminology.get(englishTerm.toLowerCase());
    if (!existingTerm) {
      return false;
    }

    this.terminology.set(englishTerm.toLowerCase(), {
      ...existingTerm,
      ...updates,
      lastUpdated: new Date()
    });
    return true;
  }

  // Export/Import functionality
  exportTerminology(): string {
    const data = {
      terminology: Array.from(this.terminology.entries()),
      adaptiveLearning: {
        ...this.adaptiveLearning,
        termUsageFrequency: Array.from(this.adaptiveLearning.termUsageFrequency.entries())
      }
    };
    return JSON.stringify(data, null, 2);
  }

  importTerminology(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.terminology) {
        this.terminology = new Map(data.terminology);
      }
      
      if (data.adaptiveLearning) {
        this.adaptiveLearning = {
          ...data.adaptiveLearning,
          termUsageFrequency: new Map(data.adaptiveLearning.termUsageFrequency || [])
        };
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import terminology:', error);
      return false;
    }
  }

  // Utility methods
  getCapabilities(): string[] {
    return [
      `📚 ${this.terminology.size} ტექნიკური ტერმინი`,
      '🎯 კონტექსტის მიხედვით თარგმნა',
      '🧠 ადაპტიური სწავლება',
      '📊 გამოყენების სტატისტიკა',
      '🔧 Custom terminology მხარდაჭერა',
      '📁 Export/Import ფუნქციონალობა',
      `🏭 ${Array.from(new Set(Array.from(this.terminology.values()).map(t => t.industryCategory))).length} ინდუსტრიული კატეგორია`
    ];
  }

  getTerminologyOverview(): {
    totalTerms: number;
    categoriesCoverage: Record<IndustryCategory, number>;
    averageConfidence: number;
    mostUsedTerms: Array<{term: string, frequency: number}>;
  } {
    const terms = Array.from(this.terminology.values());
    const categories = terms.reduce((acc, term) => {
      acc[term.industryCategory] = (acc[term.industryCategory] || 0) + 1;
      return acc;
    }, {} as Record<IndustryCategory, number>);

    const averageConfidence = terms.reduce((sum, term) => sum + term.confidenceScore, 0) / terms.length;
    const mostUsedTerms = this.getUsageStatistics().slice(0, 10);

    return {
      totalTerms: terms.length,
      categoriesCoverage: categories,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      mostUsedTerms
    };
  }
}

// ===== SMART TERMINOLOGY MAPPER =====

export class SmartTerminologyMapper {
  private database: GeorgianTerminologyDatabase;
  private contextAnalyzer: ContextAnalyzer;

  constructor() {
    this.database = new GeorgianTerminologyDatabase();
    this.contextAnalyzer = new ContextAnalyzer();
  }

  mapTextWithContext(text: string, options: {
    preserveEnglishTerms?: boolean;
    addExplanations?: boolean;
    targetAudience?: 'beginner' | 'intermediate' | 'advanced';
    industryFocus?: IndustryCategory;
  } = {}): string {
    const context = this.contextAnalyzer.analyzeContext(text);
    let mapped = text;

    // Find and replace terms based on context
    const detectedTerms = this.database.searchTerminology(text, options.industryFocus);
    
    detectedTerms.forEach(term => {
      const regex = new RegExp(`\\b${term.english}\\b`, 'gi');
      if (regex.test(mapped)) {
        let replacement = term.georgian;
        
        if (options.addExplanations && options.targetAudience === 'beginner') {
          replacement = `${term.georgian} (${term.definition})`;
        } else if (options.preserveEnglishTerms) {
          replacement = `${term.georgian} (${term.english})`;
        }
        
        mapped = mapped.replace(regex, replacement);
      }
    });

    return mapped;
  }

  getDatabase(): GeorgianTerminologyDatabase {
    return this.database;
  }
}

// ===== CONTEXT ANALYZER =====

class ContextAnalyzer {
  private frameworkPatterns: Map<string, IndustryCategory> = new Map([
    ['react', 'frontend'],
    ['vue', 'frontend'],
    ['angular', 'frontend'],
    ['express', 'backend'],
    ['node', 'backend'],
    ['database', 'database'],
    ['sql', 'database'],
    ['docker', 'devops'],
    ['kubernetes', 'devops'],
    ['css', 'ui-ux'],
    ['html', 'frontend']
  ]);

  analyzeContext(text: string): {
    detectedFrameworks: string[];
    industryCategory: IndustryCategory;
    complexityLevel: 'beginner' | 'intermediate' | 'advanced';
    confidence: number;
  } {
    const lowerText = text.toLowerCase();
    const detectedFrameworks: string[] = [];
    
    this.frameworkPatterns.forEach((category, framework) => {
      if (lowerText.includes(framework)) {
        detectedFrameworks.push(framework);
      }
    });

    // Determine industry category
    const categoryCounts = new Map<IndustryCategory, number>();
    detectedFrameworks.forEach(framework => {
      const category = this.frameworkPatterns.get(framework)!;
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    const industryCategory = categoryCounts.size > 0 
      ? Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : 'general';

    // Analyze complexity
    const complexityLevel = this.analyzeComplexity(text);
    
    // Calculate confidence
    const confidence = Math.min(0.95, detectedFrameworks.length * 0.2 + 0.3);

    return {
      detectedFrameworks,
      industryCategory,
      complexityLevel,
      confidence
    };
  }

  private analyzeComplexity(text: string): 'beginner' | 'intermediate' | 'advanced' {
    const advancedKeywords = ['optimization', 'performance', 'architecture', 'scalability', 'microservices'];
    const intermediateKeywords = ['component', 'function', 'api', 'database', 'server'];
    const beginnerKeywords = ['variable', 'loop', 'condition', 'basic', 'simple'];

    const lowerText = text.toLowerCase();
    
    if (advancedKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'advanced';
    } else if (intermediateKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'intermediate';
    } else {
      return 'beginner';
    }
  }
}

// ===== EXPORTS =====
export default GeorgianTerminologyDatabase;
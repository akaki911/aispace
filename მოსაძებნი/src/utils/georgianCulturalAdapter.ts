/**
 * 🇬🇪 Georgian Cultural Adaptation System
 * PHASE 4: Cultural Adaptation Features Implementation
 * 
 * Features:
 * ✅ Georgian Programming Terms with bilingual explanations
 * ✅ Local Examples: Bakhmaro platform integration examples  
 * ✅ Georgian Error Messages system
 * ✅ Regional Context: Georgian development best practices
 */

// ===== CULTURAL ADAPTATION INTERFACES =====

export interface GeorgianProgrammingTerm {
  english: string;
  georgian: string;
  explanation: string;
  usage: string;
  examples: string[];
  category: 'frontend' | 'backend' | 'database' | 'general' | 'tools';
}

export interface LocalPlatformExample {
  platform: string;
  description: string;
  codeExample: string;
  useCase: string;
  georgianContext: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface GeorgianErrorMessage {
  errorType: string;
  englishMessage: string;
  georgianMessage: string;
  explanation: string;
  solution: string;
  relatedTerms: string[];
}

export interface RegionalContext {
  topic: string;
  georgianPerspective: string;
  bestPractices: string[];
  culturalNotes: string[];
  localResources: string[];
}

// ===== GEORGIAN PROGRAMMING TERMS DATABASE =====

export class GeorgianProgrammingTermsDB {
  private terms: Map<string, GeorgianProgrammingTerm> = new Map([
    // Frontend Development
    ['component', {
      english: 'component',
      georgian: 'კომპონენტი',
      explanation: 'მისაღები და ხელახლა გამოყენებადი კოდის ნაწილი, რომელიც კონკრეტულ ფუნქციას ასრულებს',
      usage: 'React-ში UI ელემენტების შესაქმნელად',
      examples: [
        'ფუნქციური კომპონენტი: function Button() { return <button>კნოპკა</button>; }',
        'კლასის კომპონენტი: class Header extends React.Component { render() { return <h1>სათაური</h1>; } }'
      ],
      category: 'frontend'
    }],
    
    ['function', {
      english: 'function',
      georgian: 'ფუნქცია',
      explanation: 'კოდის ბლოკი რომელიც კონკრეტულ ამოცანას ასრულებს და შეიძლება მრავალჯერ გამოიძახოს',
      usage: 'ლოგიკის ორგანიზებისა და კოდის ხელახლა გამოყენებისთვის',
      examples: [
        'function გამარჯობა(სახელი) { return `გამარჯობა, ${სახელი}!`; }',
        'const რიცხვებისჯამი = (a, b) => a + b;'
      ],
      category: 'general'
    }],

    ['variable', {
      english: 'variable',
      georgian: 'ცვლადი',
      explanation: 'მონაცემების შესანახი კონტეინერი, რომლის მნიშვნელობაც შეიძლება შეიცვალოს',
      usage: 'ინფორმაციის დროებით შენახვისა და მანიპულირებისთვის',
      examples: [
        'let მომხმარებლისანომი = "გიორგი";',
        'const მაქსიმალურირიცხვი = 100;',
        'var კომპანიისდასახელება = "ბახმარო ტექნოლოჯიები";'
      ],
      category: 'general'
    }],

    ['array', {
      english: 'array',
      georgian: 'მასივი',
      explanation: 'მონაცემების შეკრების მეთოდი, რომელიც მრავალ მნიშვნელობას ინახავს თანმიმდევრობით',
      usage: 'მრავალი მსგავსი ელემენტის ორგანიზებისთვის',
      examples: [
        'const ქართულიქალაქები = ["თბილისი", "ბათუმი", "ქუთაისი"];',
        'const რიცხვები = [1, 2, 3, 4, 5];',
        'const მომხმარებლები = [{სახელი: "ნინო", ასაკი: 25}, {სახელი: "გიორგი", ასაკი: 30}];'
      ],
      category: 'general'
    }],

    ['object', {
      english: 'object',
      georgian: 'ობიექტი',
      explanation: 'მონაცემების სტრუქტურა რომელიც თვისებებს (properties) და მეთოდებს აერთიანებს',
      usage: 'რთული მონაცემების და ფუნქციონალობის ორგანიზებისთვის',
      examples: [
        'const სტუდენტი = { სახელი: "მარიამი", კურსი: 2, ფაკულტეტი: "ინფორმატიკა" };',
        'const მანქანა = { მარკა: "Toyota", წელი: 2023, startEngine() { console.log("ძრავი ჩაირთო"); } };'
      ],
      category: 'general'
    }],

    ['method', {
      english: 'method',
      georgian: 'მეთოდი',
      explanation: 'ობიექტის ფუნქცია რომელიც მის თვისებებთან მუშაობს',
      usage: 'ობიექტზე კონკრეტული ოპერაციების შესასრულებლად',
      examples: [
        'მომხმარებელი.მისალმება() - მომხმარებლის მისალმების მეთოდი',
        'მასივი.push(ელემენტი) - ახალი ელემენტის დამატება'
      ],
      category: 'general'
    }],

    ['interface', {
      english: 'interface',
      georgian: 'ინტერფეისი',
      explanation: 'ტიპების განსაზღვრის მეთოდი TypeScript-ში, რომელიც ობიექტის სტრუქტურას აღწერს',
      usage: 'კოდის უსაფრთხოებისა და ტიპების კონტროლისთვის',
      examples: [
        'interface მომხმარებელი { სახელი: string; ასაკი: number; }',
        'interface API_Response { მონაცემები: any[]; წარმატება: boolean; }'
      ],
      category: 'general'
    }],

    ['database', {
      english: 'database',
      georgian: 'მონაცემთა ბაზა',
      explanation: 'ორგანიზებული მონაცემების კოლექცია რომელიც ეფექტურად ინახება და იმართება',
      usage: 'აპლიკაციის მონაცემების მუდმივი შენახვისთვის',
      examples: [
        'PostgreSQL - რელაციური მონაცემთა ბაზა',
        'MongoDB - NoSQL დოკუმენტური ბაზა',
        'Firebase - Google-ის real-time მონაცემთა ბაზა'
      ],
      category: 'database'
    }],

    ['api', {
      english: 'API',
      georgian: 'აპლიკაციის პროგრამული ინტერფეისი',
      explanation: 'აპლიკაციებს შორის კომუნიკაციის წესები და პროტოკოლები',
      usage: 'სხვადასხვა სისტემებს შორის მონაცემების გაცვლისთვის',
      examples: [
        'REST API - HTTP პროტოკოლზე დაფუძნებული API',
        'GraphQL API - მძლავრი query ენა მონაცემებისთვის',
        'WebSocket API - real-time კომუნიკაციისთვის'
      ],
      category: 'backend'
    }]
  ]);

  getTermTranslation(englishTerm: string): GeorgianProgrammingTerm | null {
    return this.terms.get(englishTerm.toLowerCase()) || null;
  }

  getAllTermsByCategory(category: GeorgianProgrammingTerm['category']): GeorgianProgrammingTerm[] {
    return Array.from(this.terms.values()).filter(term => term.category === category);
  }

  searchTerms(query: string): GeorgianProgrammingTerm[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.terms.values()).filter(term => 
      term.english.toLowerCase().includes(lowerQuery) ||
      term.georgian.includes(query) ||
      term.explanation.includes(query)
    );
  }

  addCustomTerm(term: GeorgianProgrammingTerm): void {
    this.terms.set(term.english.toLowerCase(), term);
  }
}

// ===== LOCAL PLATFORM EXAMPLES =====

export class LocalPlatformExamples {
  private examples: LocalPlatformExample[] = [
    {
      platform: 'ბახმაროს ტურისტული პლატფორმა',
      description: 'ტურისტული ადგილების ონლაინ დათვალიერების პლატფორმა',
      codeExample: `
// ბახმაროს ლოკაციების კომპონენტი
const BakhmaroLocations = () => {
  const [ლოკაციები, setლოკაციები] = useState([]);
  
  useEffect(() => {
    // ბახმაროს API-დან მონაცემების ჩატვირთვა
    fetchBakhmaroData()
      .then(მონაცემები => setლოკაციები(მონაცემები))
      .catch(error => console.error('ერორი ბახმაროს მონაცემების ჩატვირთვისას:', error));
  }, []);

  return (
    <div className="bakhmaro-locations">
      <h2>🏔️ ბახმაროს ლოკაციები</h2>
      {ლოკაციები.map(ლოკაცია => (
        <LocationCard key={ლოკაცია.id} location={ლოკაცია} />
      ))}
    </div>
  );
};`,
      useCase: 'ტურისტული აპლიკაციების განვითარება',
      georgianContext: 'ქართული ტურიზმის ციფრული განვითარება და მთიული რეგიონების პოპულარიზაცია',
      difficulty: 'intermediate'
    },

    {
      platform: 'ქართული ბანკის API ინტეგრაცია',
      description: 'ლიბერთი ბანკის გადახდის სისტემის ინტეგრაცია',
      codeExample: `
// ქართული ბანკის გადახდის სერვისი
class GeorgianBankPaymentService {
  constructor(apiKey, environment = 'sandbox') {
    this.apiKey = apiKey;
    this.baseURL = environment === 'production' 
      ? 'https://api.libertybank.ge' 
      : 'https://sandbox.libertybank.ge';
  }

  async processPayment(თანხა, ვალუტა = 'GEL', აღწერა) {
    try {
      const response = await fetch(\`\${this.baseURL}/payments\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${this.apiKey}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: თანხა,
          currency: ვალუტა,
          description: აღწერა,
          callback_url: 'https://mysite.ge/payment-callback'
        })
      });
      
      const result = await response.json();
      return { წარმატება: true, მონაცემები: result };
    } catch (error) {
      return { წარმატება: false, შეცდომა: error.message };
    }
  }
}`,
      useCase: 'ელექტრონული კომერციის და FinTech აპლიკაციები',
      georgianContext: 'ქართული ფინანსური ეკოსისტემის ციფრული ტრანსფორმაცია',
      difficulty: 'advanced'
    },

    {
      platform: 'ქართული ენის NLP სერვისი',
      description: 'ქართული ტექსტის დამუშავების AI სერვისი',
      codeExample: `
// ქართული ენის დამუშავების კლასი
class GeorgianNLPService {
  constructor() {
    this.apiEndpoint = 'https://nlp.kartuli.ai/api';
  }

  async analyzeGeorgianText(ტექსტი) {
    const response = await fetch(\`\${this.apiEndpoint}/analyze\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: ტექსტი, 
        language: 'ka',
        analysis_type: ['sentiment', 'entities', 'keywords']
      })
    });

    const ანალიზი = await response.json();
    
    return {
      სენტიმენტი: ანალიზი.sentiment,
      ძირითადი_სიტყვები: ანალიზი.keywords,
      პიროვნებები: ანალიზი.entities.filter(e => e.type === 'PERSON'),
      ადგილები: ანალიზი.entities.filter(e => e.type === 'LOCATION')
    };
  }

  async translateToEnglish(ქართული_ტექსტი) {
    // ქართულიდან ინგლისურად თარგმნის API
    const translation = await this.callTranslationAPI(ქართული_ტექსტი);
    return translation;
  }
}`,
      useCase: 'ქართული კონტენტის ანალიზი და AI აპლიკაციები',
      georgianContext: 'ქართული ენის ციფრული დამუშავება და AI ტექნოლოგიების გამოყენება',
      difficulty: 'advanced'
    }
  ];

  getExamplesByDifficulty(difficulty: LocalPlatformExample['difficulty']): LocalPlatformExample[] {
    return this.examples.filter(example => example.difficulty === difficulty);
  }

  getRandomExample(): LocalPlatformExample {
    return this.examples[Math.floor(Math.random() * this.examples.length)];
  }

  searchExamples(query: string): LocalPlatformExample[] {
    const lowerQuery = query.toLowerCase();
    return this.examples.filter(example =>
      example.platform.toLowerCase().includes(lowerQuery) ||
      example.description.toLowerCase().includes(lowerQuery) ||
      example.useCase.toLowerCase().includes(lowerQuery) ||
      example.georgianContext.toLowerCase().includes(lowerQuery)
    );
  }

  addCustomExample(example: LocalPlatformExample): void {
    this.examples.push(example);
  }
}

// ===== GEORGIAN ERROR MESSAGES SYSTEM =====

export class GeorgianErrorMessagesSystem {
  private errorMessages: Map<string, GeorgianErrorMessage> = new Map([
    ['TypeError', {
      errorType: 'TypeError',
      englishMessage: 'Cannot read property of undefined',
      georgianMessage: 'ვერ ვკითხულობ განუსაზღვრელი ობიექტის თვისებას',
      explanation: 'ეს შეცდომა ხდება მაშინ, როდესაც ცდილობთ ისეთი ობიექტის თვისებაზე წვდომას, რომელიც არ არსებობს (undefined)',
      solution: 'შეამოწმეთ ობიექტი არსებობს თუ არა: if (ობიექტი && ობიექტი.თვისება) ან გამოიყენეთ optional chaining: ობიექტი?.თვისება',
      relatedTerms: ['undefined', 'object', 'property', 'null']
    }],

    ['ReferenceError', {
      errorType: 'ReferenceError',
      englishMessage: 'Variable is not defined',
      georgianMessage: 'ცვლადი არ არის განსაზღვრული',
      explanation: 'ეს შეცდომა ხდება მაშინ, როდესაც ცდილობთ ისეთი ცვლადის გამოყენებას, რომელიც არ არის გამოცხადებული',
      solution: 'შეამოწმეთ ცვლადის სახელი სწორად არის დაწერილი და გამოცხადებული არის კოდში ადრე',
      relatedTerms: ['variable', 'declaration', 'scope']
    }],

    ['SyntaxError', {
      errorType: 'SyntaxError',
      englishMessage: 'Unexpected token',
      georgianMessage: 'მოულოდნელი სიმბოლო',
      explanation: 'ეს შეცდომა ხდება კოდის სინტაქსური შეცდომის გამო - ფრჩხილების, მძიმეების ან სხვა სიმბოლოების არასწორი გამოყენება',
      solution: 'შეამოწმეთ ყველა ფრჩხილი, მძიმე და სხვა სიმბოლო სწორად არის დაწყვილებული და განლაგებული',
      relatedTerms: ['syntax', 'brackets', 'semicolon', 'token']
    }],

    ['NetworkError', {
      errorType: 'NetworkError',
      englishMessage: 'Failed to fetch',
      georgianMessage: 'მონაცემების ჩატვირთვა ვერ მოხერხდა',
      explanation: 'ეს შეცდომა ხდება ინტერნეტ კავშირის ან სერვერის პრობლემის გამო',
      solution: 'შეამოწმეთ ინტერნეტ კავშირი და API endpoint-ის ხელმისაწვდომობა. გამოიყენეთ try-catch ბლოკი ერორების დამუშავებისთვის',
      relatedTerms: ['fetch', 'API', 'network', 'server']
    }]
  ]);

  getGeorgianErrorMessage(errorType: string): GeorgianErrorMessage | null {
    return this.errorMessages.get(errorType) || null;
  }

  translateErrorMessage(englishError: string): string {
    // Simple error message translation
    const errorTranslations: Record<string, string> = {
      'Cannot read property': 'ვერ ვკითხულობ თვისებას',
      'is not defined': 'არ არის განსაზღვრული',
      'is not a function': 'არ არის ფუნქცია',
      'Failed to fetch': 'მონაცემების ჩატვირთვა ვერ მოხერხდა',
      'Network Error': 'ქსელის შეცდომა',
      'Syntax Error': 'სინტაქსური შეცდომა',
      'Type Error': 'ტიპის შეცდომა',
      'Reference Error': 'მიმართვის შეცდომა'
    };

    let translated = englishError;
    Object.entries(errorTranslations).forEach(([english, georgian]) => {
      translated = translated.replace(new RegExp(english, 'gi'), georgian);
    });

    return translated;
  }

  generateErrorSolution(errorType: string, context?: string): string {
    const errorMessage = this.getGeorgianErrorMessage(errorType);
    if (!errorMessage) {
      return 'შეცდომის ტიპი უცნობია. შეამოწმეთ კოდი და კონსოლის ლოგები დეტალებისთვის.';
    }

    let solution = `🔧 **${errorMessage.georgianMessage}**\n\n`;
    solution += `📝 **განმარტება:** ${errorMessage.explanation}\n\n`;
    solution += `✅ **გადაწყვეტა:** ${errorMessage.solution}\n\n`;
    
    if (context) {
      solution += `🎯 **კონტექსტი:** ${context}\n\n`;
    }

    solution += `🔗 **დაკავშირებული ტერმინები:** ${errorMessage.relatedTerms.join(', ')}`;
    
    return solution;
  }

  addCustomErrorMessage(error: GeorgianErrorMessage): void {
    this.errorMessages.set(error.errorType, error);
  }
}

// ===== REGIONAL CONTEXT SYSTEM =====

export class RegionalContextSystem {
  private contexts: RegionalContext[] = [
    {
      topic: 'ვებ განვითარება საქართველოში',
      georgianPerspective: 'ქართული ვებ განვითარების ეკოსისტემა სწრაფად იზრდება, განსაკუთრებით FinTech და ტურიზმის სფეროებში',
      bestPractices: [
        'ქართული Unicode (UTF-8) მხარდაჭერა ყველა პროექტში',
        'მობილურ-პირველი მიდგომა (mobile-first) - ქართველების 85% ინტერნეტს მობილურიდან იყენებს',
        'ლოკალური SEO ოპტიმიზაცია .ge დომენებისთვის',
        'ქართული ვებ ფონტების გამოყენება (ნოტო, ბ.პ.გ. უნივერსალი)',
        'ლოკალური გადახდის სისტემების ინტეგრაცია (ბანკის გადახდა, ბიზრეს გადახდა)'
      ],
      culturalNotes: [
        'ქართული ვებსაიტები უნდა აყენოს ზოგადი ქართული შემადგენელი საკითხები',
        'დაიცვას ქართული ტექსტის ტრადიციული კითხვადობა',
        'გათვალისწინებული იყოს ლოკალური საზეიმო დღეები და ტრადიციები',
        'ქართულ-ინგლისური კოდ-სვიჩინგი ნორმალურია ტექნიკურ კონტექსტში'
      ],
      localResources: [
        'საქართველოს ტექნოლოგიური უნივერსიტეტი - tech.edu.ge',
        'IT Academy Step - კერძო განათლების ცენტრი',
        'TBC IT Academy - ქართული ბანკის IT აკადემია',
        'Google for Georgia - ღია ონლაინ კურსები',
        'ქართული დეველოპერების Facebook ჯგუფები'
      ]
    },

    {
      topic: 'მობილური აპლიკაციების განვითარება',
      georgianPerspective: 'ქართული მობილური აპების ბაზარი ძირითადად iOS და Android პლატფორმებზე ფოკუსირებულია',
      bestPractices: [
        'რეაქტ ნეითივ ან Flutter გამოყენება ქოს-პლატფორმული განვითარებისთვის',
        'ქართული კლავიატურის მხარდაჭერა',
        'ოფლაინ-ფუნქციონალობა არასტაბილური ინტერნეტის მხედველობაში',
        'ლოკალური ნოტიფიკაციების ქართულად ლოკალიზაცია',
        'Google Play Console და App Store-ის ქართული ოპტიმიზაცია'
      ],
      culturalNotes: [
        'ქართველები ინტერნატის ვიზუალურ დიზაინს ანიჭებენ დიდ მნიშვნელობას',
        'ლოკალური ბრენდების მხარდაჭერა მნიშვნელოვანია მარკეტინგისთვის',
        'ოჯახური და კომუნიტური ფუნქციები მნიშვნელოვანია უზერების შეტყობისთვის'
      ],
      localResources: [
        'Appstore Georgia - ლოკალური აპების კატალოგი',
        'Georgian Mobile Development მეიტაპები',
        'Caucasus University - მობილური განვითარების კურსები'
      ]
    }
  ];

  getContextByTopic(topic: string): RegionalContext | null {
    return this.contexts.find(context => 
      context.topic.toLowerCase().includes(topic.toLowerCase())
    ) || null;
  }

  getAllContexts(): RegionalContext[] {
    return this.contexts;
  }

  searchContexts(query: string): RegionalContext[] {
    const lowerQuery = query.toLowerCase();
    return this.contexts.filter(context =>
      context.topic.toLowerCase().includes(lowerQuery) ||
      context.georgianPerspective.toLowerCase().includes(lowerQuery) ||
      context.bestPractices.some(practice => practice.toLowerCase().includes(lowerQuery))
    );
  }

  addCustomContext(context: RegionalContext): void {
    this.contexts.push(context);
  }
}

// ===== MAIN CULTURAL ADAPTER =====

export class GeorgianCulturalAdapter {
  private termsDB = new GeorgianProgrammingTermsDB();
  private platformExamples = new LocalPlatformExamples();
  private errorSystem = new GeorgianErrorMessagesSystem();
  private regionalContext = new RegionalContextSystem();

  // Public API methods
  translateTerm(englishTerm: string): GeorgianProgrammingTerm | null {
    return this.termsDB.getTermTranslation(englishTerm);
  }

  getLocalExample(difficulty?: LocalPlatformExample['difficulty']): LocalPlatformExample {
    if (difficulty) {
      const examples = this.platformExamples.getExamplesByDifficulty(difficulty);
      return examples[Math.floor(Math.random() * examples.length)];
    }
    return this.platformExamples.getRandomExample();
  }

  translateError(errorType: string, context?: string): string {
    return this.errorSystem.generateErrorSolution(errorType, context);
  }

  getRegionalContext(topic: string): RegionalContext | null {
    return this.regionalContext.getContextByTopic(topic);
  }

  enhanceContentWithCulturalContext(content: string): string {
    let enhanced = content;

    // Add Georgian programming terms explanations
    const terms = this.termsDB.searchTerms(content);
    terms.forEach(term => {
      const pattern = new RegExp(`\\b${term.english}\\b`, 'gi');
      enhanced = enhanced.replace(pattern, `**${term.english}** (${term.georgian})`);
    });

    // Add local examples if relevant
    if (content.includes('example') || content.includes('მაგალითი')) {
      const example = this.platformExamples.getRandomExample();
      enhanced += `\n\n🇬🇪 **ლოკალური მაგალითი:** ${example.platform}\n${example.description}`;
    }

    return enhanced;
  }

  getCapabilities(): string[] {
    return [
      '🏛️ ქართული პროგრამირების ტერმინოლოგია',
      '🏔️ ლოკალური პლატფორმების მაგალითები (ბახმარო, ქართული ბანკები)',
      '🔧 ქართული შეცდომების ახსნები',
      '🌍 რეგიონული კონტექსტი და ქართული dev practices',
      '📚 ქართული რესურსები და საზოგადოება',
      '🎯 კულტურული ადაპტაცია ტექნიკური კონტენტისთვის'
    ];
  }
}

export default GeorgianCulturalAdapter;
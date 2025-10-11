
const responsePatterns = {
  // არასწორი ფორმები -> სწორი ფორმები (გაფართოებული ვერსია)
  artificialFixes: {
    'შესრულება მოხდა': 'შესრულდა',
    'ანალიზის ჩატარება': 'ანალიზი', 
    'მოქმედების განხორციელება': 'მოქმედება',
    'ინფორმაციის მიღება': 'ინფორმაცია',
    'დამუშავების პროცესი': 'დამუშავება',
    'შემოწმების ჩატარება': 'შემოწმება',
    'ფუნქციონირების უზრუნველყოფა': 'ფუნქციონირება',
    'მომსახურების გაწევა': 'მომსახურება',
    'კონტროლის განხორციელება': 'კონტროლი',
    'აღრიცხვის წარმოება': 'აღრიცხვა',
    'მონიტორინგის ჩატარება': 'მონიტორინგი',
    'ვალიდაციის შესრულება': 'ვალიდაცია',
    'სინქრონიზაციის პროცესი': 'სინქრონიზაცია',
    'გადამოწმების ჩატარება': 'გადამოწმება',
    'შეფასების მიმდინარეობა': 'შეფასება'
  },

  // სისტემური თვითაღრიცხვის აცილება (გაფართოებული ვერსია)
  selfIdentificationBlocks: {
    'მე ვარ AI სისტემა': '',
    'მე ვარ ხელოვნური ინტელექტი': '',
    'მე ვარ ასისტენტი სისტემა': '',
    'მე ვარ ბახმაროს AI': '',
    'მე ვარ კომპიუტერული პროგრამა': '',
    'როგორც AI სისტემა': '',
    'როგორც ხელოვნური ინტელექტი': '',
    'მე სისტემად': '',
    'ჩემი როლი როგორც AI': '',
    'მე ვმუშაობ როგორც AI': '',
    'მე ვარ მანქანა': '',
    'მე ვარ ავტომატური სისტემა': ''
  },

  // კომპონენტებისა და სერვისების ახსნისთვის
  explanationTemplates: {
    service: 'ეს სერვისი პასუხისმგებელია {functionality}-ზე და შეიცავს {functions} ფუნქციებს',
    component: 'ეს კომპონენტი {purpose} და მუშაობს {workflow} პრინციპით',
    logic: 'ეს ლოგიკა {description} და იყენებს {methods} მეთოდებს'
  },

  // ტექნიკური ტერმინების ქართული ვარიანტები
  technicalTerms: {
    'booking': 'ჯავშანი',
    'service': 'სერვისი', 
    'component': 'კომპონენტი',
    'function': 'ფუნქცია',
    'method': 'მეთოდი',
    'validation': 'ვალიდაცია',
    'authentication': 'ავტორიზაცია',
    'database': 'მონაცემთა ბაზა',
    'API': 'API',
    'endpoint': 'ენდფოინტი'
  },
  
  // ბუნებრივი ქართული სინონიმები
  naturalSynonyms: {
    'შეასრულო': 'გააკეთო',
    'განახორციელო': 'შეასრულო', 
    'გამომიტანე': 'გამოიტანე',
    'მიღებულია': 'მუშაობს',
    'წარმატებით': 'კარგად',
    'შეცდომა მოხდა': 'შეცდომაა',
    'ჩამოტვირთვა': 'გადმოწერა',
    'ატვირთვა': 'ამოტვირთვა',
    'შენახვა': 'დაზოგვა',
    'განახლება': 'აპდეიტი',
    'გამოძახება': 'გამოძახება',
    'გამოყენება': 'იყენება',
    'დაკავშირება': 'კავშირი',
    'რედაქტირება': 'შეცვლა',
    'ვალიდაცია': 'შემოწმება',
    'ავტორიზაცია': 'შესვლა',
    'კონფიგურაცია': 'კონფიგი',
    'დეპლოიმენტი': 'განთავსება'
  },

  // მეგობრული და ბუნებრივი პასუხები
  friendlyResponses: {
    'search_help': 'რა ფაილს ეძებ? მითხარი და ვიპოვით ერთად! 😊',
    'general_confusion': 'ჰმ... ჯერ ვერ მივხვდი რას გულისხმობ. შეიძლება უფრო დეტალურად აღწერო?',
    'file_search': 'კარგი, ფაილის ძებნაში დაგეხმარები! რომელი ფაილი გჭირდება?',
    'dashboard_help': 'დეშბორდის შესახებ კითხვა გაქვს? რა კონკრეტულად გაინტერესებს?'
  }
};

function improveGeorgianResponse(response) {
  let improved = response;

  // გამოვაცალოთ სისტემური თვითაღრიცხვები
  Object.entries(responsePatterns.selfIdentificationBlocks).forEach(([pattern, replacement]) => {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    improved = improved.replace(regex, replacement);
  });

  // Fix artificial patterns
  Object.entries(responsePatterns.artificialFixes).forEach(([bad, good]) => {
    const regex = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    improved = improved.replace(regex, good);
  });

  // გაფართოებული ბუნებრივი ქართული ნაკადი
  improved = improved
    .replace(/(\w+)ს ასრულებს/g, '$1ს')
    .replace(/(\w+)ის მოპოვება/g, '$1ის მიღება')
    .replace(/განხორციელების მიზნით/g, 'რომ განხორციელდეს')
    .replace(/შეძლებას იძლევა/g, 'საშუალებას აძლევს')
    .replace(/უზრუნველყოფს შესაძლებლობას/g, 'საშუალებას აძლევს')
    .replace(/ხორციელდება პროცესი/g, 'მიმდინარეობს')
    .replace(/მოხდება განხორციელება/g, 'განხორციელდება')
    .replace(/ხდება შესრულება/g, 'შესრულდება')
    .replace(/ვარ ასისტენტი რომელიც/g, 'ასისტენტი ვარ, რომელიც')
    .replace(/შემიძლია დაგეხმარო/g, 'შემიძლია დაგეხმარება');

  // თავისუფალი ცარიელი სივრცეების მოცილება
  improved = improved.replace(/\s+/g, ' ').trim();

  return improved;
}

// ახალი ფუნქცია - fallback-ის ლოგიკა Groq-ის ვერ მუშაობის შემთხვევაში
async function improveGeorgianWithFallback(response) {
  try {
    // პირველ რიგში ვცდილობთ Groq-ით გაუმჯობესებას
    if (process.env.GROQ_API_KEY) {
      console.log('🔧 Trying Groq-based Georgian improvement...');
      
      const { askGroq } = require('./groq_service');
      
      const groqResponse = await askGroq([
        { 
          role: 'system', 
          content: 'გასწორე ქართული გრამატიკა და გახადე ტექსტი ბუნებრივი. დააბრუნე მხოლოდ გასწორებული ტექსტი.' 
        },
        { role: 'user', content: response }
      ]);

      // Enhanced validation of Groq response
      if (groqResponse && 
          groqResponse.choices && 
          Array.isArray(groqResponse.choices) && 
          groqResponse.choices.length > 0 &&
          groqResponse.choices[0].message &&
          groqResponse.choices[0].message.content) {
        
        const groqImproved = groqResponse.choices[0].message.content;

        // თუ Groq წარმატებით მუშაობს
        if (groqImproved && groqImproved !== response && groqImproved.length > response.length * 0.7) {
          console.log('✅ Groq Georgian improvement successful');
          return groqImproved;
        }
      } else {
        console.log('⚠️ Groq response structure invalid, using fallback');
      }
    }

    // Fallback: ლოკალური გაუმჯობესება
    console.log('⚡ Using fallback local Georgian improvement');
    return improveGeorgianResponse(response);

  } catch (error) {
    console.warn('⚠️ Georgian improvement error, using local fallback:', error.message);
    return improveGeorgianResponse(response);
  }
}

function analyzeResponseQuality(response) {
  const analysis = {
    georgianPercentage: 0,
    hasArtificialPatterns: false,
    technicalTermsUsed: [],
    readabilityScore: 0,
    suggestions: []
  };

  // Calculate Georgian content percentage
  const georgianChars = (response.match(/[ა-ჰ]/g) || []).length;
  analysis.georgianPercentage = (georgianChars / response.length) * 100;

  // Check for artificial patterns
  const artificialKeys = Object.keys(responsePatterns.artificialFixes);
  analysis.hasArtificialPatterns = artificialKeys.some(pattern => 
    response.includes(pattern)
  );

  // Identify technical terms used
  Object.entries(responsePatterns.technicalTerms).forEach(([eng, geo]) => {
    if (response.includes(geo)) {
      analysis.technicalTermsUsed.push(geo);
    }
  });

  // Simple readability score (sentence length, complexity)
  const sentences = response.split(/[.!?]/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(' ').length, 0) / sentences.length;
  analysis.readabilityScore = Math.max(0, 100 - (avgSentenceLength - 15) * 2);

  // Generate suggestions
  if (analysis.georgianPercentage < 80) {
    analysis.suggestions.push('გაზარდეთ ქართული კონტენტის პროცენტი');
  }
  if (analysis.hasArtificialPatterns) {
    analysis.suggestions.push('გამოიყენეთ უფრო ბუნებრივი ფრაზები');
  }
  if (analysis.readabilityScore < 70) {
    analysis.suggestions.push('გაამარტივეთ წინადადებების სტრუქტურა');
  }

  return analysis;
}

// Basic Georgian fixes for fallback scenarios
function applyBasicGeorgianFixes(text) {
  return text
    .replace(/შეგირია/g, "შეგიძლია")
    .replace(/\bკავ\b/g, "კაი")
    .replace(/მე დამეხმაროს/g, "მე დამეხმარო")
    .replace(/შეასრულებს/g, "შეასრულო")
    .replace(/ჩემი საიტი/g, "ბახმაროს პლატფორმა")
    .replace(/მე ვარ AI/g, "ბახმაროს AI ასისტენტი ვარ");
}

module.exports = {
  responsePatterns,
  improveGeorgianResponse,
  improveGeorgianWithFallback,
  analyzeResponseQuality,
  applyBasicGeorgianFixes
};


const responsePatterns = {
  // არასწორი ფორმები -> სწორი ფორმები
  artificialFixes: {
    'შესრულება მოხდა': 'შესრულდა',
    'ანალიზის ჩატარება': 'ანალიზი', 
    'მოქმედების განხორციელება': 'მოქმედება',
    'ინფორმაციის მიღება': 'ინფორმაცია',
    'დამუშავების პროცესი': 'დამუშავება',
    'შემოწმების ჩატარება': 'შემოწმება'
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
  }
};

function improveGeorgianResponse(response) {
  let improved = response;
  
  // Fix artificial patterns
  Object.entries(responsePatterns.artificialFixes).forEach(([bad, good]) => {
    const regex = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    improved = improved.replace(regex, good);
  });
  
  // Ensure natural Georgian flow
  improved = improved
    .replace(/(\w+)ს ასრულებს/g, '$1ს')
    .replace(/(\w+)ის მოპოვება/g, '$1ის მიღება')
    .replace(/განხორციელების მიზნით/g, 'რომ განხორციელდეს');
  
  return improved;
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

module.exports = {
  responsePatterns,
  improveGeorgianResponse,
  analyzeResponseQuality
};

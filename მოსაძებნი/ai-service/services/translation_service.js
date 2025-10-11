
// Translation Service for Georgian-English Support
class TranslationService {
  constructor() {
    // Technical term dictionary for consistent translations
    this.techDictionary = new Map([
      // Development terms
      ['project structure', 'პროექტის სტრუქტურა'],
      ['file content', 'ფაილის კონტენტი'],
      ['code review', 'კოდის მიმოხილვა'],
      ['function call', 'ფუნქციის გამოძახება'],
      ['error handling', 'შეცდომების დამუშავება'],
      ['performance monitoring', 'პერფორმანსის მონიტორინგი'],
      
      // UI/UX terms
      ['user interface', 'მომხმარებლის ინტერფეისი'],
      ['user experience', 'მომხმარებლის გამოცდილება'],
      ['responsive design', 'ადაპტაციური დიზაინი'],
      ['loading state', 'ჩატვირთვის მდგომარეობა'],
      
      // Backend terms
      ['database connection', 'მონაცემთა ბაზის კავშირი'],
      ['API endpoint', 'API ბოლო წერტილი'],
      ['authentication', 'ავტორიზაცია'],
      ['validation', 'შემოწმება'],
      
      // Common phrases
      ['successfully completed', 'წარმატებით დასრულდა'],
      ['failed to execute', 'ვერ შესრულდა'],
      ['processing request', 'მოთხოვნის დამუშავება'],
      ['connection error', 'კავშირის შეცდომა']
    ]);

    // Common Georgian patterns for better natural language
    this.georgianPatterns = new Map([
      ['I can help', 'შემიძლია დაგეხმაროთ'],
      ['you can use', 'შეგიძლიათ გამოიყენოთ'],
      ['this function will', 'ეს ფუნქცია შეასრულებს'],
      ['the system has', 'სისტემას აქვს'],
      ['please provide', 'გთხოვთ მიუთითოთ'],
      ['if you want', 'თუ გსურთ'],
      ['would you like', 'გსურთ თუ არა'],
      ['let me know', 'შემატყობინეთ']
    ]);
  }

  // Translate technical terms to Georgian
  translateTechTerms(text) {
    let translatedText = text;
    
    this.techDictionary.forEach((georgian, english) => {
      const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      translatedText = translatedText.replace(regex, georgian);
    });
    
    return translatedText;
  }

  // Apply natural Georgian patterns
  applyGeorgianPatterns(text) {
    let naturalText = text;
    
    this.georgianPatterns.forEach((georgian, english) => {
      const regex = new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      naturalText = naturalText.replace(regex, georgian);
    });
    
    return naturalText;
  }

  // Main translation method
  translateToGeorgian(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Apply technical term translations
    let result = this.translateTechTerms(text);
    
    // Apply natural Georgian patterns
    result = this.applyGeorgianPatterns(result);
    
    return result;
  }

  // Detect language ratio in text
  detectLanguageRatio(text) {
    const georgianChars = (text.match(/[ა-ჰ]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = georgianChars + englishChars;
    
    if (totalChars === 0) return { georgian: 0, english: 0 };
    
    return {
      georgian: (georgianChars / totalChars * 100).toFixed(1),
      english: (englishChars / totalChars * 100).toFixed(1),
      isMainlyGeorgian: georgianChars > englishChars,
      needsTranslation: englishChars > georgianChars && georgianChars > 0
    };
  }

  // Suggest translation improvements
  suggestImprovements(text) {
    const suggestions = [];
    const langRatio = this.detectLanguageRatio(text);
    
    if (langRatio.needsTranslation) {
      suggestions.push({
        type: 'translation',
        message: 'ტექსტში ძალიან ბევრი ინგლისური სიტყვაა - სჯობს უფრო ქართული ფორმულირება',
        severity: 'medium'
      });
    }
    
    // Check for untranslated technical terms
    this.techDictionary.forEach((georgian, english) => {
      if (text.includes(english) && !text.includes(georgian)) {
        suggestions.push({
          type: 'tech_term',
          message: `ტექნიკური ტერმინი "${english}" უნდა იყოს "${georgian}"`,
          severity: 'low'
        });
      }
    });
    
    return suggestions;
  }
}

module.exports = new TranslationService();

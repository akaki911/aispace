
// Georgian Language Grammar Validator
// ქართული ენის გრამატიკული ვალიდატორი

const COMMON_GRAMMAR_ERRORS = {
  'თქვენი ხართ ავტორიზაცია': 'თქვენ ხართ ავტორიზებული',
  'მოხდა შეცდომა': 'მოხდა შეცდომა',
  'ამ ინფორმაცია': 'ეს ინფორმაცია',
  'ეს ფუნქცია იქნება': 'ეს ფუნქცია იქნება',
  'შესრულდება ოპერაცია': 'შესრულდება ოპერაცია'
};

const STYLE_IMPROVEMENTS = {
  'OK': 'კარგი',
  'Error': 'შეცდომა',
  'Loading': 'იტვირთება',
  'Success': 'წარმატება',
  'Failed': 'ვერ მოხერხდა'
};

function validateGeorgianGrammar(text) {
  const errors = [];
  const suggestions = [];

  // Check for common grammar mistakes
  for (const [incorrect, correct] of Object.entries(COMMON_GRAMMAR_ERRORS)) {
    if (text.includes(incorrect)) {
      errors.push({
        type: 'grammar',
        found: incorrect,
        suggestion: correct,
        message: `🛑 გრამატიკული შეცდომა: "${incorrect}" → "${correct}"`
      });
    }
  }

  // Check for style improvements
  for (const [english, georgian] of Object.entries(STYLE_IMPROVEMENTS)) {
    if (text.includes(english) && !text.includes(georgian)) {
      suggestions.push({
        type: 'style',
        found: english,
        suggestion: georgian,
        message: `✨ სტილის გაუმჯობესება: "${english}" → "${georgian}"`
      });
    }
  }

  // Check for mixed language patterns
  const hasMixedPatterns = /[a-zA-Z]/.test(text) && /[ა-ჰ]/.test(text);
  if (hasMixedPatterns && text.length > 50) {
    suggestions.push({
      type: 'mixed',
      message: '⚠️ შერეული ენის გამოყენება - გაითვალისწინეთ მხოლოდ ქართული ან მხოლოდ ინგლისური'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    score: calculateGrammarScore(text, errors, suggestions)
  };
}

function calculateGrammarScore(text, errors, suggestions) {
  const baseScore = 100;
  const errorPenalty = errors.length * 15;
  const suggestionPenalty = suggestions.length * 5;
  
  return Math.max(0, baseScore - errorPenalty - suggestionPenalty);
}

function autoCorrectGeorgian(text) {
  let correctedText = text;
  
  // Apply automatic corrections
  for (const [incorrect, correct] of Object.entries(COMMON_GRAMMAR_ERRORS)) {
    correctedText = correctedText.replace(new RegExp(incorrect, 'gi'), correct);
  }
  
  // Apply style improvements
  for (const [english, georgian] of Object.entries(STYLE_IMPROVEMENTS)) {
    correctedText = correctedText.replace(new RegExp(`\\b${english}\\b`, 'gi'), georgian);
  }
  
  return correctedText;
}

module.exports = {
  validateGeorgianGrammar,
  autoCorrectGeorgian,
  COMMON_GRAMMAR_ERRORS,
  STYLE_IMPROVEMENTS
};

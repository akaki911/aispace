// SOL-203: User Preferences & Memory Format
// Georgian language user preference management

const DEFAULT_USER_PREFERENCES = {
  // Language preferences
  language: {
    primary: 'ka',        // Georgian
    secondary: 'en',      // English
    codeComments: 'mixed' // Mixed Georgian/English
  },
  
  // Development preferences
  development: {
    framework: 'react',
    styling: 'tailwindcss',
    stateManagement: 'react-query',
    codeStyle: 'typescript-strict',
    testingFramework: 'jest',
    preferredEditor: 'vscode'
  },
  
  // Response preferences  
  responses: {
    verbosity: 'detailed',     // brief, detailed, extensive
    includeExamples: true,
    includeExplanations: true,
    preferGeorgianTerms: true,
    showStepByStep: true
  },
  
  // AI behavior preferences
  aiAssistance: {
    persona: 'senior-engineer',  // junior, intermediate, senior-engineer, architect
    responseStyle: 'direct',     // casual, direct, formal
    expertiseLevel: 'full-stack',
    focusAreas: ['react', 'typescript', 'firebase', 'performance']
  },

  // Georgian-specific preferences
  georgian: {
    useGeorgianGreetings: true,
    explainTechnicalTerms: true,
    culturalContext: true,
    localExamples: true
  }
};

// User memory structure for personalization
const USER_MEMORY_SCHEMA = {
  personalInfo: {
    name: String,
    personalId: String,
    role: String,           // DEVELOPER, LEAD, ARCHITECT
    experience: String,     // JUNIOR, INTERMEDIATE, SENIOR
    joinDate: Date,
    lastActive: Date
  },
  
  preferences: DEFAULT_USER_PREFERENCES,
  
  // Interaction history for learning
  interactions: {
    totalSessions: Number,
    averageSessionLength: Number,
    commonQuestions: Array,
    problemsSolved: Array,
    codingPatterns: Array
  },
  
  // Project-specific context
  projects: {
    current: 'bakhmaro-cottages',
    familiarity: Number,      // 1-10 scale
    contributions: Array,
    expertise: Array          // Areas of project expertise
  },
  
  // Learning and adaptation
  learning: {
    successfulSolutions: Array,
    preferredApproaches: Array,
    feedbackHistory: Array,
    adaptations: Array
  }
};

// Georgian language patterns and preferences
const GEORGIAN_LANGUAGE_PATTERNS = {
  greetings: {
    formal: "ბატონო/ქალბატონო",
    informal: "მეგობარო", 
    professional: "კოლეგა",
    friendly: "ძვირფასო"
  },
  
  responses: {
    affirmative: ["დიახ", "სწორია", "ზუსტად", "ხო"],
    negative: ["არა", "არ არის", "არასწორია"],
    understanding: ["მიმღებია", "გავიგე", "ნათელია", "წარმოვიდგინე"],
    encouragement: ["შესანიშნავია", "კარგია", "მოგეწონება", "გააგრძელე"]
  },
  
  technicalTerms: {
    // English -> Georgian mappings
    'component': 'კომპონენტი',
    'function': 'ფუნქცია',
    'variable': 'ცვლადი',
    'array': 'მასივი',
    'object': 'ობიექტი',
    'method': 'მეთოდი',
    'property': 'თვისება',
    'interface': 'ინტერფეისი',
    'class': 'კლასი',
    'module': 'მოდული'
  }
};

// User preference validation and defaults
function validateUserPreferences(prefs) {
  const validated = { ...DEFAULT_USER_PREFERENCES };
  
  if (prefs && typeof prefs === 'object') {
    // Merge with defaults, maintaining structure
    Object.keys(validated).forEach(key => {
      if (prefs[key] && typeof prefs[key] === 'object') {
        validated[key] = { ...validated[key], ...prefs[key] };
      } else if (prefs[key] !== undefined) {
        validated[key] = prefs[key];
      }
    });
  }
  
  return validated;
}

// Create user memory object
function createUserMemory(personalId, initialData = {}) {
  return {
    personalInfo: {
      personalId,
      name: initialData.name || 'Developer',
      role: initialData.role || 'DEVELOPER',
      experience: initialData.experience || 'INTERMEDIATE',
      joinDate: new Date(),
      lastActive: new Date()
    },
    preferences: validateUserPreferences(initialData.preferences),
    interactions: {
      totalSessions: 0,
      averageSessionLength: 0,
      commonQuestions: [],
      problemsSolved: [],
      codingPatterns: []
    },
    projects: {
      current: 'bakhmaro-cottages',
      familiarity: initialData.familiarity || 5,
      contributions: [],
      expertise: initialData.expertise || []
    },
    learning: {
      successfulSolutions: [],
      preferredApproaches: [],
      feedbackHistory: [],
      adaptations: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

module.exports = {
  DEFAULT_USER_PREFERENCES,
  USER_MEMORY_SCHEMA,
  GEORGIAN_LANGUAGE_PATTERNS,
  validateUserPreferences,
  createUserMemory
};
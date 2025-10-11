// SOL-203: User Preferences & Memory Format
// Georgian language user preference management

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

class MemoryServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'MemoryServiceError';
    this.status = typeof options.status === 'number' ? options.status : 500;
    this.code = options.code || 'MEMORY_SERVICE_ERROR';
    this.publicMessage = options.publicMessage || message;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

const DEFAULT_MEMORY_CONTROLS = {
  referenceSavedMemories: true,
  referenceChatHistory: true,
  lastUpdated: null
};

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

  // Interface / presentation preferences
  interface: {
    responseMode: 'replit-style-response',
    showServiceStatus: true,
    showLogs: true,
    showCopyButtons: true
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
  },

  memory: {
    referenceSavedMemories: DEFAULT_MEMORY_CONTROLS.referenceSavedMemories,
    referenceChatHistory: DEFAULT_MEMORY_CONTROLS.referenceChatHistory
  }
};

// User memory structure for personalization
const USER_MEMORY_SCHEMA = {
  personalInfo: {
    name: String,
    personalId: String,
    encryptedPersonalId: String,
    personalIdHash: String,
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
    codingPatterns: Array,
    sessionDurations: Array
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
  },

  savedMemories: Array,

  memoryControls: {
    referenceSavedMemories: Boolean,
    referenceChatHistory: Boolean,
    lastUpdated: Date
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
    component: 'კომპონენტი',
    function: 'ფუნქცია',
    variable: 'ცვლადი',
    array: 'მასივი',
    object: 'ობიექტი',
    method: 'მეთოდი',
    property: 'თვისება',
    interface: 'ინტერფეისი',
    class: 'კლასი',
    module: 'მოდული',
    hook: 'ჰუქი',
    state: 'სტეითი',
    props: 'პროპსები',
    render: 'რენდერი',
    'component lifecycle': 'კომპონენტის სიცოცხლის ციკლი',
    context: 'კონტექსტი'
  }
};

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.USER_MEMORY_ENCRYPTION_KEY || 'fallback-user-memory-key')
  .digest();

const MEMORY_STORAGE_DIR = path.resolve(__dirname, '../../memory_data');

const MEMORY_COLLECTION = 'ai_user_memories';
const SAVED_MEMORIES_SUBCOLLECTION = 'savedMemories';
const SAVED_MEMORIES_LIMIT = 10;

function isFirestoreQuotaError(error) {
  if (!error) {
    return false;
  }

  const code = typeof error.code === 'number' ? error.code : String(error.code || '').toLowerCase();
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  return (
    code === 8 ||
    code === 'resource-exhausted' ||
    code === 'quota_exceeded' ||
    message.includes('quota exceeded') ||
    message.includes('resource_exhausted')
  );
}

async function loadLocalMemoryFallback(userId, normalizedQuery, limit) {
  const fallbackControls = {
    ...DEFAULT_MEMORY_CONTROLS,
    lastUpdated: new Date().toISOString()
  };

  if (!userId) {
    return {
      memories: [],
      controls: fallbackControls,
      meta: {
        source: 'local-fallback',
        warning: 'FIRESTORE_QUOTA_EXCEEDED'
      }
    };
  }

  const fileCandidates = [
    path.join(MEMORY_STORAGE_DIR, `${userId}.json`),
    path.join(MEMORY_STORAGE_DIR, `user_${userId}.json`)
  ];

  for (const filePath of fileCandidates) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      const memoryControls = parsed?.memoryControls
        ? {
            ...DEFAULT_MEMORY_CONTROLS,
            ...parsed.memoryControls,
            lastUpdated:
              normalizeTimestamp(parsed.memoryControls.lastUpdated) || fallbackControls.lastUpdated
          }
        : fallbackControls;

      const rawMemories = Array.isArray(parsed?.savedMemories) ? parsed.savedMemories : [];

      const normalizedMemories = rawMemories
        .map(entry => {
          if (!entry) {
            return null;
          }

          const id = entry.id || entry.key || `local_${Date.now()}`;
          const key = normalizeMemoryKey(entry.key);
          const value =
            entry.value !== undefined
              ? entry.value
              : deserializeMemoryValue(entry.encryptedValue, entry.valueType);
          const createdAt = normalizeTimestamp(entry.createdAt) || new Date().toISOString();
          const updatedAt = normalizeTimestamp(entry.updatedAt);
          const tags = Array.isArray(entry.tags) ? entry.tags.slice(0, 6) : [];
          const summary = entry.summary ? String(entry.summary).slice(0, 160) : '';

          return {
            id,
            key,
            value,
            userConfirmed: Boolean(entry.userConfirmed),
            source: entry.source || 'local-cache',
            tags,
            summary,
            createdAt,
            updatedAt
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const filteredMemories = !normalizedQuery
        ? normalizedMemories
        : normalizedMemories.filter(memory => {
            const haystack = [
              memory.key,
              typeof memory.value === 'string' ? memory.value : JSON.stringify(memory.value),
              memory.summary
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return haystack.includes(normalizedQuery);
          });

      return {
        memories: filteredMemories.slice(0, limit),
        controls: memoryControls,
        meta: {
          source: 'local-fallback',
          warning: 'FIRESTORE_QUOTA_EXCEEDED',
          filePath
        }
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ Failed to load local memory fallback for ${userId} from ${filePath}:`, error.message);
      }
    }
  }

  return {
    memories: [],
    controls: fallbackControls,
    meta: {
      source: 'local-fallback',
      warning: 'FIRESTORE_QUOTA_EXCEEDED',
      message: 'No local memory snapshot available'
    }
  };
}

let firestoreInstance = null;

function getServerTimestamp() {
  return admin.firestore && admin.firestore.FieldValue
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();
}

function getFirestoreInstance(provided) {
  if (provided) {
    return provided;
  }

  if (firestoreInstance) {
    return firestoreInstance;
  }

  try {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages';
      admin.initializeApp({ projectId });
    }
    firestoreInstance = admin.firestore();
  } catch (error) {
    console.warn('⚠️ Firestore initialization skipped in user_preferences:', error.message);
    firestoreInstance = null;
  }

  return firestoreInstance;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', '0'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function validateString(value, fallback) {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function asStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map(entry => (typeof entry === 'string' ? entry.trim() : null))
    .filter(Boolean);
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.min(Math.max(numeric, min), max);
  }
  return fallback;
}

function ensureStorageDir() {
  return fs.mkdir(MEMORY_STORAGE_DIR, { recursive: true });
}

function encryptValue(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return `${iv.toString('base64')}:${encrypted}:${authTag}`;
}

function decryptValue(value) {
  if (typeof value !== 'string' || value.split(':').length !== 3) {
    return value;
  }

  try {
    const [ivPart, encryptedPart, authTagPart] = value.split(':');
    const iv = Buffer.from(ivPart, 'base64');
    const encryptedText = Buffer.from(encryptedPart, 'base64');
    const authTag = Buffer.from(authTagPart, 'base64');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn('⚠️ Failed to decrypt value, returning raw payload');
    return value;
  }
}

function normalizeMemoryKey(key) {
  if (typeof key === 'string' && key.trim().length > 0) {
    return key.trim().slice(0, 120);
  }
  return `memory_${Date.now()}`;
}

function serializeMemoryValue(value) {
  if (value === undefined || value === null) {
    return { serialized: encryptValue(''), valueType: 'string', original: '' };
  }

  if (typeof value === 'string') {
    return { serialized: encryptValue(value), valueType: 'string', original: value };
  }

  try {
    const jsonValue = JSON.stringify(value);
    return { serialized: encryptValue(jsonValue), valueType: 'json', original: value };
  } catch (error) {
    const fallback = String(value);
    return { serialized: encryptValue(fallback), valueType: 'string', original: fallback };
  }
}

function deserializeMemoryValue(payload, valueType) {
  if (!payload) {
    return '';
  }

  const decrypted = decryptValue(payload);
  if (valueType === 'json') {
    try {
      return JSON.parse(decrypted);
    } catch (error) {
      return decrypted;
    }
  }
  return decrypted;
}

function sanitizeSavedMemoriesForPersistence(memories = []) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return [];
  }

  return memories.slice(0, SAVED_MEMORIES_LIMIT).map(entry => {
    const normalizedKey = normalizeMemoryKey(entry.key);
    const { serialized, valueType } = serializeMemoryValue(entry.value);
    const createdAt = entry.createdAt instanceof Date
      ? entry.createdAt.toISOString()
      : entry.createdAt || new Date().toISOString();

    return {
      id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
      key: normalizedKey,
      encryptedValue: serialized,
      valueType,
      userConfirmed: Boolean(entry.userConfirmed),
      source: entry.source || 'manual',
      createdAt,
      updatedAt: entry.updatedAt || createdAt
    };
  });
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (value.toDate && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  return new Date().toISOString();
}

function mapSnapshotToMemory(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    key: data.key,
    value: deserializeMemoryValue(data.encryptedValue, data.valueType),
    userConfirmed: Boolean(data.userConfirmed),
    source: data.source || 'manual',
    tags: Array.isArray(data.tags) ? data.tags : [],
    summary: data.summary || '',
    createdAt: normalizeTimestamp(data.createdAt) || normalizeTimestamp(data.timestamp) || new Date().toISOString(),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

function encryptPersonalInfo(personalInfo = {}) {
  if (!personalInfo || typeof personalInfo !== 'object') {
    return {};
  }

  const sanitized = { ...personalInfo };
  if (sanitized.personalId) {
    const personalId = sanitized.personalId;
    sanitized.encryptedPersonalId =
      sanitized.encryptedPersonalId || encryptValue(personalId);
    sanitized.personalIdHash =
      sanitized.personalIdHash ||
      crypto.createHash('sha256').update(personalId).digest('hex');
  }

  return sanitized;
}

function sanitizeForPersistence(memory) {
  const serialized = JSON.parse(
    JSON.stringify(memory, (key, value) => (value instanceof Date ? value.toISOString() : value))
  );

  if (serialized.personalInfo) {
    serialized.personalInfo = encryptPersonalInfo(serialized.personalInfo);
    delete serialized.personalInfo.personalId;
  }

  if (serialized.savedMemories) {
    serialized.savedMemories = sanitizeSavedMemoriesForPersistence(serialized.savedMemories);
  }

  const controls = serialized.memoryControls || {};
  serialized.memoryControls = {
    ...DEFAULT_MEMORY_CONTROLS,
    ...controls,
    lastUpdated: controls.lastUpdated
      ? new Date(controls.lastUpdated).toISOString()
      : new Date().toISOString()
  };

  return serialized;
}

// User preference validation and defaults
function validateUserPreferences(prefs) {
  const validated = { ...DEFAULT_USER_PREFERENCES };

  if (prefs && typeof prefs === 'object') {
    Object.keys(validated).forEach(key => {
      if (prefs[key] && typeof prefs[key] === 'object') {
        validated[key] = { ...validated[key], ...prefs[key] };
      } else if (prefs[key] !== undefined) {
        validated[key] = prefs[key];
      }
    });
  }

  validated.language = {
    primary: validateString(validated.language.primary, DEFAULT_USER_PREFERENCES.language.primary),
    secondary: validateString(
      validated.language.secondary,
      DEFAULT_USER_PREFERENCES.language.secondary
    ),
    codeComments: validateString(
      validated.language.codeComments,
      DEFAULT_USER_PREFERENCES.language.codeComments
    )
  };

  const allowedVerbosity = ['brief', 'detailed', 'extensive'];
  const allowedResponseModes = ['replit-style-response', 'classic', 'base'];
  validated.responses = {
    verbosity: allowedVerbosity.includes(validated.responses.verbosity)
      ? validated.responses.verbosity
      : DEFAULT_USER_PREFERENCES.responses.verbosity,
    includeExamples: normalizeBoolean(
      validated.responses.includeExamples,
      DEFAULT_USER_PREFERENCES.responses.includeExamples
    ),
    includeExplanations: normalizeBoolean(
      validated.responses.includeExplanations,
      DEFAULT_USER_PREFERENCES.responses.includeExplanations
    ),
    preferGeorgianTerms: normalizeBoolean(
      validated.responses.preferGeorgianTerms,
      DEFAULT_USER_PREFERENCES.responses.preferGeorgianTerms
    ),
    showStepByStep: normalizeBoolean(
      validated.responses.showStepByStep,
      DEFAULT_USER_PREFERENCES.responses.showStepByStep
    )
  };

  validated.interface = {
    responseMode: allowedResponseModes.includes(validated.interface.responseMode)
      ? validated.interface.responseMode
      : DEFAULT_USER_PREFERENCES.interface.responseMode,
    showServiceStatus: normalizeBoolean(
      validated.interface.showServiceStatus,
      DEFAULT_USER_PREFERENCES.interface.showServiceStatus
    ),
    showLogs: normalizeBoolean(
      validated.interface.showLogs,
      DEFAULT_USER_PREFERENCES.interface.showLogs
    ),
    showCopyButtons: normalizeBoolean(
      validated.interface.showCopyButtons,
      DEFAULT_USER_PREFERENCES.interface.showCopyButtons
    )
  };

  validated.development = {
    framework: validateString(
      validated.development.framework,
      DEFAULT_USER_PREFERENCES.development.framework
    ),
    styling: validateString(
      validated.development.styling,
      DEFAULT_USER_PREFERENCES.development.styling
    ),
    stateManagement: validateString(
      validated.development.stateManagement,
      DEFAULT_USER_PREFERENCES.development.stateManagement
    ),
    codeStyle: validateString(
      validated.development.codeStyle,
      DEFAULT_USER_PREFERENCES.development.codeStyle
    ),
    testingFramework: validateString(
      validated.development.testingFramework,
      DEFAULT_USER_PREFERENCES.development.testingFramework
    ),
    preferredEditor: validateString(
      validated.development.preferredEditor,
      DEFAULT_USER_PREFERENCES.development.preferredEditor
    )
  };

  const allowedPersonas = ['junior', 'intermediate', 'senior-engineer', 'architect'];
  const allowedResponseStyles = ['casual', 'direct', 'formal'];
  validated.aiAssistance = {
    persona: allowedPersonas.includes(validated.aiAssistance.persona)
      ? validated.aiAssistance.persona
      : DEFAULT_USER_PREFERENCES.aiAssistance.persona,
    responseStyle: allowedResponseStyles.includes(validated.aiAssistance.responseStyle)
      ? validated.aiAssistance.responseStyle
      : DEFAULT_USER_PREFERENCES.aiAssistance.responseStyle,
    expertiseLevel: validateString(
      validated.aiAssistance.expertiseLevel,
      DEFAULT_USER_PREFERENCES.aiAssistance.expertiseLevel
    ),
    focusAreas: asStringArray(
      validated.aiAssistance.focusAreas,
      DEFAULT_USER_PREFERENCES.aiAssistance.focusAreas
    )
  };

  validated.georgian = {
    useGeorgianGreetings: normalizeBoolean(
      validated.georgian.useGeorgianGreetings,
      DEFAULT_USER_PREFERENCES.georgian.useGeorgianGreetings
    ),
    explainTechnicalTerms: normalizeBoolean(
      validated.georgian.explainTechnicalTerms,
      DEFAULT_USER_PREFERENCES.georgian.explainTechnicalTerms
    ),
    culturalContext: normalizeBoolean(
      validated.georgian.culturalContext,
      DEFAULT_USER_PREFERENCES.georgian.culturalContext
    ),
    localExamples: normalizeBoolean(
      validated.georgian.localExamples,
      DEFAULT_USER_PREFERENCES.georgian.localExamples
    )
  };

  const incomingMemoryPrefs = prefs?.memory || validated.memory || {};
  validated.memory = {
    referenceSavedMemories: normalizeBoolean(
      incomingMemoryPrefs.referenceSavedMemories,
      DEFAULT_MEMORY_CONTROLS.referenceSavedMemories
    ),
    referenceChatHistory: normalizeBoolean(
      incomingMemoryPrefs.referenceChatHistory,
      DEFAULT_MEMORY_CONTROLS.referenceChatHistory
    )
  };

  return validated;
}

function calculateAverageSessionLength(sessionDurations = []) {
  const durations = sessionDurations.filter(duration => Number.isFinite(Number(duration)));
  if (durations.length === 0) {
    return 0;
  }
  const total = durations.reduce((sum, duration) => sum + Number(duration), 0);
  return Math.round((total / durations.length) * 100) / 100;
}

function analyzeInteractions(interactions = {}) {
  const sessionDurations = Array.isArray(interactions.sessionDurations)
    ? interactions.sessionDurations
    : [];
  const problemsSolved = Array.isArray(interactions.problemsSolved)
    ? interactions.problemsSolved
    : [];
  const commonQuestions = Array.isArray(interactions.commonQuestions)
    ? interactions.commonQuestions
    : [];
  const codingPatterns = Array.isArray(interactions.codingPatterns)
    ? interactions.codingPatterns
    : [];

  const averageSessionLength = calculateAverageSessionLength(sessionDurations);
  const totalSessions = sessionDurations.length || interactions.totalSessions || 0;
  const problemSolvingRate = totalSessions
    ? Math.round((problemsSolved.length / totalSessions) * 100) / 100
    : 0;

  const questionFrequency = commonQuestions.reduce((acc, question) => {
    const key = typeof question === 'string' ? question.trim() : question;
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const patternFrequency = codingPatterns.reduce((acc, pattern) => {
    const key = typeof pattern === 'string' ? pattern.trim() : pattern;
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    totalSessions,
    averageSessionLength,
    problemSolvingRate,
    questionFrequency,
    patternFrequency
  };
}

// Create user memory object
function createUserMemory(personalId, initialData = {}) {
  const now = new Date();
  const personalInfo = encryptPersonalInfo({
    personalId,
    name: validateString(initialData.name, 'Developer'),
    role: validateString(initialData.role, 'DEVELOPER'),
    experience: validateString(initialData.experience, 'INTERMEDIATE'),
    joinDate: now,
    lastActive: now
  });

  const familiarity = clampNumber(initialData.familiarity, 1, 10, 5);

  return {
    personalInfo,
    preferences: validateUserPreferences(initialData.preferences),
    interactions: {
      totalSessions: 0,
      averageSessionLength: 0,
      commonQuestions: [],
      problemsSolved: [],
      codingPatterns: [],
      sessionDurations: []
    },
    projects: {
      current: 'bakhmaro-cottages',
      familiarity,
      contributions: [],
      expertise: asStringArray(initialData.expertise, [])
    },
    learning: {
      successfulSolutions: [],
      preferredApproaches: [],
      feedbackHistory: [],
      adaptations: []
    },
    savedMemories: [],
    memoryControls: {
      ...DEFAULT_MEMORY_CONTROLS,
      lastUpdated: now
    },
    createdAt: now,
    updatedAt: now
  };
}

function updateUserMemory(existingMemory, updates = {}) {
  if (!existingMemory || typeof existingMemory !== 'object') {
    throw new Error('Cannot update user memory without an existing memory object.');
  }

  const updated = { ...existingMemory };

  if (updates.personalInfo) {
    updated.personalInfo = encryptPersonalInfo({
      ...existingMemory.personalInfo,
      ...updates.personalInfo
    });
  }

  if (updates.preferences) {
    updated.preferences = validateUserPreferences({
      ...existingMemory.preferences,
      ...updates.preferences
    });
  }

  if (updates.interactions) {
    const interactions = {
      ...existingMemory.interactions,
      ...updates.interactions
    };

    interactions.commonQuestions = asStringArray(
      interactions.commonQuestions,
      existingMemory.interactions.commonQuestions
    );
    interactions.problemsSolved = asStringArray(
      interactions.problemsSolved,
      existingMemory.interactions.problemsSolved
    );
    interactions.codingPatterns = asStringArray(
      interactions.codingPatterns,
      existingMemory.interactions.codingPatterns
    );
    interactions.sessionDurations = Array.isArray(interactions.sessionDurations)
      ? interactions.sessionDurations.filter(duration => Number.isFinite(Number(duration))).map(Number)
      : existingMemory.interactions.sessionDurations;

    const analytics = analyzeInteractions(interactions);
    interactions.totalSessions = analytics.totalSessions;
    interactions.averageSessionLength = analytics.averageSessionLength;

    updated.interactions = interactions;
  }

  if (updates.projects) {
    updated.projects = {
      ...existingMemory.projects,
      ...updates.projects
    };
    if (updates.projects.familiarity !== undefined) {
      updated.projects.familiarity = clampNumber(
        updates.projects.familiarity,
        1,
        10,
        existingMemory.projects.familiarity
      );
    }
    if (updates.projects.expertise) {
      updated.projects.expertise = asStringArray(
        updates.projects.expertise,
        existingMemory.projects.expertise
      );
    }
    if (updates.projects.contributions) {
      updated.projects.contributions = Array.isArray(updates.projects.contributions)
        ? updates.projects.contributions
        : existingMemory.projects.contributions;
    }
  }

  if (updates.learning) {
    updated.learning = {
      ...existingMemory.learning,
      ...updates.learning
    };
    ['successfulSolutions', 'preferredApproaches', 'feedbackHistory', 'adaptations'].forEach(key => {
      if (updates.learning[key]) {
        updated.learning[key] = Array.isArray(updates.learning[key])
          ? updates.learning[key]
          : existingMemory.learning[key];
      }
    });
  }

  if (updates.savedMemories) {
    const incoming = Array.isArray(updates.savedMemories) ? updates.savedMemories : [];
    const existing = Array.isArray(existingMemory.savedMemories) ? existingMemory.savedMemories : [];
    const merged = [...existing, ...incoming].filter(Boolean);

    const deduped = new Map();
    merged.forEach(entry => {
      if (!entry) return;
      const id = entry.id || entry.key || `memory_${Date.now()}`;
      deduped.set(id, {
        ...entry,
        id,
        key: normalizeMemoryKey(entry.key),
        userConfirmed: Boolean(entry.userConfirmed),
        createdAt: entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt || Date.now()),
        updatedAt: new Date()
      });
    });

    updated.savedMemories = Array.from(deduped.values())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-SAVED_MEMORIES_LIMIT);
  }

  if (updates.memoryControls) {
    updated.memoryControls = {
      ...DEFAULT_MEMORY_CONTROLS,
      ...(existingMemory.memoryControls || {}),
      ...updates.memoryControls,
      lastUpdated: new Date()
    };
  }

  updated.updatedAt = new Date();
  return updated;
}

async function persistUserMemory(memory, options = {}) {
  if (!memory || typeof memory !== 'object') {
    throw new Error('Cannot persist an empty user memory payload.');
  }

  const sanitized = sanitizeForPersistence(memory);
  const identifier =
    options.identifier ||
    sanitized.personalInfo?.personalIdHash ||
    sanitized.personalInfo?.encryptedPersonalId;

  if (!identifier) {
    throw new Error('Cannot persist user memory without a stable identifier.');
  }

  await ensureStorageDir();
  const fileName = options.fileName || `user_${identifier}.json`;
  const filePath = options.filePath || path.join(MEMORY_STORAGE_DIR, fileName);

  await fs.writeFile(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
  return filePath;
}

async function saveMemory(userId, memoryObj = {}, options = {}) {
  if (!userId) {
    throw new Error('User ID is required to save memory entries.');
  }

  const db = getFirestoreInstance(options.firestore);
  if (!db) {
    throw new Error('Firestore is not available for memory persistence.');
  }

  const safeUserId = String(userId);
  const normalizedKey = normalizeMemoryKey(memoryObj.key);
  const createdAt = memoryObj.createdAt ? new Date(memoryObj.createdAt) : new Date();
  const { serialized, valueType, original } = serializeMemoryValue(memoryObj.value);
  const entryId = memoryObj.id || (crypto.randomUUID ? crypto.randomUUID() : `memory_${Date.now()}`);

  const docRef = db.collection(MEMORY_COLLECTION).doc(safeUserId);
  const savedRef = docRef.collection(SAVED_MEMORIES_SUBCOLLECTION);

  const existingSnapshot = await savedRef.orderBy('createdAt', 'asc').get();
  const overflow = existingSnapshot.size - (SAVED_MEMORIES_LIMIT - 1);
  if (overflow > 0) {
    let removed = 0;
    for (const doc of existingSnapshot.docs) {
      if (removed >= overflow) break;
      await doc.ref.delete();
      removed += 1;
    }
  }

  const payload = {
    key: normalizedKey,
    encryptedValue: serialized,
    valueType,
    userConfirmed: Boolean(memoryObj.userConfirmed),
    createdAt: admin.firestore && admin.firestore.Timestamp
      ? admin.firestore.Timestamp.fromDate(createdAt)
      : createdAt,
    updatedAt: getServerTimestamp(),
    source: memoryObj.source || 'manual',
    tags: Array.isArray(memoryObj.tags) ? memoryObj.tags.slice(0, 6) : [],
    summary: memoryObj.summary ? String(memoryObj.summary).slice(0, 160) : ''
  };

  await savedRef.doc(entryId).set(payload, { merge: true });

  const docSnapshot = await docRef.get();
  const existingControls = docSnapshot.exists && docSnapshot.data()?.memoryControls
    ? docSnapshot.data().memoryControls
    : null;

  const mergePayload = existingControls
    ? { memoryControls: existingControls }
    : {
        memoryControls: {
          referenceSavedMemories: DEFAULT_MEMORY_CONTROLS.referenceSavedMemories,
          referenceChatHistory: DEFAULT_MEMORY_CONTROLS.referenceChatHistory,
          lastUpdated: getServerTimestamp()
        }
      };

  await docRef.set(
    {
      ...mergePayload,
      lastSavedAt: getServerTimestamp()
    },
    { merge: true }
  );

  return {
    id: entryId,
    key: normalizedKey,
    value: original,
    userConfirmed: Boolean(memoryObj.userConfirmed),
    source: memoryObj.source || 'manual',
    tags: Array.isArray(memoryObj.tags) ? memoryObj.tags.slice(0, 6) : [],
    summary: memoryObj.summary ? String(memoryObj.summary).slice(0, 160) : '',
    createdAt: createdAt.toISOString()
  };
}

async function retrieveMemories(userId, query, options = {}) {
  if (!userId) {
    throw new MemoryServiceError('User ID is required to retrieve memories.', {
      status: 400,
      code: 'MISSING_USER_ID',
      publicMessage: 'მომხმარებლის იდენტიფიკატორი აუცილებელია.'
    });
  }

  const db = getFirestoreInstance(options.firestore);
  if (!db) {
    return {
      memories: [],
      controls: { ...DEFAULT_MEMORY_CONTROLS, lastUpdated: new Date().toISOString() }
    };
  }

  const safeUserId = String(userId);
  const docRef = db.collection(MEMORY_COLLECTION).doc(safeUserId);
  const limit = options.limit && Number.isFinite(options.limit) ? options.limit : 25;
  const normalizedQuery = query ? String(query).toLowerCase() : null;

  try {
    const [docSnapshot, memoriesSnapshot] = await Promise.all([
      docRef.get(),
      docRef
        .collection(SAVED_MEMORIES_SUBCOLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
    ]);

    const controlsPayload = docSnapshot.exists ? docSnapshot.data() : {};
    const rawControls = controlsPayload?.memoryControls || controlsPayload?.controls || {};
    const normalizedControls = {
      ...DEFAULT_MEMORY_CONTROLS,
      ...rawControls,
      lastUpdated: normalizeTimestamp(rawControls.lastUpdated) || new Date().toISOString()
    };

    const memories = [];

    memoriesSnapshot.forEach(doc => {
      const mapped = mapSnapshotToMemory(doc);
      if (!normalizedQuery) {
        memories.push(mapped);
        return;
      }

      const haystack = [
        mapped.key,
        typeof mapped.value === 'string' ? mapped.value : JSON.stringify(mapped.value),
        mapped.summary
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (haystack.includes(normalizedQuery)) {
        memories.push(mapped);
      }
    });

    return { memories, controls: normalizedControls };
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      console.warn(`⚠️ Firestore quota exceeded while retrieving memories for user ${safeUserId}:`, error.message);
      const fallback = await loadLocalMemoryFallback(safeUserId, normalizedQuery, limit);
      return fallback;
    }

    console.error(`❌ [Memory] Firestore query failed for ${safeUserId}:`, error);
    return {
      memories: [],
      controls: {
        ...DEFAULT_MEMORY_CONTROLS,
        lastUpdated: new Date().toISOString()
      },
      degraded: true,
      error: {
        code: 'MEMORY_FETCH_FAILED',
        message: 'მეხსიერების მონაცემები დროებით მიუწვდომელია.'
      }
    };
  }
}

async function toggleMemoryUsage(userId, feature, enabled, options = {}) {
  if (!userId) {
    throw new MemoryServiceError('User ID is required to toggle memory usage.', {
      status: 400,
      code: 'MISSING_USER_ID',
      publicMessage: 'მომხმარებლის იდენტიფიკატორი აუცილებელია.'
    });
  }

  if (!['savedMemories', 'chatHistory'].includes(feature)) {
    throw new MemoryServiceError('Unsupported memory feature toggle requested.', {
      status: 400,
      code: 'INVALID_MEMORY_FEATURE',
      publicMessage: 'მეხსიერების პარამეტრი ვერ მოიძებნა.'
    });
  }

  const db = getFirestoreInstance(options.firestore);
  if (!db) {
    throw new MemoryServiceError('Firestore is not available for memory toggles.', {
      status: 503,
      code: 'FIRESTORE_UNAVAILABLE',
      publicMessage: 'მეხსიერების სერვისი დროებით მიუწვდომელია.'
    });
  }

  const safeUserId = String(userId);
  const docRef = db.collection(MEMORY_COLLECTION).doc(safeUserId);

  try {
    const docSnapshot = await docRef.get();
    const rawControls = docSnapshot.exists && docSnapshot.data()?.memoryControls
      ? docSnapshot.data().memoryControls
      : {};

    const normalized = {
      ...DEFAULT_MEMORY_CONTROLS,
      ...rawControls
    };

    if (feature === 'savedMemories') {
      normalized.referenceSavedMemories = Boolean(enabled);
    } else if (feature === 'chatHistory') {
      normalized.referenceChatHistory = Boolean(enabled);
    }

    const updatedLastUpdated = new Date().toISOString();
    normalized.lastUpdated = updatedLastUpdated;

    await docRef.set(
      {
        memoryControls: {
          referenceSavedMemories: normalized.referenceSavedMemories,
          referenceChatHistory: normalized.referenceChatHistory,
          lastUpdated: getServerTimestamp()
        }
      },
      { merge: true }
    );

    return normalized;
  } catch (error) {
    throw new MemoryServiceError('Failed to update memory controls.', {
      status: 503,
      code: 'MEMORY_TOGGLE_FAILED',
      publicMessage: 'მეხსიერების პარამეტრები ვერ განახლდა.',
      cause: error
    });
  }
}

module.exports = {
  DEFAULT_USER_PREFERENCES,
  DEFAULT_MEMORY_CONTROLS,
  USER_MEMORY_SCHEMA,
  GEORGIAN_LANGUAGE_PATTERNS,
  validateUserPreferences,
  createUserMemory,
  updateUserMemory,
  persistUserMemory,
  saveMemory,
  retrieveMemories,
  toggleMemoryUsage,
  calculateAverageSessionLength,
  analyzeInteractions,
  encryptPersonalInfo,
  decryptValue,
  SAVED_MEMORIES_LIMIT,
  MemoryServiceError
};

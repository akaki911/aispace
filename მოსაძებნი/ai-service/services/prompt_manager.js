// SOL-203: Enhanced imports for Deep Context Pipeline
const {
  SYSTEM_PROMPTS,
  getTimeBasedGreeting,
  formatGrammarExamples,
  setTransparentThoughtModeOverride
} = require('../context/system_prompts');

const {
  createUserMemory,
  validateUserPreferences
} = require('../context/user_preferences');

const { GREETING_RESPONSES } = require('../utils/greeting_responses');
const PRODUCT_GUIDE_CTA_LINE = 'CTA მითითება: ყოველი პასუხი დაასრულე საიტის კონკრეტული მოქმედების მოწოდებით.';


const {
  composeProjectContext,
  analyzeQueryIntent,
  analyzeFileContext,
  generateFileListSummary,
  checkServiceStatuses,
  generateServiceLaunchScript,
  formatLogsForExpandableSection,
  DEFAULT_SERVICE_CONFIG
} = require('../context/code_context');

const {
  isGreetingMessage,
  normalizeMessageForGreeting
} = require('../utils/greeting_utils');

const GREETING_RE = /\b(გამარჯობა|გაუმარჯოს|სალამ(?:ი)?|მოგესალმ(?:ებ(?:ი|ათ))?|hi|hello)\b/i;

class PromptManager {
  constructor() {
    this.prompts = new Map();
    this.usageStats = { totalPrompts: 0, lastUpdated: Date.now() };
    this.userMemoryCache = new Map();  // SOL-203: User memory cache
    this.contextCache = new Map();     // SOL-203: Context cache
    this.initializePrompts();
    console.log('🧠 PromptManager initialized with SOL-203 Deep Context Pipeline');
  }

  initializePrompts() {
    // Core system prompts for different query types
    this.prompts.set('general', {
      get system() {
        return [
          SYSTEM_PROMPTS.base,
          'ფოკუსი: გამოიყენე მომხმარებლის კითხვის UI კონტექსტი და მიუთითე საიტის შესაბამისი სექცია.',
          PRODUCT_GUIDE_CTA_LINE,
        ].join('\n');
      },
      tokens: 120,
    });

    this.prompts.set('code_analysis', {
      get system() {
        return [
          SYSTEM_PROMPTS.base,
          'ფოკუსი: ტექნიკურ ან კოდზე ორიენტირებულ შეკითხვებს გადააკეთე UI ახსნად და თუ თემა სცდება საიტს, გამოიყენე off-topic პასუხი.',
          PRODUCT_GUIDE_CTA_LINE,
        ].join('\n');
      },
      tokens: 120,
    });

    this.prompts.set('error_diagnosis', {
      get system() {
        return [
          SYSTEM_PROMPTS.base,
          'ფოკუსი: დეტალურად განსაზღვრე პრობლემა ან შეცდომა, შემოგვთავაზე ორი UI ნაბიჯი პრობლემის გადასაჭრელად და ასწორე მომხმარებლის მოლოდინი.',
          PRODUCT_GUIDE_CTA_LINE,
        ].join('\n');
      },
      tokens: 110,
    });

    this.prompts.set('site_overview', {
      get system() {
        return [
          SYSTEM_PROMPTS.base,
          'ფოკუსი: მოკლედ ჩამოთვალე bakhmaro.co-ს ძირითადი განყოფილებები და თითოეულს დაურთე მოქმედების CTA.',
          PRODUCT_GUIDE_CTA_LINE,
        ].join('\n');
      },
      tokens: 120,
    });

    this.prompts.set('greeting', {
      get system() {
        return [
          SYSTEM_PROMPTS.base,
          `Greeting Mode: გამოიყენე მისალმება ${GREETING_RESPONSES.join(' | ')} სიიდან და დაურთე ერთი UI მოქმედება.`,
          PRODUCT_GUIDE_CTA_LINE,
        ].join('\n');
      },
      tokens: 80,
    });

    this.usageStats.totalPrompts = this.prompts.size;
  }

  classifyAndGetPrompt(message, context = {}) {
    const safeMessage = typeof message === 'string' ? message : '';
    const normalizedMessage = normalizeMessageForGreeting(safeMessage);
    const lowerMessage = safeMessage.toLowerCase();
    const trimmedMessage = safeMessage.trim();

    const shortGreetingHeuristic =
      trimmedMessage.length > 0 &&
      trimmedMessage.length <= 12 &&
      /^\s*გამარჯ(ობა|ობათ)?\s*$/i.test(trimmedMessage);

    const patterns = {
      greeting: GREETING_RE,
      error: /(^|\s)(error|შეცდომა|პრობლემა)(?=\s|$|[.!?,])/iu,
      code: /(^|\s)(კოდი|ფუნქცია|ანალიზი)(?=\s|$|[.!?,])/iu,
    };

    const isGreeting =
      patterns.greeting.test(lowerMessage) ||
      isGreetingMessage(safeMessage, normalizedMessage) ||
      shortGreetingHeuristic;
    const hasError = !isGreeting && patterns.error.test(lowerMessage);
    const hasCodeIntent = !isGreeting && !hasError && patterns.code.test(lowerMessage);

    let classification = 'site_overview';

    if (isGreeting) {
      classification = 'greeting';
    } else if (hasError) {
      classification = 'error_diagnosis';
    } else if (hasCodeIntent) {
      classification = 'code_analysis';
    }

    console.log(`კლასიფიკაცია: ${classification}`, {
      message: safeMessage,
      isGreeting,
      hasError,
      hasCodeIntent,
    });

    return this.getPrompt(classification, context);
  }

  getPrompt(type, context = {}) {
    const basePrompt = this.prompts.get(type) || this.prompts.get('general');

    const isSuperAdminUser =
      context.user?.role === 'SUPER_ADMIN' ||
      context.user?.id === '01019062020' ||
      context.userId === '01019062020';
    const debugExplainEnabled = context.debugExplain === true;
    const explicitTransparentPreference =
      typeof context.transparentThoughtMode === 'boolean'
        ? context.transparentThoughtMode
        : undefined;

    const transparentOverrideValue =
      explicitTransparentPreference === true || debugExplainEnabled || isSuperAdminUser
        ? true
        : explicitTransparentPreference === false
          ? false
          : null;

    const restoreTransparentMode = setTransparentThoughtModeOverride(transparentOverrideValue);

    try {
      let systemPrompt = basePrompt.system;

      if (type === 'greeting') {
        const greeting = getTimeBasedGreeting();
        systemPrompt = [
          SYSTEM_PROMPTS.base,
          `${greeting}! გამოიყენე ეს მისალმება პირველ წინადადებად და მეორე წინადადებაში შესთავაზე ერთი კონკრეტული UI ნაბიჯი ან ბმული CTA-თი.`,
          PRODUCT_GUIDE_CTA_LINE,
        ].join('\n');
      }

      // Add context if available
      if (context.siteContext) {
        systemPrompt += `\n\nკონტექსტი: ${context.siteContext.substring(0, 100)}`;
      }

      return {
        system: systemPrompt,
        tokens: basePrompt.tokens + (context.siteContext ? 25 : 0)
      };
    } finally {
      restoreTransparentMode();
    }
  }

  optimizeForTokens(promptData, maxTokens = 150) {
    if (promptData.tokens <= maxTokens) {
      return promptData;
    }

    // Truncate system prompt if too long
    const truncatedSystem = promptData.system.substring(0, maxTokens * 4); // Rough estimate

    return {
      system: truncatedSystem,
      tokens: maxTokens
    };
  }

  // SOL-203: Enhanced Deep Context Pipeline
  /**
   * Compose system prompt dynamically with advanced context
   */
  composeSystemPrompt(context = {}) {
    const {
      user = null,
      files = [],
      intent = 'general',
      mode = 'chat',
      activeFile = null,
      lastEditedFiles = [],
      consoleErrors = [],
      currentRoute = null,
      featureFlags = {},
      strictGrammarMode = false,
      grammarExampleLimit
    } = context;

    console.log('🎯 SOL-203: Advanced context composition:', { 
      hasUser: !!user, 
      filesCount: files.length, 
      intent, 
      mode,
      hasActiveFile: !!activeFile,
      lastEditedCount: lastEditedFiles.length,
      errorCount: consoleErrors.length
    });

    // SOL-203: Core Role Definition
    const rolePrompt = `${SYSTEM_PROMPTS.base}

**Site Guide Playbook:**
1. ამოიცანი შეკითხვის შესაბამისი გვერდი ან პანელი (დაფა, კალენდარი, საკუთრება, დაჯავშნები, ანგარიშები, ანგარიშსწორება).
2. მიაწოდე მაქსიმუმ ორი მოკლე ინსტრუქცია UI ლეიბელებით (მაგ. "მენიუ → დაჯავშნები → დეტალები").
3. პასუხი დაასრულე პირდაპირი CTA-თი, რომელიც მოუწოდებს მომხმარებელს ზემოთხსენებულ ნაბიჯზე.

**Context Handling:**
- თუ მოგვაწოდეს ფაილის, ლოგის ან კოდის ინფორმაცია, გამოიყენე ის UI ახსნის გასამყარებლად, მაგრამ არ გააზიარო კოდის დეტალები.
- თუ თემა სცდება bakhmaro.co-ს ფუნქციებს, გამოიყენე off-topic პასუხი Contact/Help ბმულით.
- საჭიროების შემთხვევაში მოკლედ შეაჯამე აქტიური გვერდის ან შეცდომის სტატუსი, შემდეგ მიაწოდე CTA.
`;

    // SOL-203: Dynamic Context Collection
    let contextSections = [];

    // Active editor file content
    if (activeFile) {
      contextSections.push(`**📝 Active Editor File:**
Path: ${activeFile.path}
Content Preview:
\`\`\`${activeFile.language || 'text'}
${activeFile.content ? activeFile.content.substring(0, 500) + (activeFile.content.length > 500 ? '...' : '') : 'Empty file'}
\`\`\``);
    }

    // Last 5 edited files with head/tail snippets
    if (lastEditedFiles && lastEditedFiles.length > 0) {
      const recentFiles = lastEditedFiles.slice(0, 5);
      contextSections.push(`**📂 Recently Edited Files (Last 5):**
${recentFiles.map((file, index) => {
  const head = file.content ? file.content.split('\n').slice(0, 3).join('\n') : '';
  const tail = file.content ? file.content.split('\n').slice(-2).join('\n') : '';
  return `${index + 1}. ${file.path}
   └─ Head: ${head.substring(0, 100)}${head.length > 100 ? '...' : ''}
   └─ Tail: ${tail.substring(0, 100)}${tail.length > 100 ? '...' : ''}`;
}).join('\n')}`);
    }

    // Latest console errors (<=50 lines, deduplicated)
    if (consoleErrors && consoleErrors.length > 0) {
      const uniqueErrors = [...new Map(consoleErrors.map(err => [err.message, err])).values()];
      const recentErrors = uniqueErrors.slice(0, 50);
      contextSections.push(`**🚨 Recent Console Errors (${recentErrors.length} unique):**
${recentErrors.map((err, index) => 
  `${index + 1}. [${err.level || 'ERROR'}] ${err.message.substring(0, 150)}${err.message.length > 150 ? '...' : ''}`
).join('\n')}`);
    }

    // Current route/screen and feature flags
    if (currentRoute || Object.keys(featureFlags).length > 0) {
      contextSections.push(`**🛣️ Current Context:**
Route: ${currentRoute || 'Unknown'}
Feature Flags: ${Object.entries(featureFlags).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}`);
    }

    // File context attachments (provided files)
    if (files && files.length > 0) {
      const fileContext = this.buildFileContext(files);
      contextSections.push(`**📎 Attached File Context:**
${fileContext}`);
    }

    // Build final system prompt
    const fullContext = contextSections.length > 0 ? 
      '\n\n' + contextSections.join('\n\n') : '';

    const grammarExamples = strictGrammarMode || mode === 'grammarAware'
      ? `\n\n**📐 Strict Grammar Guidance:**\n${formatGrammarExamples(grammarExampleLimit || 6)}`
      : '';

    return rolePrompt + fullContext + grammarExamples + `

**⚡ Response Requirements:**
SOL-202: Use natural responses. Only structure when user explicitly asks for analysis/debugging.`;
  }

  async buildReplitStyleComponents(context = {}) {
    const result = {
      fileSummary: generateFileListSummary(context.files || [], {
        limit: context.fileLimit || 12
      }),
      services: [],
      launchScript: '',
      logsSection: formatLogsForExpandableSection(context.logs || [], {
        limit: context.logLimit || 20,
        emptyPlaceholder: context.logsPlaceholder || '⚠️ ლოგები არ არის ხელმისაწვდომი'
      })
    };

    try {
      if (!context.skipServiceCheck) {
        result.services = await checkServiceStatuses(context.services || DEFAULT_SERVICE_CONFIG);
      }
    } catch (error) {
      console.error('⚠️ Failed to collect service statuses for Replit-style response', error);
      result.services = [];
    }

    try {
      result.launchScript = generateServiceLaunchScript(context.services || DEFAULT_SERVICE_CONFIG, {
        logsDir: context.logsDir || 'logs',
        exports: context.envExports || []
      });
    } catch (error) {
      console.error('⚠️ Failed to generate launch script for Replit-style response', error);
      result.launchScript = '#!/usr/bin/env bash\necho "⚠️ სკრიპტის გენერაცია ვერ მოხერხდა"';
    }

    return result;
  }

  /**
   * Analyze chat intent for intelligent routing
   */
  analyzeChatIntent(message) {
    console.log('🔍 SOL-203: Analyzing chat intent');
    
    try {
      const intent = analyzeQueryIntent(message);
      return {
        ...intent,
        georgianRequired: /[ა-ჰ]/.test(message),
        confidence: this.calculateIntentConfidence(message, intent)
      };
    } catch (error) {
      console.warn('⚠️ Intent analysis fallback:', error.message);
      // Fallback to legacy classification
      return {
        primary: 'general-help',
        complexity: 'simple',
        georgianRequired: /[ა-ჰ]/.test(message)
      };
    }
  }

  /**
   * Compose dynamic context with RAG-style injection
   */
  composeDynamicContext(fileContext = [], userContext = {}) {
    console.log('🔄 SOL-203: Composing dynamic RAG context');
    
    try {
      const context = {
        timestamp: new Date().toISOString(),
        files: this.processFileContext(fileContext),
        user: this.processUserContext(userContext),
        project: {
          name: 'Bakhmaro Cottages Platform',
          stack: 'React + TypeScript + Node.js + Firebase',
          environment: 'Replit Development'
        }
      };

      // Cache context for future use
      const cacheKey = `ctx_${Date.now()}`;
      this.contextCache.set(cacheKey, context);

      return context;
    } catch (error) {
      console.warn('⚠️ Dynamic context fallback:', error.message);
      return { files: fileContext, user: userContext };
    }
  }

  // Helper methods for SOL-203
  buildFileContext(files) {
    if (!files || files.length === 0) return '';

    let context = '**📁 File Context:**\n';
    files.forEach((file, index) => {
      try {
        const analysis = analyzeFileContext(file.path, file.content);
        context += `${index + 1}. **${file.path}**\n`;
        context += `   - Type: ${analysis.type}\n`;
        context += `   - Language: ${analysis.language}\n`;
        if (analysis.patterns && analysis.patterns.length > 0) {
          context += `   - Patterns: ${analysis.patterns.join(', ')}\n`;
        }
      } catch (error) {
        context += `${index + 1}. **${file.path}** - Analysis failed\n`;
      }
      context += '\n';
    });
    
    return context;
  }

  processFileContext(files) {
    return files.map(file => {
      try {
        return {
          ...file,
          analysis: analyzeFileContext(file.path, file.content)
        };
      } catch (error) {
        return { ...file, analysis: { error: error.message } };
      }
    });
  }

  processUserContext(userContext) {
    try {
      return {
        ...userContext,
        preferences: validateUserPreferences(userContext.preferences),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { ...userContext, processingError: error.message };
    }
  }

  calculateIntentConfidence(message, intent) {
    const keywords = {
      'code-assistance': ['code', 'function', 'component', 'კოდი', 'ფუნქცია'],
      'file-operations': ['file', 'read', 'search', 'ფაილი', 'მოძებნე'],
      'general-help': ['help', 'what', 'how', 'დახმარება', 'რა', 'როგორ']
    };

    const intentKeywords = keywords[intent.primary] || [];
    const matches = intentKeywords.filter(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    return Math.min(0.5 + (matches * 0.2), 1.0);
  }

  // Legacy compatibility - enhanced
  getUsageStats() {
    return {
      totalPrompts: this.usageStats.totalPrompts,
      lastUpdated: this.usageStats.lastUpdated,
      availableTypes: Array.from(this.prompts.keys()),
      // SOL-203 additions
      contextCacheSize: this.contextCache.size,
      userMemoryCacheSize: this.userMemoryCache.size,
      sol203Enabled: true
    };
  }

  // Cleanup methods
  clearCache() {
    this.contextCache.clear();
    this.userMemoryCache.clear();
    console.log('🧹 SOL-203: PromptManager cache cleared');
  }

  // SOL-203: Enhanced context building with active file tracking
  buildFileContext(files) {
    if (!files || files.length === 0) return '';
    
    return files.map((file, index) => {
      const preview = file.content ? file.content.substring(0, 300) : 'Empty file';
      const fileSize = file.content ? file.content.length : 0;
      const lines = file.content ? file.content.split('\n').length : 0;
      
      return `📄 File ${index + 1}: ${file.path}
├─ Size: ${fileSize} chars, ${lines} lines  
├─ Type: ${file.extension || 'unknown'}
└─ Content Preview:
\`\`\`${file.language || file.extension || 'text'}
${preview}${fileSize > 300 ? '\n...' : ''}
\`\`\``;
    }).join('\n\n');
  }

  // SOL-203: Collect dynamic context from various sources
  async collectDynamicContext(options = {}) {
    const {
      activeEditor = null,
      fileHistory = [],
      consoleLogs = [],
      currentRoute = null,
      featureFlags = {}
    } = options;

    const context = {
      activeFile: null,
      lastEditedFiles: [],
      consoleErrors: [],
      currentRoute,
      featureFlags
    };

    // Active editor file content (+ selection)
    if (activeEditor && activeEditor.filePath) {
      try {
        context.activeFile = {
          path: activeEditor.filePath,
          content: activeEditor.content || '',
          selection: activeEditor.selection || null,
          language: this.detectLanguageFromPath(activeEditor.filePath)
        };
      } catch (error) {
        console.warn('⚠️ Failed to collect active editor context:', error.message);
      }
    }

    // Last 5 edited files with head/tail snippets  
    if (fileHistory && fileHistory.length > 0) {
      context.lastEditedFiles = fileHistory
        .filter(file => file.lastModified)
        .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
        .slice(0, 5)
        .map(file => ({
          path: file.path,
          content: file.content || '',
          lastModified: file.lastModified,
          language: this.detectLanguageFromPath(file.path)
        }));
    }

    // Latest console errors (<= 50 lines, deduplicated)
    if (consoleLogs && consoleLogs.length > 0) {
      const errors = consoleLogs
        .filter(log => log.level === 'error' || log.level === 'ERROR')
        .map(log => ({
          message: log.message,
          level: log.level,
          timestamp: log.timestamp,
          source: log.source || 'unknown'
        }));

      // Deduplicate by message content
      const uniqueErrors = [...new Map(errors.map(err => [err.message, err])).values()];
      context.consoleErrors = uniqueErrors
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);
    }

    return context;
  }

  // Helper: detect programming language from file path
  detectLanguageFromPath(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript', 
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    return languageMap[ext] || ext || 'text';
  }
}

module.exports = new PromptManager();
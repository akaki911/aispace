// SOL-203: Enhanced imports for Deep Context Pipeline
const { 
  SYSTEM_PROMPTS, 
  getTimeBasedGreeting, 
  composeBasePrompt 
} = require('../context/system_prompts');

const { 
  createUserMemory, 
  validateUserPreferences 
} = require('../context/user_preferences');

const { 
  composeProjectContext,
  analyzeQueryIntent,
  analyzeFileContext
} = require('../context/code_context');

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
      system: 'თქვენ ხართ "გურულო" - ბახმაროს ბუკინგ პლატფორმის AI ასისტენტი. პასუხობთ ქართულად, ბუნებრივად და მოკლედ. მარტივ greeting-ებზე მარტივად ეპასუხეთ.',
      tokens: 50
    });

    this.prompts.set('code_analysis', {
      system: 'თქვენ ხართ კოდის ანალიზის ექსპერტი ბახმაროს პლატფორმისთვის. ახსენით კოდის ფუნქციონალობა ქართულად.',
      tokens: 60
    });

    this.prompts.set('site_overview', {
      system: 'ახსენით ბახმაროს ბუკინგ პლატფორმის ფუნქციები: კოტეჯები, სასტუმროები, ტრანსპორტი, ბრონირების სისტემა.',
      tokens: 40
    });

    this.prompts.set('greeting', {
      system: 'ᲛᲐᲠᲢᲘᲕᲘ GREETING: ეპასუხეთ "გამარჯობა! რით შემიძლია დაგეხმარო?" ან მსგავსი მეგობრული greeting ქართულად. არაფერი სხვა, მხოლოდ მარტივი ქართული მისალმება.',
      tokens: 30
    });

    this.usageStats.totalPrompts = this.prompts.size;
  }

  classifyAndGetPrompt(message, context = {}) {
    const lowerMessage = message.toLowerCase();

    // Smart classification based on content
    if (lowerMessage.includes('კოდი') || lowerMessage.includes('ფაილი') || lowerMessage.includes('ფუნქცია')) {
      return this.getPrompt('code_analysis', context);
    }

    if (/^(გამარჯობა|hello|hi)\s*[!?]*$/i.test(lowerMessage)) {
      return this.getPrompt('greeting', context);
    }

    if (lowerMessage.includes('რა არის') || lowerMessage.includes('აღწერა')) {
      return this.getPrompt('site_overview', context);
    }

    return this.getPrompt('general', context);
  }

  getPrompt(type, context = {}) {
    const basePrompt = this.prompts.get(type) || this.prompts.get('general');

    let systemPrompt = basePrompt.system;

    // Add context if available
    if (context.siteContext) {
      systemPrompt += `\n\nკონტექსტი: ${context.siteContext.substring(0, 100)}`;
    }

    return {
      system: systemPrompt,
      tokens: basePrompt.tokens + (context.siteContext ? 25 : 0)
    };
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
      featureFlags = {}
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
    const rolePrompt = `** გურულო - Senior Full-Stack Engineer for Bakhmaro Platform **

თქვენ ხართ Bakhmaro Cottages Platform-ის მთავარი Senior Full-Stack Engineer, სპეციალიზება:

**🎯 Role & Style (SOL-203 Compliance):**
- Role: Senior Full-Stack Engineer for Bakhmaro Platform
- Language: Georgian for final answers, English for code comments when appropriate  
- Style: precise, step-by-step, numbered fixes, NO filler text
- Response Format: Always include 📋 ანალიზი, 🔧 ტექნიკური გადაწყვეტები, ✅ კონკრეტული ნაბიჯები

**🏗️ Tech Stack Expertise:**
- Frontend: React 18 + TypeScript + Vite (port 5000)
- Backend: Node.js + Express (port 5002) 
- AI Service: Groq LLaMA (port 5001)
- Database: Firebase Firestore + Redis sessions
- Auth: WebAuthn + Firebase Auth (dual system)
- Deployment: Replit platform
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

    return rolePrompt + fullContext + `

**⚡ Response Requirements:**
SOL-202: Use natural responses. Only structure when user explicitly asks for analysis/debugging.`;
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

class EnhancedErrorHandler {
  constructor() {
    // Initialize SSE client
    this.sseEmitter = null;
    this.initializeSSEConnection();
    
    this.errorMessages = {
      ka: {
        AI_SERVICE_UNAVAILABLE: "AI სერვისი ამჟამად მიუწვდომელია. სცადეთ მოგვიანებით.",
        GROQ_CONNECTION_ERROR: "Groq API-სთან კავშირის შეცდომა. შეამოწმეთ ქსელის მდგომარეობა.",
        MEMORY_STORAGE_ERROR: "მეხსიერების შენახვაში შეცდომა. მონაცემები შესაძლოა დროებით მიუწვდომელი იყოს.",
        INVALID_USER_ID: "არასწორი მომხმარებლის იდენტიფიკატორი.",
        PROMPT_PROCESSING_ERROR: "მოთხოვნის დამუშავებაში შეცდომა. სცადეთ თავიდან.",
        STREAMING_ERROR: "სტრიმინგის შეცდომა. გადავირთოთ ჩვეულებრივ რეჟიმზე.",
        CACHE_ERROR: "კეშის შეცდომა. სისტემა განაგრძობს მუშაობას ნორმალურად.",
        VALIDATION_ERROR: "შეყვანილი მონაცემების ვალიდაციის შეცდომა.",
        RATE_LIMIT_EXCEEDED: "მოთხოვნების ლიმიტი გადაჭარბებულია. დაელოდეთ და სცადეთ ხელახლა.",
        UNKNOWN_ERROR: "გაუთვალისწინებელი შეცდომა. დაუკავშირდით ტექნიკურ მხარდაჭერას."
      },
      en: {
        AI_SERVICE_UNAVAILABLE: "AI service is currently unavailable. Please try again later.",
        GROQ_CONNECTION_ERROR: "Connection error with Groq API. Please check your network connection.",
        MEMORY_STORAGE_ERROR: "Error storing memory. Data may be temporarily unavailable.",
        INVALID_USER_ID: "Invalid user identifier.",
        PROMPT_PROCESSING_ERROR: "Error processing request. Please try again.",
        STREAMING_ERROR: "Streaming error. Switching to normal mode.",
        CACHE_ERROR: "Cache error. System continues to operate normally.",
        VALIDATION_ERROR: "Input validation error.",
        RATE_LIMIT_EXCEEDED: "Request rate limit exceeded. Please wait and try again.",
        UNKNOWN_ERROR: "Unexpected error. Please contact technical support."
      }
    };

    this.errorCodes = {
      AI_SERVICE_UNAVAILABLE: 503,
      GROQ_CONNECTION_ERROR: 502,
      MEMORY_STORAGE_ERROR: 500,
      INVALID_USER_ID: 400,
      PROMPT_PROCESSING_ERROR: 422,
      STREAMING_ERROR: 500,
      CACHE_ERROR: 500,
      VALIDATION_ERROR: 400,
      RATE_LIMIT_EXCEEDED: 429,
      UNKNOWN_ERROR: 500
    };

    this.errorLog = [];
    this.maxLogSize = 1000;
    
    console.log('🛡️ Enhanced Error Handler initialized with Georgian i18n support');
  }

  // Enhanced error creation with context
  createError(errorType, details = {}, language = 'ka') {
    const timestamp = new Date().toISOString();
    const errorCode = this.errorCodes[errorType] || 500;
    const message = this.errorMessages[language]?.[errorType] || this.errorMessages.ka[errorType];

    const error = {
      type: errorType,
      code: errorCode,
      message,
      details,
      timestamp,
      language,
      id: this.generateErrorId(),
      context: {
        service: 'ai-service',
        version: '2.0',
        ...details.context
      }
    };

    this.logError(error);
    return error;
  }

  // Enhanced error validation with schema checking
  validateAndEnhanceError(error, userContext = {}) {
    try {
      // Detect if it's a Georgian text processing context
      const isGeorgianContext = this.detectGeorgianContext(error, userContext);
      const language = isGeorgianContext ? 'ka' : 'en';

      // Enhanced error categorization
      const enhancedError = this.categorizeError(error, language);

      // Add user-friendly suggestions
      enhancedError.suggestions = this.generateSuggestions(enhancedError.type, language);

      // Add recovery actions
      enhancedError.recovery = this.generateRecoveryActions(enhancedError.type, language);

      return enhancedError;
    } catch (validationError) {
      console.error('❌ Error validation failed:', validationError);
      return this.createError('UNKNOWN_ERROR', { originalError: error.message });
    }
  }

  // Detect Georgian context from error and user data
  detectGeorgianContext(error, userContext) {
    const georgianPatterns = [
      /[\u10A0-\u10FF]/, // Georgian Unicode range
      /სცადეთ|შეცდომა|ვერ|არ|მუშაობს|პრობლემა/,
      /გამარჯობა|მადლობა|დახურვა|შენახვა/
    ];

    const errorText = JSON.stringify(error).toLowerCase();
    const contextText = JSON.stringify(userContext).toLowerCase();
    const combined = errorText + ' ' + contextText;

    return georgianPatterns.some(pattern => pattern.test(combined));
  }

  // Enhanced error categorization
  categorizeError(error, language = 'ka') {
    const errorMessage = error.message || error.toString().toLowerCase();

    // Network/Connection errors
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || 
        errorMessage.includes('timeout') || errorMessage.includes('502')) {
      return this.createError('GROQ_CONNECTION_ERROR', { originalError: error }, language);
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return this.createError('RATE_LIMIT_EXCEEDED', { originalError: error }, language);
    }

    // Memory/Storage errors
    if (errorMessage.includes('memory') || errorMessage.includes('storage') || 
        errorMessage.includes('firestore')) {
      return this.createError('MEMORY_STORAGE_ERROR', { originalError: error }, language);
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || 
        errorMessage.includes('400')) {
      return this.createError('VALIDATION_ERROR', { originalError: error }, language);
    }

    // Streaming errors
    if (errorMessage.includes('stream') || errorMessage.includes('sse')) {
      return this.createError('STREAMING_ERROR', { originalError: error }, language);
    }

    // AI Service unavailable
    if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
      return this.createError('AI_SERVICE_UNAVAILABLE', { originalError: error }, language);
    }

    // Default to unknown error
    return this.createError('UNKNOWN_ERROR', { originalError: error }, language);
  }

  // Generate user-friendly suggestions
  generateSuggestions(errorType, language = 'ka') {
    const suggestions = {
      ka: {
        AI_SERVICE_UNAVAILABLE: [
          "შეამოწმეთ ინტერნეტ კავშირი",
          "სცადეთ გვერდის განახლება",
          "დაელოდეთ რამდენიმე წუთი და სცადეთ ხელახლა"
        ],
        GROQ_CONNECTION_ERROR: [
          "შეამოწმეთ ქსელის მდგომარეობა",
          "გამორთეთ VPN თუ გამოიყენებთ",
          "სცადეთ მოგვიანებით"
        ],
        MEMORY_STORAGE_ERROR: [
          "მონაცემები დროებით შეინახება ლოკალურად",
          "სცადეთ მოგვიანებით სინქრონიზაცია",
          "დარწმუნდით რომ Firebase კავშირი სტაბილურია"
        ],
        VALIDATION_ERROR: [
          "შეამოწმეთ შეყვანილი ინფორმაცია",
          "დარწმუნდით ყველა ველის სისწორეში",
          "გამოიყენეთ ვალიდური ფორმატი"
        ],
        RATE_LIMIT_EXCEEDED: [
          "დაელოდეთ 1-2 წუთი",
          "შეამცირეთ მოთხოვნების სისწრაფე",
          "სცადეთ ნაკლები რთული შეკითხვები"
        ]
      },
      en: {
        AI_SERVICE_UNAVAILABLE: [
          "Check your internet connection",
          "Try refreshing the page",
          "Wait a few minutes and try again"
        ],
        GROQ_CONNECTION_ERROR: [
          "Check your network connection",
          "Disable VPN if you're using one",
          "Try again later"
        ],
        MEMORY_STORAGE_ERROR: [
          "Data will be stored locally temporarily",
          "Try synchronizing later",
          "Ensure Firebase connection is stable"
        ],
        VALIDATION_ERROR: [
          "Check the entered information",
          "Ensure all fields are correct",
          "Use valid format"
        ],
        RATE_LIMIT_EXCEEDED: [
          "Wait 1-2 minutes",
          "Reduce request frequency",
          "Try simpler queries"
        ]
      }
    };

    return suggestions[language]?.[errorType] || suggestions.ka.UNKNOWN_ERROR || [];
  }

  // Generate recovery actions
  generateRecoveryActions(errorType, language = 'ka') {
    const actions = {
      ka: {
        AI_SERVICE_UNAVAILABLE: {
          retry: true,
          retryDelay: 5000,
          fallback: "ოფლაინ რეჟიმზე გადართვა",
          contact: "ტექნიკური მხარდაჭერა: support@bakhmaro.com"
        },
        GROQ_CONNECTION_ERROR: {
          retry: true,
          retryDelay: 3000,
          fallback: "ლოკალური მოდელის გამოყენება",
          contact: null
        },
        MEMORY_STORAGE_ERROR: {
          retry: true,
          retryDelay: 2000,
          fallback: "ლოკალური მეხსიერების გამოყენება",
          contact: null
        }
      },
      en: {
        AI_SERVICE_UNAVAILABLE: {
          retry: true,
          retryDelay: 5000,
          fallback: "Switch to offline mode",
          contact: "Technical support: support@bakhmaro.com"
        },
        GROQ_CONNECTION_ERROR: {
          retry: true,
          retryDelay: 3000,
          fallback: "Use local model",
          contact: null
        },
        MEMORY_STORAGE_ERROR: {
          retry: true,
          retryDelay: 2000,
          fallback: "Use local memory",
          contact: null
        }
      }
    };

    return actions[language]?.[errorType] || actions.ka.UNKNOWN_ERROR || {};
  }

  // Enhanced error logging
  logError(error) {
    // Add to error log
    this.errorLog.push(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Console logging with emojis for better visibility
    const logLevel = this.getLogLevel(error.code);
    const emoji = this.getErrorEmoji(error.type);
    
    console.error(`${emoji} [${logLevel}] ${error.type}:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp
    });

    // Emit to real-time SSE stream (non-blocking)
    this.emitErrorToSSE(error).catch(err => {
      // Silently handle SSE emission errors to avoid recursion
    });
  }

  getLogLevel(code) {
    if (code >= 500) return 'CRITICAL';
    if (code >= 400) return 'ERROR';
    if (code >= 300) return 'WARNING';
    return 'INFO';
  }

  getErrorEmoji(errorType) {
    const emojis = {
      AI_SERVICE_UNAVAILABLE: '🚫',
      GROQ_CONNECTION_ERROR: '🔌',
      MEMORY_STORAGE_ERROR: '💾',
      INVALID_USER_ID: '👤',
      PROMPT_PROCESSING_ERROR: '⚙️',
      STREAMING_ERROR: '🌊',
      CACHE_ERROR: '💨',
      VALIDATION_ERROR: '⚠️',
      RATE_LIMIT_EXCEEDED: '⏱️',
      UNKNOWN_ERROR: '❓'
    };
    return emojis[errorType] || '❌';
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get error statistics
  getErrorStats() {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    const recentErrors = this.errorLog.filter(err => 
      new Date(err.timestamp).getTime() > hourAgo
    );

    const errorTypes = {};
    recentErrors.forEach(err => {
      errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
    });

    return {
      totalErrors: this.errorLog.length,
      recentErrors: recentErrors.length,
      errorTypes,
      lastError: this.errorLog[this.errorLog.length - 1] || null
    };
  }

  // Clear error log
  clearErrorLog() {
    const count = this.errorLog.length;
    this.errorLog = [];
    console.log(`🧹 Cleared ${count} error log entries`);
    return count;
  }

  // Initialize SSE connection to backend
  async initializeSSEConnection() {
    try {
      // Use fetch to get backend URL and setup connection
      // Environment-aware BACKEND_URL configuration for production robustness
      this.backendUrl = process.env.BACKEND_URL || 
        (process.env.NODE_ENV === 'production' 
          ? process.env.REPLIT_URL?.replace(':443', ':5002') || 'http://127.0.0.1:5002'
          : 'http://127.0.0.1:5002');
      console.log(`🔌 Enhanced Error Handler: SSE connection initialized to ${this.backendUrl}`);
      
      // Validate production configuration
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.BACKEND_URL) {
          console.warn('⚠️ BACKEND_URL not set in production - may cause emission failures');
        }
        if (!process.env.AI_SERVICE_TOKEN) {
          console.error('❌ CRITICAL: AI_SERVICE_TOKEN missing in production - error emission will fail');
        }
      }
    } catch (error) {
      console.warn('⚠️ Enhanced Error Handler: Could not initialize SSE connection:', error.message);
    }
  }

  // Emit error to real-time SSE stream
  async emitErrorToSSE(error) {
    try {
      if (!this.backendUrl) {
        return; // SSE not available
      }

      // Prepare error payload for SSE
      const payload = {
        error: {
          id: error.id,
          type: error.type,
          code: error.code,
          message: error.message,
          level: this.getLogLevel(error.code).toLowerCase(),
          timestamp: error.timestamp,
          language: error.language,
          suggestions: error.suggestions,
          recovery: error.recovery,
          context: error.context,
          emoji: this.getErrorEmoji(error.type)
        }
      };

      // Send POST request to backend SSE emitter - environment-aware endpoint
      const endpoint = process.env.NODE_ENV === 'production' 
        ? '/api/memory/errors'  // Production secure endpoint
        : '/api/memory/_debug/emit-error';  // Development debug endpoint
      
      const response = await fetch(`${this.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': process.env.AI_SERVICE_TOKEN,
        },
        body: JSON.stringify({
          code: error.type,
          message: error.message,
          level: this.getLogLevel(error.code).toLowerCase(),
          georgian_message: error.language === 'ka' ? error.message : this.errorMessages.ka[error.type],
          english_message: error.language === 'en' ? error.message : this.errorMessages.en[error.type],
          suggestions: error.suggestions,
          recovery: error.recovery,
          context: error.context,
          emoji: this.getErrorEmoji(error.type)
        })
      });

      if (response.ok) {
        console.log('📡 Error emitted to SSE stream:', error.id);
      }
    } catch (sseError) {
      // Don't log SSE errors to avoid recursion
      console.warn('⚠️ Could not emit to SSE:', sseError.message);
    }
  }

  // Emit Georgian error notification
  async emitGeorgianErrorNotification(error) {
    const georgianError = {
      ...error,
      georgian_message: this.errorMessages.ka[error.type] || error.message,
      english_message: this.errorMessages.en[error.type] || error.message,
      suggestions: this.generateSuggestions(error.type, 'ka'),
      recovery: this.generateRecoveryActions(error.type, 'ka')
    };

    await this.emitErrorToSSE(georgianError);
  }
}

module.exports = new EnhancedErrorHandler();

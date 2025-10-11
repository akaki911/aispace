
class GeorgianErrorHandler {
  constructor() {
    this.errorMessages = {
      // Connection errors
      CONNECTION_FAILED: 'კავშირი ვერ დამყარდა AI სერვისთან',
      TIMEOUT_ERROR: 'დრო ამოიწურა - სცადეთ ხელახლა',
      NETWORK_ERROR: 'ქსელის შეცდომა - შეამოწმეთ ინტერნეტ კავშირი',
      
      // Authentication errors
      AUTH_FAILED: 'ავტორიზაცია ვერ მოხერხდა',
      ACCESS_DENIED: 'წვდომა უარყოფილია',
      INVALID_TOKEN: 'არასწორი ავტორიზაციის ტოკენი',
      
      // AI Service errors
      AI_SERVICE_UNAVAILABLE: 'AI სერვისი დროებით მიუწვდომელია',
      GROQ_API_ERROR: 'Groq API-ს შეცდომა',
      MEMORY_SYNC_FAILED: 'მეხსიერების სინქრონიზაცია ვერ მოხერხდა',
      
      // Validation errors
      INVALID_INPUT: 'არასწორი შეყვანა',
      EMPTY_MESSAGE: 'შეტყობინება ცარიელია',
      MESSAGE_TOO_LONG: 'შეტყობინება ძალიან გრძელია',
      
      // System errors
      INTERNAL_ERROR: 'სისტემური შეცდომა',
      DATABASE_ERROR: 'მონაცემთა ბაზის შეცდომა',
      FILE_ACCESS_ERROR: 'ფაილზე წვდომის შეცდომა'
    };
    
    this.errorCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      408: 'TIMEOUT',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    };
  }

  // Format error for user display  
  formatError(error, context = {}) {
    let message = this.errorMessages.INTERNAL_ERROR;
    let code = 'UNKNOWN_ERROR';
    
    // Extract real file/function from stack trace instead of using defaults
    let actualFile = 'unknown';
    let actualFunction = 'unknown';
    
    if (error.stack) {
      const stackMatch = error.stack.match(/at\s+(\w+)\s+\(([^:]+):(\d+):(\d+)\)/);
      if (stackMatch) {
        actualFile = stackMatch[2];
        actualFunction = stackMatch[1];
      }
    }
    
    if (error.code && this.errorMessages[error.code]) {
      message = this.errorMessages[error.code];
      code = error.code;
    } else if (error.response && error.response.status) {
      const statusCode = error.response.status;
      code = this.errorCodes[statusCode] || 'HTTP_ERROR';
      message = this.errorMessages[code] || `HTTP შეცდომა: ${statusCode}`;
    } else if (error.message) {
      // Try to match common error patterns
      if (error.message.includes('timeout')) {
        code = 'TIMEOUT_ERROR';
        message = this.errorMessages.TIMEOUT_ERROR;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        code = 'NETWORK_ERROR';
        message = this.errorMessages.NETWORK_ERROR;
      } else if (error.message.includes('unauthorized') || error.message.includes('auth')) {
        code = 'AUTH_FAILED';
        message = this.errorMessages.AUTH_FAILED;
      }
    }
    
    return {
      code,
      message,
      userMessage: `❌ **შეცდომა:** ${message}`,
      context,
      timestamp: new Date().toISOString(),
      originalError: error.message || error.toString()
    };
  }

  // Log error with Georgian context
  logError(error, context = {}) {
    const formattedError = this.formatError(error, context);
    
    console.error('🇬🇪 Georgian Error Handler:', {
      code: formattedError.code,
      message: formattedError.message,
      context: formattedError.context,
      originalError: formattedError.originalError,
      timestamp: formattedError.timestamp
    });
    
    return formattedError;
  }

  // Get user-friendly error message
  getUserMessage(error, includeRetryInstructions = true) {
    const formatted = this.formatError(error);
    let message = formatted.userMessage;
    
    if (includeRetryInstructions) {
      message += '\n\n🔄 **რეკომენდაცია:**\n';
      message += '• შეამოწმეთ ინტერნეტ კავშირი\n';
      message += '• დაელოდეთ რამდენიმე წამი და სცადეთ ხელახლა\n';
      message += '• თუ პრობლემა გრძელდება, შეატყობინეთ ადმინისტრატორს';
    }
    
    return message;
  }
}

module.exports = new GeorgianErrorHandler();

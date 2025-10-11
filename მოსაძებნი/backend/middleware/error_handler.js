
// error_handler.js - Complete Error Handler with Georgian Localization
// შეცდომების სრულყოფილი მენეჯერი ქართული ლოკალიზაციით

const errorMessages = {
  ka: {
    // Authentication & Authorization Errors
    'Unauthorized': 'ავტორიზაციის შეცდომა - გთხოვთ შეხვიდეთ სისტემაში',
    'Forbidden': 'წვდომა აკრძალულია - არ გაქვთ საკმარისი უფლებები',
    'TokenExpired': 'სესიის ვადა ამოიწურა - ხელახლა შედით სისტემაში',
    'InvalidCredentials': 'არასწორი მონაცემები - შეამოწმეთ იმეილი და პაროლი',
    
    // Validation Errors
    'ValidationError': 'მონაცემების შემოწმების შეცდომა - შეამოწმეთ შეყვანილი ინფორმაცია',
    'MissingFields': 'აუცილებელი ველები არ არის შევსებული',
    'InvalidFormat': 'მონაცემების ფორმატი არასწორია',
    'DataConstraintViolation': 'მონაცემების შეზღუდვის დარღვევა',
    
    // Resource Errors
    'NotFound': 'მოთხოვნილი რესურსი ვერ მოიძებნა',
    'AlreadyExists': 'ეს რესურსი უკვე არსებობს',
    'ResourceUnavailable': 'რესურსი ამჟამად მიუწვდომელია',
    
    // Server Errors
    'ServerError': 'სერვერის შიდა შეცდომა - სცადეთ მოგვიანებით',
    'DatabaseError': 'მონაცემთა ბაზის შეცდომა - სცადეთ ხელახლა',
    'ExternalServiceError': 'გარე სერვისის შეცდომა - სცადეთ მოგვიანებით',
    'ConnectionTimeout': 'კავშირის ვადა ამოიწურა',
    
    // Business Logic Errors
    'BookingConflict': 'ბრონირების კონფლიქტი - ეს თარიღი უკვე დაკავებულია',
    'InsufficientFunds': 'არასაკმარისი თანხა ანგარიშზე',
    'BookingNotAllowed': 'ბრონირება ამ პირობებში შეუძლებელია',
    'PaymentFailed': 'გადახდა ვერ განხორციელდა',
    
    // Generic Fallback
    'GenericError': 'მოხდა გაუთვალისწინებელი შეცდომა - სცადეთ ხელახლა',
    'UnknownError': 'უცნობი შეცდომა - დაუკავშირდით ადმინისტრაციას'
  }
};

// Custom Error Classes for better error handling
class AppError extends Error {
  constructor(message, statusCode, errorType = 'GenericError') {
    super(message);
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'ValidationError');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'Unauthorized');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'Forbidden');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NotFound');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'AlreadyExists');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DatabaseError');
  }
}

// Main Error Handler Middleware
function errorHandler(err, req, res, next) {
  // Get language preference (default to Georgian)
  const lang = req.headers['accept-language']?.includes('en') ? 'en' : 'ka';
  
  let statusCode = 500;
  let errorType = 'GenericError';
  let details = null;
  
  // Log the error for debugging
  console.error(`[ERROR] ${new Date().toISOString()}:`, {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Handle custom AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorType = err.errorType;
    details = err.details || null;
  }
  // Handle Mongoose/MongoDB validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'ValidationError';
    details = Object.values(err.errors).map(e => e.message);
  }
  // Handle Mongoose CastError (invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorType = 'InvalidFormat';
    details = `Invalid ${err.path}: ${err.value}`;
  }
  // Handle MongoDB duplicate key error
  else if (err.code === 11000) {
    statusCode = 409;
    errorType = 'AlreadyExists';
    const field = Object.keys(err.keyValue)[0];
    details = `${field} უკვე არსებობს`;
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorType = 'Unauthorized';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorType = 'TokenExpired';
  }
  // Handle Firebase Auth errors
  else if (err.code && err.code.startsWith('auth/')) {
    statusCode = 401;
    errorType = 'InvalidCredentials';
  }
  // Handle known HTTP errors
  else if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode;
    
    switch (statusCode) {
      case 400:
        errorType = 'ValidationError';
        break;
      case 401:
        errorType = 'Unauthorized';
        break;
      case 403:
        errorType = 'Forbidden';
        break;
      case 404:
        errorType = 'NotFound';
        break;
      case 409:
        errorType = 'AlreadyExists';
        break;
      case 429:
        errorType = 'ConnectionTimeout';
        break;
      default:
        errorType = 'ServerError';
    }
  }
  // Handle network/connection errors
  else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    statusCode = 503;
    errorType = 'ExternalServiceError';
  }
  // Unknown errors - fallback to generic server error
  else {
    statusCode = 500;
    errorType = 'GenericError';
  }

  // Get localized error message
  const localizedMessage = errorMessages[lang] && errorMessages[lang][errorType] 
    ? errorMessages[lang][errorType] 
    : errorMessages.ka[errorType] || errorMessages.ka.GenericError;

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      message: localizedMessage,
      type: errorType,
      statusCode: statusCode
    }
  };

  // Add details in development mode or for validation errors
  if (details && (process.env.NODE_ENV === 'development' || statusCode === 400)) {
    errorResponse.error.details = details;
  }

  // Add original error message in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.originalMessage = err.message;
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// 404 Handler for unmatched routes
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

// Async error wrapper
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but don't crash the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Log the error and gracefully shutdown
  process.exit(1);
});

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncErrorHandler,
  
  // Export custom error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError
};

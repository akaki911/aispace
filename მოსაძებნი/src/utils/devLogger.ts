
// Standalone development logger utility functions
export const createDevLogger = (componentName: string) => {
  return {
    logInfo: (message: string, metadata?: any) => {
      console.log(`[INFO][${componentName}] ${message}`, metadata);
    },
    logWarn: (message: string, metadata?: any) => {
      console.warn(`[WARN][${componentName}] ${message}`, metadata);
    },
    logError: (message: string, metadata?: any) => {
      console.error(`[ERROR][${componentName}] ${message}`, metadata);
    },
    logValidation: (message: string, errors?: any) => {
      console.log(`[VALIDATION][${componentName}] ${message}`, errors);
    },
    logFormEvent: (eventType: string, formData?: any) => {
      console.log(`[FORM][${componentName}] Form ${eventType}`, formData);
    },
    logValidationError: (field: string, error: string) => {
      console.log(`[VALIDATION][${componentName}] ${field}: ${error}`);
    }
  };
};

// Standalone logging functions for non-hook contexts
export const devLog = {
  info: (message: string, data?: any) => {
    console.log(`[DEV INFO] ${message}`, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[DEV WARN] ${message}`, data);
  },
  error: (message: string, data?: any) => {
    console.error(`[DEV ERROR] ${message}`, data);
  }
};

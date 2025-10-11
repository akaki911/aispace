import React, { useEffect, useCallback } from 'react';
import { logger } from '../services/loggingService';
import { useAuth } from '../contexts/useAuth';

// Assuming loggingService is imported elsewhere or globally available
// If not, you might need to import it: import * as loggingService from '../services/loggingService';

interface UIErrorDetails {
  formData?: any;
  userAction?: string;
  elementId?: string;
  validationErrors?: string[];
  networkStatus?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface InteractionErrorPayload {
  action: string;
  elementId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

// Placeholder for getMemoryUsage function, assuming it's defined elsewhere
const getMemoryUsage = () => {
  const perf = typeof performance !== 'undefined' ? (performance as Performance & { memory?: { usedJSHeapSize: number } }) : undefined;
  if (!perf?.memory) {
    return 'N/A';
  }
  return `${Math.round(perf.memory.usedJSHeapSize / 1024 / 1024)} MB`;
};

// Placeholder for generateErrorId function, assuming it's defined elsewhere
const generateErrorId = () => {
  return Math.random().toString(36).substring(2, 15);
};

// Placeholder for CapturedError and ErrorContext interfaces, assuming they are defined elsewhere
interface CapturedError {
  id: string;
  timestamp: string;
  timestamp_readable: string;
  message: string;
  stack: string;
  context?: {
    componentName?: string;
    errorType?: string;
    errorCode?: string;
    sourceService?: string;
    filePath?: string;
    functionName?: string;
    lineNumber?: string;
    componentStack?: any[];
    errorDetails?: string;
    errorName?: string;
    reproduction?: string;
  };
  url: string;
  userAgent: string;
  resolved: boolean;
}

interface ErrorContext {
  componentName?: string;
  errorType?: string;
  errorCode?: string;
  sourceService?: string;
  filePath?: string;
  functionName?: string;
  lineNumber?: string;
  componentStack?: any[];
  errorDetails?: string;
  errorName?: string;
  reproduction?: string;
}


export const useUIErrorCapture = (componentName: string) => {
  const { user } = useAuth();
  // Assuming setErrors and config are defined and managed elsewhere,
  // for example, within a context or state management system.
  // These are placeholders for the sake of demonstrating the changes.
  const [errors, setErrors] = React.useState<CapturedError[]>([]);
  const config = { sendToBackend: true }; // Example config

  // Capture form validation errors
  const captureFormError = useCallback((
    error: Error,
    formData?: any,
    validationErrors?: string[]
  ) => {
    const details: UIErrorDetails = {
      formData: formData ? JSON.stringify(formData, null, 2) : undefined,
      validationErrors
    };

    const serializedDetails = JSON.stringify(details, null, 2);
    logger.logError(
      componentName,
      `Form Validation Error: ${error.message} | Details: ${serializedDetails}`,
      error,
      user?.id,
      user?.email,
      `${componentName}_Form`
    );
  }, [componentName, user]);

  // Capture network/API errors
  const captureNetworkError = useCallback((
    error: Error,
    url?: string,
    method?: string,
    status?: number
  ) => {
    const details: UIErrorDetails = {
      networkStatus: `${method || 'GET'} ${url || 'Unknown URL'} - Status: ${status || 'Unknown'}`
    };

    const serializedDetails = JSON.stringify(details, null, 2);
    logger.logError(
      componentName,
      `Network Error: ${error.message} | Details: ${serializedDetails}`,
      error,
      user?.id,
      user?.email,
      `${componentName}_Network`
    );
  }, [componentName, user]);

  // Capture user interaction errors
  const captureInteractionError = useCallback(
    (payload: InteractionErrorPayload) => {
      const details: UIErrorDetails = {
        userAction: payload.action,
        elementId: payload.elementId,
        description: payload.description,
        metadata: payload.metadata,
      };

      const serializedDetails = JSON.stringify(details, null, 2);
      const interactionError = payload.error ?? new Error(payload.description || `Interaction: ${payload.action}`);

      logger.logError(
        componentName,
        `User Interaction: ${payload.action} | Details: ${serializedDetails}`,
        interactionError,
        user?.id,
        user?.email,
        `${componentName}_Interaction`
      );
    },
    [componentName, user]
  );

  // Improved error sending logic
  const sendErrorToBackend = async (errorEntry: CapturedError) => {
    try {
      // Create a comprehensive error payload
      const errorPayload = {
        errorName: errorEntry.context?.errorName || 'UnknownError',
        errorMessage: errorEntry.message || 'No error message provided',
        errorType: errorEntry.context?.errorType || 'FRONTEND_ERROR',
        errorCode: errorEntry.context?.errorCode || 'UNKNOWN_ERROR',
        sourceService: errorEntry.context?.sourceService || 'Frontend',
        filePath: errorEntry.context?.filePath || 'Unknown file',
        functionName: errorEntry.context?.functionName || 'Unknown function',
        lineNumber: errorEntry.context?.lineNumber || 'Unknown line',
        timestamp: errorEntry.timestamp,
        timestamp_readable: errorEntry.timestamp_readable,
        fullStackTrace: errorEntry.stack ? errorEntry.stack.split('\n').filter(line => line.trim()) : [],
        componentStack: errorEntry.context?.componentStack || [],
        url: errorEntry.url,
        userAgent: errorEntry.userAgent,
        environment: import.meta.env.DEV ? 'development' : 'production',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        affectedComponent: errorEntry.context?.componentName || 'Unknown Component',
        memoryUsage: getMemoryUsage(),
        additionalContext: {
          browserInfo: {
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled
          },
          errorDetails: errorEntry.context?.errorDetails || 'No additional details',
          reproduction: errorEntry.context?.reproduction || 'Unknown reproduction steps'
        }
      };

      console.log('📤 Sending error to backend:', errorPayload);

      const response = await fetch('/api/memory/error-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorPayload),
      });

      if (!response.ok) {
        console.warn('Failed to send error to backend:', response.status, response.statusText);
      } else {
        console.log('✅ Error successfully sent to backend');
      }
    } catch (err) {
      console.warn('Error sending to backend:', err);
    }
  };

  // Enhanced captureError function
  const captureError = useCallback(
    (error: Error | unknown, context?: ErrorContext) => {
      console.log('🔍 Error captured:', { error, context });

      if (!error) return;

      // Extract meaningful error information
      let errorMessage = 'Unknown error';
      let errorStack = '';
      let errorName = 'Error';

      if (error instanceof Error) {
        errorMessage = error.message || 'Error occurred';
        errorStack = error.stack || '';
        errorName = error.name || 'Error';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle error objects that aren't instances of Error
        errorMessage = (error as any).message || (error as any).toString() || 'Object error';
        errorStack = (error as any).stack || '';
        errorName = (error as any).name || 'ObjectError';
      }

      // Create error entry with more details
      const errorEntry: CapturedError = {
        id: generateErrorId(),
        timestamp: new Date().toISOString(),
        timestamp_readable: new Date().toLocaleString('ka-GE'),
        message: errorMessage,
        stack: errorStack,
        context: {
          ...context,
          errorName,
          componentName: context?.componentName || 'Unknown Component',
          errorDetails: context?.errorDetails || 'No additional details'
        },
        url: window.location.href,
        userAgent: navigator.userAgent,
        resolved: false
      };

      console.log('📊 Created error entry:', errorEntry);
      setErrors(prev => [errorEntry, ...prev.slice(0, 49)]);

      // Send to backend if possible
      if (config.sendToBackend) {
        sendErrorToBackend(errorEntry).catch(console.warn);
      }
    },
    [config.sendToBackend] // Dependency array includes config.sendToBackend
  );


  // Formatted errors for display
  const getFormattedErrors = useCallback(() => {
    return errors.map(error => {
      // Ensure we always have a meaningful message
      let displayMessage = error.message || 'Unknown error occurred';

      // If message is still empty or generic, try to get more info from context
      if (!displayMessage || displayMessage === 'Unknown error occurred') {
        displayMessage = error.context?.errorDetails ||
                         error.context?.componentName + ' error' ||
                         'Frontend component error';
      }

      return {
        ...error,
        displayMessage,
        shortStack: error.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace available',
        contextInfo: {
          component: error.context?.componentName || 'Unknown Component',
          service: error.context?.sourceService || 'Frontend',
          type: error.context?.errorType || 'FRONTEND_ERROR'
        }
      };
    });
  }, [errors]);


  useEffect(() => {
    // Enhanced error event listener
    const handleError = (event: ErrorEvent) => {
      if (event.error && event.filename?.includes(componentName.toLowerCase())) {
        const locationInfo = `Line: ${event.lineno}, Column: ${event.colno}`;
        logger.logError(
          componentName,
          `Component Error: ${event.error.message} (${locationInfo})`,
          event.error,
          user?.id,
          user?.email,
          event.filename
        );
      }
    };

    // Listen for unhandled promise rejections in this component
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      logger.logError(
        componentName,
        `Unhandled Promise in Component: ${error.message}`,
        error,
        user?.id,
        user?.email,
        `${componentName}_Promise`
      );
    };

    // Monitor for network errors with filtering and retry logic
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const maxRetries = 2;
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await originalFetch(...args);
          const url = args[0]?.toString() || '';

          // Handle all non-2xx responses with appropriate user feedback
          if (response && !response.ok) {
            const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            const error = new Error(errorMessage);

            // Determine severity based on status code
            let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
            let shouldShowToast = true;

            if (response.status >= 500) {
              severity = 'high';
            } else if (response.status === 429) {
              severity = 'medium';

              // Enhanced 429 handling with exponential backoff
              const retryAfter = response.headers.get('Retry-After');
              const backoffDelay = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);

              console.warn(`🚫 Rate limit hit (${response.status}), backing off for ${backoffDelay}ms`);

              // Rate limiting - show user-friendly message with backoff info (only once per component)
              if (!window._rateLimitNotified || Date.now() - window._rateLimitNotified > 60000) {
                window._rateLimitNotified = Date.now();
                window.dispatchEvent(new CustomEvent('ui-error', {
                  detail: {
                    type: 'network',
                    message: `Rate-limited - retrying in ${Math.ceil(backoffDelay/1000)}s`,
                    severity: severity,
                    component: componentName,
                    url: url,
                    retryAfter: backoffDelay
                  }
                }));
              }
              shouldShowToast = false; // Custom message sent

              // Apply exponential backoff with max 3 retries
              if (attempt < Math.min(maxRetries, 3)) {
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                continue; // Retry with backoff
              }

            } else if (response.status === 404) {
              severity = 'low';
              shouldShowToast = false; // Don't show toast for 404 - too noisy
            } else if (response.status >= 400 && response.status < 500) {
              severity = 'medium';
            }

            if (shouldShowToast && response.status !== 404) {
              // Show user-friendly toast for non-2xx responses
              let userMessage = errorMessage;
              if (response.status === 401) {
                userMessage = 'ავტორიზაციის პრობლემა - გთხოვთ შეხვიდეთ ხელახლა';
              } else if (response.status === 403) {
                userMessage = 'წვდომა უარყოფილია';
              } else if (response.status >= 500) {
                userMessage = 'სერვერის შეცდომა - სცადეთ ხელახლა';
              }

              window.dispatchEvent(new CustomEvent('ui-error', {
                detail: {
                  type: 'network',
                  message: userMessage,
                  severity: severity,
                  component: componentName,
                  url: url
                }
              }));
            }

            // Always log for debugging
            captureNetworkError(error, url, args[1]?.method || 'GET', response.status);
          }
          return response;
        } catch (err) {
          lastError = err as Error;
          // Enhanced AbortError filtering - completely silent handling
          if (lastError.name === 'AbortError' ||
              (lastError.message && lastError.message.includes('signal is aborted')) ||
              (lastError.message && lastError.message.includes('user aborted')) ||
              (lastError.message && lastError.message.includes('The user aborted a request'))) {
            // Silent fail for AbortError - don't log or throw
            return Promise.reject(lastError);
          }

          // Retry transient network errors
          const isTransientError = lastError.message?.includes('Failed to fetch') ||
                                  lastError.message?.includes('network') ||
                                  lastError.message?.includes('timeout');

          if (isTransientError && attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 4000); // 1s, 2s, 4s max
            console.log(`🔄 Retrying network request (${attempt + 1}/${maxRetries}) in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
      }

      // Handle the final error after all retries
      const error = lastError ?? new Error('Unknown error');

      // ✅ ფილტრაცია localhost connection errors-ისთვის და GitHub API errors-ის
      const isFilteredError = error.message?.includes('localhost') ||
                              error.message?.includes('ERR_CONNECTION_REFUSED') ||
                              error.message?.includes('Failed to fetch') ||
                              error.message?.includes('404') ||
                              error.message?.includes('AbortError') ||
                              error.message?.includes('github') ||
                              error.message?.includes('ERR_HTTP_RESPONSE_CODE_FAILURE');

      if (!isFilteredError) {
        console.error('🚨 Error captured:', {
          error,
          context: 'Network Fetch',
          details: { url: args[0]?.toString() }
        });

        // უმჯობეს UI feedback გამოიძახებს
        const errorMessage = `ქსელის შეცდომა: ${error.message}`;
        window.dispatchEvent(new CustomEvent('ui-error', {
          detail: {
            type: 'network',
            message: errorMessage,
            severity: 'medium',
            component: componentName,
            url: args[0]?.toString()
          }
        }));

        // Log error to service
        if (typeof logger?.logError === 'function') {
          const fetchDetails = JSON.stringify({ url: args[0]?.toString(), context: 'Network Fetch' }, null, 2);
          logger.logError(
            componentName,
            `Network Fetch Error: ${error.message} | Details: ${fetchDetails}`,
            error,
            user?.id,
            user?.email,
            `${componentName}_Network_Fetch`
          );
        } else {
          console.error(`[${componentName}] Network Fetch Error:`, error);
        }

        // Report to memory system for real-time tracking
        try {
          fetch('/api/memory/report-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: error.message,
              file: componentName,
              timestamp: new Date().toISOString(),
              severity: 'medium',
              resolved: false,
              stackTrace: error.stack,
              context: 'Network Fetch Error'
            })
          }).catch(() => {}); // Silent fail
        } catch (e) {
          // Silent fail for error reporting
        }
      } else if (import.meta.env.DEV) {
        console.debug('🔇 Localhost connection error (filtered):', error.message);
      }

      throw error; // Re-throw the error to maintain original behavior
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.fetch = originalFetch; // Restore original fetch
    };
  }, [componentName, user, captureNetworkError]);

  // Return comprehensive error capture functions
  return {
    captureError,
    captureFormError,
    captureNetworkError,
    captureInteractionError,
    getFormattedErrors // Return formatted errors as well
  };
};
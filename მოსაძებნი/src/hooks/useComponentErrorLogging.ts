import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useLogging } from './useLogging';
import { globalErrorHandler } from '../services/globalErrorHandler';

export const useComponentErrorLogging = (componentName: string) => {
  const { logError, logUIError: logUIInteraction } = useLogging();
  const errorCountRef = useRef(new Map());
  const MAX_ERRORS_PER_MINUTE = 10;

  // Rate limiting for errors
  const shouldLogError = useCallback((errorKey: string) => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    if (!errorCountRef.current.has(errorKey)) {
      errorCountRef.current.set(errorKey, []);
    }

    const errorTimes = errorCountRef.current.get(errorKey);
    // Remove old error times
    const recentErrors = errorTimes.filter((time: number) => time > oneMinuteAgo);

    if (recentErrors.length >= MAX_ERRORS_PER_MINUTE) {
      return false; // Don't log if too many errors
    }

    recentErrors.push(now);
    errorCountRef.current.set(errorKey, recentErrors);
    return true;
  }, []);

  // Automatically log component mount/unmount (only in debug mode)
  useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      console.log(`🔄 ${componentName} mounted`);
    }

    return () => {
      if (import.meta.env.MODE === 'development') {
        console.log(`🔄 ${componentName} unmounted`);
      }
      // Cleanup error tracking
      errorCountRef.current.clear();
    };
  }, [componentName]);

  // Memoized error handlers
  const errorHandlers = useMemo(() => ({
    // Wrap any function with error logging
    wrapFunction: <T extends (...args: any[]) => any>(
      fn: T,
      actionName: string
    ): T => {
      return globalErrorHandler.wrapUIAction(fn, componentName, actionName);
    },

    // Log error manually
    logComponentError: (error: Error, context?: string) => {
      logError(componentName, `${context || 'Component error'}: ${error.message}`, error);
    },

    // Log UI interaction error
    logUIError: (action: string, error?: Error, details?: any) => {
      logUIInteraction(componentName, action, {
        ...(error && {
          errorMessage: error.message,
          errorStack: error.stack
        }),
        ...details
      });
    },

    // Wrap click handlers with automatic error logging
    onClick: (handler: (event: React.MouseEvent) => void | Promise<void>, actionName?: string) => {
      const name = actionName || 'click';
      return async (event: React.MouseEvent) => {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          error && logUIInteraction(componentName, name, {
            ...(error instanceof Error ? {
              errorMessage: error.message,
              errorStack: error.stack
            } : {}),
            eventType: 'click',
            target: (event.target as HTMLElement)?.tagName,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey
          });
          throw error;
        }
      };
    },

    // Wrap form submit handlers
    onSubmit: (handler: (event: React.FormEvent) => void | Promise<void>, actionName?: string) => {
      const name = actionName || 'submit';
      return async (event: React.FormEvent) => {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          const form = event.target as HTMLFormElement;
          const formData = new FormData(form);
          const formFields = Object.fromEntries(formData.entries());

          error && logUIInteraction(componentName, name, {
            ...(error instanceof Error ? {
              errorMessage: error.message,
              errorStack: error.stack
            } : {}),
            eventType: 'submit',
            formAction: form.action,
            formMethod: form.method,
            fieldCount: Object.keys(formFields).length
          });
          throw error;
        }
      };
    },

    // Wrap change handlers
    onChange: (handler: (event: React.ChangeEvent) => void, actionName?: string) => {
      const name = actionName || 'change';
      return (event: React.ChangeEvent) => {
        try {
          handler(event);
        } catch (error) {
          const target = event.target as HTMLInputElement;
          error && logUIInteraction(componentName, name, {
            ...(error instanceof Error ? {
              errorMessage: error.message,
              errorStack: error.stack
            } : {}),
            eventType: 'change',
            inputType: target.type,
            inputName: target.name,
            inputValue: target.type === 'password' ? '[HIDDEN]' : target.value?.substring(0, 50)
          });
          throw error;
        }
      };
    },

    // Wrap async operations
    wrapAsync: async <T>(
      operation: () => Promise<T>,
      operationName: string
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        error && logUIInteraction(componentName, operationName, {
          ...(error instanceof Error ? {
            errorMessage: error.message,
            errorStack: error.stack
          } : {}),
          operationType: 'async'
        });
        throw error;
      }
    }
  }), [componentName, logError, logUIInteraction]);

  return errorHandlers;
};
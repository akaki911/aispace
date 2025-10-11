// Global error handler service
import type { ErrorPayload } from 'vite';
import { logger } from './loggingService';
import { consoleLogger } from '../components/ConsoleLogger';

class GlobalErrorHandler {
  private isInitialized = false;
  private originalConsoleError: typeof console.error = console.error.bind(console);
  private originalConsoleWarn: typeof console.warn = console.warn.bind(console);
  private currentUser: { id?: string; uid?: string; email?: string } | null = null;

  public initialize(): void {
    if (this.isInitialized) return;

    this.setupWindowErrorHandler();
    this.setupUnhandledRejectionHandler();
    this.setupConsoleInterception();
    this.setupViteErrorHandler();
    this.isInitialized = true;

    logger.logAction('GlobalErrorHandler', 'Global error handler initialized with comprehensive error capture');
  }

  private setupWindowErrorHandler(): void {
    // Global JavaScript errors
    window.onerror = (message, source, lineno, colno, error) => {
      const errorMessage = typeof message === 'string' ? message : 'Unknown error';
      const sourceFile = source || 'Unknown file';

      // Log to main logging service
      const correlationId = `${sourceFile}:${lineno ?? 0}:${colno ?? 0}`;
      const userId = this.currentUser?.uid || this.currentUser?.id;
      const userEmail = this.currentUser?.email;

      logger.logError(
        'WindowError',
        `${errorMessage} (Source: ${sourceFile}, Line: ${lineno ?? 0}, Column: ${colno ?? 0})`,
        error || new Error(errorMessage),
        userId,
        userEmail,
        correlationId
      );

      // Also log to console logger with enhanced details
      consoleLogger.addError(
        'frontend',
        `JavaScript Error: ${errorMessage}`,
        error || new Error(errorMessage),
        3000,
        {
          source: sourceFile,
          line: lineno,
          column: colno,
          type: 'WindowError'
        }
      );

      return false; // Don't prevent default browser error handling
    };

    // Resource loading errors (images, scripts, etc.)
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName || 'Unknown';
        const src = (target as any).src || (target as any).href || 'Unknown source';

        const userId = this.currentUser?.uid || this.currentUser?.id;
        const userEmail = this.currentUser?.email;

        logger.logError(
          'ResourceError',
          `Failed to load ${tagName}: ${src}`,
          new Error(`Resource loading failed: ${src}`),
          userId,
          userEmail,
          src
        );
      }
    }, true);
  }

  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      const userId = this.currentUser?.uid || this.currentUser?.id;
      const userEmail = this.currentUser?.email;

      logger.logError(
        'UnhandledPromise',
        `Unhandled Promise Rejection: ${error.message}`,
        error,
        userId,
        userEmail,
        'Promise'
      );

      // Also log to console logger with enhanced details
      consoleLogger.addError(
        'frontend',
        `Unhandled Promise Rejection: ${error.message}`,
        error,
        3000,
        {
          type: 'UnhandledPromise',
          reason: event.reason
        }
      );

      // Don't prevent default to keep browser console logging
      // event.preventDefault();
    });
  }

  private setupConsoleInterception(): void {
    // Store original console methods
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);

    // Rate limiting for console logs to prevent memory issues
    const errorLogQueue = new Map();
    const warnLogQueue = new Map();
    const MAX_SAME_ERRORS = 5;
    const RESET_INTERVAL = 30000; // 30 seconds

    // Intercept console.error with rate limiting
    console.error = (...args: any[]) => {
      // Call original console.error first
      this.originalConsoleError(...args);

      try {
        // Create a hash of the error message for deduplication
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        const messageHash = message.substring(0, 100); // Use first 100 chars as hash

        // Rate limit same errors
        if (errorLogQueue.has(messageHash)) {
          const count = errorLogQueue.get(messageHash);
          if (count >= MAX_SAME_ERRORS) {
            return; // Skip logging if too many same errors
          }
          errorLogQueue.set(messageHash, count + 1);
        } else {
          errorLogQueue.set(messageHash, 1);
          // Clean up old entries after interval - use WeakRef to prevent memory leaks
          const timeoutId = setTimeout(() => {
            try {
              errorLogQueue.delete(messageHash);
            } catch (e) {
              // Silent cleanup failure
            }
          }, RESET_INTERVAL);
          
          // Store timeout reference for cleanup
          if (typeof window !== 'undefined') {
            (window as any).__errorTimeouts = (window as any).__errorTimeouts || new Set();
            (window as any).__errorTimeouts.add(timeoutId);
          }
        }

        // Check if it's a React error or other framework error
        const isReactError = message.includes('React') || message.includes('Warning:');
        const isViteError = message.includes('[vite]') || message.includes('Failed to resolve');

        // Only log if it's an important error
        if (isReactError || isViteError || message.includes('Error') || message.includes('Failed')) {
          const userId = this.currentUser?.uid || this.currentUser?.id;
          const userEmail = this.currentUser?.email;

          logger.logError(
            isReactError ? 'ReactConsoleError' : isViteError ? 'ViteConsoleError' : 'ConsoleError',
            message.substring(0, 500), // Limit message length
            new Error(message.substring(0, 200)),
            userId,
            userEmail,
            'Console'
          );
        }
      } catch (interceptError) {
        // Prevent console interception from causing errors
        this.originalConsoleError('Console interception error:', interceptError);
      }
    };

    // Intercept console.warn with rate limiting
    console.warn = (...args: any[]) => {
      // Call original console.warn first
      this.originalConsoleWarn(...args);

      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        const messageHash = message.substring(0, 100);

        // Rate limit same warnings
        if (warnLogQueue.has(messageHash)) {
          const count = warnLogQueue.get(messageHash);
          if (count >= MAX_SAME_ERRORS) {
            return;
          }
          warnLogQueue.set(messageHash, count + 1);
        } else {
          warnLogQueue.set(messageHash, 1);
          setTimeout(() => warnLogQueue.delete(messageHash), RESET_INTERVAL);
        }

        // Only log significant warnings
        if (message.includes('React') || 
            message.includes('Warning:') || 
            message.includes('deprecated') ||
            message.includes('Memory leak') ||
            message.includes('Performance') ||
            message.includes('MaxListenersExceeded')) {

          const userId = this.currentUser?.uid || this.currentUser?.id;
          const userEmail = this.currentUser?.email;

          logger.logError(
            'ConsoleWarning',
            message.substring(0, 500),
            new Error(message.substring(0, 200)),
            userId,
            userEmail,
            'Console'
          );
        }
      } catch (interceptError) {
        this.originalConsoleWarn('Console warn interception error:', interceptError);
      }
    };
  }

  private setupViteErrorHandler(): void {
    // Listen for Vite HMR errors
    if (import.meta.hot) {
      import.meta.hot.on('vite:error', (payload: ErrorPayload & { id?: string }) => {
        const userId = this.currentUser?.uid || this.currentUser?.id;
        const userEmail = this.currentUser?.email;

        const normalizedError = payload.err instanceof Error
          ? payload.err
          : Object.assign(new Error(payload.err?.message ?? 'Vite error'), {
              stack: (payload.err as { stack?: string }).stack
            });

        logger.logError(
          'ViteHMRError',
          `Vite HMR Error: ${payload.err.message}`,
          normalizedError,
          userId,
          userEmail,
          payload.id || 'HMR'
        );
      });
    }

    // Monitor for build errors in development
    const checkForBuildErrors = () => {
      const viteErrorOverlay = document.querySelector('vite-error-overlay');
      if (viteErrorOverlay) {
        const errorContent = viteErrorOverlay.shadowRoot?.textContent || 'Build error detected';
        const userId = this.currentUser?.uid || this.currentUser?.id;
        const userEmail = this.currentUser?.email;

        logger.logError(
          'ViteBuildError',
          `Build Error: ${errorContent}`,
          new Error(errorContent),
          userId,
          userEmail,
          'Build'
        );
      }
    };

    // Check periodically for Vite error overlays
    setInterval(checkForBuildErrors, 2000);
  }

  public wrapUIAction<T extends (...args: any[]) => any>(
    fn: T,
    componentName: string,
    actionName: string
  ): T {
    return ((...args: Parameters<T>): ReturnType<T> => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return (result.catch(async (error: Error) => {
            await this.logError(error, `${componentName}.${actionName}`);
            throw error;
          }) as unknown) as ReturnType<T>;
        }
        return result;
      } catch (error) {
        void this.logError(error as Error, `${componentName}.${actionName}`);
        throw error;
      }
    }) as T;
  }

  public async logError(error: Error, context: string): Promise<void> {
    const userId = this.currentUser?.uid || this.currentUser?.id;
    const userEmail = this.currentUser?.email;
    const message = `${context}: ${error.message}`;

    await logger.logError(
      'GlobalErrorHandler',
      message,
      error,
      userId,
      userEmail,
      context
    );

    try {
      consoleLogger.addError(
        'frontend',
        message,
        error,
        3000,
        {
          type: 'GlobalError',
          source: context
        }
      );
    } catch (logError) {
      this.originalConsoleError('Failed to log UI error', logError);
    }
  }

  public cleanup(): void {
    if (!this.isInitialized) return;

    // Restore original console methods
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
    }
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
    }

    this.isInitialized = false;
    logger.logAction('GlobalErrorHandler', 'Global error handler cleaned up');
  }

  public setCurrentUser(user: any): void {
    this.currentUser = user;
  }
}

export const globalErrorHandler = new GlobalErrorHandler();

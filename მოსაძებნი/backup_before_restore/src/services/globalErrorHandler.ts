// Global error handler service
import { logger } from './loggingService';
import { consoleLogger } from '../components/ConsoleLogger';

class GlobalErrorHandler {
  private isInitialized = false;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private currentUser: any = null;

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
      logger.logError(
        'WindowError',
        `${errorMessage}`,
        error || new Error(errorMessage),
        undefined,
        undefined,
        sourceFile,
        `Line: ${lineno || 0}, Column: ${colno || 0}`
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

        logger.logError(
          'ResourceError',
          `Failed to load ${tagName}: ${src}`,
          new Error(`Resource loading failed: ${src}`),
          undefined,
          undefined,
          src
        );
      }
    }, true);
  }

  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      logger.logError(
        'UnhandledPromise',
        `Unhandled Promise Rejection: ${error.message}`,
        error,
        undefined,
        undefined,
        'Promise',
        error.stack
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
          logger.logError(
            isReactError ? 'ReactConsoleError' : isViteError ? 'ViteConsoleError' : 'ConsoleError',
            message.substring(0, 500), // Limit message length
            new Error(message.substring(0, 200)),
            undefined,
            undefined,
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

          logger.logError(
            'ConsoleWarning',
            message.substring(0, 500),
            new Error(message.substring(0, 200)),
            undefined,
            undefined,
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
      import.meta.hot.on('vite:error', (payload) => {
        logger.logError(
          'ViteHMRError',
          `Vite HMR Error: ${payload.err.message}`,
          payload.err,
          undefined,
          undefined,
          payload.id || 'HMR',
          payload.err.stack
        );
      });
    }

    // Monitor for build errors in development
    const checkForBuildErrors = () => {
      const viteErrorOverlay = document.querySelector('vite-error-overlay');
      if (viteErrorOverlay) {
        const errorContent = viteErrorOverlay.shadowRoot?.textContent || 'Build error detected';
        logger.logError(
          'ViteBuildError',
          `Build Error: ${errorContent}`,
          new Error(errorContent),
          undefined,
          undefined,
          'Build'
        );
      }
    };

    // Check periodically for Vite error overlays
    setInterval(checkForBuildErrors, 2000);
  }

  private handleError = (error: Error, context?: string): void => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: context || 'Unknown'
    };

    // Skip logging for form validation errors
    if (error.message.includes('validation') || 
        error.message.includes('required') || 
        error.message.includes('აუცილებელია') ||
        context?.includes('validation') ||
        context?.includes('form')) {
      return;
    }

    // Log to console for debugging (only for real errors)
    console.error('Global Error:', errorInfo);

    // Log to our logging service
    logger.logError(
      'GlobalError',
      error.message,
      error,
      undefined,
      undefined,
      context || 'GlobalErrorHandler'
    );
  };

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
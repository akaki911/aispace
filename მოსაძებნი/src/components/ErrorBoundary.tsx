// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../services/loggingService';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorDetails: any) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  parsedErrorDetails?: {
    filePath: string;
    lineNumber: string;
    functionName: string;
    stackTrace: string[];
    timestamp: string;
    errorCode: string;
    sourceService: string;
  };
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught error:', error, errorInfo);

    // Parse error details
    const parsedErrorDetails = this.parseErrorDetails(error, errorInfo);
    
    // Set the parsed details in state
    this.setState({ 
      hasError: true, 
      error, 
      errorInfo,
      parsedErrorDetails 
    });

    if (this.props.onError) {
      this.props.onError(error, {
        componentStack: errorInfo.componentStack?.split('\n').filter(line => line.trim()) || [],
        errorBoundary: this.constructor.name,
        componentName: 'Error Boundary',
        errorType: 'COMPONENT_ERROR',
        errorCode: 'REACT_ERROR_BOUNDARY',
        sourceService: 'Frontend',
        filePath: 'ErrorBoundary.tsx',
        functionName: 'componentDidCatch',
        errorDetails: `React component error: ${error.message}`,
        reproduction: 'Error occurred during component rendering or lifecycle'
      });
    }
  }

  private extractErrorSource(error: Error, componentStack: string): string {
    // Extract the component name from stack
    const stackMatch = componentStack.match(/^\s*in (\w+)/);
    if (stackMatch) {
      return stackMatch[1];
    }

    // Try to extract from error stack
    const errorStackMatch = error.stack?.match(/at (\w+)/);
    if (errorStackMatch) {
      return errorStackMatch[1];
    }

    return 'UnknownComponent';
  }

  private parseErrorDetails(error: Error, errorInfo: ErrorInfo) {
    const timestamp = new Date().toISOString();
    let filePath = 'Unknown file';
    let lineNumber = 'Unknown line';
    let functionName = 'Unknown function';
    let stackTrace: string[] = [];
    let errorCode = 'UNKNOWN_ERROR';
    let sourceService = 'Frontend';

    // Parse stack trace for detailed information
    if (error.stack) {
      const stackLines = error.stack.split('\n').filter(line => line.trim());
      stackTrace = stackLines;

      // Extract file path and line number from first meaningful stack line
      for (const line of stackLines) {
        // Match various stack trace formats
        const fileMatch = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
        const webpackMatch = line.match(/(\w+\.(tsx?|jsx?))\??:(\d+):(\d+)/);

        if (fileMatch) {
          functionName = fileMatch[1] || 'Anonymous';
          filePath = fileMatch[2];
          lineNumber = `${fileMatch[3]}:${fileMatch[4]}`;
          break;
        } else if (simpleMatch) {
          filePath = simpleMatch[1];
          lineNumber = `${simpleMatch[2]}:${simpleMatch[3]}`;
          break;
        } else if (webpackMatch) {
          filePath = webpackMatch[1];
          lineNumber = `${webpackMatch[3]}:${webpackMatch[4]}`;
          break;
        }
      }
    }

    // Determine error code based on error message and type
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      errorCode = 'NETWORK_ERROR';
      sourceService = 'Network';
    } else if (message.includes('firebase') || message.includes('firestore')) {
      errorCode = 'DATABASE_ERROR';
      sourceService = 'Database';
    } else if (message.includes('timeout')) {
      errorCode = 'TIMEOUT_ERROR';
      sourceService = 'Network';
    } else if (message.includes('chunk') || message.includes('loading')) {
      errorCode = 'LOADING_ERROR';
      sourceService = 'Frontend';
    } else if (message.includes('hydration')) {
      errorCode = 'REACT_HYDRATION';
      sourceService = 'React';
    } else if (error.name === 'ChunkLoadError') {
      errorCode = 'CHUNK_LOAD_ERROR';
      sourceService = 'Build System';
    }

    // Determine source service from file path and context
    if (filePath.includes('ai-service') || filePath.includes('/ai/')) {
      sourceService = 'AI Service';
    } else if (filePath.includes('backend') || filePath.includes('/api/')) {
      sourceService = 'Backend';
    } else if (filePath.includes('src/') || filePath.includes('components/') || filePath.includes('.tsx') || filePath.includes('.jsx')) {
      sourceService = 'Frontend';
    } else if (filePath === 'Unknown file' || !filePath || filePath.trim() === '') {
      // Try to determine from error message or component stack
      if (errorInfo?.componentStack) {
        sourceService = 'Frontend';
      } else {
        sourceService = 'Frontend'; // Default to Frontend for browser errors
      }
    }

    return {
      filePath,
      lineNumber,
      functionName,
      stackTrace,
      timestamp,
      errorCode,
      sourceService
    };
  }

  private logErrorContext(error: Error, errorInfo: ErrorInfo) {
    // Log browser and environment info
    const contextInfo = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      memoryUsage: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1048576),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1048576),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576)
      } : 'Not available'
    };

    try {
      logger.logError(
        'ErrorBoundaryContext',
        `Error Context Information`,
        new Error('Context logging'),
        undefined,
        undefined,
        'ErrorBoundary',
        JSON.stringify(contextInfo, null, 2)
      );
    } catch (jsonError) {
      // If JSON.stringify fails, log without the problematic data
      logger.logError(
        'ErrorBoundaryContext',
        `Error Context Information (simplified)`,
        new Error('Context logging'),
        undefined,
        undefined,
        'ErrorBoundary',
        `URL: ${contextInfo.url}, Viewport: ${contextInfo.viewport}, Memory: ${JSON.stringify(contextInfo.memoryUsage)}`
      );
    }
  }

  private extractComponentName(componentStack: string): string {
    // Extract the first component from the stack
    const lines = componentStack.split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^in (\w+)/);
      if (match && match[1] !== 'ErrorBoundary') {
        return match[1];
      }
    }
    return 'Unknown Component';
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private getErrorType(): string {
    if (!this.state.error) return 'UNKNOWN_ERROR';

    const message = this.state.error.message.toLowerCase();
    if (message.includes('firebase')) return 'DATABASE_ERROR';
    if (message.includes('network') || message.includes('fetch')) return 'NETWORK_ERROR';
    if (message.includes('chunk') || message.includes('loading')) return 'LOADING_ERROR';
    if (message.includes('hydration')) return 'REACT_HYDRATION';
    return 'FRONTEND_ERROR';
  }

  private getServiceIcon(errorType: string): string {
    const icons = {
      'DATABASE_ERROR': '🔴',
      'NETWORK_ERROR': '🟡',
      'LOADING_ERROR': '🟠',
      'REACT_HYDRATION': '🟢',
      'FRONTEND_ERROR': '🟢',
      'TIMEOUT_ERROR': '⏱️',
      'CHUNK_LOAD_ERROR': '📦',
      'UNKNOWN_ERROR': '🔴'
    };
    return icons[errorType as keyof typeof icons] || '🔴';
  }

  private getErrorTypeIcon(errorCode: string): string {
    const typeIcons = {
      'NETWORK_ERROR': '🌐',
      'DATABASE_ERROR': '🗄️',
      'TIMEOUT_ERROR': '⏱️',
      'LOADING_ERROR': '📥',
      'CHUNK_LOAD_ERROR': '📦',
      'REACT_HYDRATION': '⚛️',
      'FRONTEND_ERROR': '💻',
      'UNKNOWN_ERROR': '❓'
    };
    return typeIcons[errorCode as keyof typeof typeIcons] || '❓';
  }

  private getSourceServiceBadge(service: string): { color: string; icon: string } {
    const services = {
      'AI Service': { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '🤖' },
      'Backend': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '⚙️' },
      'Frontend': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '💻' },
      'Database': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: '🗄️' },
      'Network': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: '🌐' },
      'React': { color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200', icon: '⚛️' },
      'Build System': { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: '🔧' },
      'Unknown': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: '❓' },
      'Unknown Service': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: '❓' }
    };
    return services[service as keyof typeof services] ||
           { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: '❓' };
  }

  private getErrorDisplayName(errorType: string): string {
    const names = {
      'DATABASE_ERROR': 'მონაცემთა ბაზის შეცდომა',
      'NETWORK_ERROR': 'ქსელის შეცდომა',
      'LOADING_ERROR': 'ჩატვირთვის შეცდომა',
      'REACT_HYDRATION': 'React კომპონენტის შეცდომა',
      'FRONTEND_ERROR': 'Frontend კომპონენტის შეცდომა',
      'UNKNOWN_ERROR': 'უცნობი შეცდომა'
    };
    return names[errorType as keyof typeof names] || 'უცნობი შეცდომა';
  }

  private copyFullErrorDiagnostic = () => {
    const parsed = this.state.parsedErrorDetails;
    const errorData = {
      // Error Overview
      errorName: this.state.error?.name || 'Unknown Error',
      errorMessage: this.state.error?.message || 'No message',
      errorType: this.getErrorType(),
      errorCode: parsed?.errorCode || 'UNKNOWN_ERROR',

      // Location Details
      sourceService: parsed?.sourceService || 'Unknown',
      filePath: parsed?.filePath || 'Unknown file',
      functionName: parsed?.functionName || 'Unknown function',
      lineNumber: parsed?.lineNumber || 'Unknown line',

      // Timing
      timestamp: parsed?.timestamp || new Date().toISOString(),
      timestamp_readable: new Date().toLocaleString('ka-GE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tbilisi'
      }) + ' GMT+4',

      // Stack Information
      fullStackTrace: parsed?.stackTrace || [],
      componentStack: this.state.errorInfo?.componentStack?.split('\n') || [],

      // Environment Context
      url: window.location.href,
      userAgent: navigator.userAgent,
      environment: import.meta.env.MODE || 'unknown',
      viewport: `${window.innerWidth}x${window.innerHeight}`,

      // React Context
      affectedComponent: this.extractComponentName(this.state.errorInfo?.componentStack || ''),

      // Memory Info (if available)
      memoryUsage: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB',
        total: Math.round((performance as any).memory.totalJSHeapSize / 1048576) + 'MB',
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576) + 'MB'
      } : 'Not available'
    };

    navigator.clipboard.writeText(JSON.stringify(errorData, null, 2));
    alert('სრული დიაგნოსტიკური ინფორმაცია დაკოპირდა clipboard-ში');
  };

  private viewInLogs = () => {
    // Open logs tab if available
    const logsTab = document.querySelector('[data-tab="logs"]') as HTMLElement;
    if (logsTab) {
      logsTab.click();
    } else {
      // Try to navigate to logs page
      window.location.href = '/admin/logs';
    }
  };

  render() {
    if (this.state.hasError) {
      const errorType = this.getErrorType();
      const serviceIcon = this.getServiceIcon(errorType);
      const errorDisplayName = this.getErrorDisplayName(errorType);
      const timestamp = new Date().toLocaleString('ka-GE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tbilisi'
      });
      const affectedComponent = this.extractComponentName(this.state.errorInfo?.componentStack || '');

      const parsed = this.state.parsedErrorDetails || this.parseErrorDetails(this.state.error!, this.state.errorInfo!);
      const serviceBadge = this.getSourceServiceBadge(parsed?.sourceService || 'Frontend');
      const errorTypeIcon = this.getErrorTypeIcon(parsed?.errorCode || 'UNKNOWN_ERROR');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-center max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-center mb-6">
              <span className="text-4xl mr-3">{serviceIcon}</span>
              <div className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    {errorDisplayName}
                  </h2>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${serviceBadge.color}`}>
                    {serviceBadge.icon} {parsed?.sourceService || 'Frontend Component'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {timestamp} GMT+4
                </p>
              </div>
            </div>

            {/* Comprehensive Error Details */}
            {this.state.error && parsed && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6 text-left">

                {/* Header with copy button */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{errorTypeIcon}</span>
                    <h3 className="font-semibold text-red-800 dark:text-red-400">
                      {this.state.error.name}: {parsed.errorCode}
                    </h3>
                  </div>
                  <button
                    onClick={this.copyFullErrorDiagnostic}
                    className="text-xs bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-2 rounded transition-colors font-medium"
                  >
                    📋 Copy Full Error
                  </button>
                </div>

                {/* Error Message */}
                <div className="bg-red-100 dark:bg-red-800/30 rounded-md p-3 mb-4">
                  <p className="text-red-700 dark:text-red-300 text-sm font-mono">
                    {this.state.error.message}
                  </p>
                </div>

                {/* File ➤ Function ➤ Line ➤ Time Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                  {/* File & Location Info */}
                  <div className="space-y-3">
                    <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold w-16">📁 File:</span>
                      <span className="font-mono bg-red-100 dark:bg-red-800/50 px-2 py-1 rounded">
                        {parsed.filePath}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold w-16">⚡ Function:</span>
                      <span className="font-mono bg-red-100 dark:bg-red-800/50 px-2 py-1 rounded">
                        {parsed.functionName}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold w-16">📍 Line:</span>
                      <span className="font-mono bg-red-100 dark:bg-red-800/50 px-2 py-1 rounded">
                        {parsed.lineNumber}
                      </span>
                    </div>
                  </div>

                  {/* Timing & Environment */}
                  <div className="space-y-3">
                    <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold w-16">🕐 Time:</span>
                      <span className="font-mono bg-red-100 dark:bg-red-800/50 px-2 py-1 rounded">
                        {new Date(parsed.timestamp).toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' })}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold w-16">🌍 Env:</span>
                      <span className="font-mono bg-red-100 dark:bg-red-800/50 px-2 py-1 rounded">
                        {import.meta.env.MODE || 'unknown'}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold w-16">📦 Component:</span>
                      <span className="font-mono bg-red-100 dark:bg-red-800/50 px-2 py-1 rounded">
                        {affectedComponent}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stack Trace Preview */}
                <details className="group">
                  <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 mb-2 flex items-center">
                    <span className="mr-2 group-open:rotate-90 transition-transform">▶</span>
                    <span className="font-semibold">🔍 Stack Trace ({parsed.stackTrace.length} frames)</span>
                  </summary>
                  <div className="bg-red-100 dark:bg-red-800/30 rounded-md p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap">
                      {parsed.stackTrace.slice(0, 10).map((line, i) => (
                        `${i + 1}. ${line.trim()}`
                      )).join('\n')}
                      {parsed.stackTrace.length > 10 ? `\n... and ${parsed.stackTrace.length - 10} more frames` : ''}
                    </pre>
                  </div>
                </details>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 mb-4">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                🔄 თავიდან ცდა
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  ↻ გვერდის განახლება
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  🏠 მთავარი გვერდი
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-center space-x-4 text-sm">
              <button
                onClick={this.viewInLogs}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
              >
                🔍 ლოგებში ნახვა
              </button>
              <button
                onClick={this.copyFullErrorDiagnostic}
                className="text-green-600 dark:text-green-400 hover:underline flex items-center"
              >
                📋 Full Diagnostic დაკოპირება
              </button>
            </div>

            {/* Developer Info (Expandable) */}
            {import.meta.env.MODE === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center">
                  <span className="mr-2">▶</span> Stack Trace (დეველოპერისთვის)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400 mb-1">Error Stack:</h4>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto border">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400 mb-1">Component Stack:</h4>
                      <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto border">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}

                  {/* Browser Info */}
                  <div>
                    <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400 mb-1">Browser Info:</h4>
                    <div className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded border">
                      <div>URL: {window.location.href}</div>
                      <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
                      <div>User Agent: {navigator.userAgent}</div>
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

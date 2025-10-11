import { useState, useEffect, useRef, useCallback } from 'react';

export interface RealTimeError {
  id: string;
  type: string;
  code: number;
  message: string;
  level: 'critical' | 'error' | 'warning' | 'info';
  timestamp: string;
  language: 'ka' | 'en';
  georgian_message?: string;
  english_message?: string;
  suggestions?: string[];
  recovery?: {
    retry: boolean;
    retryDelay: number;
    fallback: string;
    contact?: string;
  };
  context?: any;
  emoji?: string;
  dismissed?: boolean;
}

export interface ErrorConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  lastReconnectAt?: number;
}

interface UseRealTimeErrorsOptions {
  language?: 'ka' | 'en';
  severity?: 'critical' | 'error' | 'warning' | 'info' | 'all';
  autoConnect?: boolean;
  maxErrors?: number;
}

export const useRealTimeErrors = (options: UseRealTimeErrorsOptions = {}) => {
  const {
    language = 'ka',
    severity = 'all',
    autoConnect = true,
    maxErrors = 100
  } = options;

  const [errors, setErrors] = useState<RealTimeError[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ErrorConnectionStatus>({
    status: 'disconnected'
  });
  const [errorCount, setErrorCount] = useState({
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
    total: 0
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const connectedRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Disconnect function
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    connectedRef.current = false;
    setConnectionStatus({ status: 'disconnected' });
  }, []);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (connectedRef.current || eventSourceRef.current) {
      return; // Already connected
    }

    connectedRef.current = true;
    setConnectionStatus({ status: 'connecting' });

    try {
      const eventSource = new EventSource('/api/memory/realtime-errors', {
        withCredentials: true
      });

      eventSource.onopen = () => {
        console.log('🔗 Real-time error monitor connected');
        setConnectionStatus({ status: 'connected', lastReconnectAt: Date.now() });
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          if (event.type === 'heartbeat') {
            // Keep connection alive
            return;
          }

          const data = JSON.parse(event.data);
          
          if (data.error) {
            const newError: RealTimeError = {
              id: data.error.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: data.error.code || data.error.type || 'UNKNOWN_ERROR',
              code: data.error.code || 500,
              message: language === 'ka' 
                ? (data.error.georgian_message || data.error.message)
                : (data.error.english_message || data.error.message),
              level: data.error.level || 'error',
              timestamp: data.error.timestamp || new Date().toISOString(),
              language,
              georgian_message: data.error.georgian_message,
              english_message: data.error.english_message,
              suggestions: data.error.suggestions || [],
              recovery: data.error.recovery,
              context: data.error.context,
              emoji: data.error.emoji || '❌',
              dismissed: false
            };

            // Filter by severity if specified
            if (severity !== 'all' && newError.level !== severity) {
              return;
            }

            setErrors(prevErrors => {
              const updatedErrors = [newError, ...prevErrors];
              
              // Maintain max errors limit
              if (updatedErrors.length > maxErrors) {
                return updatedErrors.slice(0, maxErrors);
              }
              
              return updatedErrors;
            });

            // Update error counts
            setErrorCount(prevCount => ({
              ...prevCount,
              [newError.level]: prevCount[newError.level] + 1,
              total: prevCount.total + 1
            }));

            console.log('🚨 New real-time error:', newError);
          }
        } catch (parseError) {
          console.error('❌ Failed to parse real-time error:', parseError);
        }
      };

      // Handle different event types
      eventSource.addEventListener('memory-error', (event) => {
        // Handle memory-error events specifically
        eventSource.onmessage?.(event as MessageEvent);
      });

      eventSource.addEventListener('heartbeat', () => {
        // Heartbeat received, connection is alive
      });

      eventSource.onerror = (error) => {
        console.error('❌ Real-time error stream error:', error);
        setConnectionStatus({ status: 'disconnected' });
        connectedRef.current = false;

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectAttempts.current++;
          
          setTimeout(() => {
            if (!connectedRef.current) {
              console.log(`🔄 Attempting error monitor reconnection (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
              connect();
            }
          }, delay);
        } else {
          console.warn('⚠️ Max reconnection attempts reached for error monitor');
        }
      };

      eventSourceRef.current = eventSource;

    } catch (connectionError) {
      console.error('❌ Failed to create error monitor connection:', connectionError);
      setConnectionStatus({ status: 'disconnected' });
      connectedRef.current = false;
    }
  }, [language, severity, maxErrors]);

  // Dismiss error
  const dismissError = useCallback((errorId: string) => {
    setErrors(prevErrors => 
      prevErrors.map(error => 
        error.id === errorId ? { ...error, dismissed: true } : error
      )
    );
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
    setErrorCount({
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
      total: 0
    });
  }, []);

  // Get active (non-dismissed) errors
  const activeErrors = errors.filter(error => !error.dismissed);

  // Get recent errors (last 10 minutes)
  const recentErrors = activeErrors.filter(error => {
    const errorTime = new Date(error.timestamp).getTime();
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    return errorTime > tenMinutesAgo;
  });

  // Force reconnect
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    setTimeout(() => connect(), 1000);
  }, [connect, disconnect]);

  // Test error emission (for debugging)
  const emitTestError = useCallback(async (errorData?: Partial<RealTimeError>) => {
    try {
      const testError = {
        code: errorData?.type || 'TEST_ERROR',
        message: errorData?.message || 'ტესტური შეცდომა / Test error',
        level: errorData?.level || 'error',
        georgian_message: 'ტესტური შეცდომა - ყველაფერი მუშაობს სწორად',
        english_message: 'Test error - everything is working correctly'
      };

      const response = await fetch('/api/memory/_debug/emit-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testError),
      });

      if (response.ok) {
        console.log('✅ Test error emitted successfully');
      } else {
        console.error('❌ Failed to emit test error');
      }
    } catch (error) {
      console.error('❌ Error emitting test error:', error);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);

  return {
    // State
    errors: activeErrors,
    allErrors: errors,
    recentErrors,
    connectionStatus,
    errorCount,

    // Actions
    connect,
    disconnect,
    reconnect,
    dismissError,
    clearErrors,
    emitTestError,

    // Computed
    isConnected: connectionStatus.status === 'connected',
    hasErrors: activeErrors.length > 0,
    hasRecentErrors: recentErrors.length > 0,
    criticalErrors: activeErrors.filter(e => e.level === 'critical'),
    errorSeverity: activeErrors.length > 0 ? Math.max(
      ...activeErrors.map(e => {
        const severityMap = { info: 1, warning: 2, error: 3, critical: 4 };
        return severityMap[e.level] || 1;
      })
    ) : 0
  };
};
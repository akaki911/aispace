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
  source?: string;
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

const calculateErrorCounts = (errorList: RealTimeError[]) => {
  const counts: { critical: number; error: number; warning: number; info: number; total: number } = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
    total: 0
  };

  errorList.forEach((error) => {
    if (error.dismissed) {
      return;
    }

    const severityKey = error.level as 'critical' | 'error' | 'warning' | 'info';
    counts[severityKey] = (counts[severityKey] || 0) + 1;
    counts.total += 1;
  });

  return counts;
};

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
  const [errorCount, setErrorCount] = useState(() => calculateErrorCounts([]));

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const connectedRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const updateErrors = useCallback((updater: (prev: RealTimeError[]) => RealTimeError[]) => {
    setErrors((prev) => {
      const updated = updater(prev);
      setErrorCount(calculateErrorCounts(updated));
      return updated;
    });
  }, []);

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
            const eventId = data.error.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const timestampValue = data.error.timestamp ? new Date(data.error.timestamp) : new Date();
            const normalizedTimestamp = isNaN(timestampValue.getTime())
              ? new Date().toISOString()
              : timestampValue.toISOString();

            const newError: RealTimeError = {
              id: String(eventId),
              type: data.error.type || data.error.code || 'UNKNOWN_ERROR',
              code: typeof data.error.code === 'number'
                ? data.error.code
                : Number(data.error.code) || 500,
              message: language === 'ka'
                ? (data.error.georgian_message || data.error.message)
                : (data.error.english_message || data.error.message),
              level: data.error.level || 'error',
              timestamp: normalizedTimestamp,
              language,
              georgian_message: data.error.georgian_message,
              english_message: data.error.english_message,
              suggestions: data.error.suggestions || [],
              recovery: data.error.recovery,
              context: data.error.context,
              emoji: data.error.emoji || '❌',
              dismissed: false,
              source: data.error.source
            };

            updateErrors((prevErrors) => {
              const existingIndex = prevErrors.findIndex((error) => error.id === newError.id);

              if (existingIndex !== -1) {
                const updated = [...prevErrors];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  ...newError,
                  dismissed: false
                };
                return updated;
              }

              const updatedErrors = [newError, ...prevErrors];

              if (updatedErrors.length > maxErrors) {
                return updatedErrors.slice(0, maxErrors);
              }

              return updatedErrors;
            });

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
  }, [language, maxErrors, updateErrors]);

  // Dismiss error
  const dismissError = useCallback((errorId: string) => {
    updateErrors((prevErrors) =>
      prevErrors.map(error =>
        error.id === errorId ? { ...error, dismissed: true } : error
      )
    );
  }, [updateErrors]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    updateErrors(() => []);
  }, [updateErrors]);

  // Get active (non-dismissed) errors
  const activeErrors = errors.filter(error => !error.dismissed);
  const filteredErrors = activeErrors.filter(error => severity === 'all' || error.level === severity);

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

  // Load recent errors on mount so UI has context immediately
  useEffect(() => {
    let isMounted = true;

    const fetchRecentErrors = async () => {
      try {
        const response = await fetch('/api/memory/errors');
        if (!response.ok) {
          throw new Error(`Failed to fetch recent errors: ${response.status}`);
        }

        const payload = await response.json();

        if (!payload?.success || !Array.isArray(payload.data)) {
          throw new Error('Unexpected error response format');
        }

        if (!isMounted) {
          return;
        }

        const normalized = payload.data.map((error: any) => {
          const baseMessage = typeof error.message === 'string' ? error.message : '';
          const georgianMessage = error.georgian_message || error.georgianMessage;
          const englishMessage = error.english_message || error.englishMessage;

          return {
            id: String(error.id || `${error.timestamp || Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            type: error.type || error.code || 'UNKNOWN_ERROR',
            code: Number(error.code) || 500,
            message: georgianMessage || englishMessage || baseMessage,
            level: (error.level || 'error') as RealTimeError['level'],
            timestamp: error.timestamp || new Date().toISOString(),
            language: (error.language === 'en' ? 'en' : 'ka'),
            georgian_message: georgianMessage,
            english_message: englishMessage,
            suggestions: error.suggestions || [],
            recovery: error.recovery,
            context: error.context,
            emoji: error.emoji || '❌',
            dismissed: Boolean(error.dismissed) || false,
            source: error.source
          } as RealTimeError;
        }).slice(0, maxErrors);

        updateErrors(() => normalized);
      } catch (fetchError) {
        console.error('❌ Failed to fetch recent errors:', fetchError);
      }
    };

    fetchRecentErrors();

    return () => {
      isMounted = false;
    };
  }, [maxErrors, updateErrors]);

  // Update localized message when language changes
  useEffect(() => {
    updateErrors((prevErrors) =>
      prevErrors.map(error => ({
        ...error,
        message: language === 'ka'
          ? (error.georgian_message || error.message)
          : (error.english_message || error.message),
        language
      }))
    );
  }, [language, updateErrors]);

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
    errors: filteredErrors,
    allErrors: activeErrors,
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
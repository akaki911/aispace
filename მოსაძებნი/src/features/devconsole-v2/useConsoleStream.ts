import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { storage } from './storage';
import { useDevConsole } from '../../contexts/useDevConsole';
import type { LogEntry } from '../../contexts/DevConsoleContext.types';
import type { SystemMetrics } from './types';
import { fetchAdminLogs, type AdminLogEntry } from '../../services/adminLogsApi';

let logSequence = 0;
const nextLogId = (prefix: string) => {
  logSequence = (logSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}-${Date.now()}-${logSequence.toString(36)}`;
};

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  lastReconnectAt?: number;
}

const MAX_BUFFER_SIZE = 100000;

const resolveApiBase = (): string => {
  const metaBase = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE : undefined;
  const envBase = typeof process !== 'undefined' ? process.env?.VITE_API_BASE : undefined;
  const raw = metaBase ?? envBase ?? '/api';
  if (!raw) return '/api';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

// Debounce utility for repetitive logs (available if needed)
// const useDebounce = (value: any, delay: number) => {
//   const [debouncedValue, setDebouncedValue] = useState(value);
//   useEffect(() => {
//     const handler = setTimeout(() => setDebouncedValue(value), delay);
//     return () => clearTimeout(handler);
//   }, [value, delay]);
//   return debouncedValue;
// };

const mapSeverityToLevel = (severity: string): 'info' | 'warn' | 'error' => {
  const normalized = (severity || '').toUpperCase();
  if (normalized.includes('ERR') || normalized === 'CRITICAL' || normalized === 'ALERT' || normalized === 'EMERGENCY') {
    return 'error';
  }
  if (normalized.includes('WARN')) {
    return 'warn';
  }
  return 'info';
};

const buildFunctionLogEntry = (log: AdminLogEntry): LogEntry | null => {
  const timestamp = new Date(log.timestamp).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return {
    ts: timestamp,
    source: 'functions',
    level: mapSeverityToLevel(log.severity),
    message: log.text || '',
    meta: {
      functionName: log.functionName,
      executionId: log.executionId,
      latencyMs: log.latencyMs,
      severity: log.severity,
      traceId: log.traceId,
      labels: log.labels,
    },
    id: log.executionId
      ? `functions-${log.executionId}`
      : nextLogId('functions'),
  };
};

export const useConsoleStream = (filters?: any) => {
  // ✅ Use context instead of local state for persistence
  const {
    logs,
    setLogs,
    connectionStatus,
    setConnectionStatus,
    bufferSize,
    setBufferSize,
    droppedPercentage,
    setDroppedPercentage,
    isLoadingFromCache,
    setIsLoadingFromCache
  } = useDevConsole();

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const totalReceived = useRef(0);
  const totalDropped = useRef(0);
  const apiBase = useMemo(() => resolveApiBase(), []);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  // ✅ Single connection guard for StrictMode
  const connectedRef = useRef(false);
  const seededRef = useRef(false);

  // Note: Debouncing available via useDebounce utility if needed

  const preloadFunctionLogs = useCallback(async () => {
    try {
      const response = await fetchAdminLogs({ limit: 200, minutes: 120, logsOnly: true });
      const transformed = (response.logs || [])
        .map((log: AdminLogEntry) => buildFunctionLogEntry(log))
        .filter(Boolean) as LogEntry[];

      if (transformed.length === 0) {
        return;
      }

      totalReceived.current += transformed.length;

      setLogs((prevLogs) => {
        const existingIds = new Set(prevLogs.map((log) => log.id));
        let added = false;
        const merged = [...prevLogs];

        for (const entry of transformed) {
          if (!existingIds.has(entry.id)) {
            merged.push(entry);
            added = true;
          }
        }

        if (!added) {
          return prevLogs;
        }

        merged.sort((a, b) => a.ts - b.ts);

        if (merged.length > MAX_BUFFER_SIZE) {
          const excess = merged.length - MAX_BUFFER_SIZE;
          totalDropped.current += excess;
          const trimmed = merged.slice(excess);
          const droppedPercent = (totalDropped.current / totalReceived.current) * 100;
          setDroppedPercentage(droppedPercent);
          setBufferSize(trimmed.length);
          storage.setCachedData('LOGS', trimmed);
          return trimmed;
        }

        setBufferSize(merged.length);
        storage.setCachedData('LOGS', merged);
        return merged;
      });
    } catch (error) {
      console.warn('⚠️ Failed to preload function logs:', (error as Error)?.message || error);
    }
  }, [setLogs, setBufferSize, setDroppedPercentage]);

  // ✅ Disconnect function - defined first to avoid TDZ
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    connectedRef.current = false;
    setConnectionStatus('disconnected');
  }, []);

  const setupLiveConnection = useCallback(() => {
    try {
      const url = new URL(`${apiBase}/console/events`, window.location.origin);
      if (filters?.source && filters.source !== 'all') {
        url.searchParams.set('source', filters.source);
      }
      if (filters?.level && filters.level !== 'all') {
        url.searchParams.set('level', filters.level);
      }
      if (filters?.text) {
        url.searchParams.set('text', filters.text);
      }

      const eventSource = new EventSource(url.toString(), {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        console.log('✅ DevConsole SSE connected');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload?.type === 'heartbeat') {
            return;
          }

          if (payload?.type === 'metrics') {
            setMetrics(payload.metrics ?? payload.data ?? null);
            return;
          }

          const entries: LogEntry[] = Array.isArray(payload)
            ? payload
            : payload?.entries ?? (payload ? [payload] : []);

          entries.forEach((entry) => {
            const logEntry: LogEntry = {
              ts: entry.ts || (entry as any).timestamp || payload?.ts || (payload as any)?.timestamp || Date.now(),
              source: entry.source || payload.source || 'backend',
              level: entry.level || 'info',
              message: entry.message || '',
              meta: entry.meta || {},
              id: entry.id || nextLogId('console'),
            };

            totalReceived.current += 1;

            if (filters?.source && filters.source !== 'all' && logEntry.source !== filters.source) {
              return;
            }
            if (filters?.level && filters.level !== 'all' && logEntry.level !== filters.level) {
              return;
            }

            setLogs((prevLogs) => {
              const nextLogs = [...prevLogs, logEntry];
              if (nextLogs.length > MAX_BUFFER_SIZE) {
                const excess = nextLogs.length - MAX_BUFFER_SIZE;
                totalDropped.current += excess;
                const trimmed = nextLogs.slice(excess);
                const droppedPercent = (totalDropped.current / totalReceived.current) * 100;
                setDroppedPercentage(droppedPercent);
                setBufferSize(trimmed.length);
                storage.setCachedData('LOGS', trimmed);
                return trimmed;
              }

              setBufferSize(nextLogs.length);
              storage.setCachedData('LOGS', nextLogs);
              return nextLogs;
            });
          });
        } catch (error) {
          console.error('❌ Failed to parse console stream payload:', error, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ DevConsole stream error:', error);
        setConnectionStatus('disconnected');
        connectedRef.current = false;
        setMetrics(null);
        eventSource.close();
        eventSourceRef.current = null;
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('❌ Failed to initialize console stream:', error);
      setConnectionStatus('disconnected');
      connectedRef.current = false;
    }
  }, [apiBase, filters, setBufferSize, setConnectionStatus, setDroppedPercentage, setLogs, setMetrics]);

  const connect = useCallback((forceRefresh = false) => {
    // ✅ Single connection guard - prevent StrictMode double connection
    if (connectedRef.current || eventSourceRef.current) {
      return;
    }

    connectedRef.current = true;

    // Try to load from cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedLogs = storage.getCachedData<LogEntry[]>('LOGS', []);
      if (cachedLogs.length > 0 && storage.isCacheValid('LOGS')) {
        console.log('✅ Loading logs from cache:', cachedLogs.length, 'entries');
        setIsLoadingFromCache(true);
        setLogs(cachedLogs);
        setBufferSize(cachedLogs.length);
        setConnectionStatus('connected');
        setIsLoadingFromCache(false);

        // Continue with live connection for new logs
        setupLiveConnection();
        return;
      }
    } else {
      // Clear cache when forcing refresh
      storage.clearCache('LOGS');
    }

    setConnectionStatus('connecting');
    setupLiveConnection();
  }, [disconnect, setBufferSize, setConnectionStatus, setIsLoadingFromCache, setLogs, setupLiveConnection]);

  const forceReload = useCallback(() => {
    console.log('🔄 Force reloading logs from server...');
    storage.clearCache('LOGS');
    disconnect();
    setMetrics(null);
    connect(true);
  }, [connect, disconnect, setMetrics]);

  const reconnect = useCallback(() => {
    setConnectionStatus('connecting');

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Progressive retry with exponential backoff
    const retryDelay = Math.min(1000 * Math.pow(2, Math.min(retryCountRef.current, 4)), 10000);

    setTimeout(() => {
      console.log(`🔄 Reconnecting to console stream (attempt ${retryCountRef.current + 1})`);
      connect(true); // Pass true to force a refresh
      retryCountRef.current++;
    }, retryDelay);
  }, [connect]); // Depend on connect, not connectToStream

  const retryCountRef = useRef(0);

  // Reset retry count on successful connection
  useEffect(() => {
    if (connectionStatus === 'connected') {
      retryCountRef.current = 0;
    }
  }, [connectionStatus]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setBufferSize(0);
    totalReceived.current = 0;
    totalDropped.current = 0;
    setDroppedPercentage(0);
    storage.clearCache('LOGS');
  }, [setLogs, setBufferSize, setDroppedPercentage]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Separate effect for filter changes to avoid clearing cache
  useEffect(() => {
    if (eventSourceRef.current) {
      // Only reconnect if we have an active connection
      reconnect();
    } else {
      // If no active connection, try to establish one with new filters
      connect();
    }
  }, [filters, reconnect, connect]); // Added connect as a dependency

  return {
    logs,
    connectionStatus,
    bufferSize,
    droppedPercentage,
    isLoadingFromCache,
    metrics,
    reconnect,
    clearLogs,
    forceReload
  };
};
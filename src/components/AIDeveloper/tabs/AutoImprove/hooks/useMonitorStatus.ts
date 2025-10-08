import { useMemo } from 'react';
import useSWR from 'swr';
import { rateLimitedJsonFetch } from '@/utils/rateLimitedFetch';
import { rateLimitManager } from '@/utils/rateLimitHandler';

interface MonitorStatusResponse {
  kpis: {
    queueLength?: number;
    p95ResponseTime?: number;
    responseTime?: number;
    errorRate?: number;
    mode?: 'auto' | 'manual' | 'paused';
    modelStatus?: string;
    processingRate?: number;
    lastRunAt?: string;
  } | null;
  timestamp?: string | number | null;
  source?: string;
}

const AUTO_IMPROVE_MONITOR_RATE_KEY = 'auto-improve:monitor-status';

const fetchMonitorStatus = async (): Promise<MonitorStatusResponse> => {
  const payload = await rateLimitedJsonFetch<Partial<MonitorStatusResponse & {
    kpis?: MonitorStatusResponse['kpis'];
  }>>('/api/auto-improve/monitor/status', {
    key: AUTO_IMPROVE_MONITOR_RATE_KEY,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
    cacheTTL: 4000,
    rateLimit: { maxRequests: 6, timeWindow: 10000, retryDelay: 2000 },
  });

  return {
    kpis: payload.kpis ?? null,
    timestamp: payload.timestamp ?? Date.now(),
    source: payload.source,
  };
};

interface UseMonitorStatusParams {
  hasDevConsoleAccess: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
}

export const useMonitorStatus = ({
  hasDevConsoleAccess,
  isAuthenticated,
  isOnline,
}: UseMonitorStatusParams) => {
  const monitorKey = useMemo(() => {
    if (!hasDevConsoleAccess || !isAuthenticated) {
      return null;
    }

    return 'auto-improve:monitor-status';
  }, [hasDevConsoleAccess, isAuthenticated]);

  const swrResponse = useSWR<MonitorStatusResponse>(monitorKey, fetchMonitorStatus, {
    refreshInterval: () => {
      if (!isOnline) {
        return 0;
      }

      if (rateLimitManager.isPollingDisabled(AUTO_IMPROVE_MONITOR_RATE_KEY)) {
        return rateLimitManager.getBackoffDelay(AUTO_IMPROVE_MONITOR_RATE_KEY) || 0;
      }

      const backoff = rateLimitManager.getBackoffDelay(AUTO_IMPROVE_MONITOR_RATE_KEY);
      return backoff > 0 ? Math.max(backoff, 5000) : 5000;
    },
    revalidateOnFocus: false,
    isPaused: () => !isOnline || rateLimitManager.isPollingDisabled(AUTO_IMPROVE_MONITOR_RATE_KEY),
  });

  return {
    monitorKey,
    ...swrResponse,
  };
};

export type { MonitorStatusResponse };

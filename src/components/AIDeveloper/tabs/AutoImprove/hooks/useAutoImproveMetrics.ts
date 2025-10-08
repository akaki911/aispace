import { useMemo } from 'react';
import useSWR from 'swr';
import { rateLimitedJsonFetch } from '@/utils/rateLimitedFetch';
import { rateLimitManager } from '@/utils/rateLimitHandler';

import type {
  AutoImproveMetric,
  AutoImproveMetricsResponse,
} from '@aispace/components/AIDeveloper/AutoImprove/types';

const normalizeMetric = (metric: AutoImproveMetric): AutoImproveMetric => {
  const latency =
    typeof metric.latencyMs === 'number' && Number.isFinite(metric.latencyMs)
      ? metric.latencyMs
      : typeof metric.latencyMs === 'string'
        ? Number(metric.latencyMs)
        : null;
  const success =
    typeof metric.successRate === 'number' && Number.isFinite(metric.successRate)
      ? metric.successRate
      : typeof metric.successRate === 'string'
        ? Number(metric.successRate)
        : null;

  return {
    ...metric,
    latencyMs: Number.isFinite(latency ?? NaN) ? Number(latency) : null,
    successRate: Number.isFinite(success ?? NaN) ? Number(success) : null,
    model: metric.model ?? null,
    logs: Array.isArray(metric.logs) ? metric.logs : [],
  };
};

const AUTO_IMPROVE_METRICS_RATE_KEY = 'auto-improve:metrics';

const fetchMetrics = async (): Promise<AutoImproveMetricsResponse> => {
  const payload = await rateLimitedJsonFetch<Partial<AutoImproveMetricsResponse>>(
    '/api/auto-improve/metrics',
    {
      key: AUTO_IMPROVE_METRICS_RATE_KEY,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      cacheTTL: 4000,
      rateLimit: { maxRequests: 6, timeWindow: 10000, retryDelay: 2000 },
    },
  );
  const metrics = Array.isArray(payload.metrics)
    ? payload.metrics.map((metric) => normalizeMetric(metric as AutoImproveMetric))
    : [];

  return {
    metrics,
    updatedAt: payload.updatedAt ?? Date.now(),
    pollingDisabled: payload.pollingDisabled ?? false,
  };
};

interface UseAutoImproveMetricsParams {
  hasDevConsoleAccess: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  selectedModel: string | null;
}

export const useAutoImproveMetrics = ({
  hasDevConsoleAccess,
  isAuthenticated,
  isOnline,
  selectedModel,
}: UseAutoImproveMetricsParams) => {
  const metricsKey = useMemo(() => {
    if (!hasDevConsoleAccess || !isAuthenticated) {
      return null;
    }

    return ['auto-improve:metrics', selectedModel ?? 'all'];
  }, [hasDevConsoleAccess, isAuthenticated, selectedModel]);

  const swrResponse = useSWR<AutoImproveMetricsResponse>(metricsKey, fetchMetrics, {
    refreshInterval: (latestData: AutoImproveMetricsResponse | undefined) => {
      if (!isOnline || latestData?.pollingDisabled) {
        return 0;
      }

      if (rateLimitManager.isPollingDisabled(AUTO_IMPROVE_METRICS_RATE_KEY)) {
        return rateLimitManager.getBackoffDelay(AUTO_IMPROVE_METRICS_RATE_KEY) || 0;
      }

      const backoff = rateLimitManager.getBackoffDelay(AUTO_IMPROVE_METRICS_RATE_KEY);
      return backoff > 0 ? Math.max(backoff, 5000) : 5000;
    },
    revalidateOnFocus: false,
    isPaused: () => !isOnline || rateLimitManager.isPollingDisabled(AUTO_IMPROVE_METRICS_RATE_KEY),
    onErrorRetry: (
      _error: unknown,
      _key: string,
      _config: unknown,
      revalidate: (options?: { retryCount?: number }) => void,
      context: { retryCount: number },
    ) => {
      if (!isOnline) {
        return;
      }
      if (context.retryCount >= 4) {
        return;
      }
      const backoff = rateLimitManager.getBackoffDelay(AUTO_IMPROVE_METRICS_RATE_KEY);
      const retryDelay = backoff > 0
        ? Math.min(Math.max(backoff, 5000), 120000)
        : Math.min(30000, 5000 * 2 ** context.retryCount);
      setTimeout(() => revalidate({ retryCount: context.retryCount + 1 }), retryDelay);
    },
  });

  return {
    metricsKey,
    ...swrResponse,
  };
};

export type { AutoImproveMetricsResponse };

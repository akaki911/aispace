import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchAISpaceHealth, type AISpaceHealthResult, type AISpaceHealthStatus } from '@aispace/services/health';

export interface UseAiHealthOptions {
  pollIntervalMs?: number | null;
}

export interface UseAiHealthState extends AISpaceHealthResult {
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_POLL_INTERVAL = 60_000;

const mapStatusToIndicator = (status: AISpaceHealthStatus): AISpaceHealthStatus => {
  if (status === 'checking') {
    return 'checking';
  }
  return status;
};

export const useAiHealth = (options: UseAiHealthOptions = {}): UseAiHealthState => {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL } = options;
  const [state, setState] = useState<AISpaceHealthResult>({
    status: 'checking',
    ok: true,
    lastChecked: Date.now(),
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchAISpaceHealth();
    setState({ ...next, status: mapStatusToIndicator(next.status) });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    if (!pollIntervalMs || pollIntervalMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [pollIntervalMs, refresh]);

  const computedState = useMemo<UseAiHealthState>(() => ({
    ...state,
    loading,
    refresh,
  }), [state, loading, refresh]);

  return computedState;
};

export default useAiHealth;


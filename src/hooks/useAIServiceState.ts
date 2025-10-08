import { useCallback, useMemo, useState } from 'react';

import type { AutoImproveServiceState } from '@aispace/components/AIDeveloper/AutoImprove/types';

interface AIServiceHealthSummary {
  status: AutoImproveServiceState;
  latencyMs: number;
  lastChecked: string;
}

interface AvailableModel {
  id: string;
  label: string;
}

interface GuruloTickerEntry {
  id: string;
  label: string;
  value: string;
  tone?: 'info' | 'warning' | 'error';
}

interface GuruloStatusSummary {
  activePercent: number;
  queueDepth: number;
  responseMs: number;
  throughputPerMin: number;
  lastUpdate: string;
  mode: 'auto' | 'manual' | 'paused';
  successRate: number;
  testsPassingPercent: number;
  errorCount: number;
  ticker: GuruloTickerEntry[];
}

interface GuruloBrainStatusSummary {
  percent: number;
  tasksActive: number;
  headline: string | null;
  status: string | null;
  mode: 'auto' | 'manual' | 'paused';
  lastUpdate: string;
}

export const useAIServiceState = (isAuthenticated: boolean) => {
  const [connectionState, setConnectionState] = useState<AutoImproveServiceState>('ok');
  const [aiServiceHealth, setAIServiceHealth] = useState<AIServiceHealthSummary>(() => ({
    status: 'ok',
    latencyMs: 180,
    lastChecked: new Date().toISOString(),
  }));

  const availableModels = useMemo<AvailableModel[]>(
    () => [
      { id: 'gurulo-pro', label: 'Gurulo Pro' },
      { id: 'gurulo-experimental', label: 'Experimental (β)' },
    ],
    [],
  );
  const [selectedModel, setSelectedModel] = useState<string | null>(availableModels[0]?.id ?? null);

  const [guruloStatus, setGuruloStatus] = useState<GuruloStatusSummary>(() => ({
    activePercent: 82,
    queueDepth: 3,
    responseMs: 940,
    throughputPerMin: 24,
    lastUpdate: new Date().toISOString(),
    mode: 'auto',
    successRate: 92,
    testsPassingPercent: 88,
    errorCount: 1,
    ticker: [
      { id: 'ticker-1', label: 'Latency', value: '940ms', tone: 'warning' },
      { id: 'ticker-2', label: 'Queue', value: '3 pending', tone: 'info' },
    ],
  }));

  const [guruloBrainStatus, setGuruloBrainStatus] = useState<GuruloBrainStatusSummary>(() => ({
    percent: 74,
    tasksActive: 5,
    headline: 'Auto Improve standby',
    status: 'stable',
    mode: 'auto',
    lastUpdate: new Date().toISOString(),
  }));
  const [isGuruloBrainStatusLoading, setIsGuruloBrainStatusLoading] = useState(false);
  const [guruloBrainStatusError, setGuruloBrainStatusError] = useState<Error | null>(null);

  const refreshHealth = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    setAIServiceHealth({ status: 'ok', latencyMs: 160, lastChecked: new Date().toISOString() });
    setConnectionState('ok');
  }, []);

  const refreshGuruloBrainStatus = useCallback(async () => {
    setIsGuruloBrainStatusLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setGuruloBrainStatus((previous) => ({
        ...previous,
        lastUpdate: new Date().toISOString(),
        percent: Math.min(100, Math.max(0, previous.percent + (Math.random() * 6 - 3))),
      }));
      setGuruloStatus((previous) => ({
        ...previous,
        lastUpdate: new Date().toISOString(),
        ticker: previous.ticker,
      }));
      setGuruloBrainStatusError(null);
    } catch (error) {
      setGuruloBrainStatusError(error instanceof Error ? error : new Error('Failed to refresh brain status'));
    } finally {
      setIsGuruloBrainStatusLoading(false);
    }
  }, []);

  return {
    aiServiceHealth,
    availableModels,
    selectedModel,
    setSelectedModel,
    refreshHealth,
    isOnline: isAuthenticated,
    connectionState,
    guruloStatus,
    guruloBrainStatus,
    guruloBrainStatusError,
    refreshGuruloBrainStatus,
    isGuruloBrainStatusLoading,
  };
};

export type AIServiceStateValue = ReturnType<typeof useAIServiceState>;

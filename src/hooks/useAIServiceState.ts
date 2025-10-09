import { useCallback, useMemo, useState } from 'react';

type AIModel = { id: string; label: string };

interface AIServiceHealthState {
  status: string;
  ok: boolean;
  port: number;
  lastChecked: number;
  lastCheck: number;
  lastCheckedAt: string;
  latencyMs: number;
}

interface ModelControlsState {
  temperature: number;
  maxTokens: number;
}

const DEFAULT_MODELS: AIModel[] = [
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

const DEFAULT_MODEL_CONTROLS: ModelControlsState = {
  temperature: 1,
  maxTokens: 2000,
};

const DEFAULT_GURULO_STATUS = {
  activePercent: 92,
  testsPassingPercent: 96,
  queueDepth: 0,
  responseMs: 180,
  throughputPerMin: 42,
  lastUpdate: null as string | number | null,
  mode: 'stable',
  successRate: 0.98,
  errorCount: 0,
  ticker: [] as Array<{ id: string; label?: string; value?: string; tone?: 'info' | 'warning' | 'error' }>,
};

const DEFAULT_GURULO_BRAIN_STATUS = {
  percent: 100,
  tasksActive: 0,
  headline: 'სტაბილური',
  status: 'online',
  mode: 'auto',
  lastUpdate: null as string | number | null,
};

export const useAIServiceState = (_isAuthenticated?: boolean, _user?: unknown) => {
  const [aiServiceHealth, setAiServiceHealth] = useState<AIServiceHealthState>(() => {
    const timestamp = Date.now();
    return {
      status: 'ok',
      ok: true,
      port: 5001,
      lastChecked: timestamp,
      lastCheck: timestamp,
      lastCheckedAt: new Date(timestamp).toISOString(),
      latencyMs: 120,
    };
  });
  const [availableModels] = useState<AIModel[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string | null>(DEFAULT_MODELS[0]?.id ?? null);
  const [modelControls, setModelControls] = useState<ModelControlsState>(DEFAULT_MODEL_CONTROLS);

  const refreshHealth = useCallback(async () => {
    const timestamp = Date.now();
    setAiServiceHealth((previous) => ({
      ...previous,
      status: 'ok',
      ok: true,
      lastChecked: timestamp,
      lastCheck: timestamp,
      lastCheckedAt: new Date(timestamp).toISOString(),
    }));
  }, []);

  const loadModels = useCallback(async () => availableModels, [availableModels]);

  const guruloStatus = useMemo(() => DEFAULT_GURULO_STATUS, []);
  const guruloBrainStatus = useMemo(() => DEFAULT_GURULO_BRAIN_STATUS, []);

  const refreshGuruloBrainStatus = useCallback(async () => undefined, []);

  return {
    aiServiceHealth,
    refreshHealth,
    loadModels,
    modelControls,
    setModelControls,
    availableModels,
    selectedModel,
    setSelectedModel,
    isOnline: true,
    connectionState: 'online' as 'online' | 'offline' | 'degraded',
    guruloStatus,
    guruloBrainStatus,
    guruloBrainStatusError: null as Error | null,
    refreshGuruloBrainStatus,
    isGuruloBrainStatusLoading: false,
  };
};

export default useAIServiceState;

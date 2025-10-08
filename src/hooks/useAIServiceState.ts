import { useMemo } from 'react';

export interface AIServiceHealth {
  status: string;
  port?: number;
  lastChecked?: number;
}

export interface AIModelOption {
  id: string;
  label: string;
  description?: string;
  provider?: string;
}

export interface AIModelControls {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface GuruloTickerEntry {
  id?: string;
  label?: string | null;
  value?: string | null;
  tone?: 'info' | 'warning' | 'error';
}

export interface GuruloStatusSummary {
  activePercent: number | null;
  queueDepth: number | null;
  responseMs: number | null;
  throughputPerMin: number | null;
  lastUpdate: string | number | null;
  mode: 'auto' | 'manual' | 'paused' | string | null;
  successRate: number | null;
  testsPassingPercent: number | null;
  errorCount: number | null;
  ticker: GuruloTickerEntry[];
}

export interface GuruloBrainStatusSummary {
  percent: number | null;
  tasksActive: number | null;
  headline: string | null;
  status: string | null;
  mode: 'auto' | 'manual' | 'paused' | string | null;
  lastUpdate: string | number | null;
}

export interface AIServiceState {
  aiServiceHealth: AIServiceHealth | null;
  availableModels: AIModelOption[];
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
  refreshHealth: () => Promise<void>;
  loadModels: () => Promise<void>;
  modelControls: AIModelControls;
  setModelControls: (controls: AIModelControls) => void;
  isOnline: boolean;
  connectionState: 'online' | 'offline' | 'degraded';
  guruloStatus: GuruloStatusSummary;
  guruloBrainStatus: GuruloBrainStatusSummary;
  guruloBrainStatusError: Error | null;
  refreshGuruloBrainStatus: () => Promise<void>;
  isGuruloBrainStatusLoading: boolean;
}

const DEFAULT_MODELS: AIModelOption[] = [
  { id: 'gurulo-brain', label: 'Gurulo Brain (stub)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (stub)' },
];

const DEFAULT_MODEL_CONTROLS: AIModelControls = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

const DEFAULT_GURULO_STATUS: GuruloStatusSummary = {
  activePercent: 0,
  queueDepth: 0,
  responseMs: null,
  throughputPerMin: null,
  lastUpdate: null,
  mode: 'auto',
  successRate: null,
  testsPassingPercent: null,
  errorCount: null,
  ticker: [],
};

const DEFAULT_BRAIN_STATUS: GuruloBrainStatusSummary = {
  percent: 0,
  tasksActive: 0,
  headline: 'Offline',
  status: 'offline',
  mode: 'paused',
  lastUpdate: null,
};

export const useAIServiceState = (_isAuthenticated?: boolean, _user?: unknown): AIServiceState => {
  const setSelectedModel = () => undefined;
  const setModelControls = () => undefined;

  return useMemo<AIServiceState>(
    () => ({
      aiServiceHealth: { status: 'offline', port: undefined, lastChecked: Date.now() },
      availableModels: DEFAULT_MODELS,
      selectedModel: null,
      setSelectedModel,
      refreshHealth: async () => undefined,
      loadModels: async () => undefined,
      modelControls: DEFAULT_MODEL_CONTROLS,
      setModelControls,
      isOnline: false,
      connectionState: 'offline',
      guruloStatus: DEFAULT_GURULO_STATUS,
      guruloBrainStatus: DEFAULT_BRAIN_STATUS,
      guruloBrainStatusError: null,
      refreshGuruloBrainStatus: async () => undefined,
      isGuruloBrainStatusLoading: false,
    }),
    [],
  );
};

export default useAIServiceState;

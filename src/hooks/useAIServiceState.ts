import { useMemo } from 'react';

interface AIServiceHealth {
  status: string;
  port?: number;
  lastChecked?: number;
}

export interface AIServiceState {
  aiServiceHealth: AIServiceHealth | null;
  availableModels: string[];
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
  refreshHealth: () => Promise<void>;
  loadModels: () => Promise<void>;
  modelControls: Record<string, unknown>;
  setModelControls: (controls: Record<string, unknown>) => void;
  isOnline: boolean;
  connectionState: 'online' | 'offline' | 'degraded';
  guruloStatus: Record<string, unknown>;
  guruloBrainStatus: Record<string, any>;
  guruloBrainStatusError: Error | null;
  refreshGuruloBrainStatus: () => Promise<void>;
  isGuruloBrainStatusLoading: boolean;
}

export const useAIServiceState = (_isAuthenticated?: boolean): AIServiceState => {
  const setSelectedModel = () => undefined;
  const setModelControls = () => undefined;

  return useMemo<AIServiceState>(
    () => ({
      aiServiceHealth: { status: 'offline', port: undefined, lastChecked: Date.now() },
      availableModels: [],
      selectedModel: null,
      setSelectedModel,
      refreshHealth: async () => undefined,
      loadModels: async () => undefined,
      modelControls: {},
      setModelControls,
      isOnline: false,
      connectionState: 'offline',
      guruloStatus: {},
      guruloBrainStatus: {},
      guruloBrainStatusError: null,
      refreshGuruloBrainStatus: async () => undefined,
      isGuruloBrainStatusLoading: false,
    }),
    [],
  );
};

export default useAIServiceState;

import { useMemo } from 'react';

import type { MemoryControls, MemoryDashboardMetrics, SavedMemoryEntry } from '@/types/aimemory';

interface UseMemoryControlsResult {
  controls: MemoryControls;
  memories: SavedMemoryEntry[];
  metrics: MemoryDashboardMetrics;
  loading: boolean;
  error: string | null;
  toggleFeature: (feature: 'savedMemories' | 'chatHistory', enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  saveMemory: (entry: Partial<SavedMemoryEntry> & { key: string; value: string }) => Promise<void>;
}

const DEFAULT_CONTROLS: MemoryControls = {
  referenceSavedMemories: false,
  referenceChatHistory: false,
  lastUpdated: null,
};

const DEFAULT_METRICS: MemoryDashboardMetrics = {
  total: 0,
  confirmed: 0,
  pending: 0,
  logCount: 0,
  errorCount: 0,
  warningCount: 0,
  averageConfidence: 0,
  synced: 0,
  syncing: 0,
  failing: 0,
  healthScore: 0,
  lastActivity: null,
};

export const useMemoryControls = (_userId?: string | null): UseMemoryControlsResult =>
  useMemo(
    () => ({
      controls: DEFAULT_CONTROLS,
      memories: [],
      metrics: DEFAULT_METRICS,
      loading: false,
      error: null,
      toggleFeature: async () => undefined,
      refresh: async () => undefined,
      saveMemory: async () => undefined,
    }),
    [],
  );

export default useMemoryControls;

import { useMemo } from 'react';

import type { MemoryControls, MemoryDashboardMetrics, SavedMemoryEntry } from '@/types/aimemory';

interface SaveMemoryPayload {
  key: string;
  value: unknown;
  summary?: string;
  tags?: string[];
  userConfirmed?: boolean;
}

export const useMemoryControls = (_userId: string | null) => {
  const controls: MemoryControls = useMemo(
    () => ({
      toggles: [],
      referenceSavedMemories: false,
      referenceChatHistory: false,
      lastUpdated: null,
    }),
    [],
  );

  const memories: SavedMemoryEntry[] = useMemo(() => [], []);

  const metrics: MemoryDashboardMetrics = useMemo(
    () => ({
      totalMemories: 0,
      activeFeatures: 0,
      archivedMemories: 0,
      averageEmbeddingScore: 0,
      averageConfidence: 0,
      logCount: 0,
      errorCount: 0,
      warningCount: 0,
      healthScore: 100,
      lastActivity: null,
    }),
    [],
  );

  const toggleFeature = async (_feature: 'savedMemories' | 'chatHistory', _enabled: boolean) => undefined;
  const refresh = async () => undefined;
  const saveMemory = async (_entry: SaveMemoryPayload) => ({ success: true as const });

  return {
    controls,
    memories,
    metrics,
    loading: false,
    error: null as string | null,
    toggleFeature,
    refresh,
    saveMemory,
  };
};

export default useMemoryControls;

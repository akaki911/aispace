import { useCallback, useMemo, useState } from 'react';

import type { MemoryControls, MemoryDashboardMetrics, SavedMemoryEntry } from '@/types/aimemory';

const createInitialMemories = (): SavedMemoryEntry[] => [
  {
    id: 'memory-1',
    key: 'preferred_language',
    value: 'ქართული',
    userConfirmed: true,
    summary: 'მომხმარებელს ურჩევნია ქართულად საუბარი',
    tags: ['profile', 'language'],
    source: 'profile',
    ownerName: 'გურულო',
    confidenceScore: 0.92,
    logCount: 2,
    warningCount: 0,
    errorCount: 0,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'memory-2',
    key: 'ai_last_run',
    value: 'Auto Improve ran diagnostics with no issues',
    userConfirmed: false,
    tags: ['system'],
    source: 'auto-improve',
    ownerName: 'სერვისი',
    confidenceScore: 0.7,
    logCount: 1,
    warningCount: 1,
    errorCount: 0,
    updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

const calculateMetrics = (entries: SavedMemoryEntry[]): MemoryDashboardMetrics => {
  const total = entries.length;
  const confirmed = entries.filter((entry) => entry.userConfirmed).length;
  const pending = total - confirmed;
  const logCount = entries.reduce((totalLogs, entry) => totalLogs + (entry.logCount ?? 0), 0);
  const errorCount = entries.reduce((totalErrors, entry) => totalErrors + (entry.errorCount ?? 0), 0);
  const warningCount = entries.reduce((totalWarnings, entry) => totalWarnings + (entry.warningCount ?? 0), 0);
  const averageConfidence = total === 0
    ? 0
    : Math.round(
        (entries.reduce((totalConfidence, entry) => totalConfidence + (entry.confidenceScore ?? (entry.userConfirmed ? 0.9 : 0.6)), 0) /
          total) *
          100,
      );

  return {
    total,
    confirmed,
    pending,
    logCount,
    errorCount,
    warningCount,
    synced: confirmed,
    syncing: Math.max(pending - warningCount, 0),
    failing: Math.max(errorCount, 0),
    healthScore: Math.max(0, Math.min(100, averageConfidence - warningCount * 2 - errorCount * 5)),
    averageConfidence,
    lastActivity: entries[0]?.updatedAt ?? null,
  };
};

interface SaveMemoryPayload {
  key: string;
  value: string | Record<string, unknown> | null;
  summary?: string | null;
  tags?: string[];
  userConfirmed?: boolean;
}

export const useMemoryControls = (personalId: string | null) => {
  const [controls, setControls] = useState<MemoryControls>({
    referenceSavedMemories: true,
    referenceChatHistory: true,
    lastUpdated: new Date().toISOString(),
  });
  const [memories, setMemories] = useState<SavedMemoryEntry[]>(createInitialMemories);
  const [metrics, setMetrics] = useState<MemoryDashboardMetrics>(() => calculateMetrics(createInitialMemories()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMetrics = useCallback((entries: SavedMemoryEntry[]) => {
    setMetrics(calculateMetrics(entries));
  }, []);

  const toggleFeature = useCallback(
    async (feature: 'savedMemories' | 'chatHistory', enabled: boolean) => {
      setLoading(true);
      setError(null);
      try {
        setControls((previous) => ({
          ...previous,
          referenceSavedMemories:
            feature === 'savedMemories' ? enabled : previous.referenceSavedMemories,
          referenceChatHistory:
            feature === 'chatHistory' ? enabled : previous.referenceChatHistory,
          lastUpdated: new Date().toISOString(),
        }));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setControls((previous) => ({ ...previous, lastUpdated: new Date().toISOString() }));
      refreshMetrics(memories);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to refresh memory data');
    } finally {
      setLoading(false);
    }
  }, [memories, refreshMetrics]);

  const saveMemory = useCallback(
    async (payload: SaveMemoryPayload) => {
      const baseId = payload.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const newEntry: SavedMemoryEntry = {
        id: `${baseId}-${Date.now()}`,
        key: payload.key,
        value: payload.value,
        userConfirmed: payload.userConfirmed ?? true,
        summary: payload.summary ?? null,
        tags: payload.tags ?? [],
        ownerName: personalId ?? 'system',
        confidenceScore: payload.userConfirmed ? 0.95 : 0.7,
        updatedAt: new Date().toISOString(),
        logCount: 0,
        warningCount: 0,
        errorCount: 0,
      };

      setMemories((previous) => {
        const next = [newEntry, ...previous].slice(0, 50);
        refreshMetrics(next);
        return next;
      });
      setControls((previous) => ({ ...previous, lastUpdated: newEntry.updatedAt }));
    },
    [personalId, refreshMetrics],
  );

  const state = useMemo(
    () => ({ controls, memories, metrics, loading, error, toggleFeature, refresh, saveMemory }),
    [controls, memories, metrics, loading, error, toggleFeature, refresh, saveMemory],
  );

  return state;
};

export type UseMemoryControlsReturn = ReturnType<typeof useMemoryControls>;

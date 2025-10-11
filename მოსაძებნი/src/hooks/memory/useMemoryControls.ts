import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MemoryControls, SavedMemoryEntry, MemoryDashboardMetrics } from '../../types/aimemory';

type MemoryFeature = 'savedMemories' | 'chatHistory';

interface UseMemoryControlsResult {
  controls: MemoryControls;
  memories: SavedMemoryEntry[];
  metrics: MemoryDashboardMetrics;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleFeature: (feature: MemoryFeature, enabled: boolean) => Promise<void>;
  saveMemory: (payload: { key: string; value: any; userConfirmed?: boolean; summary?: string; tags?: string[] }) => Promise<void>;
}

const DEFAULT_CONTROLS: MemoryControls = {
  referenceSavedMemories: true,
  referenceChatHistory: true,
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
  syncing: 0,
  synced: 0,
  failing: 0,
  healthScore: 100,
  lastActivity: null,
};

const DEFAULT_RESULT: UseMemoryControlsResult = {
  controls: DEFAULT_CONTROLS,
  memories: [],
  metrics: DEFAULT_METRICS,
  loading: false,
  error: null,
  refresh: async () => undefined,
  toggleFeature: async () => undefined,
  saveMemory: async () => undefined,
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const deriveMetricsFromMemories = (memories: SavedMemoryEntry[]): MemoryDashboardMetrics => {
  if (!Array.isArray(memories) || memories.length === 0) {
    return { ...DEFAULT_METRICS };
  }

  const total = memories.length;
  const confirmed = memories.filter((memory) => memory.userConfirmed).length;
  const pending = Math.max(total - confirmed, 0);

  const logCount = memories.reduce((running, memory) => running + (memory.logCount ?? 0), 0);
  const errorCount = memories.reduce((running, memory) => running + (memory.errorCount ?? 0), 0);
  const warningCount = memories.reduce((running, memory) => running + (memory.warningCount ?? 0), 0);

  const confidenceAccumulator = memories.reduce((running, memory) => {
    const explicit = typeof memory.confidenceScore === 'number' ? memory.confidenceScore : undefined;
    const normalized = explicit !== undefined ? explicit : memory.userConfirmed ? 0.9 : 0.55;
    const ratio = normalized > 1 ? normalized / 100 : normalized;
    return running + Math.max(0, Math.min(ratio, 1));
  }, 0);
  const averageConfidence = Math.round((confidenceAccumulator / total) * 100);

  const syncing = memories.filter((memory) => memory.syncStatus === 'syncing' || memory.syncStatus === 'pending').length;
  const failing = memories.filter(
    (memory) => memory.syncStatus === 'error' || (memory.errorCount ?? 0) > 0 || (memory.warningCount ?? 0) > 2,
  ).length;
  const synced = memories.filter((memory) => (memory.syncStatus ? memory.syncStatus === 'synced' : memory.userConfirmed)).length;

  const healthBaseline = total === 0 ? 100 : Math.round((confirmed / total) * 100);
  const healthPenalty = errorCount * 2 + warningCount;
  const healthScore = Math.max(0, Math.min(100, healthBaseline - healthPenalty));

  const lastActivityDate = memories.reduce<Date | null>((latest, memory) => {
    const candidate = parseDate(memory.updatedAt) || parseDate(memory.lastAccessedAt) || parseDate(memory.createdAt) || null;
    if (!candidate) {
      return latest;
    }
    if (!latest || candidate.getTime() > latest.getTime()) {
      return candidate;
    }
    return latest;
  }, null);

  return {
    total,
    confirmed,
    pending,
    logCount,
    errorCount,
    warningCount,
    averageConfidence,
    syncing,
    synced,
    failing,
    healthScore,
    lastActivity: lastActivityDate ? lastActivityDate.toISOString() : null,
  };
};

export const useMemoryControls = (userId?: string | null): UseMemoryControlsResult => {
  const [controls, setControls] = useState<MemoryControls>(DEFAULT_CONTROLS);
  const [memories, setMemories] = useState<SavedMemoryEntry[]>([]);
  const [metrics, setMetrics] = useState<MemoryDashboardMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedUserId = useMemo(() => (userId ? String(userId) : ''), [userId]);

  const refresh = useCallback(async () => {
    if (!resolvedUserId) {
      setMemories([]);
      setControls(DEFAULT_CONTROLS);
      setMetrics(DEFAULT_METRICS);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: resolvedUserId });
      const response = await fetch(`/api/memory/list?${params.toString()}`, {
        credentials: 'include',
      });

      const payload = await response
        .json()
        .catch(() => ({ memories: [], controls: DEFAULT_CONTROLS }));

      if (!response.ok) {
        const message = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(message);
      }

      const normalizedControls: MemoryControls = {
        referenceSavedMemories: payload.controls?.referenceSavedMemories ?? true,
        referenceChatHistory: payload.controls?.referenceChatHistory ?? true,
        lastUpdated: payload.controls?.lastUpdated ?? null,
      };

      const nextMemories = Array.isArray(payload.memories) ? payload.memories : [];
      const payloadMetrics: MemoryDashboardMetrics | null =
        payload.metrics || payload.controls?.metrics || null;
      const derivedMetrics = deriveMetricsFromMemories(nextMemories);

      setControls(normalizedControls);
      setMemories(nextMemories);
      setMetrics(
        payloadMetrics
          ? {
              ...derivedMetrics,
              ...payloadMetrics,
              lastActivity: payloadMetrics.lastActivity || derivedMetrics.lastActivity,
            }
          : derivedMetrics,
      );
      setError(payload?.error?.message ?? null);
    } catch (fetchError) {
      console.error('❌ Failed to load memory controls:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
      setMetrics(DEFAULT_METRICS);
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleFeature = useCallback(
    async (feature: MemoryFeature, enabled: boolean) => {
      if (!resolvedUserId) {
        return;
      }

      setLoading(true);
      const previousControls = controls;
      const optimisticControls: MemoryControls = {
        ...controls,
        referenceSavedMemories:
          feature === 'savedMemories' ? enabled : controls.referenceSavedMemories,
        referenceChatHistory:
          feature === 'chatHistory' ? enabled : controls.referenceChatHistory,
        lastUpdated: new Date().toISOString(),
      };

      setControls(optimisticControls);

      try {
        const response = await fetch('/api/memory/toggle', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: resolvedUserId, feature, enabled }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = payload?.error || `HTTP ${response.status}`;
          throw new Error(message);
        }

        setControls({
          referenceSavedMemories: payload.controls?.referenceSavedMemories ?? true,
          referenceChatHistory: payload.controls?.referenceChatHistory ?? true,
          lastUpdated: payload.controls?.lastUpdated ?? new Date().toISOString(),
        });
        setError(null);
      } catch (toggleError) {
        console.error('❌ Failed to toggle memory feature:', toggleError);
        setError(toggleError instanceof Error ? toggleError.message : 'Unknown error');
        setControls(previousControls);
      } finally {
        setLoading(false);
      }
    },
    [resolvedUserId, controls],
  );

  const saveMemoryEntry = useCallback(
    async (payload: { key: string; value: any; userConfirmed?: boolean; summary?: string; tags?: string[] }) => {
      if (!resolvedUserId) {
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/memory/save', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: resolvedUserId, memory: payload }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result?.memory) {
          setMemories((prev) => {
            const next = [result.memory, ...prev];
            setMetrics(deriveMetricsFromMemories(next));
            return next;
          });
        }
        setError(null);
      } catch (saveError) {
        console.error('❌ Failed to save memory entry:', saveError);
        setError(saveError instanceof Error ? saveError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [resolvedUserId],
  );

  if (!resolvedUserId) {
    return DEFAULT_RESULT;
  }

  return {
    controls,
    memories,
    metrics,
    loading,
    error,
    refresh,
    toggleFeature,
    saveMemory: saveMemoryEntry,
  };
};

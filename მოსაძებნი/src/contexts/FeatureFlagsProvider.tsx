/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  FeatureFlagName,
  getFeatureFlag,
  getResolvedFeatureFlags,
  resolveFeatureFlag,
  subscribeToFeatureFlag,
  updateBaseFeatureFlags,
} from '@/lib/featureFlags';

interface FeatureFlagsContextValue {
  flags: Record<FeatureFlagName, boolean>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

const getApiBase = (): string => {
  const rawBase =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) ||
    (typeof process !== 'undefined' ? process.env?.VITE_API_BASE : undefined) ||
    '/api';

  try {
    const trimmed = String(rawBase).trim();
    if (!trimmed) {
      return '/api';
    }
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  } catch (error) {
    console.warn('⚠️ Failed to normalize API base, using /api:', error);
    return '/api';
  }
};

const normalizeRemoteFlags = (
  payload: Record<string, unknown>,
): Partial<Record<FeatureFlagName, boolean>> => {
  const knownFlags = new Set(Object.keys(getResolvedFeatureFlags()) as FeatureFlagName[]);

  return Object.entries(payload).reduce<Partial<Record<FeatureFlagName, boolean>>>((acc, [key, value]) => {
    if (knownFlags.has(key as FeatureFlagName)) {
      acc[key as FeatureFlagName] = resolveFeatureFlag(value, getFeatureFlag(key as FeatureFlagName));
    }
    return acc;
  }, {});
};

export const FeatureFlagsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [flags, setFlags] = useState<Record<FeatureFlagName, boolean>>(() => getResolvedFeatureFlags());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useMemo(() => getApiBase(), []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/flags`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const body = await response.json();
      const remoteFlagsSource: Record<string, unknown> =
        (body && typeof body === 'object' && (body.flags ?? body)) || {};
      const updates = normalizeRemoteFlags(remoteFlagsSource);

      if (Object.keys(updates).length > 0) {
        updateBaseFeatureFlags(updates);
        setFlags(getResolvedFeatureFlags());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load feature flags';
      console.error('❌ Failed to refresh feature flags:', err);
      setError(message);
      setFlags(getResolvedFeatureFlags());
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const knownFlags = Object.keys(getResolvedFeatureFlags()) as FeatureFlagName[];
    const unsubscribes = knownFlags.map((flag) =>
      subscribeToFeatureFlag(flag, () => setFlags(getResolvedFeatureFlags())),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('⚠️ Failed to unsubscribe from feature flag updates:', error);
        }
      });
    };
  }, []);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({ flags, isLoading, error, refresh }),
    [flags, isLoading, error, refresh],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export const useFeatureFlagsContext = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlagsContext must be used within FeatureFlagsProvider');
  }
  return context;
};

export default FeatureFlagsProvider;

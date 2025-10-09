import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { FeatureFlagsContext } from './FeatureFlagsContextObject';
import { getFeatureFlagOverrides, setFeatureFlagOverride } from '@/lib/featureFlags';

const DEFAULT_FLAGS: Record<string, boolean> = {
  AI: true,
  GITHUB: false,
  CONNECTORS: false,
};

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_FLAGS,
    ...getFeatureFlagOverrides(),
  }));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'aispace.featureFlags') {
        setFlags((prev) => ({ ...DEFAULT_FLAGS, ...prev, ...getFeatureFlagOverrides() }));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setFlags((prev) => ({ ...DEFAULT_FLAGS, ...prev, ...getFeatureFlagOverrides() }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setFlag = useCallback((flag: string, value: boolean) => {
    setFeatureFlagOverride(flag, value);
    setFlags((prev) => ({ ...prev, [flag]: value }));
  }, []);

  const value = useMemo(
    () => ({
      flags,
      isLoading,
      refresh,
      setFlag,
    }),
    [flags, isLoading, refresh, setFlag],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

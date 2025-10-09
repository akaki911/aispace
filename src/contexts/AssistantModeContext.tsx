import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type AssistantMode = 'plan' | 'build';

interface AssistantModeValue {
  mode: AssistantMode;
  isReadOnly: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  isSyncing: boolean;
  syncError: string | null;
  setMode: (nextMode: AssistantMode, meta?: { actor?: string | null; source?: string }) => void;
}

const defaultValue: AssistantModeValue = {
  mode: 'build',
  isReadOnly: false,
  lastUpdatedAt: null,
  lastUpdatedBy: null,
  isSyncing: false,
  syncError: null,
  setMode: () => undefined,
};

const AssistantModeContext = createContext<AssistantModeValue>(defaultValue);

export const AssistantModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<AssistantMode>('build');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);

  const setMode = useCallback(
    (nextMode: AssistantMode, meta?: { actor?: string | null; source?: string }) => {
      setModeState(nextMode);
      setLastUpdatedAt(new Date().toISOString());
      setLastUpdatedBy(meta?.actor ?? 'local-admin');
    },
    [],
  );

  const value = useMemo<AssistantModeValue>(() => ({
    mode,
    isReadOnly: mode === 'plan',
    lastUpdatedAt,
    lastUpdatedBy,
    isSyncing: false,
    syncError: null,
    setMode,
  }), [lastUpdatedAt, lastUpdatedBy, mode, setMode]);

  return <AssistantModeContext.Provider value={value}>{children}</AssistantModeContext.Provider>;
};

export const useAssistantMode = () => useContext(AssistantModeContext);

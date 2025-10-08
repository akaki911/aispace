import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type AssistantMode = 'assistant' | 'developer' | 'review' | 'build' | 'plan';

interface AssistantModeUpdateMetadata {
  actor?: string | null;
  source?: string;
}

interface AssistantModeContextValue {
  mode: AssistantMode;
  setMode: (mode: AssistantMode, metadata?: AssistantModeUpdateMetadata) => void;
  isReadOnly: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  isSyncing: boolean;
  syncError: string | null;
}

const AssistantModeContext = createContext<AssistantModeContextValue | undefined>(undefined);

export const AssistantModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AssistantMode>('assistant');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isReadOnly = false;

  const setMode = useCallback(
    (nextMode: AssistantMode, metadata?: AssistantModeUpdateMetadata) => {
      setIsSyncing(true);
      setSyncError(null);
      setModeState(nextMode);
      setLastUpdatedAt(new Date().toISOString());
      setLastUpdatedBy(metadata?.actor ?? null);
      setTimeout(() => {
        setIsSyncing(false);
      }, 100);
    },
    [],
  );

  const value = useMemo(
    () => ({ mode, setMode, isReadOnly, lastUpdatedAt, lastUpdatedBy, isSyncing, syncError }),
    [isReadOnly, isSyncing, lastUpdatedAt, lastUpdatedBy, mode, setMode, syncError],
  );

  return <AssistantModeContext.Provider value={value}>{children}</AssistantModeContext.Provider>;
};

export const useAssistantMode = () => {
  const context = useContext(AssistantModeContext);
  if (!context) {
    throw new Error('useAssistantMode must be used within an AssistantModeProvider');
  }
  return context;
};

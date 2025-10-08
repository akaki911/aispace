import { useState } from 'react';

export type AssistantMode = 'assistant' | 'developer' | 'build' | 'plan';

export interface SetModeContext {
  actor?: string | null;
  source?: string;
}

export interface AssistantModeState {
  mode: AssistantMode;
  setMode: (nextMode: AssistantMode, context?: SetModeContext) => void;
  isReadOnly: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  isSyncing: boolean;
  syncError: string | null;
}

export const useAssistantMode = (): AssistantModeState => {
  const [mode, setModeState] = useState<AssistantMode>('build');

  const setMode = (nextMode: AssistantMode) => {
    setModeState(nextMode);
  };

  return {
    mode,
    setMode,
    isReadOnly: mode === 'plan',
    lastUpdatedAt: null,
    lastUpdatedBy: null,
    isSyncing: false,
    syncError: null,
  };
};

export default useAssistantMode;

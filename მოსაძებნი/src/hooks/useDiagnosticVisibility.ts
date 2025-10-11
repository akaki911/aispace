import { useCallback, useEffect, useMemo, useState } from 'react';

type DiagnosticState = {
  collapsed: boolean;
  dismissed: boolean;
};

const STORAGE_KEY = 'diagnostic-visibility-state';

const defaultState: DiagnosticState = {
  collapsed: false,
  dismissed: false
};

function readState(): DiagnosticState {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultState;
    }

    const parsed = JSON.parse(stored) as Partial<DiagnosticState>;
    return {
      collapsed: Boolean(parsed.collapsed),
      dismissed: Boolean(parsed.dismissed)
    };
  } catch (error) {
    console.warn('[DiagnosticVisibility] Failed to read state', error);
    return defaultState;
  }
}

function writeState(next: DiagnosticState) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[DiagnosticVisibility] Failed to persist state', error);
  }
}

export function useDiagnosticVisibility() {
  const [state, setState] = useState<DiagnosticState>(() => readState());

  useEffect(() => {
    setState(readState());
  }, []);

  useEffect(() => {
    writeState(state);
  }, [state]);

  const toggleCollapsed = useCallback(() => {
    setState(prev => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const dismiss = useCallback(() => {
    setState(prev => ({ ...prev, dismissed: true }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultState);
  }, []);

  return useMemo(
    () => ({
      collapsed: state.collapsed,
      dismissed: state.dismissed,
      toggleCollapsed,
      dismiss,
      reset
    }),
    [state.collapsed, state.dismissed, toggleCollapsed, dismiss, reset]
  );
}

export type UseDiagnosticVisibilityReturn = ReturnType<typeof useDiagnosticVisibility>;

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type AssistantMode = 'plan' | 'build';

export interface AssistantModeChangeMeta {
  actor?: string | null;
  source?: string;
  timestamp?: string;
}

export interface AssistantModeContextValue {
  mode: AssistantMode;
  isReadOnly: boolean;
  setMode: (mode: AssistantMode, meta?: AssistantModeChangeMeta) => void;
  toggleMode: (meta?: AssistantModeChangeMeta) => void;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  isSyncing: boolean;
  syncError: string | null;
}

type StoredPlanMode = {
  mode: AssistantMode;
  updatedAt: string;
  updatedBy?: string | null;
};

const STORAGE_KEY = 'ai-developer.planMode';
const CONFIG_ENDPOINT = '/api/config/planMode';

const AssistantModeContext = createContext<AssistantModeContextValue | undefined>(undefined);

const parseAssistantMode = (value: unknown): AssistantMode | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase();
  return normalized === 'plan' || normalized === 'build' ? (normalized as AssistantMode) : null;
};

const parseStoredPayload = (value: unknown): StoredPlanMode | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const mode =
    parseAssistantMode(candidate.mode) ||
    parseAssistantMode(candidate.planMode) ||
    parseAssistantMode(candidate.value);

  if (!mode) {
    return null;
  }

  const updatedAtRaw = (candidate.updatedAt || candidate.updated_at || candidate.timestamp) as string | undefined;
  const updatedAt = updatedAtRaw ? new Date(updatedAtRaw).toISOString() : new Date().toISOString();
  const updatedBy = (candidate.updatedBy || candidate.updated_by || candidate.actor) as string | null | undefined;

  return {
    mode,
    updatedAt,
    updatedBy: updatedBy ?? null,
  };
};

const readLocalPlanMode = (): StoredPlanMode | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    return parseStoredPayload(parsed);
  } catch (error) {
    console.warn('[AssistantMode] Failed to read plan mode from localStorage', error);
    return null;
  }
};

const writeLocalPlanMode = (payload: StoredPlanMode) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[AssistantMode] Failed to persist plan mode to localStorage', error);
  }
};

const resolveInitialMode = (): StoredPlanMode => {
  const localState = readLocalPlanMode();
  if (localState) {
    return localState;
  }

  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const rawValue = typeof env.VITE_ASSISTANT_MODE === 'string' ? env.VITE_ASSISTANT_MODE : undefined;
  const mode: AssistantMode = rawValue && rawValue.toLowerCase() === 'build' ? 'build' : 'plan';

  return {
    mode,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  };
};

export const AssistantModeProvider = ({ children }: { children: ReactNode }) => {
  const initialState = useRef<StoredPlanMode>(resolveInitialMode());
  const [{ mode, updatedAt, updatedBy }, setState] = useState<StoredPlanMode>(initialState.current);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isSyncing = pendingRequests > 0;

  const applyState = useCallback((payload: StoredPlanMode) => {
    setState({
      mode: payload.mode,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy ?? null,
    });
  }, []);

  const persistToBackend = useCallback(async (payload: StoredPlanMode) => {
    if (typeof fetch !== 'function') {
      return;
    }

    setPendingRequests((count) => count + 1);
    setSyncError(null);

    try {
      const response = await fetch(CONFIG_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn('[AssistantMode] Failed to sync plan mode with backend', error);
      setSyncError(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingRequests((count) => (count > 0 ? count - 1 : 0));
    }
  }, []);

  const updateMode = useCallback(
    (nextMode: AssistantMode, meta?: AssistantModeChangeMeta, options?: { skipBackend?: boolean; skipLocal?: boolean }) => {
      const timestamp = meta?.timestamp ? new Date(meta.timestamp).toISOString() : new Date().toISOString();
      const actor = meta?.actor ?? updatedBy ?? null;

      const payload: StoredPlanMode = {
        mode: nextMode,
        updatedAt: timestamp,
        updatedBy: actor,
      };

      applyState(payload);

      if (!options?.skipLocal) {
        writeLocalPlanMode(payload);
      }

      if (!options?.skipBackend) {
        void persistToBackend(payload);
      }
    },
    [applyState, persistToBackend, updatedBy],
  );

  useEffect(() => {
    if (typeof fetch !== 'function') {
      return;
    }

    let isMounted = true;

    const syncFromBackend = async () => {
      setPendingRequests((count) => count + 1);
      try {
        const response = await fetch(CONFIG_ENDPOINT, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const parsed = parseStoredPayload(data?.data ?? data?.config ?? data);

        if (parsed && isMounted) {
          applyState(parsed);
          writeLocalPlanMode(parsed);
        }
      } catch (error) {
        console.warn('[AssistantMode] Failed to load plan mode from backend', error);
      } finally {
        if (isMounted) {
          setPendingRequests((count) => (count > 0 ? count - 1 : 0));
        }
      }
    };

    void syncFromBackend();

    return () => {
      isMounted = false;
    };
  }, [applyState]);

  const setMode = useCallback(
    (nextMode: AssistantMode, meta?: AssistantModeChangeMeta) => {
      updateMode(nextMode, meta);
    },
    [updateMode],
  );

  const toggleMode = useCallback(
    (meta?: AssistantModeChangeMeta) => {
      const nextMode = mode === 'plan' ? 'build' : 'plan';
      updateMode(nextMode, meta);
    },
    [mode, updateMode],
  );

  const value = useMemo<AssistantModeContextValue>(
    () => ({
      mode,
      isReadOnly: mode === 'plan',
      setMode,
      toggleMode,
      lastUpdatedAt: updatedAt ?? null,
      lastUpdatedBy: updatedBy ?? null,
      isSyncing,
      syncError,
    }),
    [isSyncing, mode, setMode, syncError, toggleMode, updatedAt, updatedBy],
  );

  return <AssistantModeContext.Provider value={value}>{children}</AssistantModeContext.Provider>;
};

export default AssistantModeContext;

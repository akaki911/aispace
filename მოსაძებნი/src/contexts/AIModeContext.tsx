import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type AIMode = 'live';

export interface AIModeContextValue {
  mode: AIMode;
  isLive: boolean;
  setMode: (mode: AIMode) => void;
  lastUpdatedAt: string | null;
}

const STORAGE_KEY = 'gurulo.aiMode';

const resolveInitialMode = (): { mode: AIMode; updatedAt: string | null } => {
  const resolvedAt = new Date().toISOString();

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'live') {
        return { mode: 'live', updatedAt: resolvedAt };
      }
      if (stored && stored !== 'live') {
        console.info('[AIMode] Live enforcement active — ignoring stored override');
      }
    } catch (error) {
      console.warn('[AIMode] Unable to read stored mode', error);
    }
  }

  return { mode: 'live', updatedAt: resolvedAt };
};

const AIModeContext = createContext<AIModeContextValue | undefined>(undefined);

export const AIModeProvider = ({ children }: { children: ReactNode }) => {
  const initialRef = useRef(resolveInitialMode());
  const [modeState, setModeState] = useState<AIMode>(initialRef.current.mode);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(initialRef.current.updatedAt);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        modeState,
      );
    } catch (error) {
      console.warn('[AIMode] Unable to persist mode', error);
    }
  }, [modeState]);

  const setMode = useCallback((nextMode: AIMode) => {
    const timestamp = new Date().toISOString();
    if (nextMode !== 'live') {
      console.info('[AIMode] Live enforcement active — ignoring non-live mode toggle');
    }
    setModeState('live');
    setLastUpdatedAt(timestamp);
  }, []);

  const value = useMemo(
    () => ({
      mode: modeState,
      isLive: modeState === 'live',
      setMode,
      lastUpdatedAt,
    }),
    [modeState, lastUpdatedAt, setMode],
  );

  return <AIModeContext.Provider value={value}>{children}</AIModeContext.Provider>;
};

export default AIModeContext;

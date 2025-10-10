import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  devConsoleEventBus,
  type DevConsoleConnectionStatus,
  type DevConsoleEventDetail,
} from '@/lib/devConsoleEventBus';
import { connectAutoImproveStream, type AutoImproveStreamController } from '@/lib/sse/autoImproveSSE';

type ConsoleEntry = {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  createdAt: string;
};

interface DevConsoleContextValue {
  entries: ConsoleEntry[];
  appendEntry: (entry: Omit<ConsoleEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => void;
  clear: () => void;
  connectionStatus: DevConsoleConnectionStatus;
  lastEventAt: number | null;
}

const MAX_ENTRIES = 500;
const STREAM_KEY = '__AISPACE_DEVCONSOLE_STREAM__';

type StreamRef = {
  controller: AutoImproveStreamController;
  count: number;
};

const DevConsoleContext = createContext<DevConsoleContextValue>({
  entries: [],
  appendEntry: () => undefined,
  clear: () => undefined,
  connectionStatus: 'connecting',
  lastEventAt: null,
});

const ensureGlobalStream = (): (() => void) | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const globalWindow = window as typeof window & { [STREAM_KEY]?: StreamRef };
  const existing = globalWindow[STREAM_KEY];

  if (existing) {
    existing.count += 1;
    return () => {
      existing.count -= 1;
      if (existing.count <= 0) {
        existing.controller.close();
        delete globalWindow[STREAM_KEY];
      }
    };
  }

  const controller = connectAutoImproveStream();
  const ref: StreamRef = { controller, count: 1 };
  globalWindow[STREAM_KEY] = ref;

  return () => {
    ref.count -= 1;
    if (ref.count <= 0) {
      ref.controller.close();
      delete globalWindow[STREAM_KEY];
    }
  };
};

const normaliseLevel = (value: unknown): ConsoleEntry['level'] => {
  if (typeof value !== 'string') {
    return 'info';
  }

  const lower = value.toLowerCase();

  if (lower === 'warn' || lower === 'warning') {
    return 'warn';
  }
  if (lower === 'error' || lower === 'danger') {
    return 'error';
  }
  if (lower === 'success' || lower === 'ok') {
    return 'success';
  }
  return 'info';
};

const extractMessage = (detail: DevConsoleEventDetail): { level: ConsoleEntry['level']; message: string } | null => {
  if (detail.kind !== 'event') {
    return null;
  }

  if (detail.eventName === 'heartbeat') {
    return null;
  }

  const { data } = detail.event;

  if (!data) {
    return {
      level: 'info',
      message: `[${detail.eventName}]`,
    };
  }

  try {
    if (typeof data !== 'string') {
      return {
        level: 'info',
        message: String(data),
      };
    }

    const parsed = JSON.parse(data) as { level?: string; message?: string } | string;
    if (typeof parsed === 'string') {
      return {
        level: 'info',
        message: parsed,
      };
    }
    const level = normaliseLevel(parsed.level);
    const message = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : data;

    return { level, message };
  } catch {
    const fallback = typeof data === 'string' ? data : String(data);
    return {
      level: 'info',
      message: fallback,
    };
  }
};

export const DevConsoleProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<DevConsoleConnectionStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const appendEntry = useCallback<DevConsoleContextValue['appendEntry']>((entry) => {
    setEntries((prev) => {
      const next: ConsoleEntry[] = [
        ...prev,
        {
          id: entry.id ?? crypto.randomUUID(),
          level: entry.level,
          message: entry.message,
          createdAt: entry.createdAt ?? new Date().toISOString(),
        },
      ];
      return next.slice(-MAX_ENTRIES);
    });
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  useEffect(() => {
    const detach = ensureGlobalStream();
    return () => {
      detach?.();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = devConsoleEventBus.addListener((detail) => {
      if (detail.kind === 'status') {
        setConnectionStatus(detail.status);
        return;
      }

      setLastEventAt(detail.receivedAt);
      const parsed = extractMessage(detail);
      if (!parsed) {
        return;
      }

      setEntries((prev) => {
        const next: ConsoleEntry[] = [
          ...prev,
          {
            id: crypto.randomUUID(),
            level: parsed.level,
            message: parsed.message,
            createdAt: new Date(detail.receivedAt).toISOString(),
          },
        ];
        return next.slice(-MAX_ENTRIES);
      });
    });

    return unsubscribe;
  }, []);

  const value = useMemo<DevConsoleContextValue>(
    () => ({
      entries,
      appendEntry,
      clear,
      connectionStatus,
      lastEventAt,
    }),
    [appendEntry, clear, connectionStatus, entries, lastEventAt],
  );

  return <DevConsoleContext.Provider value={value}>{children}</DevConsoleContext.Provider>;
};

export const useDevConsole = () => useContext(DevConsoleContext);


import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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
}

const DevConsoleContext = createContext<DevConsoleContextValue>({
  entries: [],
  appendEntry: () => undefined,
  clear: () => undefined,
});

export const DevConsoleProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);

  const appendEntry = useCallback<DevConsoleContextValue['appendEntry']>((entry) => {
    setEntries((prev) => [
      ...prev,
      {
        id: entry.id ?? crypto.randomUUID(),
        level: entry.level,
        message: entry.message,
        createdAt: entry.createdAt ?? new Date().toISOString(),
      },
    ]);
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo<DevConsoleContextValue>(
    () => ({
      entries,
      appendEntry,
      clear,
    }),
    [appendEntry, clear, entries],
  );

  return <DevConsoleContext.Provider value={value}>{children}</DevConsoleContext.Provider>;
};

export const useDevConsole = () => useContext(DevConsoleContext);

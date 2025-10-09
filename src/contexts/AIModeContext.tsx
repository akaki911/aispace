import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AIMode = 'assistant' | 'developer';

interface AIModeValue {
  mode: AIMode;
  setMode: (mode: AIMode) => void;
}

const AIModeContext = createContext<AIModeValue>({
  mode: 'developer',
  setMode: () => undefined,
});

export const AIModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<AIMode>('developer');

  const value = useMemo<AIModeValue>(() => ({ mode, setMode }), [mode]);

  return <AIModeContext.Provider value={value}>{children}</AIModeContext.Provider>;
};

export const useAIMode = () => useContext(AIModeContext);

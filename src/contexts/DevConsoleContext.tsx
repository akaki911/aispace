import React, { createContext, useContext, useMemo, useState } from 'react';

interface DevConsoleContextValue {
  activePanel: string;
  setActivePanel: (panel: string) => void;
}

const DevConsoleContext = createContext<DevConsoleContextValue | undefined>(undefined);

export const DevConsoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePanel, setActivePanel] = useState('logs');

  const value = useMemo(() => ({ activePanel, setActivePanel }), [activePanel]);

  return <DevConsoleContext.Provider value={value}>{children}</DevConsoleContext.Provider>;
};

export const useDevConsole = () => {
  const context = useContext(DevConsoleContext);
  if (!context) {
    throw new Error('useDevConsole must be used within a DevConsoleProvider');
  }
  return context;
};


import React, { useState, useCallback, ReactNode } from 'react';
import { DebugContext } from './DebugContextObject';
import type { DebugContextType, DebugLog } from './DebugContext.types';
export type { DebugContextType, DebugLog } from './DebugContext.types';

interface DebugProviderProps {
  children: ReactNode;
}

export const DebugProvider: React.FC<DebugProviderProps> = ({ children }) => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isConsoleVisible, setIsConsoleVisible] = useState(false);

  const logEvent = useCallback((log: Omit<DebugLog, 'id' | 'timestamp'>) => {
    const newLog: DebugLog = {
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setLogs(prevLogs => {
      const updatedLogs = [...prevLogs, newLog];
      // Keep only the last 100 entries
      return updatedLogs.slice(-100);
    });

    // Also log to browser console for development
    const logLevel = log.type === 'ERROR' ? 'error' : log.type === 'WARN' ? 'warn' : 'log';
    console[logLevel](`[${log.type}] ${log.component || 'App'}: ${log.message}`, log.metadata);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleConsole = useCallback(() => {
    setIsConsoleVisible(prev => !prev);
  }, []);

  const value: DebugContextType = {
    logs,
    logEvent,
    clearLogs,
    isConsoleVisible,
    toggleConsole
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

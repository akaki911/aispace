import React, { useState, useCallback, ReactNode } from "react";
import { DevConsoleContext } from './DevConsoleContextObject';
import type { DevConsoleContextType, LogEntry } from './DevConsoleContext.types';
export type { DevConsoleContextType, LogEntry, ConnectionStatus } from './DevConsoleContext.types';

// Provider component props
interface DevConsoleProviderProps {
  children: ReactNode;
}

// Provider component
export const DevConsoleProvider: React.FC<DevConsoleProviderProps> = ({ children }) => {
  // Log state
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Buffer metrics
  const [bufferSize, setBufferSize] = useState(0);
  const [droppedPercentage, setDroppedPercentage] = useState(0);

  // Loading state
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  // Clear logs action
  const clearLogs = useCallback(() => {
    setLogs([]);
    setBufferSize(0);
    setDroppedPercentage(0);
  }, []);

  // Add single log action
  const addLog = useCallback((log: LogEntry) => {
    setLogs(prevLogs => [...prevLogs, log]);
    setBufferSize(prevSize => prevSize + 1);
  }, []);

  const contextValue: DevConsoleContextType = {
    logs,
    setLogs,
    connectionStatus,
    setConnectionStatus,
    bufferSize,
    setBufferSize,
    droppedPercentage,
    setDroppedPercentage,
    isLoadingFromCache,
    setIsLoadingFromCache,
    clearLogs,
    addLog
  };

  return (
    <DevConsoleContext.Provider value={contextValue}>
      {children}
    </DevConsoleContext.Provider>
  );
};
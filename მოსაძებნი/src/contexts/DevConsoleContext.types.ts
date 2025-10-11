export interface LogEntry {
  ts: number;
  source: 'ai' | 'backend' | 'frontend' | 'functions';
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: any;
  id: string;
}

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  lastReconnectAt?: number;
}

export interface DevConsoleContextType {
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  setConnectionStatus: React.Dispatch<React.SetStateAction<'connected' | 'connecting' | 'disconnected'>>;
  bufferSize: number;
  setBufferSize: React.Dispatch<React.SetStateAction<number>>;
  droppedPercentage: number;
  setDroppedPercentage: React.Dispatch<React.SetStateAction<number>>;
  isLoadingFromCache: boolean;
  setIsLoadingFromCache: React.Dispatch<React.SetStateAction<boolean>>;
  clearLogs: () => void;
  addLog: (log: LogEntry) => void;
}

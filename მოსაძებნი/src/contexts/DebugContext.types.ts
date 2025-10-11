export interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'INFO' | 'WARN' | 'ERROR' | 'API' | 'MODAL' | 'VALIDATION';
  message: string;
  metadata?: any;
  component?: string;
}

export interface DebugContextType {
  logs: DebugLog[];
  logEvent: (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  isConsoleVisible: boolean;
  toggleConsole: () => void;
}

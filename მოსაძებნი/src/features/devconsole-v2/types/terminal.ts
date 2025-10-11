export interface TerminalSession {
  id: string;
  name: string;
  userId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  history: TerminalCommand[];
  status: 'idle' | 'running' | 'error';
  created: string;
  lastActivity: string;
  output: TerminalOutput[];
  maxOutputLines: number;
}

export interface TerminalCommand {
  command: string;
  timestamp: string;
}

export interface TerminalOutput {
  type: 'stdout' | 'stderr' | 'command' | 'info' | 'error' | 'history_output';
  content: string;
  timestamp: string;
}

export interface TerminalTab {
  id: string;
  name: string;
  sessionId: string;
  isActive: boolean;
  hasUnsavedOutput: boolean;
  status: 'idle' | 'running' | 'error' | 'connecting';
  lastCommand?: string;
}

export interface TerminalExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
  success: boolean;
  timestamp: string;
}

export interface TerminalEventMessage {
  type: 'command_start' | 'output' | 'command_complete' | 'command_error' | 'connection_established' | 'history_output' | 'heartbeat' | 'session_terminated';
  command?: string;
  outputType?: 'stdout' | 'stderr';
  data?: string;
  result?: TerminalExecutionResult;
  error?: string;
  sessionId?: string;
  session?: Partial<TerminalSession>;
  timestamp: string;
}

export interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  sessions: Map<string, TerminalSession>;
  connections: Map<string, EventSource>;
  
  // Actions
  createTab: (name?: string, workingDirectory?: string) => Promise<string>;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  executeCommand: (sessionId: string, command: string) => Promise<void>;
  renameTab: (tabId: string, newName: string) => void;
  getTabHistory: (tabId: string) => TerminalCommand[];
  clearTabOutput: (tabId: string) => void;
}

export interface TerminalSessionAPI {
  sessions: TerminalSession[];
  timestamp: string;
}

export interface CreateSessionRequest {
  name?: string;
  workingDirectory?: string;
}

export interface CreateSessionResponse {
  success: boolean;
  session: TerminalSession;
  timestamp: string;
}

export interface ExecuteCommandRequest {
  command: string;
}

import { useState } from 'react';
import { systemCleanerService } from '@/services/SystemCleanerService';

interface ActiveContext {
  activeFile: {
    path: string;
    content: string;
    selection?: { start: number; end: number };
    language: string;
  } | null;
  lastEditedFiles: Array<{
    path: string;
    lastModified: string;
    preview: string;
  }>;
  consoleErrors: Array<{
    message: string;
    level: string;
    timestamp: string;
    source: string;
  }>;
  currentRoute: string;
}

interface LogEntry {
  id: string;
  type: "info" | "success" | "error" | "warning";
  source: "ai-service" | "backend" | "frontend" | "npm" | "system";
  message: string;
  timestamp: Date;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  port?: number;
  process?: string;
  hasUrl?: boolean;
  url?: string;
}

interface GitStatus {
  branch: string;
  lastCommit: string;
  hasChanges: boolean;
  changedFiles: number;
}

const defaultSecretsTelemetry = {
  total: 0,
  requiredMissing: 0,
  lastStatus: 'unknown',
  queueLength: 0,
  pendingKeys: 0,
  lastAction: null as string | null,
  lastCompletedAt: null as string | null,
};

export const useSystemState = () => {
  const [userRoleState, setUserRole] = useState<string>("");
  
  const [activeContext, setActiveContext] = useState<ActiveContext>({
    activeFile: null,
    lastEditedFiles: [],
    consoleErrors: [],
    currentRoute: "developer-panel",
  });

  const [telemetryData, setTelemetryData] = useState({
    totalRequests: 0,
    averageLatency: 0,
    errorRate: 0,
    fallbackUsage: 0,
    lastUpdate: new Date().toISOString(),
    secrets: defaultSecretsTelemetry,
  });

  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  
  const [cleanerEnabled, setCleanerEnabled] = useState(
    systemCleanerService.isCleaningEnabled(),
  );
  
  const [isCleaningNow, setIsCleaningNow] = useState(false);
  
  const [lastCleanup, setLastCleanup] = useState(
    systemCleanerService.getLastCleanupTime(),
  );

  const [gitStatus] = useState<GitStatus>({
    branch: "main",
    lastCommit: "a7b3c8d",
    hasChanges: true,
    changedFiles: 3,
  });

  return {
    userRoleState,
    setUserRole,
    activeContext,
    setActiveContext,
    telemetryData,
    setTelemetryData,
    consoleLogs,
    setConsoleLogs,
    cleanerEnabled,
    setCleanerEnabled,
    isCleaningNow,
    setIsCleaningNow,
    lastCleanup,
    setLastCleanup,
    gitStatus
  };
};

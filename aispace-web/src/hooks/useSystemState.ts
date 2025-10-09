
import { useEffect, useState } from 'react';
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
    cpuUsage: 0,
    throughput: 0,
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

  useEffect(() => {
    let isActive = true;
    let abortController: AbortController | null = null;
    let intervalId: number | NodeJS.Timeout | null = null;

    const parseNumber = (value: unknown): number | undefined => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const numeric = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);
      return Number.isFinite(numeric) ? numeric : undefined;
    };

    const fetchTelemetry = async () => {
      abortController?.abort();
      abortController = new AbortController();

      try {
        const response = await fetch('/api/system/telemetry', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const payload = await response.json();
        if (!isActive) {
          return;
        }

        const cpu =
          parseNumber(payload?.cpu) ??
          parseNumber(payload?.cpuUsage) ??
          parseNumber(payload?.metrics?.cpu);
        const latency =
          parseNumber(payload?.latency) ??
          parseNumber(payload?.latencyMs) ??
          parseNumber(payload?.metrics?.latency);
        const throughput =
          parseNumber(payload?.throughput) ??
          parseNumber(payload?.requestsPerSecond) ??
          parseNumber(payload?.metrics?.throughput);
        const totalRequests =
          parseNumber(payload?.totalRequests) ??
          throughput ??
          parseNumber(payload?.metrics?.totalRequests);
        const errorRate =
          parseNumber(payload?.errorRate) ??
          parseNumber(payload?.errorsPerSecond) ??
          parseNumber(payload?.metrics?.errorRate);
        const fallback =
          parseNumber(payload?.fallbackUsage) ??
          parseNumber(payload?.metrics?.fallbackUsage);

        setTelemetryData(prev => ({
          ...prev,
          totalRequests: totalRequests ?? prev.totalRequests,
          averageLatency: latency ?? prev.averageLatency,
          errorRate: errorRate ?? prev.errorRate,
          fallbackUsage: fallback ?? prev.fallbackUsage,
          cpuUsage: cpu ?? prev.cpuUsage,
          throughput: throughput ?? prev.throughput,
          lastUpdate: new Date().toISOString(),
          secrets: payload?.secrets ? { ...defaultSecretsTelemetry, ...payload.secrets } : prev.secrets,
        }));
      } catch (error) {
        if (!isActive) {
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch system telemetry', error);
      }
    };

    if (typeof window !== 'undefined') {
      void fetchTelemetry();
      intervalId = window.setInterval(fetchTelemetry, 5000);
    } else {
      void fetchTelemetry();
    }

    return () => {
      isActive = false;
      abortController?.abort();
      if (typeof intervalId === 'number') {
        window.clearInterval(intervalId);
      } else if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

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

// Auto-Improve specific interfaces
export interface AutoUpdateKPIs {
  aiHealth: 'OK' | 'WARN' | 'ERROR';
  backendHealth: 'OK' | 'WARN' | 'ERROR';
  frontendHealth: 'OK' | 'WARN' | 'ERROR';
  queueLength: number;
  p95ResponseTime: number;
  errorRate: number;
  lastRunAt: string;
  mode: 'auto' | 'manual' | 'paused';
  
  // Optional AI-specific metrics
  modelStatus?: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  responseTime?: number;
  processingRate?: number;
  lastModelUpdate?: string;
}

export interface AutoUpdateRun {
  id: string;
  startedAt: string;
  sources: string[];
  result: 'success' | 'failed' | 'running';
  cid: string;
}

export interface LiveEvent {
  id?: string;
  type: 'CheckStarted' | 'CheckPassed' | 'CheckFailed' | 'TestsRunning' | 'TestsPassed' | 'TestsFailed' | 'Risk' | 'ArtifactsReady' | 'ProposalsPushed';
  message: string;
  timestamp: string;
  cid: string;
  source?: string;
  metadata?: Record<string, unknown>;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Proposal {
  id: string;
  title: string;
  summary: string;
  description?: string;
  status: 'pending' | 'approved' | 'applied' | 'failed' | 'rejected' | 'validating' | 'declined' | 'edited' | 'needs_rollback';
  severity: 'P1' | 'P2' | 'P3';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'performance' | 'security' | 'maintainability' | 'bug-fix' | string;
  impact?: number;
  confidence?: number;
  estimatedTime?: number;
  source?: string;
  correlationId?: string;
  kpiKey?: string;
  routeDecision?: string;
  modelUsed?: string;
  memoryContext?: Array<Record<string, unknown>>;
  risk?: {
    level: 'low' | 'medium' | 'high';
    badge?: {
      icon?: string;
      label?: string;
    };
  };
  files?: Array<{
    path: string;
    lines: number;
    rule: string;
    note: string;
  }>;
  changes?: unknown;
  scope?: string[];
  evidence?: Array<{
    note: string;
  }>;
  createdAt?: {
    seconds: number;
  };
  appliedAt?: string;
  approvedAt?: string;
  editedAt?: string;
  rejectedAt?: string;
  statusHistory?: Array<{ status: string; at: string; reason?: string; note?: string }>;
  feedbackHistory?: Array<{
    outcome: 'improved' | 'regressed' | 'no-change' | string;
    delta: number;
    recordedAt: string;
    rollbackRecommended?: boolean;
  }>;
  lastKpiOutcome?: string;
  editNote?: string;
  rejectionReason?: string;
  rollbackAvailable?: boolean;
  error?: string;
  validation?: {
    passed: boolean;
    issues: Array<{ description: string; severity: 'low' | 'medium' | 'high' | 'critical' }>;
    completedAt?: string;
  };
}

export interface ValidationRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  description: string;
  scope: string[];
}

export interface AutoImproveSafetyLimits {
  rateLimit: number;
  maxFiles: number;
}

export interface AutoImproveNotificationSettings {
  email: boolean;
  slack: boolean;
  webhooks: string[];
}

export interface AutoImproveSettings {
  autoApply: boolean;
  maxChangesPerHour: number;
  allowedTimeWindows: string[];
  excludedPaths: string[];
  enabledScopes: string[];
  riskThreshold: 'low' | 'medium' | 'high';
  safety: AutoImproveSafetyLimits;
  notificationSettings: AutoImproveNotificationSettings;
}

export const defaultAutoImproveSettings: AutoImproveSettings = {
  autoApply: false,
  maxChangesPerHour: 0,
  allowedTimeWindows: [],
  excludedPaths: [],
  enabledScopes: [],
  riskThreshold: 'medium',
  safety: {
    rateLimit: 0,
    maxFiles: 0
  },
  notificationSettings: {
    email: false,
    slack: false,
    webhooks: []
  }
};

export interface AutoImproveStatus {
  state: 'online' | 'offline' | 'degraded' | 'maintenance' | 'unknown';
  message: string;
  lastCheckedAt: string;
  incidents: string[];
  version?: string;
}

export const defaultAutoImproveStatus: AutoImproveStatus = {
  state: 'unknown',
  message: 'service unavailable',
  lastCheckedAt: '',
  incidents: []
};

export interface AutoImproveGuardMetrics {
  filesScanned: number;
  violationsFound: number;
  rulesApplied: number;
  lastScan: string | null;
}

export interface AutoImproveMetrics {
  totalProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  appliedProposals: number;
  rollbackCount: number;
  averageApprovalTime: number;
  successRate: number;
  timeToApply: number;
  guard?: AutoImproveGuardMetrics;
  [key: string]: unknown;
}

export const defaultAutoImproveMetrics: AutoImproveMetrics = {
  totalProposals: 0,
  approvedProposals: 0,
  rejectedProposals: 0,
  appliedProposals: 0,
  rollbackCount: 0,
  averageApprovalTime: 0,
  successRate: 0,
  timeToApply: 0,
  guard: {
    filesScanned: 0,
    violationsFound: 0,
    rulesApplied: 0,
    lastScan: null
  }
};

export type AutoImproveTraceEventType = 'PLAN' | 'THOUGHT' | 'TOOL_CALL' | 'OBSERVATION' | 'FINAL';

export type AutoImproveTraceLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface AutoImproveTraceEvent {
  id: string;
  runId: string;
  type: AutoImproveTraceEventType;
  level: AutoImproveTraceLevel;
  message: string | null;
  tool: string | null;
  status: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export interface AutoImproveTraceRun {
  runId: string;
  status: string;
  goal: string | null;
  actor: string | null;
  source: string | null;
  metadata?: Record<string, unknown> | null;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  summary?: string | null;
  metrics?: Record<string, unknown> | null;
  events: AutoImproveTraceEvent[];
}

export type SystemConfig = AutoImproveSettings;
export type MetricsData = AutoImproveMetrics;
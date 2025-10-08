export interface StatusEventPayload {
  phase: string | null;
  connected: boolean;
  runId?: string | null;
  uptimeMs?: number | null;
  startedAt?: string | number | null;
  diffUrl?: string | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export interface ActionEventPayload {
  summary: string;
  filesTouched: string[];
  testsRan: string[];
  result: string;
  durationMs?: number | null;
  runId?: string | null;
  actionId?: string | null;
  diffUrl?: string | null;
  checkpointId?: string | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export interface ProblemEventPayload {
  title: string;
  stackKey?: string | null;
  severity?: string | null;
  evidence?: string[];
  runId?: string | null;
  diffUrl?: string | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export interface DecisionEventPayload {
  chosenPath: string;
  reason?: string | null;
  runId?: string | null;
  diffUrl?: string | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export interface LogEventPayload {
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  ts?: string | number;
  runId?: string | null;
  diffUrl?: string | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export interface MetricEventPayload {
  cpu: number | null;
  mem: number | null;
  reqRate: number | null;
  errorRate: number | null;
  latencyP95: number | null;
  timestamp?: string | number | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export interface ErrorEventPayload {
  code: string | number;
  message: string;
  hint?: string;
  runId?: string | null;
  diffUrl?: string | null;
  correlationId?: string | null;
  transport?: 'sse' | 'poll';
}

export type BrainEventPayload =
  | { type: 'status'; data: StatusEventPayload }
  | { type: 'action'; data: ActionEventPayload }
  | { type: 'problem'; data: ProblemEventPayload }
  | { type: 'decision'; data: DecisionEventPayload }
  | { type: 'log'; data: LogEventPayload }
  | { type: 'metric'; data: MetricEventPayload }
  | { type: 'error'; data: ErrorEventPayload };

export type BrainEventRecord = BrainEventPayload & {
  id: string;
  runId: string | null;
  receivedAt: number;
  diffUrl?: string | null;
  checkpointId?: string | null;
  transport?: 'sse' | 'poll';
  correlationId?: string | null;
};

export type BrainHistoryTone = 'info' | 'warning' | 'error';

export type BrainHistoryEntry = {
  runId: string | null;
  updatedAt: number;
  phase: string | null;
  headline: string;
  detail?: string | null;
  tone: BrainHistoryTone;
  diffUrl?: string | null;
};

export interface ControlCallbacks {
  onPause: () => void;
  onResume: () => void;
  onRetry: (runId?: string | null) => Promise<void>;
  onRollback: (runId?: string | null, checkpointId?: string | null) => Promise<void>;
  isPaused: boolean;
  isRetrying: boolean;
  isRollingBack: boolean;
}

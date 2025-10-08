export type AutoImproveServiceState = 'ok' | 'degraded' | 'offline';

export interface AutoImproveLogEntry {
  timestamp: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
}

export interface AutoImproveMetric {
  id: string;
  title: string;
  description?: string;
  status: 'ok' | 'warning' | 'error' | 'paused';
  latencyMs?: number | null;
  successRate?: number | null;
  paused?: boolean;
  model?: string | null;
  updatedAt?: string | number | null;
  logs?: Array<AutoImproveLogEntry | string>;
  value?: number | string | null;
  unit?: string | null;
  trend?: {
    direction: 'up' | 'down' | 'flat';
    value?: number | string | null;
    label?: string;
  } | null;
  progress?: {
    current: number;
    target?: number;
    tone?: 'ok' | 'warning' | 'error';
    label?: string;
  } | null;
  meta?: Array<{
    label: string;
    value: string;
    tone?: 'ok' | 'warning' | 'error';
  }>;
  footnote?: string | null;
  cta?: {
    label: string;
    onClick?: () => void;
    loading?: boolean;
    disabled?: boolean;
  } | null;
  dataTestId?: string;
}

export interface AutoImproveMetricsResponse {
  metrics: AutoImproveMetric[];
  updatedAt?: string | number | null;
  pollingDisabled?: boolean;
}

export interface AdminLogEntry {
  timestamp: string;
  severity: string;
  functionName: string | null;
  executionId: string | null;
  traceId?: string | null;
  text: string;
  latencyMs: number | null;
  labels?: Record<string, unknown>;
}

export interface AdminLogFunctionMetrics {
  invocations: number;
  errors: number;
  errorRate: number;
  lastSeen?: string | null;
  latency: {
    average: number;
    p95: number;
    p99: number;
  };
}

export interface AdminLogMetrics {
  windowMinutes: number;
  total: number;
  errors: number;
  errorRate: number;
  invocationsPerMinute: number;
  latency: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  functions: Record<string, AdminLogFunctionMetrics>;
}

export interface AdminLogsResponse {
  logs: AdminLogEntry[];
  metrics: AdminLogMetrics;
  observedAt: string;
  rateLimit: { remaining: number; reset: number } | null;
}

export interface FetchAdminLogsParams {
  limit?: number;
  minutes?: number;
  severity?: string;
  functionName?: string;
  metricsOnly?: boolean;
  logsOnly?: boolean;
  signal?: AbortSignal;
}

const buildQuery = (params: FetchAdminLogsParams): string => {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.minutes !== undefined) search.set('minutes', String(params.minutes));
  if (params.severity) search.set('severity', params.severity);
  if (params.functionName) search.set('functionName', params.functionName);
  if (params.metricsOnly) search.set('metricsOnly', '1');
  if (params.logsOnly) search.set('logsOnly', '1');
  const query = search.toString();
  return query ? `?${query}` : '';
};

const parseResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid server response');
  }
};

export const fetchAdminLogs = async (
  params: FetchAdminLogsParams = {},
): Promise<AdminLogsResponse> => {
  const query = buildQuery(params);
  const response = await fetch(`/api/admin/logs${query}`, {
    credentials: 'include',
    signal: params.signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const payload = await parseResponse(response).catch(() => ({}));
    const message = (payload as { error?: string })?.error || 'Failed to load admin logs';
    throw new Error(message);
  }

  const payload = await parseResponse(response);
  const data = (payload?.data ?? payload) as Partial<AdminLogsResponse>;
  const metrics = data.metrics as AdminLogMetrics | undefined;

  if (!metrics) {
    throw new Error('Admin metrics unavailable');
  }

  return {
    logs: Array.isArray(data.logs) ? data.logs : [],
    metrics,
    observedAt: data.observedAt || new Date().toISOString(),
    rateLimit: data.rateLimit ?? null,
  };
};

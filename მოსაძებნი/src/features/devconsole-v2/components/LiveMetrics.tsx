import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { AdminLogMetrics, AdminLogFunctionMetrics } from '../../../services/adminLogsApi';

export interface MetricsHistoryPoint {
  observedAt: string;
  invocationsPerMinute: number;
  errorRate: number;
  latencyAverage: number;
  latencyP95: number;
  latencyP99: number;
  total: number;
  errors: number;
}

interface LiveMetricsProps {
  metrics: AdminLogMetrics | null;
  history: MetricsHistoryPoint[];
  isLoading: boolean;
  lastUpdated?: string | null;
  error?: string | null;
  onRefresh?: () => void;
  rateLimitRemaining?: number | null;
}

const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}) => {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
};

const formatRelativeTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return '—';
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return '—';

  const diffMs = Date.now() - parsed;
  if (!Number.isFinite(diffMs)) return '—';

  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatTimestamp = (timestamp: string | null | undefined) => {
  if (!timestamp) return '—';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsed);
};

const sparklineClassMap: Record<'blue' | 'green' | 'rose', string> = {
  blue: 'bg-blue-400 dark:bg-blue-500',
  green: 'bg-emerald-400 dark:bg-emerald-500',
  rose: 'bg-rose-400 dark:bg-rose-500',
};

const renderSparkline = (values: number[], color: keyof typeof sparklineClassMap) => {
  if (!values.length) {
    return <div className="text-xs text-gray-500">No data</div>;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  return (
    <div className="flex items-end space-x-px h-10 mt-1">
      {values.map((value, index) => {
        const scaled = range === 0 ? 50 : ((value - min) / range) * 100;
        return (
          <div
            key={`${color}-${index}`}
            className={`w-1 rounded-sm ${sparklineClassMap[color]} transition-all duration-200`}
            style={{ height: `${Math.max(4, scaled)}%` }}
          />
        );
      })}
    </div>
  );
};

const getErrorBadgeClass = (errorRate: number) => {
  if (errorRate >= 10) return 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/40';
  if (errorRate >= 5) return 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/40';
  return 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/40';
};

const getLatencyBadgeClass = (latency: number) => {
  if (latency >= 1000) return 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/40';
  if (latency >= 500) return 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/40';
  return 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/40';
};

export const LiveMetrics: React.FC<LiveMetricsProps> = ({
  metrics,
  history,
  isLoading,
  lastUpdated,
  error,
  onRefresh,
  rateLimitRemaining,
}) => {
  const invocationsHistory = history.map((point) => point.invocationsPerMinute);
  const errorRateHistory = history.map((point) => point.errorRate);
  const latencyHistory = history.map((point) => point.latencyP95);

  const topFunctions = metrics
    ? (Object.entries(metrics.functions || {}) as Array<[string, AdminLogFunctionMetrics]>)
        .sort(([, a], [, b]) => (b.invocations ?? 0) - (a.invocations ?? 0))
        .slice(0, 5)
    : [];

  return (
    <div className="h-full flex flex-col border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center space-x-2">
            <BarChart3 size={16} className="text-blue-500" />
            <span>Cloud Functions Metrics</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Window: {metrics?.windowMinutes ?? 0}m · Updated {formatRelativeTime(lastUpdated)}
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
          {typeof rateLimitRemaining === 'number' && (
            <span className="flex items-center space-x-1">
              <Clock size={12} />
              <span>Quota {rateLimitRemaining}</span>
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center space-x-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Refreshing' : 'Refresh'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!metrics && !isLoading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded p-4 text-center">
            No metrics available yet. Once Cloud Logging provides data this panel will populate automatically.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Activity size={12} className="text-blue-500" />
                    <span>Invocations / min</span>
                  </span>
                  <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                    {formatNumber(metrics?.invocationsPerMinute ?? 0)}
                  </span>
                </div>
                {renderSparkline(invocationsHistory, 'blue')}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center space-x-1">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span>Error rate</span>
                  </span>
                  <span className={`font-mono text-sm ${getErrorBadgeClass((metrics?.errorRate ?? 0) * 100)}`}>
                    {formatNumber((metrics?.errorRate ?? 0) * 100, { maximumFractionDigits: 2 })}%
                  </span>
                </div>
                {renderSparkline(errorRateHistory, 'rose')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Zap size={12} className="text-purple-500" />
                    <span>Latency p95</span>
                  </span>
                  <span className={`font-mono text-sm ${getLatencyBadgeClass(metrics?.latency.p95 ?? 0)}`}>
                    {formatNumber(metrics?.latency.p95 ?? 0, { maximumFractionDigits: 0 })}ms
                  </span>
                </div>
                {renderSparkline(latencyHistory, 'green')}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Clock size={12} className="text-cyan-500" />
                    <span>Average latency</span>
                  </span>
                  <span className={`font-mono text-sm ${getLatencyBadgeClass(metrics?.latency.average ?? 0)}`}>
                    {formatNumber(metrics?.latency.average ?? 0, { maximumFractionDigits: 0 })}ms
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  p50 {formatNumber(metrics?.latency.p50 ?? 0, { maximumFractionDigits: 0 })}ms · p99 {formatNumber(metrics?.latency.p99 ?? 0, { maximumFractionDigits: 0 })}ms
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  <span>Total invocations</span>
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatNumber(metrics?.total ?? 0, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Errors {formatNumber(metrics?.errors ?? 0, { maximumFractionDigits: 0 })}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                  <Clock size={12} className="text-indigo-500" />
                  <span>Last observed</span>
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatTimestamp(lastUpdated ?? null)}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(lastUpdated)}</p>
              </div>
            </div>

            {topFunctions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  Top Functions
                </h4>
                <div className="space-y-2">
                  {topFunctions.map(([name, fn]) => {
                    const errorRate = (fn.errorRate ?? 0) * 100;
                    const badgeClass = getErrorBadgeClass(errorRate);
                    return (
                      <div
                        key={name}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={name}>
                            {name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${badgeClass}`}>
                            {formatNumber(errorRate, { maximumFractionDigits: 2 })}%
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="flex flex-col">
                            <span className="text-[10px] uppercase">Invocations</span>
                            <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              {formatNumber(fn.invocations ?? 0, { maximumFractionDigits: 0 })}
                            </span>
                          </span>
                          <span className="flex flex-col">
                            <span className="text-[10px] uppercase">Errors</span>
                            <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              {formatNumber(fn.errors ?? 0, { maximumFractionDigits: 0 })}
                            </span>
                          </span>
                          <span className="flex flex-col">
                            <span className="text-[10px] uppercase">p99</span>
                            <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              {formatNumber(fn.latency?.p99 ?? 0, { maximumFractionDigits: 0 })}ms
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Last seen {formatRelativeTime(fn.lastSeen ?? null)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

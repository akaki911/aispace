import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import type { AdminLogMetrics, AdminLogFunctionMetrics } from '../../../services/adminLogsApi';

interface ServicePanelProps {
  metrics: AdminLogMetrics | null;
  isLoading: boolean;
  lastUpdated?: string | null;
  error?: string | null;
  onRefresh?: () => void;
}

const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, ...options }).format(value);

const formatRelativeTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return '—';
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return '—';
  const diffSeconds = Math.max(0, Math.round((Date.now() - parsed) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const getStatusStyle = (errorRate: number) => {
  if (errorRate >= 10) {
    return {
      label: 'critical',
      icon: <AlertTriangle size={14} className="text-red-500" />,
      badge: 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    } as const;
  }
  if (errorRate >= 5) {
    return {
      label: 'warning',
      icon: <AlertTriangle size={14} className="text-amber-500" />,
      badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    } as const;
  }
  return {
    label: 'healthy',
    icon: <CheckCircle2 size={14} className="text-emerald-500" />,
    badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  } as const;
};

export const ServicePanel: React.FC<ServicePanelProps> = ({ metrics, isLoading, lastUpdated, error, onRefresh }) => {
  const functions = metrics
    ? (Object.entries(metrics.functions || {}) as Array<[string, AdminLogFunctionMetrics]>)
        .map(([name, fn]) => ({
          name,
          invocations: fn.invocations ?? 0,
          errors: fn.errors ?? 0,
          errorRate: (fn.errorRate ?? 0) * 100,
          lastSeen: fn.lastSeen ?? null,
          latencyP95: fn.latency?.p95 ?? 0,
          latencyP99: fn.latency?.p99 ?? 0,
        }))
        .sort((a, b) => b.invocations - a.invocations)
    : [];

  return (
    <div className="h-1/2 flex flex-col border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Activity size={16} className="text-blue-500" />
            <span>Functions Overview</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {functions.length ? `${functions.length} functions observed` : 'Waiting for recent activity'}
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center space-x-1">
            <Clock size={12} />
            <span>{formatRelativeTime(lastUpdated)}</span>
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center space-x-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
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

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!functions.length && !isLoading ? (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded p-3">
            No recent Cloud Function executions were found in the selected window.
          </div>
        ) : (
          functions.map((fn) => {
            const status = getStatusStyle(fn.errorRate);
            return (
              <div
                key={fn.name}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={fn.name}>
                    {fn.name}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase inline-flex items-center ${status.badge}`}>
                    {status.icon}
                    <span className="ml-1">{status.label}</span>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="space-y-1">
                    <p className="flex items-center justify-between">
                      <span>Invocations</span>
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {formatNumber(fn.invocations, { maximumFractionDigits: 0 })}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Errors</span>
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {formatNumber(fn.errors, { maximumFractionDigits: 0 })}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Error rate</span>
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {formatNumber(fn.errorRate, { maximumFractionDigits: 2 })}%
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="flex items-center justify-between">
                      <span>p95 latency</span>
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {formatNumber(fn.latencyP95, { maximumFractionDigits: 0 })}ms
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>p99 latency</span>
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {formatNumber(fn.latencyP99, { maximumFractionDigits: 0 })}ms
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Last seen</span>
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {formatRelativeTime(fn.lastSeen)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

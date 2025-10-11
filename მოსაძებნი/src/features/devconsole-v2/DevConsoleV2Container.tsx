// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConsoleStream } from './useConsoleStream';
import { useConsoleStore } from './consoleStore';
import { ConsoleToolbar } from './components/ConsoleToolbar';
import { LogList } from './components/LogList';
import { ExportMenu } from './components/ExportMenu';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { LiveMetrics, type MetricsHistoryPoint } from './components/LiveMetrics';
import { ServicePanel } from './components/ServicePanel';
import { ServicesView } from './components/ServicesView';
import { MultiTabTerminal } from './components/MultiTabTerminal';
import RealTimeErrorMonitor from './components/RealTimeErrorMonitor';
import { useRealTimeErrors } from './hooks/useRealTimeErrors';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Activity,
  Database,
  TrendingUp,
  Zap,
  Bell,
  Terminal,
  FileText,
  BarChart3,
  GitBranch,
  Clock,
  Server,
} from 'lucide-react';
import { SystemMetrics } from './types';
import type { AdminLogMetrics, AdminLogsResponse } from '../../services/adminLogsApi';
import { fetchAdminLogs } from '../../services/adminLogsApi';
import AIRolloutManager from '../../components/AIRolloutManager';

const METRICS_HISTORY_LIMIT = 60;
const METRICS_POLL_INTERVAL = 30000;

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

export const DevConsoleV2Container: React.FC = () => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showErrorMonitor, setShowErrorMonitor] = useState(false);
  const [language, setLanguage] = useState<'ka' | 'en'>('ka');

  const DEFAULT_SYSTEM_METRICS: SystemMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    networkRequests: 0,
    errorRate: 0,
    averageLatency: 0,
    latency: { p50: 0, p95: 0, p99: 0 },
    lastUpdated: null,
    services: {
      frontend: { status: 'healthy', cpu: 0, memory: 0, errors: [] },
      backend: { status: 'healthy', cpu: 0, memory: 0, errors: [] },
      ai: { status: 'healthy', cpu: 0, memory: 0, errors: [] },
    },
  };
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  const {
    filters,
    ui,
    toggleAutoscroll,
    bufferSize,
    droppedCount,
    setFilters,
  } = useConsoleStore();
  const [activeTab, setActiveTab] = useState<'logs' | 'metrics' | 'services' | 'rollout' | 'terminal'>('logs');

  const { logs, connectionStatus, reconnect, clearLogs, forceReload, isLoadingFromCache, metrics } = useConsoleStream(filters);

  const updateSystemMetricsFromLogs = useCallback((metrics: AdminLogMetrics, observedAt: string | null) => {
    const errorRatePercent = metrics.errorRate * 100;
    const serviceStatus = errorRatePercent >= 10 ? 'error' : errorRatePercent >= 5 ? 'warning' : 'healthy';

    const buildServiceSnapshot = () => ({
      status: serviceStatus,
      cpu: Math.min(100, Math.round(metrics.invocationsPerMinute)),
      memory: Math.min(100, Math.round(errorRatePercent)),
      uptime: undefined,
      port: undefined,
      url: undefined,
      pid: undefined,
      errors:
        metrics.errors > 0
          ? [
              {
                message: `${metrics.errors} error${metrics.errors === 1 ? '' : 's'} in last ${metrics.windowMinutes}m`,
                timestamp: observedAt ?? undefined,
              },
            ]
          : [],
    });

    setSystemMetrics({
      windowMinutes: metrics.windowMinutes,
      total: metrics.total,
      errors: metrics.errors,
      invocationsPerMinute: metrics.invocationsPerMinute,
      errorRate: errorRatePercent,
      averageLatency: metrics.latency.average,
      latency: {
        p50: metrics.latency.p50,
        p95: metrics.latency.p95,
        p99: metrics.latency.p99,
      },
      lastUpdated: observedAt,
      services: {
        frontend: buildServiceSnapshot(),
        backend: buildServiceSnapshot(),
        ai: buildServiceSnapshot(),
      },
    });
  }, []);

  const fetchMetrics = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (metricsControllerRef.current) {
      metricsControllerRef.current.abort();
    }

    const controller = new AbortController();
    metricsControllerRef.current = controller;
    setIsMetricsLoading(true);

    try {
      const response = await fetchAdminLogs({
        limit: 200,
        minutes: 60,
        metricsOnly: true,
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      const observedAt = response.observedAt ?? new Date().toISOString();

      setLogMetrics(response.metrics);
      setMetricsObservedAt(observedAt);
      setMetricsRateLimit(response.rateLimit ?? null);
      setMetricsError(null);
      updateSystemMetricsFromLogs(response.metrics, observedAt);

      setMetricsHistory((previous) => {
        const nextPoint: MetricsHistoryPoint = {
          observedAt,
          invocationsPerMinute: response.metrics.invocationsPerMinute,
          errorRate: response.metrics.errorRate * 100,
          latencyAverage: response.metrics.latency.average,
          latencyP95: response.metrics.latency.p95,
          latencyP99: response.metrics.latency.p99,
          total: response.metrics.total,
          errors: response.metrics.errors,
        };
        const next = [...previous, nextPoint];
        return next.slice(-METRICS_HISTORY_LIMIT);
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      const error = err instanceof Error ? err : new Error('Failed to load metrics');
      if (error.name === 'AbortError') {
        return;
      }
      setMetricsError(error.message || 'Failed to load metrics');
    } finally {
      if (isMountedRef.current && metricsControllerRef.current === controller) {
        setIsMetricsLoading(false);
        metricsControllerRef.current = null;
      }
    }
  }, [updateSystemMetricsFromLogs]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, METRICS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRefreshMetrics = useCallback(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      const reconnectTimer = setTimeout(() => {
        console.log('🔄 Auto-reconnecting to console stream...');
        reconnect();
      }, 5000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [connectionStatus, reconnect]);

  const {
    errorCount,
    isConnected: errorMonitorConnected,
    hasRecentErrors,
    criticalErrors
  } = useRealTimeErrors({ language, autoConnect: false }); // Connection managed by RealTimeErrorMonitor

  // Enhanced system metrics with real-time data
  useEffect(() => {
    if (metrics) {
      setSystemMetrics(metrics);
    }
  }, [metrics]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            document.getElementById('console-filter-input')?.focus();
            break;
          case 'p':
            e.preventDefault();
            toggleAutoscroll();
            break;
          case 'e':
            e.preventDefault();
            setShowExportMenu(true);
            break;
          case 'j':
            e.preventDefault();
            handleJumpToLatest();
            break;
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ui.autoscroll, toggleAutoscroll]);

  const filteredLogs = logs.filter((log) => {
    if (filters.source !== 'all' && log.source !== filters.source) return false;
    if (filters.level !== 'all' && log.level !== filters.level) return false;
    if (filters.text && !log.message.toLowerCase().includes(filters.text.toLowerCase())) return false;
    if (filters.regex) {
      try {
        const regex = new RegExp(filters.regex, 'i');
        if (!regex.test(log.message)) return false;
      } catch {
        // ignore invalid regex
      }
    }
    return true;
  });

  const visibleLogs = filteredLogs;
  const metricsSnapshot = systemMetrics ?? DEFAULT_SYSTEM_METRICS;
  const isStreamOnline = connectionStatus === 'connected' && systemMetrics !== null;

  const handleJumpToLatest = () => {
    const latestLogElement = document.getElementById('log-list')?.lastElementChild;
    latestLogElement?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleServices = () => {
    setShowServices((prev) => !prev);
    if (showTerminal) setShowTerminal(false);
  };

  const handleToggleTerminal = () => {
    setShowTerminal((prev) => !prev);
    if (showServices) setShowServices(false);
  };

  const forceReconnect = () => {
    reconnect();
  };

  const tabs = [
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'rollout', label: 'Rollout', icon: GitBranch },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
  ];

  return (
    <div className="devconsole-v2 flex h-full w-full">
      <div className="w-80 border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-col">
        <ServicePanel
          metrics={logMetrics}
          isLoading={isMetricsLoading}
          lastUpdated={metricsObservedAt}
          error={metricsError}
          onRefresh={handleRefreshMetrics}
        />
        <LiveMetrics
          metrics={logMetrics}
          history={metricsHistory}
          isLoading={isMetricsLoading}
          lastUpdated={metricsObservedAt}
          error={metricsError}
          onRefresh={handleRefreshMetrics}
          rateLimitRemaining={metricsRateLimit?.remaining ?? null}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              {connectionStatus === 'connected' ? (
                <Wifi size={12} className="text-green-500 animate-pulse" />
              ) : (
                <WifiOff size={12} className="text-red-500" />
              )}
              <span className={isStreamOnline ? 'text-green-600 font-medium' : connectionStatus === 'connected' ? 'text-yellow-600 font-medium' : 'text-red-600'}>
                {isLoadingFromCache ? 'Cached' : (isStreamOnline ? 'Live' : connectionStatus === 'connected' ? 'Stream offline' : 'Disconnected')}
              </span>
              {isStreamOnline && !isLoadingFromCache && (
                <span className="text-gray-500">({metricsSnapshot.activeConnections} conn)</span>
              )}
            </div>

            {!isStreamOnline && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                stream offline
              </span>
            )}

            <div className="flex items-center space-x-1">
              <Database size={12} className="text-blue-500" />
              <span>Buffer: {bufferSize}</span>
              <span className="text-gray-500">/ 100k</span>
            </div>

            {!isStreamOnline && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                stream offline
              </span>
            )}

            <div className="flex items-center space-x-1">
              <Activity size={12} className="text-purple-500" />
              <span>CPU: {metricsSnapshot.cpuUsage.toFixed(1)}%</span>
            </div>

            {!isStreamOnline && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                stream offline
              </span>
            )}

            <div className="flex items-center space-x-1">
              <Server size={12} className="text-orange-500" />
              <span>RAM: {metricsSnapshot.memoryUsage.toFixed(1)}%</span>
            </div>

            {!isStreamOnline && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                stream offline
              </span>
            )}

            <div className="flex items-center space-x-1">
              <TrendingUp size={12} className="text-cyan-500" />
              <span>{metricsSnapshot.throughput} KB/s</span>
            </div>

            {!isStreamOnline && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                stream offline
              </span>
            )}

            <div className="flex items-center space-x-1">
              <Zap size={12} className="text-yellow-500" />
              <span>p50: {metricsSnapshot.latency.p50}ms</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              Req/min: <span className="font-medium text-blue-600">{metricsSnapshot.networkRequests}</span>
            </span>
            {/* Real-time Error Monitor Status */}
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">
                Errors: <span className={`font-medium ${metricsSnapshot.errorRate > 2 ? 'text-red-600' : 'text-green-600'}`}>
                  {metricsSnapshot.errorRate.toFixed(1)}%
                </span>
              </span>
            </div>
            {typeof metricsRateLimit?.remaining === 'number' && (
              <span className="text-gray-500">
                Quota {metricsRateLimit.remaining}
              </span>
            )}
            <span className="text-gray-500 flex items-center space-x-1">
              <Clock size={12} />
              <span>{formatRelativeTime(systemMetrics.lastUpdated)}</span>
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowErrorMonitor(!showErrorMonitor)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  hasRecentErrors
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'
                    : errorMonitorConnected
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={language === 'ka' ? 'შეცდომების მონიტორი' : 'Error Monitor'}
              >
                {criticalErrors.length > 0 ? (
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                ) : hasRecentErrors ? (
                  <AlertCircle className="w-3 h-3 text-orange-600" />
                ) : (
                  <Bell className="w-3 h-3" />
                )}
                <span className="font-mono">
                  {errorCount.critical + errorCount.error}
                  {errorCount.warning > 0 && `+${errorCount.warning}`}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full ${errorMonitorConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              </button>
            </div>
            <span className="text-gray-600">
              Dropped: <span className="font-medium text-orange-600">{droppedCount}</span>
            </span>
            <span className="text-gray-600">
              Visible: <span className="font-medium">{visibleLogs.length}</span>
            </span>
            <span className="text-gray-500">
              Uptime: {metricsSnapshot.uptime}
            </span>

            <button
              onClick={forceReload}
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              title="Reload logs from server"
            >
              <Activity size={14} />
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle size={14} />
            </button>
          </div>
        </div>

        <ConsoleToolbar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          onFiltersChange={setFilters}
          onClear={clearLogs}
          onPause={toggleAutoscroll}
          onJumpToLatest={handleJumpToLatest}
          onExport={() => setShowExportMenu(true)}
          onReload={forceReconnect}
          onToggleServices={handleToggleServices}
          onToggleTerminal={handleToggleTerminal}
          isPaused={!ui.autoscroll}
          showServices={showServices}
          showTerminal={showTerminal}
        />

        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'logs' && (
            <div className="flex-1 min-h-0 p-4">
              <LogList logs={visibleLogs} />
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="flex-1 min-h-0 p-4">
              <LiveMetrics
                metrics={logMetrics}
                history={metricsHistory}
                isLoading={isMetricsLoading}
                lastUpdated={metricsObservedAt}
                error={metricsError}
                onRefresh={handleRefreshMetrics}
                rateLimitRemaining={metricsRateLimit?.remaining ?? null}
              />
            </div>
          )}

          {activeTab === 'services' && (
            <div className="flex-1 min-h-0 p-4">
              <ServicesView onBackToLogs={() => setActiveTab('logs')} />
            </div>
          )}

          {activeTab === 'rollout' && (
            <div className="flex-1 min-h-0 p-4">
              <AIRolloutManager />
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="flex-1 min-h-0 p-4">
              <MultiTabTerminal />
            </div>
          )}
        </div>
      </div>

      {showExportMenu && (
        <ExportMenu
          logs={filteredLogs}
          onClose={() => setShowExportMenu(false)}
        />
      )}

      {showShortcuts && (
        <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
      )}

      <RealTimeErrorMonitor
        isOpen={showErrorMonitor}
        onClose={() => setShowErrorMonitor(false)}
        language={language}
        onLanguageChange={setLanguage}
        position="topRight"
        showToasts={true}
      />
    </div>
  );
};

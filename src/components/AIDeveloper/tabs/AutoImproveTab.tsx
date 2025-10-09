import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import ImproveSidebar from '../AutoImprove/ImproveSidebar';
import FilterBar from '../AutoImprove/FilterBar';
import MetricStrip from '../AutoImprove/MetricStrip';
import MetricCard from '../AutoImprove/MetricCard';
import AutoImproveEmptyState from '../AutoImprove/AutoImproveEmptyState';
import { autoImproveTheme } from '../AutoImprove/theme';
import GuruloGauge from '../AutoImprove/GuruloGauge';
import BrainStatusCard from '../AutoImprove/BrainStatusCard';
import AutoImproveTraceMonitor from '@/components/AutoImprove/AutoImproveTraceMonitor';
import BrainPage from './AutoImprove/BrainPage';
import { type AIAssistantActivitySample } from '../AutoImprove/AIAssistantActivityCard';
import SystemMonitoringDashboard from '@/components/SystemMonitoringDashboard';
import AutoUpdateMonitoringDashboard from '@/components/AutoUpdateMonitoringDashboard';
import SecurityAuditTab from '@/components/SecurityAuditTab';
import ActivityLog from '@/components/ActivityLog';
import type {
  AutoImproveMetric,
  AutoImproveServiceState,
} from '../AutoImprove/types';
import { useAIServiceState } from '@/hooks/useAIServiceState';
import { useAuth } from '@/contexts/useAuth';
import { metricToneMap } from './AutoImprove/constants/metricToneMap';
import { useAutoImproveMetrics } from './AutoImprove/hooks/useAutoImproveMetrics';
import { useMonitorStatus } from './AutoImprove/hooks/useMonitorStatus';

interface AutoImproveTabProps {
  hasDevConsoleAccess: boolean;
  isAuthenticated: boolean;
  userRole: string;
  openFileFromActivity?: (path: string) => void;
}

type AutoImproveSection = 'brain' | 'operations' | 'security';

type QualityCheckStatus = 'pending' | 'running' | 'passed' | 'failed';

interface QualityCheckItem {
  id: string;
  label: string;
  description: string;
  status: QualityCheckStatus;
}

type WorkflowStepStatus = 'pending' | 'active' | 'done' | 'failed';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: WorkflowStepStatus;
}

type BrainMonitorLogEntry = {
  id: string;
  message: string;
  timestamp: string | null;
  level: 'info' | 'warning' | 'error';
};

const AutoImproveTab: React.FC<AutoImproveTabProps> = ({
  hasDevConsoleAccess,
  isAuthenticated,
  userRole,
  openFileFromActivity,
}) => {
  const { user } = useAuth();
  const isTraceMonitorEnabled = user?.personalId === '01019062020';
  const { t } = useTranslation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<AutoImproveSection>('brain');
  const [searchValue, setSearchValue] = useState('');
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [approvalState, setApprovalState] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [decisionTimestamp, setDecisionTimestamp] = useState<string | null>(null);
  const [activeGauge, setActiveGauge] = useState<'latency' | 'success' | 'tests' | null>(null);
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState<AIAssistantActivitySample[]>([]);

  useEffect(() => {
    if (activeSection !== 'brain' && activeGauge !== null) {
      setActiveGauge(null);
    }
  }, [activeSection, activeGauge]);

  const {
    aiServiceHealth,
    availableModels,
    selectedModel,
    setSelectedModel,
    refreshHealth,
    isOnline,
    connectionState,
    guruloStatus,
    guruloBrainStatus,
    guruloBrainStatusError,
    refreshGuruloBrainStatus,
    isGuruloBrainStatusLoading,
  } = useAIServiceState(isAuthenticated);

  // Preserve prop usage for backward compatibility / potential audits.
  void userRole;

  const {
    metricsKey,
    data: metricsData,
    error: metricsError,
    mutate: mutateMetrics,
    isLoading: isMetricsLoading,
    isValidating: isMetricsValidating,
  } = useAutoImproveMetrics({
    hasDevConsoleAccess,
    isAuthenticated,
    isOnline,
    selectedModel: selectedModel ?? null,
  });

  const {
    monitorKey,
    data: monitorData,
    error: monitorError,
    mutate: mutateMonitor,
    isLoading: isMonitorLoading,
  } = useMonitorStatus({
    hasDevConsoleAccess,
    isAuthenticated,
    isOnline,
  });

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    if (!isOnline || !metricsKey) {
      return;
    }

    void mutateMetrics();
  }, [isOnline, metricsKey, mutateMetrics]);

  useEffect(() => {
    if (!isBrainModalOpen) {
      return;
    }

    void refreshGuruloBrainStatus();
  }, [isBrainModalOpen, refreshGuruloBrainStatus]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedMetricId(null);
        setIsBrainModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const metrics: AutoImproveMetric[] = metricsData?.metrics ?? [];
  const lastUpdated = metricsData?.updatedAt ?? aiServiceHealth?.lastChecked ?? null;
  const pollingDisabled = metricsData?.pollingDisabled ?? false;

  const isOffline = !isOnline || connectionState === 'offline';
  const isDegraded = connectionState === 'degraded' || Boolean(metricsError) || Boolean(monitorError);

  const brainPercent =
    typeof guruloBrainStatus.percent === 'number' && Number.isFinite(guruloBrainStatus.percent)
      ? Math.round(guruloBrainStatus.percent)
      : null;
  const activePercent =
    typeof guruloStatus.activePercent === 'number' && Number.isFinite(guruloStatus.activePercent)
      ? Math.round(guruloStatus.activePercent)
      : brainPercent;
  const brainTasksActive =
    typeof guruloBrainStatus.tasksActive === 'number' && Number.isFinite(guruloBrainStatus.tasksActive)
      ? Math.max(0, Math.round(guruloBrainStatus.tasksActive))
      : null;
  const brainStatusRaw = guruloBrainStatus.headline ?? guruloBrainStatus.status ?? null;
  const brainStatusHeadline = brainStatusRaw && brainStatusRaw.trim().length > 0
    ? brainStatusRaw
    : guruloBrainStatus.status ?? null;
  const brainStatusTooltip = t('aiImprove.brain.sidebar.tooltipDetailed', 'გურულოს ტვინის სწრაფი სტატუსი');
  const brainStatusErrorMessage =
    guruloBrainStatusError && guruloBrainStatusError instanceof Error
      ? guruloBrainStatusError.message
      : null;
  const brainPercentDisplay = brainPercent !== null ? `${brainPercent}%` : 'N/A';
  const brainTasksLabel =
    typeof brainTasksActive === 'number'
      ? t('aiImprove.brain.sidebar.tasksBadge', '{{count}} მიმდინარე', { count: brainTasksActive })
      : t('aiImprove.brain.sidebar.tasksFallback', 'N/A');

  const brainModeLabel = useMemo(() => {
    const rawMode = guruloBrainStatus.mode;
    switch (rawMode) {
      case 'auto':
        return t('aiImprove.metrics.mode.auto', 'ავტომატური');
      case 'manual':
        return t('aiImprove.metrics.mode.manual', 'ხელით');
      case 'paused':
        return t('aiImprove.metrics.mode.paused', 'შეჩერებული');
      case null:
      case undefined:
        return null;
      default:
        return rawMode;
    }
  }, [guruloBrainStatus.mode, t]);

  const formatTime = useCallback(
    (value?: string | number | null) => {
      if (!value) {
        return t('aiImprove.metrics.never', 'არასდროს');
      }

      const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        return t('aiImprove.metrics.unknown', 'უცნობია');
      }

      return new Intl.DateTimeFormat('ka-GE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    },
    [t],
  );

  const brainLastUpdateFormatted = formatTime(guruloBrainStatus.lastUpdate);
  const brainLastUpdateClock = useMemo(() => {
    if (!guruloBrainStatus.lastUpdate) {
      return t('aiImprove.brain.sidebar.lastUnknown', 'უცნობია');
    }

    const date = new Date(guruloBrainStatus.lastUpdate);
    if (Number.isNaN(date.getTime())) {
      return t('aiImprove.brain.sidebar.lastUnknown', 'უცნობია');
    }

    return new Intl.DateTimeFormat('ka-GE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }, [guruloBrainStatus.lastUpdate, t]);

  const brainModalStatusLine = useMemo(() => {
    const segments: string[] = [];
    const trimmedStatus = brainStatusHeadline?.trim();

    if (trimmedStatus) {
      segments.push(trimmedStatus);
    } else if (isOffline) {
      segments.push(t('aiImprove.brain.sidebar.offline', 'შეზღუდული რეჟიმი'));
    }

    if (brainPercent !== null) {
      segments.push(`${t('aiImprove.brain.sidebar.analysis', 'ანალიზი')}: ${brainPercent}%`);
    }

    const hasLastUpdateValue =
      guruloBrainStatus.lastUpdate !== null
      && guruloBrainStatus.lastUpdate !== undefined
      && guruloBrainStatus.lastUpdate !== '';

    if (hasLastUpdateValue) {
      const parsed = new Date(guruloBrainStatus.lastUpdate as string | number);
      if (!Number.isNaN(parsed.getTime())) {
        segments.push(`${t('aiImprove.brain.sidebar.last', 'ბოლო')}: ${brainLastUpdateFormatted}`);
      }
    }

    return segments.join(' | ');
  }, [brainLastUpdateFormatted, brainPercent, brainStatusHeadline, guruloBrainStatus.lastUpdate, isOffline, t]);

  const filteredMetrics = useMemo<AutoImproveMetric[]>(() => {
    const search = searchValue.trim().toLowerCase();

    return metrics.filter((metric: AutoImproveMetric) => {
      const matchesSearch =
        !search ||
        metric.title.toLowerCase().includes(search) ||
        (metric.description ?? '').toLowerCase().includes(search);
      const matchesModel = !selectedModel || metric.model === selectedModel;
      return matchesSearch && matchesModel;
    });
  }, [metrics, searchValue, selectedModel]);

  const modelOptions = useMemo(
    () => availableModels.map((model) => ({ id: model.id, label: model.label })),
    [availableModels],
  );

  const skeletonMetrics = useMemo(
    () =>
      Array.from({ length: 3 }).map((_, index) => ({
        id: `metric-skeleton-${index}`,
        title: '',
        status: 'ok' as AutoImproveMetric['status'],
        latencyMs: null,
        successRate: null,
        model: null,
        logs: [],
      })),
    [],
  );

  const resolveMetricPrimaryValue = useCallback((metric: AutoImproveMetric): number | string => {
    if (metric.value !== undefined && metric.value !== null) {
      return metric.value;
    }
    if (typeof metric.latencyMs === 'number' && Number.isFinite(metric.latencyMs)) {
      return metric.latencyMs;
    }
    if (typeof metric.successRate === 'number' && Number.isFinite(metric.successRate)) {
      return metric.successRate;
    }
    return '—';
  }, []);

  const resolveMetricProgressPercent = useCallback((metric: AutoImproveMetric): number | undefined => {
    if (!metric.progress) {
      return undefined;
    }
    const { current, target = 100 } = metric.progress;
    if (!Number.isFinite(current) || !Number.isFinite(target) || target === 0) {
      return undefined;
    }
    return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  }, []);

  const aggregatedMetrics = useMemo(() => {
    if (!filteredMetrics.length) {
      return {
        avgLatency: null as number | null,
        avgSuccessRate: null as number | null,
        paused: 0,
      };
    }

    const latencyValues = filteredMetrics
      .map((metric) => (typeof metric.latencyMs === 'number' ? metric.latencyMs : null))
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const successValues = filteredMetrics
      .map((metric) => (typeof metric.successRate === 'number' ? metric.successRate : null))
      .filter((value): value is number => value !== null && Number.isFinite(value));

    return {
      avgLatency: latencyValues.length
        ? latencyValues.reduce((acc, value) => acc + value, 0) / latencyValues.length
        : null,
      avgSuccessRate: successValues.length
        ? successValues.reduce((acc, value) => acc + value, 0) / successValues.length
        : null,
      paused: filteredMetrics.filter((metric) => metric.status === 'paused' || metric.paused).length,
    };
  }, [filteredMetrics]);

  const monitorKpis = monitorData?.kpis ?? null;
  const monitorQueueLength = typeof monitorKpis?.queueLength === 'number' ? monitorKpis.queueLength : null;
  const monitorResponseTime = typeof monitorKpis?.p95ResponseTime === 'number'
    ? monitorKpis.p95ResponseTime
    : typeof monitorKpis?.responseTime === 'number'
      ? monitorKpis.responseTime
      : aggregatedMetrics.avgLatency;
  const errorRate = typeof monitorKpis?.errorRate === 'number' ? monitorKpis.errorRate : null;
  const monitorProcessingRate = typeof monitorKpis?.processingRate === 'number' ? monitorKpis.processingRate : null;
  const monitorModeRaw = monitorKpis?.mode
    ?? (monitorKpis?.modelStatus === 'PAUSED'
      ? 'paused'
      : monitorKpis?.modelStatus === 'ACTIVE'
        ? 'auto'
        : 'manual');

  const queueLength = monitorQueueLength ?? (typeof guruloStatus.queueDepth === 'number' ? guruloStatus.queueDepth : null);
  const responseTime = monitorResponseTime ?? (typeof guruloStatus.responseMs === 'number' ? guruloStatus.responseMs : null);
  const processingRate = guruloStatus.throughputPerMin ?? monitorProcessingRate;
  const lastRunAt = guruloStatus.lastUpdate ?? monitorKpis?.lastRunAt ?? monitorData?.timestamp ?? null;
  const monitorMode = (typeof guruloStatus.mode === 'string' ? guruloStatus.mode : null) ?? monitorModeRaw;

  const successRate = (() => {
    const base = errorRate !== null
      ? Math.max(0, Math.min(100, 100 - errorRate))
      : aggregatedMetrics.avgSuccessRate;

    if (typeof base === 'number' && Number.isFinite(base)) {
      return base;
    }

    return typeof guruloStatus.successRate === 'number' ? guruloStatus.successRate : null;
  })();

  const queueTone: AutoImproveMetric['status'] = queueLength === null
    ? 'warning'
    : queueLength < 5
      ? 'ok'
      : queueLength < 10
        ? 'warning'
        : 'error';

  const latencyTone: AutoImproveMetric['status'] = responseTime === null
    ? 'warning'
    : responseTime < 200
      ? 'ok'
      : responseTime < 400
        ? 'warning'
        : 'error';

  const successTone: AutoImproveMetric['status'] = successRate === null
    ? 'warning'
    : successRate >= 85
      ? 'ok'
      : successRate >= 70
        ? 'warning'
        : 'error';

  const isPaused = monitorMode === 'paused';

  useEffect(() => {
    const timestampSource = monitorData?.timestamp ?? guruloStatus.lastUpdate ?? Date.now();
    const timestampValue =
      typeof timestampSource === 'number'
        ? timestampSource
        : typeof timestampSource === 'string'
          ? new Date(timestampSource).getTime()
          : Date.now();

    const sample: AIAssistantActivitySample = {
      timestamp: Number.isFinite(timestampValue) ? timestampValue : Date.now(),
      queue: typeof queueLength === 'number' && Number.isFinite(queueLength) ? queueLength : null,
      latency: typeof responseTime === 'number' && Number.isFinite(responseTime) ? responseTime : null,
      success: typeof successRate === 'number' && Number.isFinite(successRate) ? successRate : null,
    };

    if (sample.queue === null && sample.latency === null && sample.success === null) {
      return;
    }

    setAssistantHistory((prev) => {
      if (prev.length) {
        const last = prev[prev.length - 1];
        if (last.queue === sample.queue && last.latency === sample.latency && last.success === sample.success) {
          return prev;
        }
      }

      const next = [...prev, sample];
      if (next.length > 24) {
        next.splice(0, next.length - 24);
      }
      return next;
    });
  }, [guruloStatus.lastUpdate, monitorData?.timestamp, queueLength, responseTime, successRate, setAssistantHistory]);

  const modeLabel = useMemo(() => {
    switch (monitorMode) {
      case 'auto':
        return t('aiImprove.metrics.mode.auto', 'ავტომატური');
      case 'manual':
        return t('aiImprove.metrics.mode.manual', 'ხელით');
      case 'paused':
      default:
        return t('aiImprove.metrics.mode.paused', 'შეჩერებული');
    }
  }, [monitorMode, t]);

  const handleTogglePause = useCallback(async () => {
    if (isOffline || !hasDevConsoleAccess) {
      return;
    }

    setIsTogglingPause(true);
    try {
      const action = isPaused ? 'resume' : 'pause';
      const response = await fetch('/api/auto-improve/monitor/control', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await Promise.allSettled([
        mutateMonitor(),
        metricsKey ? mutateMetrics() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Failed to toggle auto-improve mode', error);
    } finally {
      setIsTogglingPause(false);
    }
  }, [hasDevConsoleAccess, isOffline, isPaused, metricsKey, mutateMetrics, mutateMonitor]);

  const handleApproveUpdate = useCallback(() => {
    setApprovalState('approved');
    setDecisionTimestamp(new Date().toISOString());
  }, []);

  const handleRejectUpdate = useCallback(() => {
    setApprovalState('rejected');
    setDecisionTimestamp(new Date().toISOString());
  }, []);

  const handleReopenReview = useCallback(() => {
    setApprovalState('pending');
    setDecisionTimestamp(null);
  }, []);

  const derivedMetrics = useMemo<AutoImproveMetric[]>(() => {
    const items: AutoImproveMetric[] = [];

    items.push({
      id: 'monitor-queue-length',
      title: t('aiImprove.metrics.queue.title', 'რიგში ამოცანები'),
      description: t('aiImprove.metrics.queue.description', 'დაგეგმილი სამუშაოების მოცულობა რეალურ დროში'),
      status: queueTone,
      value: queueLength,
      unit: queueLength !== null ? ` ${t('aiImprove.metrics.queue.unit', 'ამოცანა')}` : null,
      progress:
        queueLength !== null
          ? {
              current: queueLength,
              target: 20,
              tone: queueTone === 'error' ? 'error' : queueTone === 'warning' ? 'warning' : 'ok',
              label: t('aiImprove.metrics.queue.progress', 'სისტემის დატვირთვა'),
            }
          : null,
      trend:
        processingRate !== null
          ? {
              direction: processingRate >= 1 ? 'up' : processingRate <= 0.2 ? 'down' : 'flat',
              label: t('aiImprove.metrics.queue.rate', '{{rate}}/წმ', {
                rate: processingRate.toFixed(1),
              }),
            }
          : null,
      meta: [
        {
          label: t('aiImprove.metrics.queue.updated', 'განახლდა'),
          value: formatTime(lastRunAt),
        },
      ],
      logs: [
        t('aiImprove.metrics.queue.logCount', 'რიგშია {{count}} ამოცანა', {
          count: queueLength ?? 0,
        }),
        ...(queueLength === null
          ? [t('aiImprove.metrics.queue.logUnknown', '⚠️ რეალური მონაცემი დროებით მიუწვდომელია')]
          : []),
        t('aiImprove.metrics.queue.logMode', 'რეჟიმი: {{mode}}', { mode: modeLabel }),
      ],
      dataTestId: 'original-metric',
    });

    items.push({
      id: 'monitor-response-time',
      title: t('aiImprove.metrics.latency.title', 'რეაგირების დრო'),
      description: t('aiImprove.metrics.latency.description', 'ბოლო 95-ე პერფორმანსის მაჩვენებელი'),
      status: latencyTone,
      value: responseTime,
      unit: responseTime !== null ? 'ms' : null,
      trend:
        processingRate !== null
          ? {
              direction: processingRate >= 1 ? 'up' : processingRate <= 0.2 ? 'down' : 'flat',
              label: t('aiImprove.metrics.latency.rate', '{{rate}} ტასკი/წმ', {
                rate: processingRate.toFixed(1),
              }),
            }
          : null,
      meta: [
        {
          label: t('aiImprove.metrics.latency.mode', 'რეჟიმი'),
          value: modeLabel,
        },
      ],
      logs: [
        t('aiImprove.metrics.latency.log', 'პასუხის დრო: {{time}}ms', {
          time: responseTime ?? '—',
        }),
        t('aiImprove.metrics.latency.updated', 'ბოლო განახლება {{time}}', {
          time: formatTime(lastRunAt),
        }),
      ],
      dataTestId: 'original-metric',
    });

    items.push({
      id: 'monitor-success-rate',
      title: t('aiImprove.metrics.success.title', 'ტესტირების წარმატება'),
      description: t('aiImprove.metrics.success.description', 'დასრულებული სამუშაოებიდან წარმატებული %'),
      status: successTone,
      value: successRate,
      unit: successRate !== null ? '%' : null,
      progress:
        successRate !== null
          ? {
              current: successRate,
              target: 100,
              tone: successTone === 'error' ? 'error' : successTone === 'warning' ? 'warning' : 'ok',
              label: t('aiImprove.metrics.success.progress', 'პროგრესი'),
            }
          : null,
      meta: [
        {
          label: t('aiImprove.metrics.success.errorRate', 'შეცდომები'),
          value:
            errorRate !== null
              ? `${errorRate.toFixed(1)}%`
              : t('aiImprove.metrics.unknown', 'უცნობია'),
          tone: errorRate !== null && errorRate > 15 ? 'error' : errorRate !== null && errorRate > 5 ? 'warning' : 'ok',
        },
      ],
      logs: [
        t('aiImprove.metrics.success.logRate', 'წარმატება: {{rate}}%', {
          rate: successRate !== null ? successRate.toFixed(0) : '—',
        }),
        t('aiImprove.metrics.success.logUpdated', 'განახლდა {{time}}', {
          time: formatTime(lastRunAt),
        }),
      ],
      dataTestId: 'original-metric',
    });

    items.push({
      id: 'monitor-mode',
      title: t('aiImprove.metrics.mode.title', 'სისტემის რეჟიმი'),
      description: t('aiImprove.metrics.mode.description', 'მართეთ ავტომატური გაუმჯობესების პროცესი'),
      status: isPaused ? 'paused' : isDegraded ? 'warning' : 'ok',
      value: modeLabel,
      logs: [
        t('aiImprove.metrics.mode.log', 'ამჟამინდელი რეჟიმი: {{mode}}', { mode: modeLabel }),
        t('aiImprove.metrics.mode.lastRun', 'ბოლო გაშვება: {{time}}', {
          time: formatTime(lastRunAt),
        }),
      ],
      cta: hasDevConsoleAccess
        ? {
            label: isPaused
              ? t('aiImprove.metrics.mode.resume', 'გაგრძელება')
              : t('aiImprove.metrics.mode.pause', 'პაუზა'),
            onClick: handleTogglePause,
            loading: isTogglingPause,
            disabled: isOffline || isTogglingPause,
          }
        : null,
      dataTestId: 'original-metric',
    });

    return items;
  }, [
    errorRate,
    formatTime,
    handleTogglePause,
    hasDevConsoleAccess,
    isDegraded,
    isOffline,
    isPaused,
    isTogglingPause,
    modeLabel,
    processingRate,
    queueLength,
    queueTone,
    responseTime,
    successRate,
    successTone,
    t,
    lastRunAt,
  ]);

  const combinedMetrics = useMemo<AutoImproveMetric[]>(() => {
    const merged = [...derivedMetrics];

    filteredMetrics.forEach((metric) => {
      const index = merged.findIndex((item) => item.id === metric.id);
      if (index >= 0) {
        const derived = merged[index];
        merged[index] = {
          ...metric,
          ...derived,
          logs: derived.logs && derived.logs.length ? derived.logs : metric.logs,
        };
      } else {
        merged.push(metric);
      }
    });

    return merged;
  }, [derivedMetrics, filteredMetrics]);

  const priorityMetric = useMemo(() => {
    if (!combinedMetrics.length) {
      return null;
    }

    const severity = { error: 0, warning: 1, paused: 2, ok: 3 } as const;
    const sorted = [...combinedMetrics].sort((a, b) => {
      const severityA = severity[a.status] ?? 3;
      const severityB = severity[b.status] ?? 3;
      if (severityA !== severityB) {
        return severityA - severityB;
      }

      const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return updatedB - updatedA;
    });

    return sorted[0] ?? null;
  }, [combinedMetrics]);

  const brainOnline = !isOffline;
  const brainDegraded = !isOffline && isDegraded;
  const queueHasWork = typeof queueLength === 'number' && queueLength > 0;
  const improvementNeeded = Boolean(
    priorityMetric && (priorityMetric.status === 'warning' || priorityMetric.status === 'error'),
  );

  const baseQualityChecks = useMemo(
    () => [
      {
        id: 'unit-tests',
        label: t('aiImprove.brain.tests.names.unit', 'იუნიტ ტესტები'),
        description: t(
          'aiImprove.brain.tests.descriptions.unit',
          'ფუნდამენტური ლოგიკის შემოწმება, რომ ბირთვი მუშაობს სწორად.',
        ),
      },
      {
        id: 'e2e-tests',
        label: t('aiImprove.brain.tests.names.e2e', 'სრული სცენარები'),
        description: t(
          'aiImprove.brain.tests.descriptions.e2e',
          'მომხმარებლის სრული ნაკადის სიმულაცია და შედეგების დადასტურება.',
        ),
      },
      {
        id: 'performance-tests',
        label: t('aiImprove.brain.tests.names.performance', 'წარმადობის ტესტები'),
        description: t(
          'aiImprove.brain.tests.descriptions.performance',
          'მეხსიერებისა და სიჩქარის ოპტიმალურ ზღვარზე შენარჩუნება.',
        ),
      },
      {
        id: 'security-tests',
        label: t('aiImprove.brain.tests.names.security', 'უსაფრთხოების აუდიტი'),
        description: t(
          'aiImprove.brain.tests.descriptions.security',
          'სუსტი ადგილების სკანირება და დაცვის პროტოკოლების გადამოწმება.',
        ),
      },
      {
        id: 'ui-tests',
        label: t('aiImprove.brain.tests.names.ui', 'ინტერფეისის ტესტები'),
        description: t(
          'aiImprove.brain.tests.descriptions.ui',
          'UI ელემენტების თანმიმდევრულობა და თანამედროვე ვიზუალური სტანდარტები.',
        ),
      },
      {
        id: 'regression-tests',
        label: t('aiImprove.brain.tests.names.regression', 'რეგრესიის კონტროლი'),
        description: t(
          'aiImprove.brain.tests.descriptions.regression',
          'წინა ფუნქციონალის დაურღვევლად მუშაობის უზრუნველყოფა.',
        ),
      },
    ],
    [t],
  );

  const qualityChecks = useMemo<QualityCheckItem[]>(() => {
    if (!brainOnline) {
      return baseQualityChecks.map((check) => ({ ...check, status: 'pending' }));
    }

    if (successRate === null) {
      return baseQualityChecks.map((check, index) => ({
        ...check,
        status: index === 0 ? 'running' : 'pending',
      }));
    }

    const highSuccess = successRate >= 95;
    const mediumSuccess = successRate >= 85;
    const lowSuccess = successRate >= 70;

    return baseQualityChecks.map((check, index) => {
      let status: QualityCheckStatus = 'pending';

      if (highSuccess) {
        status = 'passed';
      } else if (mediumSuccess) {
        status = index <= 4 ? 'passed' : index === 5 ? 'running' : 'pending';
      } else if (lowSuccess) {
        status = index <= 3 ? 'passed' : index === 4 ? 'running' : 'failed';
      } else {
        status = index <= 1 ? 'running' : 'failed';
      }

      return { ...check, status };
    });
  }, [baseQualityChecks, brainOnline, successRate]);

  const testsComplete = qualityChecks.length > 0 && qualityChecks.every((check) => check.status === 'passed');
  const testsInProgress = qualityChecks.some((check) => check.status === 'running');
  const testsFailed = qualityChecks.some((check) => check.status === 'failed');

  const improvementSummary = useMemo(() => {
    const items = combinedMetrics
      .filter((metric) => metric.status !== 'ok')
      .slice(0, 4)
      .map((metric) => ({
        id: metric.id,
        title: metric.title,
        description: metric.description,
        status: metric.status,
      }));

    if (items.length > 0) {
      return items;
    }

    const fallback = priorityMetric
      ? [
          {
            id: priorityMetric.id,
            title: priorityMetric.title,
            description: priorityMetric.description,
            status: priorityMetric.status,
          },
        ]
      : [];

    if (fallback.length > 0) {
      return fallback;
    }

    return [
      {
        id: 'all-clear',
        title: t('aiImprove.brain.summary.empty', 'ამ მომენტში პრობლემები არ იძებნება'),
        description: t(
          'aiImprove.brain.summary.emptyDescription',
          'ტვინი აგროვებს იდეებს შემდეგი გაუმჯობესებისთვის და ინარჩუნებს სტაბილურობას.',
        ),
        status: 'ok' as const,
      },
    ];
  }, [combinedMetrics, priorityMetric, t]);

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const steps: WorkflowStep[] = [];

    const activationStatus: WorkflowStepStatus = brainOnline ? 'done' : 'pending';
    steps.push({
      id: 'activation',
      title: t('aiImprove.brain.workflow.activation.title', 'სერვისების ჩართვა'),
      description: brainOnline
        ? t('aiImprove.brain.workflow.activation.ready', 'ყველა ძირითადი სერვისი ჩართულია და ტვინი მზადაა მუშაობისთვის.')
        : t('aiImprove.brain.workflow.activation.waiting', 'ველოდებით სერვისების სრულ გახურებას, რათა ტვინი ჩაირთოს.'),
      status: activationStatus,
    });

    const analysisStatus: WorkflowStepStatus = !brainOnline
      ? 'pending'
      : improvementNeeded || queueHasWork
        ? 'active'
        : 'done';
    steps.push({
      id: 'analysis',
      title: t('aiImprove.brain.workflow.analysis.title', 'პრობლემის ანალიზი'),
      description: improvementNeeded || queueHasWork
        ? t('aiImprove.brain.workflow.analysis.active', 'გურულო იპოვის შეცდომის ფესვებს და ამზადებს მოქმედების გეგმას.')
        : t('aiImprove.brain.workflow.analysis.done', 'ყველა ბოლო ანალიზი დასრულებულია, ახალი დავალებების მოლოდინში ვართ.'),
      status: analysisStatus,
    });

    const codingStatus: WorkflowStepStatus = !brainOnline
      ? 'pending'
      : improvementNeeded && !(testsComplete || testsFailed)
        ? 'active'
        : improvementNeeded
          ? 'done'
          : 'done';
    steps.push({
      id: 'coding',
      title: t('aiImprove.brain.workflow.coding.title', 'კოდის განახლება'),
      description:
        improvementNeeded && !(testsComplete || testsFailed)
          ? t('aiImprove.brain.workflow.coding.active', 'გურულო აახლებს საჭირო ფაილებს და აღწერს თითოეულ ცვლილებას.')
          : t('aiImprove.brain.workflow.coding.done', 'კოდის განახლება დასრულებულია და მზადაა ტესტირებისთვის.'),
      status: codingStatus,
    });

    let testingStatus: WorkflowStepStatus = 'pending';
    if (testsFailed) {
      testingStatus = 'failed';
    } else if (testsComplete) {
      testingStatus = 'done';
    } else if (brainOnline && (improvementNeeded || queueHasWork || testsInProgress)) {
      testingStatus = 'active';
    }
    steps.push({
      id: 'testing',
      title: t('aiImprove.brain.workflow.testing.title', 'ტესტირების ეტაპი'),
      description: testsFailed
        ? t('aiImprove.brain.workflow.testing.failed', 'გურულო ასწორებს ჩავარდნილ ტესტებს და ხელახლა ამოწმებს კოდს.')
        : testsComplete
          ? t('aiImprove.brain.workflow.testing.done', 'ყველა 7 ტესტმა წარმატებით დაადასტურა განახლება.')
          : t('aiImprove.brain.workflow.testing.active', 'ტესტები მიმდინარეობს, შედეგები რეალურ დროში განახლდება.'),
      status: testingStatus,
    });

    let reviewStatus: WorkflowStepStatus = 'pending';
    if (approvalState === 'approved') {
      reviewStatus = 'done';
    } else if (approvalState === 'rejected') {
      reviewStatus = 'failed';
    } else if (testsComplete && !testsFailed) {
      reviewStatus = 'active';
    }
    steps.push({
      id: 'review',
      title: t('aiImprove.brain.workflow.review.title', 'განახლებების განხილვა'),
      description:
        approvalState === 'approved'
          ? t('aiImprove.brain.workflow.review.done', 'განახლება დადასტურებულია და მზადაა დაყენებისთვის.')
          : approvalState === 'rejected'
            ? t('aiImprove.brain.workflow.review.failed', 'გურულო გააუმჯობესებს ცვლილებებს და ხელახლა მოგაწვდით პაკეტს.')
            : t('aiImprove.brain.workflow.review.active', 'ყველა ინფორმაცია გაგზავნილია განიხილვის პანელში.'),
      status: reviewStatus,
    });

    const deploymentStatus: WorkflowStepStatus = approvalState === 'approved' ? 'done' : 'pending';
    steps.push({
      id: 'deployment',
      title: t('aiImprove.brain.workflow.deployment.title', 'განახლების დაყენება'),
      description:
        approvalState === 'approved'
          ? t('aiImprove.brain.workflow.deployment.done', 'კოდის ცვლილება უკვე ძალაშია საიტზე.')
          : t('aiImprove.brain.workflow.deployment.pending', 'დაყენება მოხდება დაუყოვნებლივ როგორც კი განახლება დამტკიცდება.'),
      status: deploymentStatus,
    });

    return steps;
  }, [
    approvalState,
    brainOnline,
    improvementNeeded,
    queueHasWork,
    t,
    testsComplete,
    testsFailed,
    testsInProgress,
  ]);

  const statusLabels: Record<WorkflowStepStatus, string> = useMemo(
    () => ({
      pending: t('aiImprove.brain.workflow.status.pending', 'მოლოდინი'),
      active: t('aiImprove.brain.workflow.status.active', 'მიმდინარეობს'),
      done: t('aiImprove.brain.workflow.status.done', 'დასრულდა'),
      failed: t('aiImprove.brain.workflow.status.failed', 'საჭიროა ყურადღება'),
    }),
    [t],
  );

  const workflowToneMap: Record<WorkflowStepStatus, string> = useMemo(
    () => ({
      pending: 'border-slate-700 bg-slate-900/70 text-slate-200',
      active: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
      done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
      failed: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    }),
    [],
  );

  const reviewStatusMessage = useMemo(() => {
    if (!testsComplete || testsFailed) {
      return t('aiImprove.brain.review.awaitingTests', 'ტესტები უნდა დასრულდეს, რათა დადასტურება გახდეს შესაძლებელი.');
    }

    switch (approvalState) {
      case 'approved':
        return t('aiImprove.brain.review.approved', 'განახლება დამტკიცებულია — ცვლილება უკვე ძალაშია.');
      case 'rejected':
        return t('aiImprove.brain.review.rejected', 'განახლება დაბრუნდა დახვეწაზე. გურულო უკვე ამზადებს გაუმჯობესებულ ვერსიას.');
      case 'pending':
      default:
        return t('aiImprove.brain.review.pending', 'თქვენი გადაწყვეტილებაა საჭირო, რათა განახლება დაინერგოს.');
    }
  }, [approvalState, t, testsComplete, testsFailed]);

  const summaryStatusMap = useMemo(
    () => ({
      ok: {
        label: t('aiImprove.brain.summary.status.ok', 'დასრულებული'),
        className: 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10',
      },
      warning: {
        label: t('aiImprove.brain.summary.status.warning', 'საჭიროა ყურადღება'),
        className: 'border-amber-400/40 text-amber-300 bg-amber-500/10',
      },
      error: {
        label: t('aiImprove.brain.summary.status.error', 'კრიტიკული'),
        className: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
      },
      paused: {
        label: t('aiImprove.brain.summary.status.paused', 'გაჩერებული'),
        className: 'border-slate-500/40 text-slate-300 bg-slate-700/30',
      },
    }),
    [t],
  );

  const qualityStatusMap: Record<QualityCheckStatus, { label: string; className: string; indicator: string }> = useMemo(
    () => ({
      pending: {
        label: t('aiImprove.brain.tests.status.pending', 'მოლოდინი'),
        className: 'border-slate-700 bg-slate-900/60 text-slate-300',
        indicator: 'bg-slate-500',
      },
      running: {
        label: t('aiImprove.brain.tests.status.running', 'მიმდინარეობს'),
        className: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
        indicator: 'bg-blue-400 animate-pulse',
      },
      passed: {
        label: t('aiImprove.brain.tests.status.passed', 'გასული'),
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        indicator: 'bg-emerald-400',
      },
      failed: {
        label: t('aiImprove.brain.tests.status.failed', 'ჩავარდა'),
        className: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
        indicator: 'bg-rose-400 animate-pulse',
      },
    }),
    [t],
  );

  const brainStatusLabel = !brainOnline
    ? t('aiImprove.brain.status.offline', 'გათიშულია')
    : brainDegraded
      ? t('aiImprove.brain.status.degraded', 'შეზღუდულად')
      : t('aiImprove.brain.status.active', 'აქტიური');

  const brainStatusTone = !brainOnline
    ? 'border-slate-600 bg-slate-900/80 text-slate-300'
    : brainDegraded
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';

  const testsPassedCount = qualityChecks.filter((check) => check.status === 'passed').length;
  const totalQualityChecks = qualityChecks.length;
  const derivedTestsPercent = totalQualityChecks > 0
    ? (testsPassedCount / totalQualityChecks) * 100
    : testsComplete
      ? 100
      : testsFailed
        ? 0
        : null;
  const testsProgressPercent = guruloStatus.testsPassingPercent ?? derivedTestsPercent;
  const testsProgressValue = testsProgressPercent !== null ? Math.round(testsProgressPercent) : null;
  const testsMetricStatus: AutoImproveMetric['status'] = testsFailed
    ? 'error'
    : testsComplete
      ? 'ok'
      : testsInProgress
        ? 'warning'
        : 'paused';
  const formattedDecisionTime = decisionTimestamp ? formatTime(decisionTimestamp) : null;
  const queueDisplay = queueLength !== null ? queueLength.toString() : '—';
  const responseDisplay = responseTime !== null ? `${Math.round(responseTime)} ms` : '—';
  const successDisplay = successRate !== null ? `${successRate.toFixed(1)}%` : '—';
  const testsDisplay = testsProgressValue !== null ? `${testsProgressValue}%` : '—';
  const testsTone = testsMetricStatus === 'paused' ? 'warning' : metricToneMap[testsMetricStatus] ?? 'default';

  const throughputDisplay =
    typeof processingRate === 'number' && Number.isFinite(processingRate)
      ? processingRate.toFixed(1)
      : '—';
  const errorCount = guruloStatus.errorCount !== null && Number.isFinite(guruloStatus.errorCount)
    ? Math.max(0, Math.round(guruloStatus.errorCount))
    : null;
  const throughputValueLabel =
    typeof processingRate === 'number' && Number.isFinite(processingRate)
      ? t('aiImprove.brain.digital.throughputValue', '{{count}} ოპ./წთ', {
        count: Number(processingRate.toFixed(1)),
      })
      : t('aiImprove.metrics.unknown', 'უცნობია');
  const gaugeDetails = useMemo<
    Record<
      'latency' | 'success' | 'tests',
      { title: string; value: string; helper: string; rows: { label: string; value: string }[] }
    >
  >(
    () => ({
      latency: {
        title: t('aiImprove.brain.digital.details.latencyTitle', 'რესპონსი'),
        value: responseDisplay,
        helper: t('aiImprove.brain.digital.details.latencyHelper', 'საშუალო რეაგირება მიმდინარე ციკლში.'),
        rows: [
          { label: t('aiImprove.brain.stats.queue', 'რიგი'), value: queueDisplay },
          { label: t('aiImprove.brain.digital.throughputLabel', 'გატარება'), value: throughputValueLabel },
        ],
      },
      success: {
        title: t('aiImprove.brain.digital.details.successTitle', 'სტაბილურობა'),
        value: successDisplay,
        helper: t('aiImprove.brain.digital.details.successHelper', 'შეცდომების გარეშე დამუშავების წილი.'),
        rows: [
          {
            label: t('aiImprove.brain.digital.details.errorsRow', 'შეცდომები'),
            value:
              errorCount !== null
                ? errorCount.toString()
                : t('aiImprove.brain.digital.errorNone', '0'),
          },
          { label: t('aiImprove.brain.digital.modeLabel', 'რეჟიმი'), value: modeLabel },
        ],
      },
      tests: {
        title: t('aiImprove.brain.digital.details.testsTitle', 'ტესტები'),
        value: testsDisplay,
        helper: t('aiImprove.brain.digital.details.testsHelper', 'ავტომატური ტესტების დასრულების პროცენტი.'),
        rows: [
          {
            label: t('aiImprove.brain.digital.details.testsPassed', 'გასული'),
            value:
              totalQualityChecks > 0
                ? `${testsPassedCount}/${totalQualityChecks}`
                : t('aiImprove.metrics.unknown', 'უცნობია'),
          },
          {
            label: t('aiImprove.brain.digital.details.decision', 'გადაწყვეტილება'),
            value: formattedDecisionTime ?? t('aiImprove.metrics.unknown', 'უცნობია'),
          },
        ],
      },
    }),
    [
      errorCount,
      formattedDecisionTime,
      modeLabel,
      queueDisplay,
      responseDisplay,
      successDisplay,
      t,
      testsDisplay,
      testsPassedCount,
      totalQualityChecks,
      throughputValueLabel,
    ],
  );
  const canApprove = testsComplete && !testsFailed && approvalState === 'pending';
  const canReject = approvalState !== 'approved';

  const priorityLogEntries = useMemo<BrainMonitorLogEntry[]>(() => {
    const entries: BrainMonitorLogEntry[] = [];

    const metricLogs = Array.isArray(priorityMetric?.logs) ? priorityMetric?.logs ?? [] : [];
    metricLogs.forEach((log, index) => {
      if (!log) {
        return;
      }

      if (typeof log === 'string') {
        const trimmed = log.trim();
        if (!trimmed) {
          return;
        }
        entries.push({
          id: `priority-metric-log-${priorityMetric?.id ?? 'unknown'}-${index}`,
          message: trimmed,
          timestamp: null,
          level: 'info',
        });
        return;
      }

      const message = typeof log.message === 'string' ? log.message.trim() : '';
      if (!message) {
        return;
      }

      const level: BrainMonitorLogEntry['level'] = log.level === 'warning' || log.level === 'error' ? log.level : 'info';
      const timestamp = typeof log.timestamp === 'string' && log.timestamp.trim().length > 0 ? log.timestamp : null;
      entries.push({
        id:
          (typeof log.timestamp === 'string' && log.timestamp.trim().length > 0
            ? log.timestamp
            : `priority-metric-log-${priorityMetric?.id ?? 'unknown'}-${index}`) ??
          `priority-metric-log-${priorityMetric?.id ?? 'unknown'}-${index}`,
        message,
        timestamp,
        level,
      });
    });

    if (guruloStatus.ticker.length > 0) {
      guruloStatus.ticker.forEach((item, index) => {
        const label = item.label?.trim() ?? '';
        const value = item.value?.trim() ?? '';
        if (!label && !value) {
          return;
        }

        const tone = item.tone === 'warning' || item.tone === 'error' ? item.tone : 'info';
        entries.push({
          id: item.id ?? `ticker-${index}`,
          message: label && value ? `${label}: ${value}` : label || value,
          timestamp: null,
          level: tone,
        });
      });
    }

    if (!entries.length && priorityMetric) {
      const fallbackMessage = priorityMetric.description ?? priorityMetric.title ?? null;
      if (fallbackMessage) {
        entries.push({
          id: `priority-fallback-${priorityMetric.id}`,
          message: fallbackMessage,
          timestamp: null,
          level: 'info',
        });
      }
    }

    return entries;
  }, [guruloStatus.ticker, priorityMetric]);

  const activeThought = useMemo(() => {
    if (priorityLogEntries.length > 0) {
      return priorityLogEntries[0].message;
    }

    if (priorityMetric?.description) {
      return priorityMetric.description;
    }

    if (priorityMetric?.title) {
      return priorityMetric.title;
    }

    const tickerFallback = guruloStatus.ticker[0];
    if (tickerFallback) {
      const message = tickerFallback.label && tickerFallback.value
        ? `${tickerFallback.label}: ${tickerFallback.value}`
        : tickerFallback.label ?? tickerFallback.value ?? null;
      if (message) {
        return message;
      }
    }

    return null;
  }, [guruloStatus.ticker, priorityLogEntries, priorityMetric]);

  const activityHelperText = useMemo(() => {
    if (!brainOnline) {
      return t(
        'aiImprove.brain.analysis.offline',
        'ტვინი standby რეჟიმშია და ელოდება სერვისების სრულ გახურებას.',
      );
    }

    if (testsFailed) {
      return t(
        'aiImprove.brain.analysis.testsFailed',
        'გურულო ხელახლა ავლებს ჩავარდნილ ტესტებს, რათა გამოავლინოს პრობლემის მიზეზი.',
      );
    }

    if (priorityMetric?.title) {
      return t(
        'aiImprove.brain.analysis.focus',
        'გურულო ახლა იკვლევს "{{title}}" განახლებას და დეტალურად აღწერს პრობლემას.',
        { title: priorityMetric.title },
      );
    }

    if (queueHasWork && typeof queueLength === 'number' && Number.isFinite(queueLength)) {
      return t(
        'aiImprove.brain.analysis.queue',
        'რიგშია {{count}} ამოცანა და გურულო ამზადებს შესრულების გეგმას.',
        { count: queueLength },
      );
    }

    if (brainDegraded) {
      return t(
        'aiImprove.brain.analysis.degraded',
        'მონაცემები ოდნავ აგვიანებს, მაგრამ გურულო აგროვებს საჭირო კონტექსტს.',
      );
    }

    return t(
      'aiImprove.brain.analysis.stable',
      'ყველაფერი სტაბილურად გამოიყურება. გურულო ელოდება შემდეგ გაუმჯობესების შესაძლებლობას.',
    );
  }, [
    brainDegraded,
    brainOnline,
    priorityMetric,
    queueHasWork,
    queueLength,
    t,
    testsFailed,
  ]);

  const categorizeMetric = useCallback((metric: AutoImproveMetric): AutoImproveSection => {
    const baseText = [metric.id, metric.title, metric.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const hasLogSignals = (metric.logs?.length ?? 0) > 0 || baseText.includes('log') || baseText.includes('ლოგ');

    if (
      hasLogSignals ||
      baseText.includes('security') ||
      baseText.includes('audit') ||
      baseText.includes('auth') ||
      baseText.includes('უსაფრთხო') ||
      baseText.includes('აუდიტ')
    ) {
      return 'security';
    }

    if (
      baseText.includes('monitor') ||
      baseText.includes('trace') ||
      baseText.includes('uptime') ||
      baseText.includes('latency') ||
      baseText.includes('queue') ||
      baseText.includes('update') ||
      baseText.includes('deploy') ||
      baseText.includes('release') ||
      baseText.includes('refresh') ||
      baseText.includes('მონიტორ') ||
      baseText.includes('განახლ')
    ) {
      return 'operations';
    }

    return 'brain';
  }, []);

  const sidebarCounts = useMemo(() => {
    const counts: Record<AutoImproveSection, number> = {
      brain: combinedMetrics.length,
      operations: 0,
      security: 0,
    };

    combinedMetrics.forEach((metric) => {
      const section = categorizeMetric(metric);
      if (section !== 'brain') {
        counts[section] += 1;
      }
    });

    return counts;
  }, [categorizeMetric, combinedMetrics]);

  const sectionMetrics = useMemo(() => {
    if (activeSection === 'brain') {
      return combinedMetrics;
    }

    return combinedMetrics.filter((metric) => categorizeMetric(metric) === activeSection);
  }, [activeSection, categorizeMetric, combinedMetrics]);

  const openActivityFile = useCallback(
    (path: string) => {
      if (!path) {
        return;
      }

      if (typeof openFileFromActivity === 'function') {
        openFileFromActivity(path);
        return;
      }

      console.warn('openFileFromActivity handler is not provided, cannot open', path);
    },
    [openFileFromActivity],
  );

  const embeddedContent = useMemo(() => {
    switch (activeSection) {
      case 'operations': {
        return (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7 xl:col-span-8">
              <SystemMonitoringDashboard />
              <AutoUpdateMonitoringDashboard />
            </div>
            {isTraceMonitorEnabled ? (
              <div className="lg:col-span-5 xl:col-span-4">
                <AutoImproveTraceMonitor className="h-full" />
              </div>
            ) : null}
          </div>
        );
      }
      case 'security':
        return (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 xl:col-span-8">
              <SecurityAuditTab />
            </div>
            <div className="lg:col-span-5 xl:col-span-4">
              <ActivityLog openFile={openActivityFile} />
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [activeSection, isTraceMonitorEnabled, openActivityFile]);

  const handleRefresh = useCallback(() => {
    if (isOffline) {
      return;
    }
    if (metricsKey) {
      void mutateMetrics();
    }
    if (monitorKey) {
      void mutateMonitor();
    }
  }, [isOffline, metricsKey, monitorKey, mutateMetrics, mutateMonitor]);

  const handleCopySnapshot = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    setIsCopying(true);
    try {
      const snapshot = JSON.stringify(filteredMetrics, null, 2);
      await navigator.clipboard.writeText(snapshot);
    } catch (error) {
      console.error('Failed to copy auto-improve snapshot', error);
    } finally {
      setIsCopying(false);
    }
  }, [filteredMetrics]);

  const handleExportCsv = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    setIsExporting(true);
    try {
      const header = 'id,title,status,latencyMs,successRate,model,updatedAt\n';
      const rows = filteredMetrics.map((metric: AutoImproveMetric) =>
        [
          metric.id,
          metric.title,
          metric.status,
          metric.latencyMs ?? 'N/A',
          metric.successRate ?? 'N/A',
          metric.model ?? 'N/A',
          metric.updatedAt ?? 'N/A',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      );
      const csv = `${header}${rows.join('\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `auto-improve-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export auto-improve csv', error);
    } finally {
      setIsExporting(false);
    }
  }, [filteredMetrics]);

  const handleToggleMetric = useCallback((metricId: string) => {
    setExpandedMetricId((current) => (current === metricId ? null : metricId));
  }, []);

  const handleSectionChange = useCallback((section: AutoImproveSection) => {
    setActiveSection(section);
  }, []);

  const handleGaugeOpen = useCallback((gauge: 'latency' | 'success' | 'tests') => {
    setActiveGauge(gauge);
  }, []);

  const handleGaugeClose = useCallback(() => {
    setActiveGauge(null);
  }, []);

  const sidebarItems = useMemo(() => {
    const items: Array<{
      id: string;
      icon: string;
      label: string;
      onClick: () => void;
      active: boolean;
      badge?: number | string | null;
    }> = [
      {
        id: 'brain',
        icon: '🧠',
        label: t('aiImprove.sidebar.brain', 'ტვინი'),
        onClick: () => handleSectionChange('brain'),
        active: activeSection === 'brain',
        badge: sidebarCounts.brain,
      },
      {
        id: 'operations',
        icon: '🛠️',
        label: t('aiImprove.sidebar.operations', 'ოპერაციები'),
        onClick: () => handleSectionChange('operations'),
        active: activeSection === 'operations',
        badge: sidebarCounts.operations,
      },
      {
        id: 'security',
        icon: '🛡️',
        label: t('aiImprove.sidebar.securityCenter', 'უსაფრთხოება და აქტივობები'),
        onClick: () => handleSectionChange('security'),
        active: activeSection === 'security',
        badge: sidebarCounts.security,
      },
    ];

    return items;
  }, [
    activeSection,
    handleSectionChange,
    sidebarCounts.brain,
    sidebarCounts.operations,
    sidebarCounts.security,
    t,
  ]);

  if (!hasDevConsoleAccess && !isTraceMonitorEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-950 text-gray-300">
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 px-8 py-6 text-center shadow-lg">
          <p className="text-lg font-semibold">{t('aiImprove.access.deniedTitle', '🔒 წვდომა აკრძალულია')}</p>
          <p className="mt-2 text-sm text-gray-400">
            {t('aiImprove.access.deniedBody', 'Auto-Improve სისტემაზე წვდომა მხოლოდ ადმინისტრატორებს აქვთ')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames('flex h-full bg-slate-950 text-slate-100', autoImproveTheme.colors.background)}>
      <ImproveSidebar
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        items={sidebarItems}
        serviceState={connectionState as AutoImproveServiceState}
        addon={(
          <BrainStatusCard
            collapsed={isSidebarCollapsed}
            status={brainStatusHeadline}
            percent={brainPercent}
            lastUpdate={guruloBrainStatus.lastUpdate}
            tasksActive={brainTasksActive}
            mode={brainModeLabel ?? undefined}
            isLoading={isGuruloBrainStatusLoading}
            isOffline={isOffline}
            error={guruloBrainStatusError ? 'error' : null}
            tooltip={brainStatusTooltip}
            onClick={() => setIsBrainModalOpen(true)}
          />
        )}
      />
      <main className="flex-1 overflow-y-auto">
        <div className={classNames('mx-auto flex h-full max-w-7xl flex-col', autoImproveTheme.spacing.layout)}>
          <div className="space-y-6 pb-16">
            {activeSection === 'brain' && <BrainPage />}

            <MetricStrip
              metrics={activeSection === 'brain' ? combinedMetrics : sectionMetrics}
              lastUpdated={lastUpdated}
              serviceState={connectionState as AutoImproveServiceState}
              onCopy={handleCopySnapshot}
              onExport={handleExportCsv}
              isCopying={isCopying}
              isExporting={isExporting}
              disabled={isOffline}
            />

            {isOffline && (
              <div
                className="rounded-md border border-slate-600/40 bg-slate-900/80 px-4 py-3 text-sm text-slate-200"
                role="status"
                aria-live="polite"
              >
                {t(
                  'aiImprove.banner.offline',
                  'სერვისი მუშაობს შეზღუდულ რეჟიმში. მონაცემები განახლდება ონლაინ დაბრუნების შემდეგ.',
                )}
              </div>
            )}

            {!isOffline && isDegraded && (
              <div
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
                role="status"
                aria-live="polite"
              >
                {t('aiImprove.banner.degraded', 'მონაცემების განახლება დაგვიანებულია. მიმდინარეობს აღდგენა...')}
              </div>
            )}

            <FilterBar
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              models={modelOptions}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onRefresh={handleRefresh}
              isRefreshing={isMetricsValidating}
              disabled={isOffline}
            />

            <div
              className="grid grid-cols-1 gap-4 p-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto"
            >
              {(isMetricsLoading || isMonitorLoading || isOffline) && !sectionMetrics.length ? (
                skeletonMetrics.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    id={metric.id}
                    title={metric.title}
                    primary="—"
                    trend={undefined}
                    progress={undefined}
                    metric={metric}
                    isExpanded={false}
                    onToggle={() => undefined}
                    isLoading
                    data-testid="original-metric"
                  />
                ))
              ) : sectionMetrics.length > 0 ? (
                sectionMetrics.map((metric: AutoImproveMetric) => {
                  const progressPercent = resolveMetricProgressPercent(metric);
                  return (
                    <MetricCard
                      key={metric.id}
                      id={metric.id}
                      title={metric.title}
                      primary={resolveMetricPrimaryValue(metric)}
                      trend={undefined}
                      progress={progressPercent}
                      cta={
                        metric.cta && typeof metric.cta.onClick === 'function'
                          ? {
                              label: metric.cta.label,
                              onClick: metric.cta.onClick,
                            }
                          : undefined
                      }
                      data-testid={metric.dataTestId ?? 'original-metric'}
                      metric={metric}
                      isExpanded={expandedMetricId === metric.id}
                      onToggle={handleToggleMetric}
                    />
                  );
                })
              ) : (
                <AutoImproveEmptyState
                  offline={isOffline}
                  pollingDisabled={pollingDisabled}
                  onRetry={!isOffline ? handleRefresh : undefined}
                />
              )}
            </div>

            {embeddedContent && (
              <div
                className={classNames(
                  'space-y-6',
                  activeSection === 'operations' ? 'mt-4' : 'mt-8',
                )}
              >
                {embeddedContent}
              </div>
            )}

            {activeSection === 'brain' && activeGauge ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
                <div className="w-full max-w-md rounded-3xl border border-purple-500/40 bg-slate-900/90 p-6 shadow-2xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/80">
                        {t('aiImprove.brain.digital.details.title', 'გურულოს დეტალები')}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">
                        {gaugeDetails[activeGauge].title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">{gaugeDetails[activeGauge].helper}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGaugeClose}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-purple-500/40 text-slate-200 transition hover:border-purple-300/60 hover:text-white"
                      aria-label={t('aiImprove.brain.digital.details.close', 'დახურვა')}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-6 rounded-2xl border border-purple-500/20 bg-slate-950/60 px-4 py-3">
                    <p className="text-3xl font-bold text-white">{gaugeDetails[activeGauge].value}</p>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {gaugeDetails[activeGauge].rows.map((row) => (
                      <li
                        key={`${activeGauge}-${row.label}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                      >
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{row.label}</span>
                        <span className="font-semibold text-white">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
          ) : null}
        </div>
      </div>
    </main>
    <AnimatePresence>
      {isBrainModalOpen && (
        <motion.div
          key="brain-status-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setIsBrainModalOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="brain-status-modal-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="mx-4 w-full max-w-md rounded-3xl border border-purple-500/40 bg-slate-950/95 p-6 text-slate-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-purple-200/70">
                  {t('aiImprove.brain.title', 'ტვინი')}
                </p>
                <h2
                  id="brain-status-modal-title"
                  className="mt-2 text-2xl font-semibold text-white"
                >
                  {t('aiImprove.brain.modal.title', 'გურულოს ტვინის სტატუსი')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsBrainModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-purple-500/40 text-slate-200 transition hover:border-purple-300/60 hover:text-white"
                aria-label={t('aiImprove.brain.modal.close', 'დახურვა')}
              >
                ✕
              </button>
            </div>
            {brainStatusHeadline ? (
              <p className="mt-4 text-sm font-medium text-purple-100">
                {brainStatusHeadline}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-300">{brainModalStatusLine}</p>
            {brainStatusErrorMessage ? (
              <p className="mt-2 text-xs text-rose-300">
                {t('aiImprove.brain.modal.error', 'შეცდომა')}: {brainStatusErrorMessage}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 p-3 shadow-inner">
                <p className="text-[11px] uppercase tracking-[0.28em] text-purple-200/70">
                  {t('aiImprove.brain.sidebar.activity', 'აქტიურობა')}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{brainPercentDisplay}</p>
              </div>
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 p-3 shadow-inner">
                <p className="text-[11px] uppercase tracking-[0.28em] text-purple-200/70">
                  {t('aiImprove.brain.modal.tasks', 'დავალებები')}
                </p>
                <p className="mt-2 text-lg font-semibold text-purple-100">{brainTasksLabel}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/70">
              <span>
                {t('aiImprove.brain.modal.mode', 'რეჟიმი')}: {brainModeLabel ?? t('aiImprove.brain.modal.modeUnknown', 'უცნობია')}
              </span>
              <span>
                {t('aiImprove.brain.modal.clock', 'ბოლო ტაქტი')}: {brainLastUpdateClock}
              </span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-purple-500/40 bg-purple-950/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-400 via-purple-500 to-fuchsia-500"
                style={{ width: `${brainPercent !== null ? Math.max(8, brainPercent) : 12}%` }}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {t('aiImprove.brain.modal.updated', 'განახლდა')}: {brainLastUpdateFormatted}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBrainModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-purple-500/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200 transition hover:border-purple-300/60 hover:text-white"
                >
                  {t('aiImprove.brain.modal.close', 'დახურვა')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void refreshGuruloBrainStatus();
                  }}
                  disabled={isGuruloBrainStatusLoading || isOffline}
                  className="inline-flex items-center justify-center rounded-full border border-purple-500/50 bg-purple-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-100 transition hover:border-purple-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  title={t('aiImprove.brain.modal.refresh', 'განაახლე სტატუსი')}
                >
                  {isGuruloBrainStatusLoading
                    ? t('aiImprove.brain.modal.refreshing', 'განახლება...')
                    : t('aiImprove.brain.digital.refresh', 'განახლება')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
};

export default AutoImproveTab;

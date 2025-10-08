import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  Database,
  History,
  Info,
  ListChecks,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Users,
  XCircle,
  Zap,
  Clock,
} from 'lucide-react';
import type { MemoryControls, SavedMemoryEntry, MemoryDashboardMetrics } from '@/types/aimemory';

interface MemoryControlsPanelProps {
  controls: MemoryControls;
  memories: SavedMemoryEntry[];
  metrics: MemoryDashboardMetrics;
  loading?: boolean;
  error?: string | null;
  onToggle: (feature: 'savedMemories' | 'chatHistory', enabled: boolean) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onSaveQuickMemory?: () => void;
  userDisplayName?: string;
  expandedViewEnabled: boolean;
  onExpandedViewChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<{
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  loading?: boolean;
  onChange: (value: boolean) => void;
  icon: React.ReactNode;
}> = ({ id, label, description, enabled, loading, onChange, icon }) => (
  <button
    type="button"
    aria-pressed={enabled}
    aria-describedby={`${id}-description`}
    onClick={() => onChange(!enabled)}
    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between w-full rounded-xl border px-4 py-3 transition-colors ${
      enabled ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-gray-700 bg-gray-900/50'
    } ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:border-emerald-500/80'}`}
    disabled={loading}
  >
    <div className="flex items-start gap-3 text-left">
      <span className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p id={`${id}-description`} className="text-xs text-gray-400">
          {description}
        </p>
      </div>
    </div>
    <span
      className={`mt-3 sm:mt-0 inline-flex h-7 w-14 items-center rounded-full px-1 transition ${
        enabled ? 'bg-emerald-500/80 justify-end' : 'bg-gray-700 justify-start'
      }`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow ${enabled ? '' : 'bg-gray-200'}`} />
    </span>
  </button>
);

type TimeRangeFilter = '24h' | '7d' | '30d' | 'all';
type StatusFilter = 'all' | 'confirmed' | 'pending' | 'issues' | 'logs';

const parseDateSafe = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const formatDateForDisplay = (value?: string | null): string => {
  const parsed = parseDateSafe(value);
  if (!parsed) {
    return '—';
  }

  return parsed.toLocaleString('ka-GE');
};

const badgeToneClassMap: Record<'emerald' | 'red' | 'amber' | 'slate' | 'sky', { wrapper: string; text: string }> = {
  emerald: {
    wrapper: 'border-emerald-500/60 bg-emerald-500/10',
    text: 'text-emerald-200',
  },
  red: {
    wrapper: 'border-red-500/60 bg-red-500/10',
    text: 'text-red-200',
  },
  amber: {
    wrapper: 'border-amber-500/60 bg-amber-500/10',
    text: 'text-amber-100',
  },
  slate: {
    wrapper: 'border-gray-700 bg-gray-900/80',
    text: 'text-gray-300',
  },
  sky: {
    wrapper: 'border-sky-500/60 bg-sky-500/10',
    text: 'text-sky-200',
  },
};

const MemoryMetricBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: keyof typeof badgeToneClassMap;
}> = ({ icon, label, value, tone = 'slate' }) => {
  const palette = badgeToneClassMap[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        palette.wrapper
      } ${palette.text}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/60 text-current">{icon}</span>
      <span>{label}</span>
      <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide">{value}</span>
    </span>
  );
};

interface MemoryListProps {
  memories: SavedMemoryEntry[];
  metrics: MemoryDashboardMetrics;
  query: string;
  onQueryChange: (value: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  expanded: boolean;
  showDetailedMetrics: boolean;
  onRequestExpand?: () => void;
  timeRange: TimeRangeFilter;
  statusFilter: StatusFilter;
  onStatusFilterChange: (next: StatusFilter) => void;
}

const MemoryList: React.FC<MemoryListProps> = ({
  memories,
  metrics,
  query,
  onQueryChange,
  selectedIds,
  onSelectionChange,
  expanded,
  showDetailedMetrics,
  onRequestExpand,
  timeRange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const filteredMemories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const now = Date.now();
    const threshold =
      timeRange === '24h'
        ? now - 24 * 60 * 60 * 1000
        : timeRange === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : timeRange === '30d'
        ? now - 30 * 24 * 60 * 60 * 1000
        : null;

    return memories.filter((memory) => {
      if (statusFilter === 'confirmed' && !memory.userConfirmed) {
        return false;
      }
      if (statusFilter === 'pending' && memory.userConfirmed) {
        return false;
      }
      const issuesCount = (memory.errorCount ?? 0) + (memory.warningCount ?? 0);
      if (statusFilter === 'issues' && issuesCount === 0) {
        return false;
      }
      if (statusFilter === 'logs' && (memory.logCount ?? 0) === 0) {
        return false;
      }

      if (threshold) {
        const eventTimestamp =
          parseDateSafe(memory.updatedAt)?.getTime() ??
          parseDateSafe(memory.lastAccessedAt)?.getTime() ??
          parseDateSafe(memory.createdAt)?.getTime() ??
          null;

        if (eventTimestamp && eventTimestamp < threshold) {
          return false;
        }
      }

      if (!normalized) {
        return true;
      }

      const haystack = [
        memory.key,
        typeof memory.value === 'string' ? memory.value : JSON.stringify(memory.value),
        memory.summary,
        Array.isArray(memory.tags) ? memory.tags.join(' ') : '',
        memory.ownerName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [memories, query, statusFilter, timeRange]);

  const visibleMemories = useMemo(
    () => (expanded ? filteredMemories : filteredMemories.slice(0, 4)),
    [filteredMemories, expanded],
  );

  const allVisibleSelected = useMemo(
    () => visibleMemories.length > 0 && visibleMemories.every((memory) => selectedIds.includes(memory.id)),
    [selectedIds, visibleMemories],
  );

  const metricLogCount = metrics.logCount ?? 0;
  const metricErrorCount = metrics.errorCount ?? 0;
  const metricWarningCount = metrics.warningCount ?? 0;
  const metricHealthScore = metrics.healthScore ?? 0;
  const metricAverageConfidence = metrics.averageConfidence ?? 0;
  const badgeHealthTone: 'emerald' | 'amber' | 'red' =
    metricHealthScore >= 75
      ? 'emerald'
      : metricHealthScore >= 50
      ? 'amber'
      : 'red';

  const toggleSelection = (memoryId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange(Array.from(new Set([...selectedIds, memoryId])));
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== memoryId));
    }
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = visibleMemories.map((memory) => memory.id);
      onSelectionChange(selectedIds.filter((id) => !visibleIds.includes(id)));
    } else {
      const visibleIds = visibleMemories.map((memory) => memory.id);
      onSelectionChange(Array.from(new Set([...selectedIds, ...visibleIds])));
    }
  };

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'ყველა' },
    { value: 'confirmed', label: 'დადასტ.' },
    { value: 'pending', label: 'მოლოდინი' },
    { value: 'issues', label: 'გაფრთხილება' },
    { value: 'logs', label: 'ლოგი' },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">🔎 სწრაფი გადახედვა</p>
          <p className="text-xs text-gray-400">
            ბოლო აქტივობა:{' '}
            <span className="text-gray-200">{formatDateForDisplay(metrics.lastActivity)}</span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-60">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="ძიება მეხსიერებაში…"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 py-1.5 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusOptions.map((option) => {
              const active = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStatusFilterChange(option.value)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-emerald-500/60 hover:text-emerald-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={toggleAllVisible}
            disabled={visibleMemories.length === 0}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1 text-xs transition ${
              visibleMemories.length === 0
                ? 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-500'
                : allVisibleSelected
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-emerald-500/60 hover:text-emerald-200'
            }`}
          >
            {allVisibleSelected ? 'მონიშვნის მოხსნა' : 'ყველას მონიშვნა'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <MemoryMetricBadge icon={<Database size={12} />} label="ლოგი" value={metricLogCount} tone={metricLogCount > 0 ? 'emerald' : 'slate'} />
        <MemoryMetricBadge icon={<XCircle size={12} />} label="შეცდომა" value={metricErrorCount} tone={metricErrorCount > 0 ? 'red' : 'slate'} />
        <MemoryMetricBadge
          icon={<ShieldCheck size={12} />}
          label="გაფრთხილება"
          value={metricWarningCount}
          tone={metricWarningCount > 0 ? 'amber' : 'slate'}
        />
        <MemoryMetricBadge
          icon={<Activity size={12} />}
          label="ჯანმრთელობა"
          value={`${metricHealthScore}%`}
          tone={badgeHealthTone}
        />
        <MemoryMetricBadge
          icon={<BarChart3 size={12} />}
          label="დარწმუნებულობა"
          value={`${metricAverageConfidence}%`}
          tone={metricAverageConfidence > 74 ? 'emerald' : metricAverageConfidence > 49 ? 'amber' : 'red'}
        />
      </div>

      <div className="mt-4 space-y-3">
        {visibleMemories.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-700 bg-gray-950/80 px-4 py-6 text-center text-sm text-gray-500">
            არჩეული ფილტრებით შედეგი არ მოიძებნა.
          </div>
        )}
        {visibleMemories.map((memory) => {
          const memoryValue =
            typeof memory.value === 'string' ? memory.value : JSON.stringify(memory.value, null, 2);
          const checked = selectedIds.includes(memory.id);
          const updatedLabel = memory.updatedAt || memory.createdAt;
          const lastAccessed = memory.lastAccessedAt;
          const confidenceRaw = typeof memory.confidenceScore === 'number' ? memory.confidenceScore : memory.userConfirmed ? 0.92 : 0.6;
          const confidencePercent = Math.round((confidenceRaw > 1 ? confidenceRaw : confidenceRaw * 100));
          const syncStatus = memory.syncStatus ?? (memory.userConfirmed ? 'synced' : 'pending');
          const syncProgressRaw = typeof memory.syncProgress === 'number' ? memory.syncProgress : undefined;
          const syncProgress = Math.min(
            100,
            Math.max(0, syncProgressRaw ?? (memory.userConfirmed ? 100 : Math.max(60, metricAverageConfidence - 5))),
          );
          const usageCount = memory.usageCount ?? memory.conversationCount ?? 0;
          const issuesCount = (memory.errorCount ?? 0) + (memory.warningCount ?? 0);

          const syncBadge = (() => {
            switch (syncStatus) {
              case 'synced':
                return { className: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200', label: 'სინქრონიზებულია', icon: <CircleCheck size={12} /> };
              case 'syncing':
                return { className: 'border-sky-500/60 bg-sky-500/10 text-sky-200', label: 'სინქის მიმდინარეობა', icon: <CircleDashed size={12} /> };
              case 'pending':
                return { className: 'border-amber-500/60 bg-amber-500/10 text-amber-100', label: 'დამუშავება გრძელდება', icon: <CircleDashed size={12} /> };
              case 'error':
                return { className: 'border-red-500/60 bg-red-500/10 text-red-200', label: 'სინქი შეჩერდა', icon: <XCircle size={12} /> };
              default:
                return { className: 'border-gray-700 bg-gray-900 text-gray-300', label: 'სტატუსი უცნობია', icon: <CircleDashed size={12} /> };
            }
          })();

          return (
            <label
              key={memory.id}
              className={`flex gap-3 rounded-lg border px-4 py-3 transition ${
                checked ? 'border-emerald-500/60 bg-emerald-500/5' : issuesCount > 0 ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-400' : 'border-gray-800 bg-gray-950/80 hover:border-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => toggleSelection(memory.id, event.target.checked)}
                className="mt-1 h-4 w-4 rounded border border-gray-600 bg-gray-900 text-emerald-400 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-gray-400">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-200">
                    {memory.key}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                        memory.userConfirmed
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                          : 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                      }`}
                    >
                      {memory.userConfirmed ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {memory.userConfirmed ? 'დადასტურებული' : 'გადასამოწმებელი'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${syncBadge.className}`}>
                      {syncBadge.icon}
                      {syncBadge.label}
                    </span>
                  </span>
                  {updatedLabel ? (
                    <span className="text-[11px] text-gray-500">{formatDateForDisplay(updatedLabel)}</span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{memoryValue}</p>
                {memory.summary && <p className="mt-2 text-xs text-emerald-200/80">📝 {memory.summary}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                  {memory.source && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5">
                      <Database size={10} /> {memory.source}
                    </span>
                  )}
                  {memory.ownerName && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5">
                      <Users size={10} /> {memory.ownerName}
                    </span>
                  )}
                  {lastAccessed && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5">
                      <Clock size={10} /> ბოლო გამოყენება: {formatDateForDisplay(lastAccessed)}
                    </span>
                  )}
                  {usageCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5">
                      <Activity size={10} /> გამოყენება: {usageCount}
                    </span>
                  )}
                  {Array.isArray(memory.tags) &&
                    memory.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 uppercase"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
                <div className="mt-3 grid gap-3 text-[11px] text-gray-400 sm:grid-cols-2">
                  <div>
                    <div className="flex justify-between">
                      <span>დარწმუნებულობა</span>
                      <span>{Math.min(100, Math.max(0, confidencePercent))}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-800">
                      <div
                        className={`h-2 rounded-full ${
                          confidencePercent >= 75
                            ? 'bg-emerald-500'
                            : confidencePercent >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, confidencePercent))}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>სინქის პროგრესი</span>
                      <span>{Math.round(syncProgress)}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-800">
                      <div
                        className={`h-2 rounded-full ${
                          syncStatus === 'error'
                            ? 'bg-red-500'
                            : syncStatus === 'syncing' || syncStatus === 'pending'
                            ? 'bg-amber-400'
                            : 'bg-sky-400'
                        }`}
                        style={{ width: `${Math.round(syncProgress)}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
                {showDetailedMetrics && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <MemoryMetricBadge
                      icon={<Database size={10} />}
                      label="ლოგი"
                      value={memory.logCount ?? 0}
                      tone={(memory.logCount ?? 0) > 0 ? 'emerald' : 'slate'}
                    />
                    <MemoryMetricBadge
                      icon={<XCircle size={10} />}
                      label="შეცდომა"
                      value={memory.errorCount ?? 0}
                      tone={(memory.errorCount ?? 0) > 0 ? 'red' : 'slate'}
                    />
                    <MemoryMetricBadge
                      icon={<ShieldCheck size={10} />}
                      label="გაფრთხილება"
                      value={memory.warningCount ?? 0}
                      tone={(memory.warningCount ?? 0) > 0 ? 'amber' : 'slate'}
                    />
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {!expanded && filteredMemories.length > visibleMemories.length && (
        <button
          type="button"
          onClick={onRequestExpand}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
        >
          <ListChecks size={14} />
          სრულ მართვაზე გადასვლა
        </button>
      )}
      {expanded && (
        <a
          href="#gurulo-memory-manager"
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
        >
          <ListChecks size={14} />
          სრულ მართვაზე გადასვლა
        </a>
      )}
    </div>
  );
};


const MemoryControlsPanel: React.FC<MemoryControlsPanelProps> = ({
  controls,
  memories,
  metrics,
  loading,
  error,
  onToggle,
  onRefresh,
  onSaveQuickMemory,
  userDisplayName,
  expandedViewEnabled,
  onExpandedViewChange,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(true);
  const [userToggledMetrics, setUserToggledMetrics] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    setSelectedIds((previous) => previous.filter((id) => memories.some((memory) => memory.id === id)));
  }, [memories]);

  const fallbackMetrics = useMemo(() => {
    const total = memories.length;
    const confirmed = memories.filter((memory) => memory.userConfirmed).length;
    const pending = Math.max(total - confirmed, 0);
    const log = memories.reduce((running, memory) => running + (memory.logCount ?? 0), 0);
    const error = memories.reduce((running, memory) => running + (memory.errorCount ?? 0), 0);
    const warning = memories.reduce((running, memory) => running + (memory.warningCount ?? 0), 0);
    const confidenceAccumulator = memories.reduce((running, memory) => {
      const explicit = typeof memory.confidenceScore === 'number' ? memory.confidenceScore : undefined;
      const normalized = explicit !== undefined ? (explicit > 1 ? explicit / 100 : explicit) : memory.userConfirmed ? 0.9 : 0.55;
      return running + Math.max(0, Math.min(1, normalized));
    }, 0);
    const averageConfidence = total === 0 ? 0 : Math.round((confidenceAccumulator / total) * 100);

    return { total, confirmed, pending, log, error, warning, averageConfidence };
  }, [memories]);

  const totalCount = metrics.total ?? fallbackMetrics.total;
  const confirmedCount = metrics.confirmed ?? fallbackMetrics.confirmed;
  const pendingCount = metrics.pending ?? fallbackMetrics.pending;
  const logBadgeCount = metrics.logCount ?? fallbackMetrics.log;
  const errorBadgeCount = metrics.errorCount ?? fallbackMetrics.error;
  const warningBadgeCount = metrics.warningCount ?? fallbackMetrics.warning;
  const averageConfidence = metrics.averageConfidence ?? fallbackMetrics.averageConfidence;
  const syncedCount = metrics.synced ?? 0;
  const syncingCount = metrics.syncing ?? 0;
  const failingCount = metrics.failing ?? 0;
  const selectionCount = selectedIds.length;
  const isFeatureAvailable = controls.referenceSavedMemories || controls.referenceChatHistory;
  const metricsPanelVisible = isFeatureAvailable && showDetailedMetrics;
  const confirmationProgress = totalCount === 0 ? 0 : Math.round((confirmedCount / totalCount) * 100);
  const pendingProgress = totalCount === 0 ? 0 : Math.round((pendingCount / totalCount) * 100);
  const issuesTotal = errorBadgeCount + warningBadgeCount;
  const healthScore = metrics.healthScore ?? Math.max(
    0,
    Math.min(100, Math.round((confirmedCount / Math.max(totalCount, 1)) * 100) - errorBadgeCount * 2 - warningBadgeCount),
  );
  const healthStatus = healthScore >= 75 ? 'სტაბილური' : healthScore >= 50 ? 'ყურადღება' : 'გაფრთხილება';
  const healthTone =
    healthScore >= 75
      ? 'text-emerald-200 border-emerald-500/60 bg-emerald-500/10'
      : healthScore >= 50
      ? 'text-amber-100 border-amber-500/60 bg-amber-500/10'
      : 'text-red-200 border-red-500/60 bg-red-500/10';

  const handleExpandedToggle = () => {
    const nextValue = !expandedViewEnabled;
    onExpandedViewChange(nextValue);
  };

  useEffect(() => {
    if (!isFeatureAvailable) {
      setShowDetailedMetrics(false);
      setUserToggledMetrics(false);
    }
  }, [isFeatureAvailable]);

  useEffect(() => {
    if (isFeatureAvailable && !showDetailedMetrics && !userToggledMetrics) {
      setShowDetailedMetrics(true);
    }
  }, [isFeatureAvailable, showDetailedMetrics, userToggledMetrics]);

  return (
    <section className="rounded-3xl border border-gray-800 bg-[#0B1220]/95 p-6 shadow-xl">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">AI მეხსიერება</h2>
          <p className="text-sm text-gray-400">გურულოს მეხსიერების მართვა</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            გურულო მუშაობს
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-gray-300">
            <UserIcon size={14} />
            {userDisplayName || 'ანგარიში დაუდგენელია'}
          </span>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="memory-filter" className="text-xs text-gray-400">
              უკანასკნელი
            </label>
            <select
              id="memory-filter"
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-1 text-xs text-gray-200"
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRangeFilter)}
            >
              <option value="24h">24 საათი</option>
              <option value="7d">7 დღე</option>
              <option value="30d">30 დღე</option>
              <option value="all">ყველა პერიოდი</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="memory-scope" className="text-xs text-gray-400">
              ჩანაწერები
            </label>
            <select
              id="memory-scope"
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-1 text-xs text-gray-200"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">ყველა</option>
              <option value="confirmed">დადასტურებული</option>
              <option value="pending">გადასამოწმებელი</option>
              <option value="issues">გაფრთხილება</option>
              <option value="logs">ლოგი</option>
            </select>
          </div>
        </div>
        {!metricsPanelVisible && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-3 py-1">
              სულ: <span className="text-gray-200">{totalCount}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              დადასტურებული: {confirmedCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-amber-100">
              გადასამოწმებელი: {pendingCount}
            </span>
            {selectionCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/5 px-3 py-1 text-emerald-200">
                მონიშნული: {selectionCount}
              </span>
            )}
          </div>
        )}
      </div>

      {isFeatureAvailable && (
        <div className="mt-4 rounded-2xl border border-gray-800 bg-[#0B1322]/70 p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-200">📊 გაერთიანებული მეტრიკები</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-3 py-1">
                სულ: <span className="text-gray-200">{totalCount}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                დადასტურებული: {confirmedCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-amber-100">
                გადასამოწმებელი: {pendingCount}
              </span>
              {selectionCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/5 px-3 py-1 text-emerald-200">
                  მონიშნული: {selectionCount}
                </span>
              )}
            </div>
          </div>
          {metricsPanelVisible ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-xs text-gray-400">დადასტურების პროგრესი</p>
                <p className="mt-2 text-lg font-semibold text-emerald-200">{confirmationProgress}%</p>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>დადასტურებული</span>
                      <span>{confirmedCount}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-800">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${confirmationProgress}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>გადასამოწმებელი</span>
                      <span>{pendingCount}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-800">
                      <div
                        className="h-2 rounded-full bg-amber-400"
                        style={{ width: `${pendingProgress}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-xs text-gray-400">შეტყობინებების სტატუსი</p>
                <p className="mt-2 text-lg font-semibold text-gray-200">{logBadgeCount}</p>
                <p className="text-[11px] text-gray-500">ლოგები, შეცდომები და გაფრთხილებები ერთ ხედში</p>
                <div className="mt-3 space-y-2 text-[11px] text-gray-400">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-emerald-200">
                      <Database size={12} /> ლოგები
                    </span>
                    <span>{logBadgeCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-red-200">
                      <XCircle size={12} /> შეცდომა
                    </span>
                    <span>{errorBadgeCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-amber-200">
                      <ShieldCheck size={12} /> გაფრთხილება
                    </span>
                    <span>{warningBadgeCount}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-xs text-gray-400">სინქრონიზაციის სტატუსი</p>
                <p className="mt-2 text-lg font-semibold text-gray-200">{syncedCount}/{totalCount}</p>
                <p className="text-[11px] text-gray-500">აქტიური, მიმდინარენი და პრობლემური ჩანაწერები</p>
                <div className="mt-3 space-y-2 text-[11px] text-gray-400">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-emerald-200">
                      <CircleCheck size={12} /> სინქრონიზებული
                    </span>
                    <span>{syncedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-sky-200">
                      <CircleDashed size={12} /> მიმდინარეობს
                    </span>
                    <span>{syncingCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-red-200">
                      <XCircle size={12} /> პრობლემური
                    </span>
                    <span>{failingCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-emerald-200">
                      <ListChecks size={12} /> მონიშნული
                    </span>
                    <span>{selectionCount}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-xs text-gray-400">სისტემის ჯანმრთელობა</p>
                <span className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${healthTone}`}>
                  <CheckCircle2 size={14} /> {healthStatus}
                </span>
                <p className="mt-3 text-[11px] text-gray-400">ჯანმრთელობის ქულა: {healthScore}%</p>
                <p className="text-[11px] text-gray-400">საშუალო დარწმუნებულობა: {averageConfidence}%</p>
                <p className="text-[11px] text-gray-400">გაფრთხილებები და შეცდომები: {issuesTotal}</p>
                <p className="text-[11px] text-gray-500">ბოლო აქტივობა: {formatDateForDisplay(metrics.lastActivity)}</p>
                <p className="text-[11px] text-gray-500">
                  კონტროლის განახლება: {controls.lastUpdated ? formatDateForDisplay(controls.lastUpdated) : '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-500">
              მეტრიკები ჩაკეცილია. გამოიყენე „მეტრიკების ჩვენება" ღილაკი რათა იხილო დეტალური სტატუსი.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-300">
        <button
          type="button"
          onClick={() => onSaveQuickMemory?.()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1 hover:border-emerald-500/60 hover:text-emerald-200"
        >
          <Save size={14} /> შენახვა
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1 hover:border-emerald-500/60 hover:text-emerald-200"
        >
          <RefreshCw size={14} /> განახლება
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 ${
            selectionCount === 0
              ? 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-500'
              : 'border-red-500/60 bg-red-500/10 text-red-200 hover:border-red-400'
          }`}
          disabled={selectionCount === 0}
          title={selectionCount === 0 ? 'მონიშნე ჩანაწერები წასაშლელად' : 'მონიშნული ჩანაწერების წაშლა'}
        >
          <Trash2 size={14} /> წაშლა
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 ${
            logBadgeCount > 0
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
              : 'border-gray-700 bg-gray-900 text-gray-300'
          }`}
          title="ლოგების ნახვა"
        >
          <Database size={14} /> ლოგი
          <span className="ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-gray-800 px-1 text-[10px] text-gray-200">
            {logBadgeCount}
          </span>
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 ${
            errorBadgeCount > 0
              ? 'border-red-500/60 bg-red-500/10 text-red-200'
              : 'border-gray-700 bg-gray-900 text-gray-300'
          }`}
          title="შეცდომების მონიტორინგი"
        >
          <XCircle size={14} /> შეცდომა
          <span className="ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-gray-800 px-1 text-[10px] text-gray-200">
            {errorBadgeCount}
          </span>
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 ${
            warningBadgeCount > 0
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
              : 'border-gray-700 bg-gray-900 text-gray-300'
          }`}
          title="გაფრთხილებების ნახვა"
        >
          <ShieldCheck size={14} /> გაფრთხილება
          <span className="ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-gray-800 px-1 text-[10px] text-gray-200">
            {warningBadgeCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            setShowDetailedMetrics((previous) => {
              const next = !previous;
              setUserToggledMetrics(true);
              return next;
            })
          }
          aria-pressed={metricsPanelVisible}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 transition ${
            metricsPanelVisible
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400'
              : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-emerald-500/60 hover:text-emerald-200'
          }`}
          title={metricsPanelVisible ? 'მეტრიკების ჩაკეცვა' : 'მეტრიკების ჩვენება'}
        >
          <ListChecks size={14} /> {metricsPanelVisible ? 'მეტრიკების ჩაკეცვა' : 'მეტრიკების ჩვენება'}
        </button>
        <button
          type="button"
          onClick={handleExpandedToggle}
          disabled={!isFeatureAvailable}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 transition ${
            !isFeatureAvailable
              ? 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-500'
              : expandedViewEnabled
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400'
              : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-emerald-500/60 hover:text-emerald-200'
          }`}
          title={
            isFeatureAvailable
              ? expandedViewEnabled
                ? 'გაფართოებული ხედის ჩაკეცვა'
                : 'გაფართოებული ხედის გახსნა'
              : 'სრულ მენეჯერზე წვდომა მხოლოდ გააქტიურებული მეხსიერების ფუნქციებისას'
          }
        >
          {expandedViewEnabled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expandedViewEnabled ? 'სრული ხედვის ჩაკეცვა' : 'სრული ხედვის გახსნა'}
        </button>
      </div>
      {!isFeatureAvailable && (
        <p className="mt-2 text-xs text-amber-200/80">
          გაფართოებული მეხსიერების სიის სანახავად ჩართე შესაბამისი ფუნქციები (შენახული მეხსიერებები ან ჩატის ისტორია).
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ToggleSwitch
          id="toggle-saved-memories"
          label="შენახული მეხსიერებების გამოყენება"
          description="გურულო პასუხებში გამოიყენებს მომხმარებლის ფაქტებს და პრეფერენციებს"
          enabled={controls.referenceSavedMemories}
          loading={loading}
          onChange={(value) => onToggle('savedMemories', value)}
          icon={<Zap size={16} />}
        />
        <ToggleSwitch
          id="toggle-chat-history"
          label="ჩატის ისტორიის გათვალისწინება"
          description="გურულო გამოიყენებს წინა დიალოგებს სრული კონტექსტისთვის"
          enabled={controls.referenceChatHistory}
          loading={loading}
          onChange={(value) => onToggle('chatHistory', value)}
          icon={<History size={16} />}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <Info size={14} className="mt-0.5 text-emerald-300" />
        გურულო შესაძლოა გამოიყენოს მეხსიერება, რათა პერსონალიზებული პასუხები შექმნას (მაგალითად Bing-ის ძიების მსგავსი ინტეგრაციისას).
        <a
          href="https://help.openai.com/en/articles/8151410-chatgpt-memory"
          target="_blank"
          rel="noreferrer"
          className="ml-1 text-emerald-300 hover:text-emerald-200"
        >
          გაიგე მეტი
        </a>
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          ❌ {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <MemoryList
          memories={memories}
          metrics={metrics}
          query={query}
          onQueryChange={setQuery}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          expanded={expandedViewEnabled}
          showDetailedMetrics={metricsPanelVisible}
          onRequestExpand={() => onExpandedViewChange(true)}
          timeRange={timeRange}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
        <div className="flex h-full flex-col justify-between rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">🧾 სტატუსი</p>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-center gap-2"><Database size={14} className="text-emerald-300" /> მეხსიერების ჩანაწერები: {totalCount}</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-300" /> დადასტურებული: {confirmedCount}</li>
              <li className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-300" /> გადასამოწმებელი: {pendingCount}</li>
              <li className="flex items-center gap-2"><Database size={14} className="text-emerald-300" /> ლოგები: {logBadgeCount}</li>
              <li className="flex items-center gap-2"><XCircle size={14} className="text-red-300" /> შეცდომები: {errorBadgeCount}</li>
              <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-amber-200" /> გაფრთხილებები: {warningBadgeCount}</li>
              <li className="flex items-center gap-2"><CircleCheck size={14} className="text-emerald-300" /> სინქრონიზებული: {syncedCount}</li>
              <li className="flex items-center gap-2"><CircleDashed size={14} className="text-sky-300" /> მიმდინარეობს: {syncingCount}</li>
              <li className="flex items-center gap-2"><XCircle size={14} className="text-red-300" /> პრობლემური სინქი: {failingCount}</li>
              <li className="flex items-center gap-2"><BarChart3 size={14} className="text-emerald-300" /> საშუალო დარწმუნებულობა: {averageConfidence}%</li>
              <li className="flex items-center gap-2"><Clock size={14} className="text-sky-300" /> ბოლო აქტივობა: {formatDateForDisplay(metrics.lastActivity)}</li>
              <li className="flex items-center gap-2"><History size={14} className="text-emerald-300" /> კონტროლის განახლება: {controls.lastUpdated ? formatDateForDisplay(controls.lastUpdated) : '—'}</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => onExpandedViewChange(true)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
          >
            <ListChecks size={16} /> სრული მენეჯერის გახსნა
          </button>
        </div>
      </div>
    </section>
  );
};

export default MemoryControlsPanel;

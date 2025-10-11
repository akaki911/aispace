import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Activity,
  Download,
  Filter,
  Pause,
  Play,
  RefreshCw,
  Search
} from 'lucide-react';
import type {
  AutoImproveTraceEvent,
  AutoImproveTraceRun,
  AutoImproveTraceLevel
} from '../../types/autoImprove';

interface AutoImproveTraceMonitorProps {
  className?: string;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'paused';

type TraceFilters = {
  search: string;
  level: AutoImproveTraceLevel | 'all';
  status: string | 'all';
  tool: string | 'all';
};

const EVENT_TYPE_STYLES: Record<string, string> = {
  PLAN: 'border border-blue-500/40 bg-blue-500/10 text-blue-200',
  THOUGHT: 'border border-purple-500/40 bg-purple-500/10 text-purple-200',
  TOOL_CALL: 'border border-amber-500/40 bg-amber-500/10 text-amber-200',
  OBSERVATION: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  FINAL: 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
};

const LEVEL_BADGE: Record<AutoImproveTraceLevel, string> = {
  info: 'text-blue-200',
  warn: 'text-amber-300',
  error: 'text-rose-300',
  debug: 'text-slate-300',
  success: 'text-emerald-300'
};

const formatTimestamp = (timestamp: string | null | undefined) => {
  if (!timestamp) {
    return '—';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString('ka-GE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const stringifyMetadata = (data: unknown) => {
  if (!data) {
    return '{}';
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return '{}';
  }
};

const clampRuns = (runs: AutoImproveTraceRun[]) => {
  return runs
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 50)
    .map((run) => ({
      ...run,
      events: (run.events || []).slice(0, 500)
    }));
};

const mergeRuns = (
  existingRuns: AutoImproveTraceRun[],
  incomingRuns: AutoImproveTraceRun[]
): AutoImproveTraceRun[] => {
  const map = new Map<string, AutoImproveTraceRun>();

  for (const run of existingRuns) {
    map.set(run.runId, {
      ...run,
      events: run.events ? run.events.slice(0, 500) : []
    });
  }

  for (const incoming of incomingRuns) {
    if (!incoming || !incoming.runId) {
      continue;
    }

    const current = map.get(incoming.runId);
    if (current) {
      map.set(incoming.runId, {
        ...current,
        ...incoming,
        events: incoming.events && incoming.events.length > 0
          ? incoming.events.slice(0, 500)
          : current.events
      });
    } else {
      map.set(incoming.runId, {
        ...incoming,
        events: incoming.events ? incoming.events.slice(0, 500) : []
      });
    }
  }

  return clampRuns(Array.from(map.values()));
};

const AutoImproveTraceMonitor: React.FC<AutoImproveTraceMonitorProps> = ({ className }) => {
  const [runs, setRuns] = useState<AutoImproveTraceRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [isPaused, setIsPaused] = useState(false);
  const [filters, setFilters] = useState<TraceFilters>({
    search: '',
    level: 'all',
    status: 'all',
    tool: 'all'
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef(1000);
  const pausedRef = useRef(false);
  const mountedRef = useRef(false);

  const applySnapshot = useCallback((snapshotRuns: AutoImproveTraceRun[]) => {
    if (!Array.isArray(snapshotRuns) || snapshotRuns.length === 0) {
      return;
    }
    setRuns((prev) => mergeRuns(prev, snapshotRuns));
  }, []);

  const handleSnapshot = useCallback((event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data);
      if (Array.isArray(payload?.runs)) {
        applySnapshot(payload.runs as AutoImproveTraceRun[]);
      }
    } catch (error) {
      console.warn('⚠️ [TraceMonitor] Failed to parse snapshot payload', error);
    }
  }, [applySnapshot]);

  const handleRunUpdate = useCallback((event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data);
      if (!payload?.run?.runId) {
        return;
      }
      applySnapshot([payload.run as AutoImproveTraceRun]);
    } catch (error) {
      console.warn('⚠️ [TraceMonitor] Failed to parse run update', error);
    }
  }, [applySnapshot]);

  const handleEventUpdate = useCallback((event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data);
      const runId = payload?.runId;
      const eventPayload = payload?.event as AutoImproveTraceEvent | undefined;
      if (!runId || !eventPayload) {
        return;
      }

      setRuns((prevRuns) => {
        const runsMap = new Map<string, AutoImproveTraceRun>();
        for (const run of prevRuns) {
          runsMap.set(run.runId, {
            ...run,
            events: run.events ? run.events.slice(0, 500) : []
          });
        }

        const existing = runsMap.get(runId);
        if (existing) {
          runsMap.set(runId, {
            ...existing,
            updatedAt: eventPayload.timestamp || existing.updatedAt,
            events: [eventPayload, ...(existing.events || [])].slice(0, 500)
          });
        } else {
          runsMap.set(runId, {
            runId,
            status: 'running',
            goal: null,
            actor: null,
            source: 'unknown',
            metadata: {},
            startedAt: eventPayload.timestamp,
            updatedAt: eventPayload.timestamp,
            completedAt: null,
            summary: null,
            metrics: undefined,
            events: [eventPayload]
          });
        }

        return clampRuns(Array.from(runsMap.values()));
      });

      setSelectedRunId((prev) => prev ?? runId);
      setSelectedEventId((prev) => prev ?? eventPayload.id);
    } catch (error) {
      console.warn('⚠️ [TraceMonitor] Failed to parse event update', error);
    }
  }, []);

  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (pausedRef.current) {
      return;
    }

    cleanupEventSource();
    setConnectionState('connecting');

    const source = new EventSource('/api/ai/trace/stream');
    eventSourceRef.current = source;

    source.addEventListener('trace_snapshot', handleSnapshot);
    source.addEventListener('trace_event', handleEventUpdate);
    source.addEventListener('trace_run', handleRunUpdate);

    source.onopen = () => {
      retryDelayRef.current = 1000;
      if (!pausedRef.current) {
        setConnectionState('connected');
      }
    };

    source.onerror = () => {
      cleanupEventSource();
      if (pausedRef.current) {
        setConnectionState('paused');
        return;
      }
      setConnectionState('disconnected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      const delay = Math.min(retryDelayRef.current, 5000);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (pausedRef.current) {
          return;
        }
        connect();
      }, delay);
      retryDelayRef.current = Math.min(retryDelayRef.current + 1000, 5000);
    };
  }, [cleanupEventSource, handleEventUpdate, handleRunUpdate, handleSnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    pausedRef.current = false;

    const fetchInitialRuns = async () => {
      try {
        const response = await fetch('/api/ai/trace/runs?limit=50', {
          credentials: 'include'
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (mountedRef.current && Array.isArray(payload?.runs)) {
          applySnapshot(payload.runs as AutoImproveTraceRun[]);
        }
      } catch (error) {
        console.warn('⚠️ [TraceMonitor] Failed to load initial runs', error);
      }
    };

    fetchInitialRuns();
    connect();

    return () => {
      mountedRef.current = false;
      pausedRef.current = true;
      cleanupEventSource();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [applySnapshot, cleanupEventSource, connect]);

  useEffect(() => {
    pausedRef.current = isPaused;
    if (isPaused) {
      setConnectionState('paused');
      cleanupEventSource();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    } else {
      retryDelayRef.current = 1000;
      connect();
    }
  }, [cleanupEventSource, connect, isPaused]);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].runId);
    }
  }, [runs, selectedRunId]);

  const currentRun = useMemo(() => {
    if (!runs.length) {
      return null;
    }
    const match = runs.find((run) => run.runId === selectedRunId);
    return match || runs[0];
  }, [runs, selectedRunId]);

  const availableTools = useMemo(() => {
    if (!currentRun) {
      return [];
    }
    const tools = new Set<string>();
    for (const event of currentRun.events || []) {
      if (event.tool) {
        tools.add(event.tool);
      }
    }
    return Array.from(tools).sort();
  }, [currentRun]);

  const availableStatuses = useMemo(() => {
    if (!currentRun) {
      return [];
    }
    const statuses = new Set<string>();
    for (const event of currentRun.events || []) {
      if (event.status) {
        statuses.add(event.status);
      }
    }
    return Array.from(statuses).sort();
  }, [currentRun]);

  const filteredEvents = useMemo(() => {
    if (!currentRun) {
      return [] as AutoImproveTraceEvent[];
    }
    const searchTerm = filters.search.trim().toLowerCase();
    return (currentRun.events || []).filter((event) => {
      if (filters.level !== 'all' && event.level !== filters.level) {
        return false;
      }
      if (filters.status !== 'all' && event.status !== filters.status) {
        return false;
      }
      if (filters.tool !== 'all' && event.tool !== filters.tool) {
        return false;
      }
      if (searchTerm) {
        const message = event.message?.toLowerCase() ?? '';
        const metadataText = stringifyMetadata(event.metadata).toLowerCase();
        if (!message.includes(searchTerm) && !metadataText.includes(searchTerm)) {
          return false;
        }
      }
      return true;
    });
  }, [currentRun, filters.level, filters.search, filters.status, filters.tool]);

  useEffect(() => {
    if (!currentRun) {
      setSelectedEventId(null);
      return;
    }
    const hasSelected = filteredEvents.some((event) => event.id === selectedEventId);
    if (!hasSelected) {
      const fallback = filteredEvents[0];
      setSelectedEventId(fallback ? fallback.id : null);
    }
  }, [currentRun, filteredEvents, selectedEventId]);

  const selectedEvent = useMemo(() => {
    return filteredEvents.find((event) => event.id === selectedEventId) || filteredEvents[0] || null;
  }, [filteredEvents, selectedEventId]);

  const handleFilterChange = useCallback(<K extends keyof TraceFilters>(key: K, value: TraceFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleExport = useCallback(() => {
    if (!currentRun) {
      return;
    }
    const blob = new Blob([JSON.stringify(currentRun, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auto-improve-trace-${currentRun.runId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentRun]);

  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const connectionBadge = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return { text: '🟢 live', tone: 'text-emerald-300' };
      case 'paused':
        return { text: '⚪ paused/offline', tone: 'text-slate-200' };
      case 'disconnected':
        return { text: '⚪ paused/offline', tone: 'text-slate-200' };
      default:
        return { text: '🔄 connecting…', tone: 'text-blue-200' };
    }
  }, [connectionState]);

  return (
    <div className={`rounded-2xl border border-blue-500/30 bg-slate-900/80 shadow-xl ${className ?? ''}`}>
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-blue-500/20 bg-slate-900/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-blue-200/70">
            <Activity className="h-4 w-4" />
            ციფრული მონიტორი
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className={`font-semibold ${connectionBadge.tone}`}>{connectionBadge.text}</span>
            {currentRun ? (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] text-blue-200/70">
                {currentRun.runId}
              </span>
            ) : null}
            {currentRun?.status ? (
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-200/70">
                {currentRun.status}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePauseToggle}
            className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!currentRun}
            className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="border-b border-blue-500/20 bg-slate-900/70 px-4 py-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-blue-200/70">
            Run
            <select
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-400 focus:outline-none"
              value={currentRun?.runId ?? ''}
              onChange={(event) => setSelectedRunId(event.target.value || null)}
            >
              {runs.map((run) => (
                <option key={run.runId} value={run.runId}>
                  {`${formatTimestamp(run.startedAt)} • ${run.runId}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-blue-200/70">
            <span className="flex items-center gap-1"><Search className="h-3 w-3" />ძებნა</span>
            <input
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-400 focus:outline-none"
              placeholder="შეიყვანეთ საკვანძო სიტყვა"
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-blue-200/70">
            <span className="flex items-center gap-1"><Filter className="h-3 w-3" />დონე</span>
            <select
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-400 focus:outline-none"
              value={filters.level}
              onChange={(event) => handleFilterChange('level', event.target.value as TraceFilters['level'])}
            >
              <option value="all">ყველა</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="debug">debug</option>
              <option value="success">success</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-blue-200/70">
            <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />სტატუსი</span>
            <select
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-400 focus:outline-none"
              value={filters.status}
              onChange={(event) => handleFilterChange('status', event.target.value as TraceFilters['status'])}
            >
              <option value="all">ყველა</option>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-blue-200/70">
            ინსტრუმენტი
            <select
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-400 focus:outline-none"
              value={filters.tool}
              onChange={(event) => handleFilterChange('tool', event.target.value as TraceFilters['tool'])}
            >
              <option value="all">ყველა</option>
              {availableTools.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-blue-200/70">
            <span>Timeline</span>
            <span className="text-[10px] text-slate-400">{filteredEvents.length} events</span>
          </div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {filteredEvents.map((event) => {
              const typeStyle = EVENT_TYPE_STYLES[event.type] || 'border border-slate-700 bg-slate-800/60 text-slate-200';
              const isActive = selectedEvent?.id === event.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    isActive ? 'border border-blue-400/50 bg-blue-500/10' : 'border border-slate-700/60 bg-slate-800/50 hover:border-blue-400/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.24em] ${typeStyle}`}>
                      {event.type}
                    </span>
                    <span className={`text-[11px] font-medium ${LEVEL_BADGE[event.level] || 'text-slate-300'}`}>
                      {event.level}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    {event.message || '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span>{formatTimestamp(event.timestamp)}</span>
                    {event.tool ? <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] text-slate-200">{event.tool}</span> : null}
                    {event.status ? <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-200">{event.status}</span> : null}
                  </div>
                </button>
              );
            })}
            {!filteredEvents.length ? (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
                არცერთი მოვლენა არ ემთხვევა ფილტრებს
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-blue-200/70">
            <span>დეტალები</span>
            {currentRun?.goal ? <span className="text-[10px] text-slate-400">{currentRun.goal}</span> : null}
          </div>
          {selectedEvent ? (
            <>
              <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Event ID</p>
                  <p className="font-mono text-[11px] text-slate-200">{selectedEvent.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">დრო</p>
                  <p className="text-[11px] text-slate-200">{formatTimestamp(selectedEvent.timestamp)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">დონე</p>
                  <p className={`text-[11px] font-semibold ${LEVEL_BADGE[selectedEvent.level] || 'text-slate-200'}`}>{selectedEvent.level}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">სტატუსი</p>
                  <p className="text-[11px] text-slate-200">{selectedEvent.status ?? '—'}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/80 p-3 text-xs text-slate-200">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Metadata</p>
                <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-200">
{stringifyMetadata(selectedEvent.metadata)}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              მოვლენა არ არის არჩეული
            </div>
          )}
          {currentRun ? (
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-3 text-xs text-slate-300">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Run metadata</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-slate-400">Actor</p>
                  <p className="text-[11px] text-slate-200">{currentRun.actor ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Source</p>
                  <p className="text-[11px] text-slate-200">{currentRun.source ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Started</p>
                  <p className="text-[11px] text-slate-200">{formatTimestamp(currentRun.startedAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Updated</p>
                  <p className="text-[11px] text-slate-200">{formatTimestamp(currentRun.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Completed</p>
                  <p className="text-[11px] text-slate-200">{formatTimestamp(currentRun.completedAt ?? undefined)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Summary</p>
                  <p className="text-[11px] text-slate-200">{currentRun.summary ?? '—'}</p>
                </div>
              </div>
              {currentRun.metadata ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-blue-200/80">გაფართოებული მეტამონაცემები</summary>
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-200">
{stringifyMetadata(currentRun.metadata)}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AutoImproveTraceMonitor;

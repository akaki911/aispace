import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Clock,
  Cpu,
  Gauge,
  RefreshCw,
  Server,
  SignalHigh,
  SignalLow,
  SignalMedium,
  TimerReset,
} from 'lucide-react';

interface DiagnosticsResponse {
  success: boolean;
  fetchedAt: string;
  aiStatus: any;
  aiHealth: any;
  aiMetrics: any;
  backendPerformance: any;
  streamStats: any;
  connectionStats: any;
  rateLimit: any;
  recentErrors: Array<{ timestamp: number; source: string; level: string; message: string }>;
  version: { gitSha?: string | null; gitShaShort?: string | null; buildTime?: string | null; timestamp?: string };
  warnings?: string[];
}

const statusTone = (status?: string) => {
  if (!status) return 'neutral';
  const normalized = status.toLowerCase();
  if (['ok', 'ready', 'healthy', 'normal'].includes(normalized)) return 'ok';
  if (['watch', 'degraded', 'warning'].includes(normalized)) return 'warn';
  if (['limited', 'error', 'offline', 'timeout'].includes(normalized)) return 'error';
  return 'neutral';
};

const toneClasses: Record<string, string> = {
  ok: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
  warn: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  error: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
  neutral: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
};

const formatMs = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'N/A';
  return `${Math.round(value)} ms`;
};

const formatTimestamp = (value?: number | string) => {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return date.toLocaleString();
};

const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  tone?: 'ok' | 'warn' | 'error' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
}> = ({ title, value, subtitle, tone = 'neutral', icon: Icon }) => (
  <div className={`rounded-2xl border p-4 transition-colors ${toneClasses[tone]}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        {subtitle && <p className="text-xs mt-1 text-slate-500">{subtitle}</p>}
      </div>
      <Icon className="h-8 w-8 opacity-70" />
    </div>
  </div>
);

const RateLimitIcon: React.FC<{ status?: string; className?: string }> = ({ status, className }) => {
  const tone = statusTone(status);
  const iconClass = className ?? 'h-4 w-4';
  switch (tone) {
    case 'ok':
      return <SignalHigh className={iconClass} />;
    case 'warn':
      return <SignalMedium className={iconClass} />;
    case 'error':
      return <SignalLow className={iconClass} />;
    default:
      return <Gauge className={iconClass} />;
  }
};

const AIDiagnosticsCenter: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/ai/diagnostics', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as DiagnosticsResponse;
      setDiagnostics(payload);
    } catch (err) {
      console.error('Failed to load diagnostics', err);
      setError('დიაგნოსტიკის ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const groqStatus = diagnostics?.aiStatus?.groq;
  const rateLimitStatus = diagnostics?.rateLimit;
  const streamStats = diagnostics?.streamStats;
  const backendPerformance = diagnostics?.backendPerformance;
  const warnings = diagnostics?.warnings ?? [];

  const statusCards = useMemo(() => {
    return [
      {
        title: 'Groq latency',
        value: formatMs(groqStatus?.latency ?? diagnostics?.aiHealth?.latency),
        subtitle: groqStatus?.status ? groqStatus.status.toUpperCase() : 'Latency snapshot',
        tone: statusTone(groqStatus?.status),
        icon: Activity,
      },
      {
        title: 'Availability',
        value: groqStatus?.available ? 'Online' : 'Fallback',
        subtitle: groqStatus?.fallbackMode ? 'Fallback mode active' : 'Primary model active',
        tone: statusTone(groqStatus?.available ? 'ok' : groqStatus?.status || 'error'),
        icon: Server,
      },
      {
        title: 'Rate limit',
        value: rateLimitStatus?.status ? rateLimitStatus.status.toUpperCase() : 'Unknown',
        subtitle: rateLimitStatus?.details
          ? `${rateLimitStatus.details.activeConnections}/${rateLimitStatus.details.poolCapacity} connections`
          : undefined,
        tone: statusTone(rateLimitStatus?.status),
        icon: ({ className }: { className?: string }) => (
          <RateLimitIcon status={rateLimitStatus?.status} className={className} />
        ),
      },
      {
        title: 'Active streams',
        value: streamStats?.activeStreams?.length ?? 0,
        subtitle: `Completed: ${streamStats?.completed ?? 0} · Errors: ${streamStats?.errors ?? 0}`,
        tone: streamStats?.activeStreams?.length ? 'ok' : 'neutral',
        icon: Gauge,
      },
    ];
  }, [groqStatus, diagnostics?.aiHealth, rateLimitStatus, streamStats]);

  const averageChunkCount = streamStats?.averages?.chunkCount ?? 0;
  const averageTtf = streamStats?.averages?.timeToFirstChunk ?? 0;
  const averageDuration = streamStats?.averages?.duration ?? 0;

  const versionInfo = diagnostics?.version;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-500" />
            AI Health & Diagnostics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ბოლო განახლება · {diagnostics?.fetchedAt ? formatTimestamp(diagnostics.fetchedAt) : '---'}
          </p>
        </div>
        <button
          onClick={fetchDiagnostics}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-600"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          განახლება
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-600 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <ul className="space-y-1">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            tone={card.tone as any}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/50 bg-white/70 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-sky-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Streaming analytics</h3>
            </div>
            <span className="text-xs text-gray-500">{streamStats?.timestamp ? formatTimestamp(streamStats.timestamp) : ''}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white">{averageChunkCount.toFixed(1)}</p>
              <p className="text-xs text-gray-500">საშ. chunk-ები</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white">{formatMs(averageTtf)}</p>
              <p className="text-xs text-gray-500">პირველ chunk-მდე</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white">{formatMs(averageDuration)}</p>
              <p className="text-xs text-gray-500">საშ. სესიის ხანგრძლივობა</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(streamStats?.recentStreams ?? []).slice(0, 5).map((stream: any) => (
              <div key={stream.id} className="flex items-center justify-between rounded-lg bg-slate-100/60 px-3 py-2 text-sm dark:bg-slate-800/60">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{stream.userId}</p>
                  <p className="text-xs text-gray-500">chunk-ები: {stream.chunkCount} · {stream.status}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{formatMs(stream.timeToFirstChunk)}</div>
                  <div>{stream.completedAt ? formatTimestamp(stream.completedAt) : ''}</div>
                </div>
              </div>
            ))}
            {(!streamStats?.recentStreams || streamStats.recentStreams.length === 0) && (
              <p className="rounded-lg bg-slate-50/60 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                ბოლო დროის სტრიმინგის მონაცემები არ არის.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/50 bg-white/70 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Backend performance</h3>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatMs(backendPerformance?.averageResponseTime)}
              </p>
              <p className="text-xs text-gray-500">საშუალო latency</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatMs(backendPerformance?.latencyPercentiles?.p95)}
              </p>
              <p className="text-xs text-gray-500">P95 latency</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {(backendPerformance?.errorRate ?? 0).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">შეცდომების მაჩვენებელი</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-slate-800/60">
              <Clock className="h-4 w-4" />
              <span>Uptime: {(backendPerformance?.uptime / 1000 / 60).toFixed(1)} წუთი</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-slate-800/60">
              <BarChart2 className="h-4 w-4" />
              <span>მოთხოვნები: {backendPerformance?.requests ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/50 bg-white/70 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <TimerReset className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Version & Deployment</h3>
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center justify-between rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-slate-800/60">
              <span>Git SHA</span>
              <span className="font-mono text-xs">{versionInfo?.gitShaShort ?? '---'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-slate-800/60">
              <span>Build time</span>
              <span>{versionInfo?.buildTime ? formatTimestamp(versionInfo.buildTime) : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-slate-800/60">
              <span>Reported</span>
              <span>{versionInfo?.timestamp ? formatTimestamp(versionInfo.timestamp) : '---'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/50 bg-white/70 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ბოლო შეცდომები</h3>
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {(diagnostics?.recentErrors ?? []).slice(0, 6).map((entry) => (
              <div key={`${entry.timestamp}-${entry.message}`} className="rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-slate-800/60">
                <p className="font-medium text-gray-900 dark:text-white">{entry.message}</p>
                <p className="text-xs text-gray-500">
                  {entry.source} · {formatTimestamp(entry.timestamp)}
                </p>
              </div>
            ))}
            {(!diagnostics?.recentErrors || diagnostics.recentErrors.length === 0) && (
              <p className="rounded-lg bg-slate-100/60 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                ბოლო შეცდომები არ არის დაფიქსირებული.
              </p>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-slate-200/60 bg-white/70 p-6 text-gray-500 dark:border-slate-700/60 dark:bg-slate-900/50">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          დიაგნოსტიკის განახლება მიმდინარეობს...
        </div>
      )}
    </div>
  );
};

export default AIDiagnosticsCenter;

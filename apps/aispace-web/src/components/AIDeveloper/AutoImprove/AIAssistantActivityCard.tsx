import React, { useEffect, useId, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

export interface AIAssistantActivitySample {
  timestamp: number;
  queue: number | null;
  latency: number | null;
  success: number | null;
}

interface AIAssistantActivityCardProps {
  queueLength: number | null;
  latencyMs: number | null;
  successRate: number | null;
  mode: string | null;
  status?: string | null;
  isOnline: boolean;
  isLoading?: boolean;
  lastUpdated?: string | number | null;
  activeThought?: string | null;
  history: AIAssistantActivitySample[];
  className?: string;
}

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

const formatNumber = (value: number | null | undefined, options?: Intl.NumberFormatOptions) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat(undefined, options).format(value);
};

const normalizeHistory = (history: AIAssistantActivitySample[], fallback: number) => {
  if (!history.length) {
    return [];
  }

  let lastValue = fallback;
  return history.map((sample) => {
    const value =
      typeof sample.success === 'number'
        ? sample.success
        : typeof sample.queue === 'number'
          ? sample.queue
          : typeof sample.latency === 'number'
            ? sample.latency
            : lastValue;

    if (typeof value === 'number' && Number.isFinite(value)) {
      lastValue = value;
      return value;
    }

    return lastValue;
  });
};

const formatTimestamp = (input?: string | number | null, t?: (key: string, defaultValue?: string) => string) => {
  if (!input) {
    return t ? t('aiImprove.brain.card.updatedNever', 'არასდროს') : '—';
  }

  const date = typeof input === 'number' ? new Date(input) : new Date(String(input));
  if (Number.isNaN(date.getTime())) {
    return t ? t('aiImprove.brain.card.updatedUnknown', 'უცნობია') : '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const brainStatusBackgrounds = [
  'from-purple-500/30 via-indigo-500/20 to-blue-500/20',
  'from-indigo-500/30 via-blue-500/20 to-purple-500/20',
];

const sparklineDimensions = { width: 160, height: 56 };

const AIAssistantActivityCard: React.FC<AIAssistantActivityCardProps> = ({
  queueLength,
  latencyMs,
  successRate,
  mode,
  status,
  isOnline,
  isLoading = false,
  lastUpdated,
  activeThought,
  history,
  className,
}) => {
  const { t } = useTranslation();
  const gradientId = useId();
  const [statusIndex, setStatusIndex] = useState(0);

  const modeLabel = useMemo(() => {
    switch (mode) {
      case 'auto':
        return t('aiImprove.brain.card.mode.auto', 'Running');
      case 'manual':
        return t('aiImprove.brain.card.mode.manual', 'Manual');
      case 'paused':
        return t('aiImprove.brain.card.mode.paused', 'Paused');
      default:
        return mode ?? t('aiImprove.brain.card.mode.unknown', 'Unknown');
    }
  }, [mode, t]);
  const defaultStatusRotation = useMemo(
    () => [
      t('aiImprove.brain.card.statusRotation.analyzing', 'Analyzing requests'),
      t('aiImprove.brain.card.statusRotation.drafting', 'Building proposals'),
      t('aiImprove.brain.card.statusRotation.validating', 'Validating output'),
      t('aiImprove.brain.card.statusRotation.applying', 'Applying changes'),
    ],
    [t],
  );

  const statusMessages = useMemo(() => {
    const uniqueMessages = new Set<string>();
    const pushMessage = (value?: string | null) => {
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (trimmed.length > 0) {
        uniqueMessages.add(trimmed);
      }
    };

    pushMessage(activeThought);

    if (typeof queueLength === 'number') {
      pushMessage(
        t('aiImprove.brain.card.status.queue', 'Analyzing {{count}} queued tasks', {
          count: queueLength,
        }),
      );
    }

    if (typeof latencyMs === 'number') {
      pushMessage(
        t('aiImprove.brain.card.status.latency', 'Validating responses (~{{ms}}ms)', {
          ms: Math.round(latencyMs),
        }),
      );
    }

    if (typeof successRate === 'number') {
      pushMessage(
        t('aiImprove.brain.card.status.success', 'Stability at {{rate}}% success', {
          rate: Math.round(successRate),
        }),
      );
    }

    pushMessage(status);

    defaultStatusRotation.forEach(pushMessage);

    if (!uniqueMessages.size) {
      pushMessage(t('aiImprove.brain.card.status.idle', 'Standing by for new activity...'));
    }

    return Array.from(uniqueMessages);
  }, [activeThought, defaultStatusRotation, latencyMs, queueLength, status, successRate, t]);

  useEffect(() => {
    setStatusIndex((index) => (index >= statusMessages.length ? 0 : index));
    if (statusMessages.length <= 1) {
      return;
    }

    const rotation = window.setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusMessages.length);
    }, 4000);

    return () => window.clearInterval(rotation);
  }, [statusMessages]);

  const normalizedHistory = useMemo(() => {
    const fallback =
      (typeof successRate === 'number' && Number.isFinite(successRate)
        ? successRate
        : typeof queueLength === 'number' && Number.isFinite(queueLength)
          ? queueLength
          : typeof latencyMs === 'number' && Number.isFinite(latencyMs)
            ? latencyMs
            : 0);

    return normalizeHistory(history, fallback);
  }, [history, latencyMs, queueLength, successRate]);

  const sparkline = useMemo(() => {
    if (!normalizedHistory.length) {
      return { path: '', area: '', min: 0, max: 0 };
    }

    const width = sparklineDimensions.width;
    const height = sparklineDimensions.height;
    const min = Math.min(...normalizedHistory);
    const max = Math.max(...normalizedHistory);
    const span = max - min || 1;

    const points = normalizedHistory
      .map((value, index) => {
        const x = normalizedHistory.length > 1 ? (index / (normalizedHistory.length - 1)) * width : width;
        const normalized = (value - min) / span;
        const y = height - normalized * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    const areaPath = `${points} L ${width} ${height} L 0 ${height} Z`;

    return {
      path: points,
      area: areaPath,
      min,
      max,
    };
  }, [normalizedHistory]);

  const progressItems = useMemo(
    () => [
      {
        id: 'queue',
        label: t('aiImprove.brain.card.progress.queue', 'Workload'),
        value: typeof queueLength === 'number' ? clamp((queueLength / 20) * 100, 8, 100) : 8,
      },
      {
        id: 'latency',
        label: t('aiImprove.brain.card.progress.latency', 'Latency health'),
        value:
          typeof latencyMs === 'number'
            ? clamp(100 - (clamp(latencyMs, 0, 800) / 800) * 100, 8, 100)
            : 50,
      },
      {
        id: 'success',
        label: t('aiImprove.brain.card.progress.success', 'Completion'),
        value: typeof successRate === 'number' ? clamp(successRate, 0, 100) : 42,
      },
    ],
    [latencyMs, queueLength, successRate, t],
  );

  const metrics = useMemo(
    () => [
      {
        id: 'queue',
        label: t('aiImprove.brain.card.metric.queue', 'Queue'),
        value:
          typeof queueLength === 'number'
            ? formatNumber(queueLength)
            : t('aiImprove.brain.card.metric.missing', '—'),
      },
      {
        id: 'latency',
        label: t('aiImprove.brain.card.metric.latency', 'Latency'),
        value:
          typeof latencyMs === 'number'
            ? `${formatNumber(latencyMs, { maximumFractionDigits: latencyMs >= 100 ? 0 : 1 })} ms`
            : t('aiImprove.brain.card.metric.missing', '—'),
      },
      {
        id: 'success',
        label: t('aiImprove.brain.card.metric.success', 'Success'),
        value:
          typeof successRate === 'number'
            ? `${formatNumber(successRate, { maximumFractionDigits: 0 })}%`
            : t('aiImprove.brain.card.metric.missing', '—'),
      },
      {
        id: 'mode',
        label: t('aiImprove.brain.card.metric.mode', 'Mode'),
        value: modeLabel,
      },
    ],
    [latencyMs, modeLabel, queueLength, successRate, t],
  );

  const statusMessage = statusMessages[statusIndex] ?? statusMessages[0];
  const lastUpdatedLabel = formatTimestamp(lastUpdated, (key, def) => t(key, def ?? '—'));
  const baseClasses = classNames(
    'relative w-full overflow-hidden rounded-3xl border border-purple-500/30 bg-slate-950/80 p-5 shadow-lg',
    'max-w-[21rem]',
    className,
  );

  if (isLoading) {
    return (
      <section data-testid="brain-card" className={baseClasses} aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded bg-slate-800/80" />
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-slate-800/70" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-slate-800/70" />
              <div className="h-3 w-2/3 rounded bg-slate-800/70" />
            </div>
          </div>
          <div className="h-2 w-full rounded bg-slate-800/70" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-10 rounded-lg bg-slate-800/70" />
            <div className="h-10 rounded-lg bg-slate-800/70" />
            <div className="h-10 rounded-lg bg-slate-800/70" />
            <div className="h-10 rounded-lg bg-slate-800/70" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="brain-card" className={baseClasses}>
      <div className="absolute inset-0 opacity-70 blur-3xl">
        <div
          className={classNames(
            'absolute -top-10 left-6 h-32 w-32 animate-pulse rounded-full bg-gradient-to-br from-purple-500/30 via-indigo-500/30 to-blue-500/30',
          )}
        />
        <div
          className={classNames(
            'absolute -bottom-12 right-4 h-36 w-36 animate-[pulse_4s_ease-in-out_infinite] rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-indigo-500/20',
          )}
        />
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-purple-200/70">
            {t('aiImprove.brain.card.title', 'AI Assistant')}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {t('aiImprove.brain.card.subtitle', 'Live brain activity')}
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-purple-500/40 bg-slate-900/80 px-3 py-1 text-xs font-medium text-purple-100">
          <span className={classNames('h-2.5 w-2.5 rounded-full', isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400')} />
          {isOnline ? t('aiImprove.brain.card.status.online', 'Online') : t('aiImprove.brain.card.status.offline', 'Offline')}
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-start gap-4">
        <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center">
          <div
            className={classNames(
              'absolute inset-0 rounded-full bg-gradient-to-br shadow-inner shadow-purple-500/30',
              brainStatusBackgrounds[0],
            )}
          />
          <svg
            className="relative h-16 w-16 text-purple-100 drop-shadow-[0_0_10px_rgba(139,92,246,0.45)]"
            viewBox="0 0 120 120"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${gradientId}-glow`} x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(129,140,248,0.95)" />
                <stop offset="50%" stopColor="rgba(59,130,246,0.85)" />
                <stop offset="100%" stopColor="rgba(165,180,252,0.7)" />
              </linearGradient>
            </defs>
            <path
              d="M40 20c-12 4-20 16-20 28 0 6 2 12 6 18-4 5-6 10-6 16 0 12 10 22 22 22 6 0 12-2 16-6 4 4 10 6 16 6 12 0 22-10 22-22 0-6-2-11-6-16 4-6 6-12 6-18 0-12-8-24-20-28-4-8-12-12-18-12s-14 4-18 12z"
              fill={`url(#${gradientId}-glow)`}
            >
              <animate
                attributeName="d"
                dur="6s"
                repeatCount="indefinite"
                values="
                  M40 20c-12 4-20 16-20 28 0 6 2 12 6 18-4 5-6 10-6 16 0 12 10 22 22 22 6 0 12-2 16-6 4 4 10 6 16 6 12 0 22-10 22-22 0-6-2-11-6-16 4-6 6-12 6-18 0-12-8-24-20-28-4-8-12-12-18-12s-14 4-18 12z;
                  M42 18c-13 3-22 16-22 30 0 6 2 12 6 18-4 4-6 9-6 15 0 13 11 24 24 24 6 0 12-2 17-6 4 4 11 6 17 6 13 0 24-11 24-24 0-6-2-11-6-15 4-6 6-12 6-18 0-14-9-27-22-30-4-9-13-14-19-14s-15 5-19 14z;
                  M40 20c-12 4-20 16-20 28 0 6 2 12 6 18-4 5-6 10-6 16 0 12 10 22 22 22 6 0 12-2 16-6 4 4 10 6 16 6 12 0 22-10 22-22 0-6-2-11-6-16 4-6 6-12 6-18 0-12-8-24-20-28-4-8-12-12-18-12s-14 4-18 12z
                "
              />
            </path>
            <circle
              cx="60"
              cy="60"
              r="26"
              fill="none"
              stroke={`url(#${gradientId}-glow)`}
              strokeWidth="4"
              strokeDasharray="12 8"
            >
              <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 60 60" to="360 60 60" dur="12s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <p className="flex-1 text-sm leading-relaxed text-slate-200/90">
          {statusMessage}
        </p>
      </div>

      <div className="relative z-10 mt-5 space-y-3">
        {progressItems.map((item) => (
          <div key={item.id}>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-slate-400">
              <span>{item.label}</span>
              <span>{Math.round(item.value)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500"
                style={{ width: `${clamp(item.value, 0, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-5 rounded-2xl border border-purple-500/20 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>{t('aiImprove.brain.card.sparkline.title', 'Signal trend')}</span>
          <span>
            {t('aiImprove.brain.card.sparkline.range', '{{min}} → {{max}}', {
              min: Math.round(sparkline.min),
              max: Math.round(sparkline.max),
            })}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${sparklineDimensions.width} ${sparklineDimensions.height}`}
          role="img"
          aria-label={t('aiImprove.brain.card.sparkline.aria', 'Recent assistant output trend')}
          className="mt-2 h-16 w-full text-purple-400"
        >
          {sparkline.area && (
            <path d={sparkline.area} fill="url(#sparklineGradient)" fillOpacity={0.18} />
          )}
          {sparkline.path && <path d={sparkline.path} fill="none" stroke="url(#sparklineStroke)" strokeWidth={2} strokeLinecap="round" />}
          <defs>
            <linearGradient id="sparklineGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(129,140,248,0.6)" />
              <stop offset="100%" stopColor="rgba(129,140,248,0)" />
            </linearGradient>
            <linearGradient id="sparklineStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(129,140,248,0.7)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0.9)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 text-sm">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-2xl border border-slate-800/60 bg-slate-900/70 px-3 py-3 shadow-sm"
          >
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{metric.label}</p>
            <p className="mt-1 text-base font-semibold text-white">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          {t('aiImprove.brain.card.updated', 'Last update')} · {lastUpdatedLabel}
        </span>
        <span>{modeLabel}</span>
      </div>
    </section>
  );
};

export default AIAssistantActivityCard;

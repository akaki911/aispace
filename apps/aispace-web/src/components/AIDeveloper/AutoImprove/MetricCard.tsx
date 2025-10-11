import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import classNames from 'classnames';
import { ClockIcon, BoltIcon, PauseCircleIcon } from '@heroicons/react/24/outline';
import type { AutoImproveMetric } from './types';

interface MetricCardProps {
  id: string;
  title: string;
  primary: number | string;
  trend?: number[];
  progress?: number;
  cta?: { label: string; onClick: () => void };
  'data-testid'?: string;
  metric: AutoImproveMetric;
  isExpanded: boolean;
  onToggle: (metricId: string) => void;
  isLoading?: boolean;
}

const statusTone: Record<AutoImproveMetric['status'], string> = {
  ok: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20',
  error: 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20',
  paused: 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/20',
};

const formatNumber = (value: number | null | undefined, suffix = '') => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A';
  }

  const precision = suffix === '%' ? 0 : value >= 1000 ? 0 : 1;
  return `${value.toFixed(precision)}${suffix}`;
};

const formatPrimaryValue = (value: number | string | null | undefined, unit?: string | null) => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'number') {
    const formatted = value >= 1000 ? Math.round(value) : Number(value.toFixed(1));
    return `${formatted}${unit ? unit : ''}`;
  }

  return unit ? `${value}${unit}` : value;
};

const formatTimestamp = (input?: string | number | null) => {
  if (!input) {
    return 'N/A';
  }

  const date = typeof input === 'number' ? new Date(input) : new Date(String(input));
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const MetricCardComponent: React.FC<MetricCardProps> = ({
  metric,
  isExpanded,
  onToggle,
  isLoading,
  id,
  title,
  primary,
  trend,
  progress,
  cta,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();
  const resolvedId = metric.id ?? id;
  const resolvedTitle = title ?? metric.title;
  const resolvedPrimary = primary;
  const resolvedDataTestId = dataTestId ?? metric.dataTestId ?? 'original-metric';
  const trendInfo = useMemo(() => {
    if (metric.trend) {
      return metric.trend;
    }
    if (trend && trend.length >= 2) {
      const delta = trend[trend.length - 1] - trend[0];
      const direction: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      return {
        direction,
        value: delta.toFixed(1),
      };
    }
    return metric.trend ?? null;
  }, [metric.trend, trend]);
  const progressInfo = useMemo(() => {
    if (metric.progress) {
      return metric.progress;
    }
    if (typeof progress === 'number') {
      return {
        current: progress,
        target: 100,
        tone: progress >= 85 ? 'ok' : progress >= 60 ? 'warning' : 'error',
        label: t('aiImprove.metric.progress', 'პროგრესი'),
      };
    }
    return null;
  }, [metric.progress, progress, t]);
  const resolvedCta = metric.cta ?? (cta ? { label: cta.label, onClick: cta.onClick, loading: false, disabled: false } : null);
  const logsId = `metric-logs-${resolvedId}`;
  const detailItems = useMemo(() => {
    const items: Array<{
      id: string;
      icon: React.ReactNode;
      label: string;
      value: string;
    }> = [];

    if (metric.latencyMs !== null && metric.latencyMs !== undefined) {
      items.push({
        id: 'latency',
        icon: <ClockIcon className="h-4 w-4 text-violet-300" aria-hidden="true" />,
        label: t('aiImprove.metric.latency', 'ლატენცია'),
        value: formatNumber(metric.latencyMs, 'ms'),
      });
    }

    if (metric.successRate !== null && metric.successRate !== undefined) {
      items.push({
        id: 'success',
        icon: <BoltIcon className="h-4 w-4 text-violet-300" aria-hidden="true" />,
        label: t('aiImprove.metric.successRate', 'წარმატება'),
        value: formatNumber(metric.successRate, '%'),
      });
    }

    if (metric.model) {
      items.push({
        id: 'model',
        icon: <PauseCircleIcon className="h-4 w-4 text-violet-300" aria-hidden="true" />,
        label: t('aiImprove.metric.model', 'მოდელი'),
        value: metric.model ?? 'N/A',
      });
    }

    if (metric.updatedAt) {
      items.push({
        id: 'updated',
        icon: <ClockIcon className="h-4 w-4 text-violet-300" aria-hidden="true" />,
        label: t('aiImprove.metric.updated', 'განახლდა'),
        value: formatTimestamp(metric.updatedAt),
      });
    }

    return items;
  }, [metric.latencyMs, metric.model, metric.successRate, metric.updatedAt, t]);

  if (isLoading) {
    return (
      <article
        className="flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-md shadow-violet-500/5 animate-pulse"
        data-testid="ai-imp:metric-card"
        aria-busy="true"
      >
        <div className="space-y-3">
          <div className="h-4 w-1/3 rounded bg-gray-700/70" />
          <div className="h-3 w-1/2 rounded bg-gray-700/60" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-gray-700/50" />
          <div className="h-10 rounded bg-gray-700/50" />
          <div className="h-10 rounded bg-gray-700/50" />
          <div className="h-10 rounded bg-gray-700/50" />
        </div>
      </article>
    );
  }

  const statusLabel = (() => {
    switch (metric.status) {
      case 'ok':
        return t('aiImprove.metric.status.ok', 'სტაბილური');
      case 'warning':
        return t('aiImprove.metric.status.warning', 'სიფრთხილით');
      case 'error':
        return t('aiImprove.metric.status.error', 'შეცდომა');
      case 'paused':
      default:
        return t('aiImprove.metric.status.paused', 'შეჩერებული');
    }
  })();

  return (
    <article
      className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm shadow-violet-500/10 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/20"
      data-testid="ai-imp:metric-card"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 md:text-base">{resolvedTitle}</h3>
          {metric.description && (
            <p className="mt-1 text-xs text-slate-400 md:text-sm">{metric.description}</p>
          )}
        </div>
        <span
          className={classNames(
            'rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
            statusTone[metric.status],
          )}
        >
          {statusLabel}
        </span>
      </header>

      {((resolvedPrimary !== undefined && resolvedPrimary !== null) || trendInfo) && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          {resolvedPrimary !== undefined && resolvedPrimary !== null && (
            <div className="flex flex-col" data-testid={resolvedDataTestId}>
              <span className="text-2xl font-semibold text-white">
                {formatPrimaryValue(resolvedPrimary, metric.unit)}
              </span>
              {progressInfo?.label && <span className="text-xs text-slate-400">{progressInfo.label}</span>}
            </div>
          )}
          {trendInfo && (
            <span
              className={classNames(
                'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                trendInfo.direction === 'up'
                  ? 'bg-emerald-500/10 text-emerald-200'
                  : trendInfo.direction === 'down'
                    ? 'bg-rose-500/10 text-rose-200'
                    : 'bg-slate-700/40 text-slate-200',
              )}
            >
              {trendInfo.direction === 'up'
                ? '↑'
                : trendInfo.direction === 'down'
                  ? '↓'
                  : '→'}{' '}
              {trendInfo.label ?? trendInfo.value}
            </span>
          )}
        </div>
      )}

      {progressInfo && progressInfo.current >= 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
            <span>{progressInfo.label ?? t('aiImprove.metric.progress', 'პროგრესი')}</span>
            <span>{Math.min(100, Math.round((progressInfo.current / (progressInfo.target ?? 100)) * 100))}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
            <div
              className={classNames(
                'h-full rounded-full',
                progressInfo.tone === 'warning'
                  ? 'bg-amber-400'
                  : progressInfo.tone === 'error'
                    ? 'bg-rose-500'
                    : 'bg-violet-400',
              )}
              style={{
                width: `${Math.min(100, Math.round((progressInfo.current / (progressInfo.target ?? 100)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {metric.meta && metric.meta.length > 0 && (
        <ul className="mt-3 space-y-2 text-xs text-slate-300">
          {metric.meta.map((entry, index) => (
            <li
              key={`${metric.id}-meta-${index}`}
              className={classNames(
                'flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/80 px-3 py-2',
                entry.tone === 'warning'
                  ? 'text-amber-200'
                  : entry.tone === 'error'
                    ? 'text-rose-200'
                    : 'text-slate-200',
              )}
            >
              <span className="text-[11px] uppercase tracking-wide text-slate-400">{entry.label}</span>
              <span className="text-sm font-semibold">{entry.value}</span>
            </li>
          ))}
        </ul>
      )}

      {detailItems.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-200 sm:grid-cols-2">
          {detailItems.map((item) => (
            <div
              key={`${metric.id}-${item.id}`}
              className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              {item.icon}
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</dt>
                <dd className="font-semibold text-slate-100">{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}

      {metric.footnote && (
        <p className="mt-3 text-[11px] text-slate-400">{metric.footnote}</p>
      )}

      {resolvedCta && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={resolvedCta.onClick}
            disabled={resolvedCta.disabled || resolvedCta.loading}
            className={classNames(
              'inline-flex items-center gap-2 rounded-md border border-violet-500/60 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60',
              resolvedCta.loading && 'animate-pulse',
            )}
          >
            {metric.status === 'paused' ? '▶' : '⏸'}
            {resolvedCta.label}
          </button>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => onToggle(resolvedId)}
          className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-500/60 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-expanded={isExpanded}
          aria-controls={logsId}
        >
          <span>{t('aiImprove.metric.logs', 'ლოგები')}</span>
          <span aria-hidden="true" className="text-xs text-slate-400">
            {isExpanded
              ? t('aiImprove.metric.hide', 'დახურვა')
              : t('aiImprove.metric.show', 'ჩვენება')}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && metric.logs && metric.logs.length > 0 && (
            <motion.div
              id={logsId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200"
                role="region"
                aria-label={t('aiImprove.metric.logsRegion', 'მეტრიკის დეტალური ლოგები')}
                tabIndex={0}
              >
                {metric.logs.map((log, index) => {
                  if (typeof log === 'string') {
                    return (
                      <p key={index} className="whitespace-pre-wrap text-slate-200">
                        {log}
                      </p>
                    );
                  }

                  const tone =
                    log.level === 'error'
                      ? 'text-rose-300'
                      : log.level === 'warning'
                        ? 'text-amber-200'
                        : 'text-emerald-200';

                  return (
                    <div key={index} className="rounded border border-slate-800/70 bg-slate-900/60 p-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        {formatTimestamp(log.timestamp)}
                      </p>
                      <p className={classNames('mt-1 whitespace-pre-wrap text-[13px] leading-snug', tone)}>{log.message}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
};

export const MetricCard = memo(MetricCardComponent);

export default MetricCard;

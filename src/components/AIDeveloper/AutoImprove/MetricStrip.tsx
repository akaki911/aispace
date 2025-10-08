import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { ArrowDownTrayIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import type { AutoImproveMetric, AutoImproveServiceState } from './types';

interface MetricStripProps {
  metrics: AutoImproveMetric[];
  lastUpdated?: string | number | null;
  serviceState: AutoImproveServiceState;
  onExport: () => void;
  onCopy: () => void;
  isExporting?: boolean;
  isCopying?: boolean;
  disabled?: boolean;
}

const formatNumber = (value: number | null | undefined, suffix = '') => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A';
  }

  return `${Math.round(value)}${suffix}`;
};

const formatTimestamp = (input?: string | number | null, fallbackLabel?: string) => {
  if (!input) {
    return fallbackLabel ?? '—';
  }

  const date = typeof input === 'number' ? new Date(input) : new Date(String(input));
  if (Number.isNaN(date.getTime())) {
    return fallbackLabel ?? '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const MetricStrip: React.FC<MetricStripProps> = ({
  metrics,
  lastUpdated,
  serviceState,
  onExport,
  onCopy,
  isExporting = false,
  isCopying = false,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const summary = useMemo(() => {
    if (!metrics.length) {
      return {
        count: 0,
        avgLatency: null as number | null,
        avgSuccessRate: null as number | null,
        paused: 0,
      };
    }

    const latencyValues = metrics
      .map((metric) => (typeof metric.latencyMs === 'number' ? metric.latencyMs : null))
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const successValues = metrics
      .map((metric) => (typeof metric.successRate === 'number' ? metric.successRate : null))
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const avgLatency = latencyValues.length
      ? latencyValues.reduce((acc, value) => acc + value, 0) / latencyValues.length
      : null;
    const avgSuccessRate = successValues.length
      ? successValues.reduce((acc, value) => acc + value, 0) / successValues.length
      : null;

    const paused = metrics.filter((metric) => metric.status === 'paused' || metric.paused).length;

    return {
      count: metrics.length,
      avgLatency,
      avgSuccessRate,
      paused,
    };
  }, [metrics]);

  const lastUpdatedLabel = useMemo(
    () =>
      t('aiImprove.strip.updated', 'განახლდა {{time}}', {
        time: formatTimestamp(lastUpdated, t('aiImprove.strip.never', 'არასდროს')),
      }),
    [lastUpdated, t],
  );

  const stateChip = useMemo(() => {
    switch (serviceState) {
      case 'offline':
        return t('aiImprove.strip.state.offline', 'შეზღუდული რეჟიმი');
      case 'degraded':
        return t('aiImprove.strip.state.degraded', 'დაგვიანება');
      default:
        return t('aiImprove.strip.state.ok', 'სტაბილური');
    }
  }, [serviceState, t]);

  return (
    <section
      className={classNames(
        'flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 shadow-sm shadow-violet-500/10 md:flex-row md:items-center md:justify-between',
        serviceState === 'offline' && 'ring-1 ring-slate-500/40',
        serviceState === 'degraded' && 'ring-1 ring-amber-500/40',
      )}
      data-testid="ai-imp:strip"
      aria-live="polite"
    >
      <div className="flex flex-1 flex-wrap items-center gap-4">
        <span className="font-medium text-slate-100">
          {t('aiImprove.strip.rows', 'რიგი')}: {summary.count}
        </span>
        <span className="text-slate-300">
          {t('aiImprove.strip.latency', 'ლატენცია')}: {formatNumber(summary.avgLatency, 'ms')}
        </span>
        <span className="text-slate-300">
          {t('aiImprove.strip.success', 'წარმატება')}: {formatNumber(summary.avgSuccessRate, '%')}
        </span>
        <span className="text-slate-300">
          {t('aiImprove.strip.paused', 'შეჩერებული')}: {summary.paused}
        </span>
        <span className="text-slate-400">{lastUpdatedLabel}</span>
        <span
          className={classNames(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
            serviceState === 'offline'
              ? 'border-slate-500/50 text-slate-200'
              : serviceState === 'degraded'
                ? 'border-amber-500/50 text-amber-200'
                : 'border-violet-500/60 text-violet-200',
          )}
        >
          {stateChip}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md border border-violet-500/60 bg-violet-500/10 px-3 py-2 font-medium text-violet-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={isCopying}
          aria-disabled={disabled}
        >
          <ClipboardDocumentIcon
            className={classNames('h-4 w-4', isCopying && 'animate-pulse text-emerald-100')}
            aria-hidden="true"
          />
          {t('aiImprove.strip.copy', 'კოპირება')}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-medium text-slate-100 transition hover:border-violet-500/60 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={isExporting}
          aria-disabled={disabled}
        >
          <ArrowDownTrayIcon
            className={classNames('h-4 w-4', isExporting && 'animate-pulse text-emerald-200')}
            aria-hidden="true"
          />
          {t('aiImprove.strip.export', 'Export CSV')}
        </button>
      </div>
    </section>
  );
};

export default MetricStrip;

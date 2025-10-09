import React, { useMemo } from 'react';
import classNames from 'classnames';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface BrainStatusCardProps {
  collapsed: boolean;
  status: string | null;
  percent: number | null;
  lastUpdate: string | number | null;
  tasksActive: number | null;
  mode?: string | null;
  isLoading?: boolean;
  isOffline?: boolean;
  error?: string | null;
  tooltip?: string;
  onClick?: () => void;
}

const clampPercent = (value: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
};

const BrainStatusCard: React.FC<BrainStatusCardProps> = ({
  collapsed,
  status,
  percent,
  lastUpdate,
  tasksActive,
  mode,
  isLoading = false,
  isOffline = false,
  error = null,
  tooltip,
  onClick,
}) => {
  const { t } = useTranslation();

  const safePercent = clampPercent(percent);

  const lastUpdateDisplay = useMemo(() => {
    if (lastUpdate === null || lastUpdate === undefined || lastUpdate === '') {
      return null;
    }

    const parsed = new Date(lastUpdate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat('ka-GE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }, [lastUpdate]);

  const tasksDisplay = useMemo(() => {
    if (typeof tasksActive === 'number' && Number.isFinite(tasksActive)) {
      return t('aiImprove.brain.sidebar.tasksBadge', '{{count}} მიმდინარე', {
        count: tasksActive,
      });
    }

    return null;
  }, [tasksActive, t]);

  const baseStatus = useMemo(() => {
    if (error) {
      return t('aiImprove.brain.sidebar.error', 'შეცდომა: N/A');
    }

    if (status && status.trim().length > 0) {
      return status.trim();
    }

    if (isOffline) {
      return t('aiImprove.brain.sidebar.offline', 'შეზღუდული რეჟიმი');
    }

    return null;
  }, [error, isOffline, status, t]);

  const headline = useMemo(() => {
    if (baseStatus) {
      return baseStatus;
    }

    if (mode && mode.trim().length > 0) {
      return mode.trim();
    }

    if (safePercent !== null) {
      return `${t('aiImprove.brain.sidebar.analysis', 'ანალიზი')} ${safePercent}%`;
    }

    return t('aiImprove.brain.sidebar.monitoring', 'Brain monitor standby');
  }, [baseStatus, mode, safePercent, t]);

  const shouldHideCard = useMemo(() => {
    if (isLoading) {
      return false;
    }

    const hasMode = Boolean(mode && mode.trim().length > 0);

    return !baseStatus && safePercent === null && !lastUpdateDisplay && !tasksDisplay && !hasMode;
  }, [baseStatus, isLoading, lastUpdateDisplay, mode, safePercent, tasksDisplay]);

  const tooltipText = tooltip
    ?? t('aiImprove.brain.sidebar.tooltip', 'გურულოს ტვინის ციფრული მონიტორი');

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  if (collapsed || shouldHideCard) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={isLoading && !onClick}
      title={tooltipText}
      className={classNames(
        'group hidden w-64 flex-col rounded-xl border border-purple-500/40 bg-purple-900/20 p-3 text-left transition-colors',
        'hover:border-purple-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400',
        'md:flex',
        isLoading && 'cursor-wait opacity-80',
      )}
      data-testid="ai-imp:brain-card"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/20 text-purple-200 shadow-inner">
          <Brain className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-200/80">
            {t('aiImprove.brain.sidebar.pulse', 'Brain Pulse')}
          </p>
          <p className="mt-1 text-sm font-medium text-purple-100/90">{headline}</p>
        </div>
        {safePercent !== null ? <span className="text-lg font-semibold text-white">{safePercent}%</span> : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-purple-200/70">
        <span className="truncate pr-2 text-purple-100/80">
          {tasksDisplay ?? mode ?? t('aiImprove.brain.sidebar.standby', 'Standby')}
        </span>
        <span>{lastUpdateDisplay ?? '—'}</span>
      </div>

      {error ? <p className="mt-2 text-[11px] text-rose-200/80">{error}</p> : null}
    </button>
  );
};

export default BrainStatusCard;

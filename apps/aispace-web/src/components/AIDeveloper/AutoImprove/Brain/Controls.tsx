import React from 'react';
import type { ControlCallbacks } from './types';

interface ControlsProps extends ControlCallbacks {
  hasRollbackCheckpoint: boolean;
  currentRunId: string | null;
}

const Controls: React.FC<ControlsProps> = ({
  onPause,
  onResume,
  onRetry,
  onRollback,
  isPaused,
  isRetrying,
  isRollingBack,
  hasRollbackCheckpoint,
  currentRunId,
}) => {
  const handleRetry = () => onRetry(currentRunId ?? undefined);
  const handleRollback = () => onRollback(currentRunId ?? undefined, undefined);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 text-sm text-slate-200">
      <button
        type="button"
        onClick={isPaused ? onResume : onPause}
        className="rounded-full border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-100 transition hover:bg-purple-500/20"
      >
        {isPaused ? 'Resume Stream' : 'Pause Stream'}
      </button>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRetrying ? 'Retrying…' : 'Retry Run'}
      </button>
      <button
        type="button"
        onClick={handleRollback}
        disabled={!hasRollbackCheckpoint || isRollingBack}
        className="rounded-full border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRollingBack ? 'Rolling Back…' : 'Rollback'}
      </button>
      {currentRunId ? (
        <span className="ml-auto text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Focused run: {currentRunId}
        </span>
      ) : null}
    </div>
  );
};

export default Controls;

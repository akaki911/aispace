import React, { useMemo } from 'react';
import classNames from 'classnames';
import type { BrainMachineSnapshot } from '@/state/brainMachine';
import type { StatusEventPayload } from './types';

interface StatusStripProps {
  status: StatusEventPayload | null;
  connection: BrainMachineSnapshot;
  lastHeartbeatAt: number | null;
  transport?: 'sse' | 'poll';
  backpressure?: number;
}

const COLOR_CLASS: Record<BrainMachineSnapshot['color'], string> = {
  green: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/50',
  yellow: 'bg-amber-500/10 text-amber-200 border-amber-500/50',
  red: 'bg-rose-500/10 text-rose-200 border-rose-500/50',
  purple: 'bg-purple-500/10 text-purple-200 border-purple-500/50',
  slate: 'bg-slate-800/40 text-slate-200 border-slate-700/70',
};

const formatDuration = (ms?: number | null) => {
  if (!ms || Number.isNaN(ms)) {
    return '—';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((segment) => String(segment).padStart(2, '0'))
    .join(':');
};

const StatusStrip: React.FC<StatusStripProps> = ({ status, connection, lastHeartbeatAt, transport = 'sse', backpressure = 0 }) => {
  const uptime = useMemo(() => {
    if (!status?.uptimeMs && status?.startedAt) {
      const started = new Date(status.startedAt).getTime();
      if (!Number.isNaN(started)) {
        return Date.now() - started;
      }
    }
    return status?.uptimeMs ?? null;
  }, [status]);

  const badges = [
    {
      label: status?.phase ? status.phase.toUpperCase() : 'IDLE',
      tone: COLOR_CLASS[connection.color],
    },
    {
      label: connection.value.toUpperCase(),
      tone: COLOR_CLASS[connection.color],
    },
  ];

  if (transport === 'poll') {
    badges.push({
      label: 'FALLBACK: POLL',
      tone: 'bg-amber-500/20 text-amber-100 border-amber-400/40',
    });
  }

  const runBadge = status?.runId
    ? { label: `Run ${status.runId}`, tone: 'bg-slate-800/60 text-slate-200 border-slate-600/50' }
    : null;

  if (runBadge) {
    badges.push(runBadge);
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/80 p-4 text-sm text-slate-200"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        {badges.map((badge, index) => (
          <span
            key={`${badge.label}-${index}`}
            className={classNames(
              'rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.2em]',
              badge.tone,
            )}
          >
            {badge.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
        <div>
          <p className="uppercase tracking-[0.2em] text-slate-500">Uptime</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{formatDuration(uptime)}</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.2em] text-slate-500">Heartbeat</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : '—'}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-[0.2em] text-slate-500">Queue</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{backpressure > 0 ? `${backpressure} buffered` : 'Stable'}</p>
        </div>
      </div>
    </div>
  );
};

export default StatusStrip;

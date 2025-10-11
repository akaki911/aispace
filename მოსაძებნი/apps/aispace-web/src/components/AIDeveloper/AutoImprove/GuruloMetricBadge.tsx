import React from 'react';
import classNames from 'classnames';

type BadgeTone = 'default' | 'ok' | 'warning' | 'error';

interface GuruloMetricBadgeProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: BadgeTone;
  helper?: string | null;
  title?: string;
}

const toneMap: Record<BadgeTone, string> = {
  default: 'border-slate-700/80 bg-slate-900/60 text-slate-200',
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

const GuruloMetricBadge: React.FC<GuruloMetricBadgeProps> = ({
  label,
  value,
  icon,
  tone = 'default',
  helper,
  title,
}) => {
  return (
    <div
      className={classNames(
        'flex flex-col gap-2 rounded-lg border px-4 py-3 shadow-md transition-colors duration-200 hover:border-purple-400/60',
        toneMap[tone],
      )}
      title={title ?? undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300/80">{label}</p>
        {icon ? <span className="text-lg text-purple-300/80">{icon}</span> : null}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {helper ? <p className="text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
};

export default GuruloMetricBadge;

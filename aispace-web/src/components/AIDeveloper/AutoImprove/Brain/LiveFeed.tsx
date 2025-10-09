import React from 'react';
import classNames from 'classnames';
import type { BrainEventRecord } from './types';

interface LiveFeedProps {
  events: BrainEventRecord[];
  activeTypes: Set<BrainEventRecord['type']>;
  onToggleType: (type: BrainEventRecord['type']) => void;
}

const toneByType: Record<BrainEventRecord['type'], string> = {
  status: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
  action: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  problem: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  decision: 'border-purple-500/40 bg-purple-500/10 text-purple-100',
  log: 'border-slate-700/60 bg-slate-900/80 text-slate-200',
  metric: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  error: 'border-red-500/40 bg-red-500/10 text-red-100',
};

const LiveFeed: React.FC<LiveFeedProps> = ({ events, activeTypes, onToggleType }) => {
  const ordered = [...events].sort((a, b) => b.receivedAt - a.receivedAt);
  const filters = (Object.keys(toneByType) as BrainEventRecord['type'][]).map((type) => ({
    type,
    active: activeTypes.has(type),
  }));

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-800/70 bg-slate-950/70">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/60 px-4 py-3 text-xs text-slate-400">
        <span className="uppercase tracking-[0.28em] text-slate-500">Live Feed</span>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter.type}
              type="button"
              onClick={() => onToggleType(filter.type)}
              className={classNames(
                'rounded-full border px-2 py-1 transition-colors',
                filter.active
                  ? 'border-purple-400/70 bg-purple-500/20 text-purple-100'
                  : 'border-slate-700/70 bg-transparent text-slate-400 hover:border-purple-400/40 hover:text-purple-100',
              )}
            >
              {filter.type}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-xs">
        {ordered.length === 0 ? (
          <p className="text-slate-500">No events yet.</p>
        ) : (
          ordered.map((event) => (
            <div
              key={event.id}
              className={classNames('rounded-2xl border px-3 py-2 shadow-sm backdrop-blur-sm', toneByType[event.type])}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em]">
                <span>{event.type}</span>
                <span>{event.runId ?? 'no-run'}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/90">
                {(() => {
                  switch (event.type) {
                    case 'status':
                      return event.data.phase ?? 'Status update';
                    case 'action':
                      return event.data.summary;
                    case 'decision':
                      return event.data.chosenPath;
                    case 'problem':
                      return event.data.title;
                    case 'metric':
                      return `CPU ${event.data.cpu ?? '—'}% | MEM ${event.data.mem ?? '—'}% | P95 ${event.data.latencyP95 ?? '—'}ms`;
                    case 'error':
                      return `${event.data.code}: ${event.data.message}`;
                    case 'log':
                    default:
                      return event.data.message;
                  }
                })()}
              </p>
              <p className="mt-2 text-[10px] text-white/70">
                {new Date(event.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LiveFeed;

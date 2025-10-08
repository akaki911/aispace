import React from 'react';
import classNames from 'classnames';
import type { BrainHistoryEntry } from './types';

interface HistoryProps {
  entries: BrainHistoryEntry[];
  onSelect: (entry: BrainHistoryEntry) => void;
  onDiffNavigate?: (entry: BrainHistoryEntry, diffUrl: string | null) => void;
}

const toneStyles: Record<BrainHistoryEntry['tone'], string> = {
  info: 'border-slate-800/60 bg-slate-900/60 text-slate-200',
  warning: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
};

const toneHeadlineClass: Record<BrainHistoryEntry['tone'], string> = {
  info: 'text-slate-100',
  warning: 'text-amber-50',
  error: 'text-rose-50',
};

const toneDetailClass: Record<BrainHistoryEntry['tone'], string> = {
  info: 'text-slate-400',
  warning: 'text-amber-200',
  error: 'text-rose-200',
};

const History: React.FC<HistoryProps> = ({ entries, onSelect, onDiffNavigate }) => {
  if (!entries.length) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">History</p>
        <p className="mt-3 text-slate-400">No completed runs yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">History</p>
      <ul className="mt-4 space-y-3" role="list">
        {entries.map((entry) => {
          const diffUrl = entry.diffUrl ?? null;

          return (
            <li
              key={entry.runId ?? entry.updatedAt}
              className={classNames(
                'rounded-2xl border p-4 focus-within:ring-2 focus-within:ring-purple-400',
                toneStyles[entry.tone],
              )}
              role="listitem"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Run {entry.runId ?? '—'}
                  </p>
                  <p className={classNames('mt-1 text-sm', toneHeadlineClass[entry.tone])}>{entry.headline}</p>
                  {entry.detail ? (
                    <p className={classNames('mt-1 text-xs', toneDetailClass[entry.tone])}>{entry.detail}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {diffUrl ? (
                    <a
                      href={diffUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100 hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      onClick={() => onDiffNavigate?.(entry, diffUrl)}
                    >
                      View Diff
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="rounded-full border border-purple-400/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-100 hover:bg-purple-500/10 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    Inspect Run
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default History;

import React from 'react';
import type { ActionEventPayload } from './types';

interface LastOutcomeProps {
  action: ActionEventPayload | null;
  diffUrl?: string | null;
  transport?: 'sse' | 'poll';
}

const LastOutcome: React.FC<LastOutcomeProps> = ({ action, diffUrl, transport = 'sse' }) => {
  if (!action) {
    return (
      <div
        className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 text-sm text-slate-300"
        aria-live="polite"
      >
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Last Outcome</p>
        <p className="mt-3 text-slate-200">No actions have been completed yet.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-sm text-emerald-50"
      aria-live="polite"
    >
      <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">Last Outcome</p>
      <p className="mt-3 text-base font-semibold">{action.summary}</p>
      <div className="mt-3 grid gap-2 text-xs text-emerald-100/80 md:grid-cols-3">
        <div>
          <p className="uppercase tracking-[0.24em] text-emerald-200/70">Files</p>
          <p className="mt-1 text-sm font-semibold">
            {action.filesTouched.length ? action.filesTouched.length : '—'}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-[0.24em] text-emerald-200/70">Tests</p>
          <p className="mt-1 text-sm font-semibold">
            {action.testsRan.length ? action.testsRan.join(', ') : '—'}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-[0.24em] text-emerald-200/70">Result</p>
          <p className="mt-1 text-sm font-semibold">{action.result}</p>
        </div>
      </div>
      {action.durationMs ? (
        <p className="mt-3 text-xs text-emerald-100/80">Duration: {Math.round(action.durationMs)} ms</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-emerald-400/50 px-3 py-1 uppercase tracking-[0.24em] text-emerald-100">
          Transport: {transport.toUpperCase()}
        </span>
        {action.checkpointId ? (
          <span className="rounded-full border border-emerald-400/40 px-3 py-1 uppercase tracking-[0.24em] text-emerald-200/80">
            Checkpoint {action.checkpointId}
          </span>
        ) : null}
        {diffUrl ? (
          <a
            href={diffUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-emerald-300/60 px-3 py-1 uppercase tracking-[0.24em] text-emerald-100 hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            View Diff
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default LastOutcome;

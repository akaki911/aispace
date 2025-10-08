import React from 'react';
import type { DecisionEventPayload, ProblemEventPayload, StatusEventPayload } from './types';

interface ThinkingNowProps {
  status: StatusEventPayload | null;
  problem: ProblemEventPayload | null;
  decision: DecisionEventPayload | null;
}

const ThinkingNow: React.FC<ThinkingNowProps> = ({ status, problem, decision }) => {
  return (
    <div className="rounded-3xl border border-purple-500/30 bg-slate-950/70 p-5 text-sm text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-200/80">Thinking Now</p>
      <div className="mt-3 space-y-3">
        <p className="text-base text-slate-100">
          {status?.phase
            ? `Gurulo is currently in the “${status.phase}” phase.`
            : 'Awaiting the next phase update from Gurulo.'}
        </p>
        {problem ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-rose-200/80">Active Problem</p>
            <p className="mt-2 font-medium text-rose-50">{problem.title}</p>
            {problem.severity ? (
              <p className="text-xs text-rose-100/80">Severity: {problem.severity}</p>
            ) : null}
            {problem.evidence?.length ? (
              <ul className="mt-2 space-y-1 text-xs text-rose-100/70">
                {problem.evidence.slice(0, 3).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {decision ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Decision</p>
            <p className="mt-2 font-medium text-emerald-50">{decision.chosenPath}</p>
            {decision.reason ? (
              <p className="mt-2 text-xs text-emerald-100/80">{decision.reason}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ThinkingNow;

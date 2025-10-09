import React from 'react';
import type { DecisionEventPayload } from './types';

interface NextActionProps {
  decision: DecisionEventPayload | null;
  statusPhase: string | null;
}

const NextAction: React.FC<NextActionProps> = ({ decision, statusPhase }) => {
  return (
    <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-5 text-sm text-blue-50">
      <p className="text-xs uppercase tracking-[0.28em] text-blue-200/80">Next Action</p>
      <p className="mt-3 text-base font-semibold">
        {decision?.chosenPath ?? 'Standing by for the next instruction.'}
      </p>
      <p className="mt-2 text-xs text-blue-100/80">
        {decision?.reason ??
          (statusPhase ? `Awaiting completion of the ${statusPhase} phase.` : 'Monitoring the pipeline.')}
      </p>
    </div>
  );
};

export default NextAction;

import type { FC, ReactNode } from 'react';

export interface PendingAction {
  id: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

interface SafetySwitchProps {
  pendingActions: PendingAction[];
  onExecute: (action: PendingAction) => Promise<{ success: boolean; result?: ReactNode }> | void;
}

export const SafetySwitch: FC<SafetySwitchProps> = ({ pendingActions, onExecute }) => {
  if (!pendingActions.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        უსაფრთხოების სიგნალები არ არის აქტიური.
      </div>
    );
  }

  const handleExecute = async (action: PendingAction) => {
    try {
      await onExecute(action);
    } catch (error) {
      console.error('Safety switch action failed', error);
    }
  };

  return (
    <div className="space-y-3">
      {pendingActions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => handleExecute(action)}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-red-500/20 px-4 py-3 text-left text-xs text-white transition hover:bg-red-500/30"
        >
          <div>
            <div className="text-sm font-semibold">{action.label}</div>
            {action.description ? <div className="mt-1 text-[11px] text-white/70">{action.description}</div> : null}
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide">
            {action.severity}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SafetySwitch;

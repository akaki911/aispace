import React, { useMemo, useState } from 'react';

export type PendingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PendingAction {
  id: string;
  label: string;
  severity: PendingSeverity;
  description?: string;
  createdAt?: string | number;
}

export interface SafetySwitchProps {
  actions?: PendingAction[];
  isVisible?: boolean;
  onActionExecute?: (action: PendingAction) => Promise<unknown> | unknown;
  className?: string;
}

const severityTone: Record<PendingSeverity, string> = {
  low: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  medium: 'border-amber-500/50 bg-amber-500/10 text-amber-100',
  high: 'border-orange-500/50 bg-orange-500/10 text-orange-100',
  critical: 'border-rose-500/50 bg-rose-500/10 text-rose-200',
};

const fallbackActions: PendingAction[] = [
  {
    id: 'fallback-log-purge',
    label: 'სისტემური ლოგების გაწმენდა',
    severity: 'medium',
    description: 'შედგენის პანელის დემო ქმედება. რეალურ გარემოში გამოჩნდება მართვის ცოცხალი მოთხოვნები.',
  },
];

const SafetySwitch: React.FC<SafetySwitchProps> = ({ actions, isVisible = true, onActionExecute, className }) => {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const availableActions = useMemo(() => (actions && actions.length > 0 ? actions : fallbackActions), [actions]);

  if (!isVisible) {
    return null;
  }

  const handleExecute = async (action: PendingAction) => {
    setPendingActionId(action.id);
    try {
      await onActionExecute?.(action);
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-[#E6E8EC]">
        <header>
          <h4 className="text-base font-semibold text-white">🛡️ უსაფრთხო ქმედებები</h4>
          <p className="mt-1 text-xs text-[#A0A4AD]">
            ავტომატიზებული ოპერაციები გამოჩნდება აქ. დემო რეჟიმში ნაჩვენებია ნაგულისხმევი ქმედება.
          </p>
        </header>
        <ul className="space-y-2">
          {availableActions.map((action) => (
            <li
              key={action.id}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#101522]/80 p-3 backdrop-blur"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{action.label}</span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-0.5 text-[11px] font-semibold ${severityTone[action.severity]}`}>
                  {action.severity.toUpperCase()}
                </span>
              </div>
              {action.description ? <p className="text-xs text-[#A0A4AD]">{action.description}</p> : null}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-500/60 hover:bg-emerald-500/20"
                onClick={() => handleExecute(action)}
                disabled={pendingActionId === action.id}
              >
                {pendingActionId === action.id ? 'მიმდინარეობს...' : 'დადასტურება'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export { SafetySwitch };
export default SafetySwitch;

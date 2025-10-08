import type { PropsWithChildren } from 'react';

export type PendingActionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PendingAction {
  id: string;
  severity: PendingActionSeverity;
  label?: string;
}

export interface SafetySwitchProps extends PropsWithChildren {
  onExecute?: (action: PendingAction) => Promise<unknown> | unknown;
  onActionExecute?: (action: PendingAction) => Promise<unknown> | unknown;
  pendingActions?: PendingAction[];
  isVisible?: boolean;
  className?: string;
  label?: string;
}

export const SafetySwitch = ({
  children,
  pendingActions = [],
  onExecute,
  onActionExecute,
  isVisible = true,
  className,
  label,
}: SafetySwitchProps): JSX.Element | null => {
  if (!isVisible) {
    return null;
  }

  const handler = onActionExecute ?? onExecute;
  const firstPending = pendingActions[0];

  if (children) {
    return <div className={className}>{children}</div>;
  }

  const displayLabel = label ?? (firstPending?.label ?? firstPending?.id ?? 'Execute');

  const handleClick = () => {
    if (firstPending && handler) {
      void handler(firstPending);
    }
  };

  return (
    <button type="button" className={className} onClick={handleClick} disabled={!firstPending || !handler}>
      {displayLabel}
    </button>
  );
};

export default SafetySwitch;

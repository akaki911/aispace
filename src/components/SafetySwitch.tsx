import type { PropsWithChildren } from 'react';

export type PendingActionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PendingAction {
  id: string;
  severity: PendingActionSeverity;
  label?: string;
}

export interface SafetySwitchProps extends PropsWithChildren {
  onExecute?: (action: PendingAction) => Promise<unknown> | unknown;
  pendingActions?: PendingAction[];
}

export const SafetySwitch = ({ children }: SafetySwitchProps): JSX.Element => {
  return <>{children ?? null}</>;
};

export default SafetySwitch;

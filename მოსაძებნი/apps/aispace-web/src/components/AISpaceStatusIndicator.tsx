import type { FC } from 'react';

import type { AISpaceHealthStatus } from '@aispace/services/health';

const STATUS_LABELS: Record<AISpaceHealthStatus, string> = {
  checking: 'AI სერვისის სტატუსი მოწმდება',
  healthy: 'AI სერვისი ხელმისაწვდომია',
  degraded: 'AI სერვისი ნაწილობრივ ხელმისაწვდომია',
  offline: 'AI სერვისი მიუწვდომელია',
};

const STATUS_COLORS: Record<AISpaceHealthStatus, string> = {
  checking: 'bg-slate-400 animate-pulse',
  healthy: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  offline: 'bg-rose-500',
};

export interface AISpaceStatusIndicatorProps {
  status: AISpaceHealthStatus;
  className?: string;
}

export const AISpaceStatusIndicator: FC<AISpaceStatusIndicatorProps> = ({ status, className }) => {
  const classes = ['relative inline-flex h-2 w-2 rounded-full', STATUS_COLORS[status]];
  if (className) {
    classes.push(className);
  }

  return (
    <span className={classes.join(' ')} aria-label={STATUS_LABELS[status]} role="status">
      <span className="sr-only">{STATUS_LABELS[status]}</span>
    </span>
  );
};

export default AISpaceStatusIndicator;


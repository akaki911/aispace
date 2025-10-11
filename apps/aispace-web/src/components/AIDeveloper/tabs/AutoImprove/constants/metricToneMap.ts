import type { AutoImproveMetric } from '@aispace/components/AIDeveloper/AutoImprove/types';

export const metricToneMap: Record<AutoImproveMetric['status'], 'ok' | 'warning' | 'error' | 'default'> = {
  ok: 'ok',
  warning: 'warning',
  error: 'error',
  paused: 'default',
};

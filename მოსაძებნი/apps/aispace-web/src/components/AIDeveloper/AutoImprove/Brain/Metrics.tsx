import React from 'react';
import type { MetricEventPayload } from './types';

interface MetricsProps {
  metric: MetricEventPayload | null;
}

const formatNumber = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value * 100) / 100}${suffix}`;
};

const Metrics: React.FC<MetricsProps> = ({ metric }) => {
  const items = [
    { label: 'CPU', value: formatNumber(metric?.cpu, '%') },
    { label: 'Memory', value: formatNumber(metric?.mem, '%') },
    { label: 'Req Rate', value: formatNumber(metric?.reqRate, '/s') },
    { label: 'Error Rate', value: formatNumber(metric?.errorRate, '%') },
    { label: 'P95 Latency', value: formatNumber(metric?.latencyP95, 'ms') },
  ];

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Metrics</p>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        {metric?.timestamp ? `Updated ${new Date(metric.timestamp).toLocaleTimeString()}` : 'Awaiting metrics.'}
      </p>
    </div>
  );
};

export default Metrics;

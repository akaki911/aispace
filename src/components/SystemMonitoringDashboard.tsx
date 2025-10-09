import type { FC } from 'react';

interface SystemMonitoringDashboardProps {
  metrics?: Record<string, number>;
}

const SystemMonitoringDashboard: FC<SystemMonitoringDashboardProps> = ({ metrics = {} }) => {
  const entries = Object.entries(metrics);

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-xs text-white/60">
        სისტემის მონიტორინგის მეტრიკები დროებით მიუწვდომელია.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-xs text-white/80">
      {entries.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-white/60">{label}</div>
          <div className="mt-1 text-lg font-semibold text-white">{value}</div>
        </div>
      ))}
    </div>
  );
};

export default SystemMonitoringDashboard;

import type { FC } from 'react';

interface AutoUpdateMonitoringDashboardProps {
  updates?: Array<{ id: string; status: string; description?: string }>;
}

const AutoUpdateMonitoringDashboard: FC<AutoUpdateMonitoringDashboardProps> = ({ updates = [] }) => {
  if (!updates.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-xs text-white/70">
        ავტომატური განახლებების ისტორია ჯერ არ არსებობს.
      </div>
    );
  }

  return (
    <ul className="space-y-3 text-xs text-white/80">
      {updates.map((update) => (
        <li key={update.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{update.id}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">{update.status}</span>
          </div>
          {update.description ? <p className="mt-2 text-[11px] text-white/60">{update.description}</p> : null}
        </li>
      ))}
    </ul>
  );
};

export default AutoUpdateMonitoringDashboard;

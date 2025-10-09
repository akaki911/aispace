import type { FC } from 'react';

interface AutoImproveTraceMonitorProps {
  traces?: Array<{ id: string; status: string; summary?: string }>;
}

const AutoImproveTraceMonitor: FC<AutoImproveTraceMonitorProps> = ({ traces = [] }) => {
  if (!traces.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-xs text-white/70">
        ტრეისები ჯერ არ არის ხელმისაწვდომი.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {traces.map((trace) => (
        <div key={trace.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{trace.id}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">{trace.status}</span>
          </div>
          {trace.summary ? <p className="mt-2 text-[11px] text-white/60">{trace.summary}</p> : null}
        </div>
      ))}
    </div>
  );
};

export default AutoImproveTraceMonitor;

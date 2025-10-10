import { useMemo, type FC } from 'react';

import { useDevConsole } from '@/contexts/DevConsoleContext';

interface AutoImproveTraceMonitorProps {
  traces?: Array<{ id: string; status: string; summary?: string }>;
  className?: string;
}

const statusTone: Record<string, string> = {
  connected: 'bg-emerald-500/20 text-emerald-200',
  retrying: 'bg-amber-500/20 text-amber-200',
  connecting: 'bg-sky-500/20 text-sky-200',
  disconnected: 'bg-rose-500/20 text-rose-200',
};

const statusLabel: Record<string, string> = {
  connected: 'Connected',
  retrying: 'Retrying…',
  connecting: 'Connecting…',
  disconnected: 'Offline',
};

const AutoImproveTraceMonitor: FC<AutoImproveTraceMonitorProps> = ({ traces = [], className }) => {
  const { connectionStatus, lastEventAt } = useDevConsole();

  const lastEventLabel = useMemo(() => {
    if (!lastEventAt) {
      return 'No events yet';
    }
    return new Date(lastEventAt).toLocaleTimeString();
  }, [lastEventAt]);

  const statusClass = statusTone[connectionStatus] ?? statusTone.disconnected;
  const statusText = statusLabel[connectionStatus] ?? statusLabel.disconnected;

  return (
    <div className={`flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 text-xs text-white/80 ${className ?? ''}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-[11px] uppercase tracking-wide text-white/60">Live events</span>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
          <span className={`rounded-full px-2 py-0.5 ${statusClass}`}>{statusText}</span>
          <span className="text-white/40">{lastEventLabel}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {traces.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60">
            ტრეისები ჯერ არ არის ხელმისაწვდომი.
          </div>
        ) : (
          traces.map((trace) => (
            <div key={trace.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span className="font-semibold text-white">{trace.id}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">{trace.status}</span>
              </div>
              {trace.summary ? <p className="mt-2 text-[11px] text-white/60">{trace.summary}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AutoImproveTraceMonitor;


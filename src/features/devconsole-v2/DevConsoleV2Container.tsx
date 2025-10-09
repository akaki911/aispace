import type { FC } from 'react';

import { useDevConsole } from '@/contexts/DevConsoleContext';

export const DevConsoleV2Container: FC = () => {
  const { entries, appendEntry, clear } = useDevConsole();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/60">
        <span>Dev Console</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-white"
            onClick={() =>
              appendEntry({
                level: 'info',
                message: 'Manual log entry',
              })
            }
          >
            Add log
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-white/80"
            onClick={clear}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-xs text-white/80">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            ჯერ არ არის ლოგები.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span className="uppercase tracking-wide">{entry.level}</span>
                <span>{new Date(entry.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="mt-2 text-white">{entry.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DevConsoleV2Container;

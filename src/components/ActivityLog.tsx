import type { FC } from 'react';

export interface ActivityLogEntry {
  id: string;
  label: string;
  description?: string;
  timestamp: string;
}

interface ActivityLogProps {
  items?: ActivityLogEntry[];
  onOpen?: (id: string) => void;
  openFile?: (path: string) => void;
}

const ActivityLog: FC<ActivityLogProps> = ({ items = [], onOpen, openFile }) => {
  const handleOpen = (id: string) => {
    onOpen?.(id);
    openFile?.(id);
  };

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        აქტივობის ჩანაწერები არ მოიძებნა.
      </div>
    );
  }

  return (
    <ul className="space-y-3 text-xs text-white/80">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{item.label}</div>
              {item.description ? <p className="mt-1 text-[11px] text-white/60">{item.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => handleOpen(item.id)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-white/80"
            >
              გახსნა
            </button>
          </div>
          <div className="mt-2 text-[10px] text-white/50">{new Date(item.timestamp).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
};

export default ActivityLog;

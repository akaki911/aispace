
import { useState, useMemo } from 'react';
import { countAddedRemoved } from '@/utils/diffMetrics';
import type { ActivityEvent } from '@/types/activity';

export default function FileChangeCard({ evt }: { evt: Extract<ActivityEvent, {type:'file'}> }) {
  const [open, setOpen] = useState(true);
  const metrics = useMemo(() => {
    if (evt.unified && (evt.added==null || evt.removed==null)) {
      return countAddedRemoved(evt.unified);
    }
    return { added: evt.added || 0, removed: evt.removed || 0 };
  }, [evt]);

  return (
    <div className="rounded-xl border p-3 mb-2">
      <div className="flex items-center justify-between">
        <div>
          {evt.action==='create' ? '🟩 Create' : evt.action==='update' ? '🛠 Update' : '🗑 Delete'}&nbsp;
          <b className="truncate">{evt.path}</b>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-green-600">+{metrics.added}</span>
          <span className="text-red-600">−{metrics.removed}</span>
          <button className="border px-2 py-1 rounded" onClick={()=>setOpen(!open)}>{open?'Hide':'Show'}</button>
        </div>
      </div>
      {open && evt.unified ? (
        <pre className="mt-2 max-h-64 overflow-auto text-xs"><code>{evt.unified}</code></pre>
      ) : null}
    </div>
  );
}

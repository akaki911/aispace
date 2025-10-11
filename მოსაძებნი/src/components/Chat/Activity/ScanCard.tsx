
import { useState } from 'react';
import type { ActivityEvent } from '@/types/activity';

export default function ScanCard({ evt }: { evt: Extract<ActivityEvent, {type:'scan'}> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border p-3 mb-2">
      <div className="flex items-center justify-between">
        <div>📖 Reading <b>{evt.total}</b> files…</div>
        {evt.sample?.length ? <button className="border px-2 py-1 rounded" onClick={()=>setOpen(!open)}>{open?'Hide list':'View list'}</button> : null}
      </div>
      {open && evt.sample?.length ? (
        <pre className="mt-2 max-h-48 overflow-auto text-xs">{evt.sample.join('\n')}</pre>
      ) : null}
    </div>
  );
}

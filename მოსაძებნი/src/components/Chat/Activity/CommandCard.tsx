
import { useState } from 'react';
import type { ActivityEvent } from '@/types/activity';

export default function CommandCard({ evt }: { evt: Extract<ActivityEvent, {type:'install'}> }) {
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<string|undefined>(evt.out);
  const [err, setErr] = useState<string|undefined>(evt.err);
  const cmd = `${evt.pm || 'npm'} ${evt.pm==='pnpm'?'add':evt.pm==='yarn'?'add':'install'} ${evt.pkg}`;

  async function run() {
    setRunning(true);
    try {
      const r = await fetch('/api/dev/install', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ pkg: evt.pkg })
      });
      const j = await r.json();
      setOut(j.out); setErr(j.err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border p-3 mb-2">
      <div className="flex items-center justify-between">
        <div>📦 <b>{cmd}</b></div>
        <button className="border px-3 py-1 rounded" onClick={run} disabled={running}>Run</button>
      </div>
      {(out||err) && (
        <details className="mt-2">
          <summary className="cursor-pointer">Output</summary>
          {out ? <pre className="text-xs overflow-auto max-h-40 mt-2">{out}</pre> : null}
          {err ? <pre className="text-xs overflow-auto max-h-40 mt-2 text-red-500">{err}</pre> : null}
        </details>
      )}
    </div>
  );
}

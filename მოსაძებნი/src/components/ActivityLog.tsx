import React, { useEffect, useState } from 'react';
import { connectActivity, ActivityEvent } from '../services/activityClient';

const ICONS: Record<string,string> = { 
  SUPER_ADMIN:'👑', 
  Gurulo:'🤖', 
  'Replit Assistant':'🛠️' 
};

const TYPE_ICON: Record<string,string> = { 
  FILE_MODIFIED:'</>', 
  AI_COMMAND:'✨', 
  CONFIG_UPDATED:'⚙️', 
  DEPENDENCY_INSTALLED:'📦' 
};

const StatusDot = ({ok}:{ok:boolean|null}) => (
  <span className="text-xs">
    {ok === null ? '🟡' : (ok ? '🟢' : '🔴')}
  </span>
);

const relativeTime = (timestamp: string) => {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

export default function ActivityLog({ openFile }: { openFile: (path: string) => void }) {
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [q, setQ] = useState('');
  const [author, setAuthor] = useState('');
  const [atype, setAtype] = useState('');
  const [isPaused, setPaused] = useState(false);
  const [queued, setQueued] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState<null|boolean>(null);
  const [lastId, setLastId] = useState<string|undefined>();
  const mountedOnce = React.useRef(false);
  const everOpened = React.useRef(false);

  useEffect(() => {
    if (mountedOnce.current) return; // Dev StrictMode guard — connect only once
    mountedOnce.current = true;
    const disconnect = connectActivity((e: ActivityEvent | { __meta?: 'opened' | 'heartbeat' }) => {
      // მოვსპოთ ცრუ "შეცდომა": თუ გახსნა/ჰარტბითი მოვიდა, აღარ ვთვლით წარუმატებლად
      if ((e as any)?.__meta === 'opened') { everOpened.current = true; return; }
      if ((e as any)?.__meta === 'heartbeat') { return; }
      if (isPaused) {
        setQueued(prev => [e as ActivityEvent, ...prev]
          .filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i).slice(0,500));
      } else {
        setItems(prev => [e as ActivityEvent, ...prev]
          .filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i).slice(0,250));
      }
    });
    // მნიშვნელოვანია: StrictMode-ში cleanup იძახება ორჯერ — არ ვხურავთ კავშირს
    return () => { /* keep SSE alive in dev */ };
  }, []); // 👈 აღარ ვართ დამოკიდებული isPaused-ზე — კავშირი მუდმივია

  const filtered = items.filter(e =>
    (!q || (
      e.summary?.toLowerCase().includes(q.toLowerCase()) || 
      e.details?.description?.toLowerCase().includes(q.toLowerCase()) || 
      e.details?.file?.toLowerCase().includes(q.toLowerCase())
    )) &&
    (!author || e.author?.name === author) && 
    (!atype || e.actionType === atype)
  );

  async function emitDiag() {
    try {
      console.log('🧪 Emitting test events...');
      const response = await fetch('/api/activity/diag');
      const result = await response.json();
      console.log('🧪 Test events result:', result);
    } catch (error) {
      console.error('❌ Failed to emit test events:', error);
    }
  }

  function flushQueued() {
    if (queued.length > 0) {
      setItems(prev => [...queued, ...prev].slice(0, 250));
      setQueued([]);
      setPaused(false);
    }
  }

  return (
    <div className="space-y-3 p-4 bg-gray-800 text-white rounded-lg h-full overflow-hidden flex flex-col">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center space-x-2">
          <span className="text-sm">Stream <StatusDot ok={connected} /></span>
          {lastId && <span className="text-xs text-gray-400">· last: {lastId.slice(0, 8)}</span>}
        </div>

        <input 
          placeholder="Search…" 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          className="border rounded px-2 py-1 bg-gray-700 border-gray-600 text-sm flex-grow min-w-0" 
        />

        <select 
          value={author} 
          onChange={e => setAuthor(e.target.value)} 
          className="border rounded px-2 py-1 bg-gray-700 border-gray-600 text-sm"
        >
          <option value="">All Authors</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          <option value="Gurulo">Gurulo</option>
          <option value="Replit Assistant">Replit Assistant</option>
        </select>

        <button 
          onClick={() => isPaused ? flushQueued() : setPaused(true)} 
          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
        >
          {isPaused ? `▶️ Resume (${queued.length})` : '⏸️ Pause'}
        </button>

        <button 
          onClick={() => { setItems([]); setQueued([]); }} 
          className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-sm"
        >
          🗑️
        </button>

        <button 
          onClick={emitDiag} 
          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-sm"
        >
          🧪 ტესტ
        </button>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto">
        {connected === false && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔌</div>
            <p className="text-gray-400">Activity stream disconnected</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-3 py-1 bg-blue-600 rounded text-sm"
            >
              Reload Page
            </button>
          </div>
        )}

        {connected === null && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting to activity stream...</p>
          </div>
        )}

        {connected === true && filtered.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-gray-400">No activity events yet</p>
            <button onClick={emitDiag} className="mt-2 px-3 py-1 bg-emerald-600 rounded text-sm">
              Generate Test Events
            </button>
          </div>
        )}

        <ul className="divide-y divide-gray-700 space-y-2">
          {filtered.map(e => (
            <li key={e.id} className="py-2 flex items-start gap-3">
              <div title={e.author?.name} className="text-xl pt-1">
                {ICONS[e.author?.name] || '📝'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{e.author?.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-600">
                    {TYPE_ICON[e.actionType] || '•'} {e.actionType}
                  </span>
                  {e.verified?.ok && (
                    <span className="text-xs text-green-400">
                      ✓ {e.verified?.devMode ? '(DEV)' : ''}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">· {relativeTime(e.timestamp)}</span>
                </div>
                <div className="text-sm mt-1">{e.summary}</div>
                {e.details?.file && (
                  <button 
                    onClick={() => openFile(e.details!.file!)} 
                    className="text-xs underline text-blue-400 hover:text-blue-300 mt-1"
                  >
                    📁 {e.details.file}
                  </button>
                )}
                {e.details?.description && (
                  <div className="text-xs text-gray-400 mt-1">{e.details.description}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
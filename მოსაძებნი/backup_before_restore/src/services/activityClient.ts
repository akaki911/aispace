export type ActivityEvent = {
  id: string;
  author: { name: 'SUPER_ADMIN'|'Gurulo'|'Replit Assistant'; type: 'USER'|'INTERNAL_AI'|'EXTERNAL_AI' };
  actionType: string;
  summary: string;
  details?: { file?: string; description?: string };
  timestamp: string;
  verified?: { ok: boolean; devMode?: boolean };
};

export function connectActivity(onEvent: (e: ActivityEvent) => void) {
  // DEV → relative path (Vite proxy), PROD → VITE_API_URL or relative
  const base = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
  const primary = `${base}/api/activity-stream`;
  let es: EventSource | null = null;
  let backoff = 1000;

  function getLastId() {
    try {
      return localStorage.getItem('activity:lastId') || undefined;
    } catch {
      return undefined;
    }
  }

  function start(lastId?: string) {
    const url = lastId ? `${primary}?lastEventId=${encodeURIComponent(lastId)}` : primary;
    console.log('🔌 Connecting to activity stream:', url);
    if (import.meta.env.DEV) {
      console.log('🔍 DEV mode: using relative URL with Vite proxy');
    } else {
      console.log('🔍 PROD mode: base =', base);
    }

    es = new EventSource(url);

    es.addEventListener('activity', (msg: MessageEvent) => {
      console.log('📨 Activity event received:', msg.data);
      backoff = 1000;
      try {
        const data = JSON.parse(msg.data);
        onEvent(data);
        localStorage.setItem('activity:lastId', data.id);
      } catch (e) {
        console.error('❌ Failed to parse activity event:', e);
      }
    });

    es.addEventListener('heartbeat', () => {
      console.debug('💓 Activity heartbeat');
      onEvent({ __meta: 'heartbeat' } as ActivityEvent);
    });

    es.addEventListener('connected', () => {
      console.log('✅ Activity stream connected event');
      backoff = 1000;
    });

    es.onopen = () => {
      console.log('✅ Activity stream opened');
    };

    es.onerror = (error) => {
      console.error('❌ Activity stream error:', error);
      if (es?.readyState === EventSource.CLOSED) {
        console.log('🔄 Connection closed, retrying...');
        setTimeout(() => start(getLastId()), Math.min(backoff, 10000));
        backoff = Math.min(backoff * 1.5, 30000);
      } else if (es?.readyState === EventSource.CONNECTING) {
        console.log('🟡 Still connecting to activity stream...');
      }
    };
  }

  if (import.meta.env.DEV) {
    console.log('🔬 DEV mode: Wrapping EventSource in StrictMode guard.');
    const originalEventSource = window.EventSource;
    window.EventSource = class extends EventSource {
      constructor(url: string | URL, eventSourceInitDict?: EventSourceInit | undefined) {
        console.log('🔬 Activity Stream: Instantiating EventSource (StrictMode Guard)');
        const instance = new originalEventSource(url, eventSourceInitDict);
        const originalClose = instance.close;
        instance.close = () => {
          console.log('🔬 Activity Stream: close() called (StrictMode Guard)');
          // If this is a double-unmount from StrictMode, do nothing.
          // We rely on the *actual* unmount to close the connection.
          // This prevents the retry logic from firing on the first unmount.
          if (document.hidden) {
            console.log('🔬 Activity Stream: Connection closed by StrictMode unmount.');
            return;
          }
          console.log('🔬 Activity Stream: Performing actual close.');
          originalClose.call(instance);
        };
        return instance;
      }
    } as any;
  }

  start(getLastId());
  return () => {
    // Dev StrictMode double-unmount-ზე არ ვხურავთ მყისიერად
    console.debug('🔌 Disconnect requested (noop in dev to avoid StrictMode churn)');
  };
}
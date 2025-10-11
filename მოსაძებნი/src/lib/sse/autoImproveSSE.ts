import { useEffect, useMemo, useRef, useState } from 'react';

const RETRY_DELAYS = [1000, 5000, 15000, 30000] as const;
const HEARTBEAT_EVENT = 'heartbeat';
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_GRACE_MS = 5000;
const MAX_EVENTS_PER_SECOND = 200;
const QUEUE_DRAIN_INTERVAL_MS = 50;
const MAX_BUFFER_SIZE = 4000;
const POLL_INTERVAL_MS = 3000;
const POLL_RECONNECT_THRESHOLD = 3;

export type AutoImproveStreamEventName =
  | 'status'
  | 'action'
  | 'problem'
  | 'decision'
  | 'log'
  | 'metric'
  | 'error'
  | typeof HEARTBEAT_EVENT
  | 'message';

export interface AutoImproveStreamCallbacks {
  onOpen?: (event: Event) => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onEvent?: (name: AutoImproveStreamEventName, event: MessageEvent<string>) => void;
  onReconnectSchedule?: (attempt: number, delayMs: number) => void;
  onHeartbeatTimeout?: () => void;
  onBackpressure?: (queueSize: number) => void;
  onTransportChange?: (transport: 'sse' | 'poll') => void;
}

export interface AutoImproveStreamController {
  pause: () => void;
  resume: () => void;
  close: () => void;
  isPaused: () => boolean;
  getLastEventId: () => string | null;
  getTransport: () => 'sse' | 'poll';
}

interface StartOptions {
  since?: string | null;
  headers?: Record<string, string>;
}

export function connectAutoImproveStream(
  url: string,
  callbacks: AutoImproveStreamCallbacks = {},
  options: StartOptions = {},
): AutoImproveStreamController {
  let eventSource: EventSource | null = null;
  let reconnectAttempt = 0;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let paused = false;
  let lastEventId: string | null = null;
  let sinceOverride: string | null | undefined = options.since;
  const headers = options.headers ?? {};
  const eventQueue: Array<{ name: AutoImproveStreamEventName; event: MessageEvent<string> }> = [];
  let drainTimer: ReturnType<typeof setInterval> | null = null;
  let transport: 'sse' | 'poll' = 'sse';
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveErrors = 0;

  const batchSize = Math.max(1, Math.floor((MAX_EVENTS_PER_SECOND * QUEUE_DRAIN_INTERVAL_MS) / 1000));

  const notifyTransportChange = (nextTransport: 'sse' | 'poll') => {
    if (transport !== nextTransport) {
      transport = nextTransport;
      callbacks.onTransportChange?.(transport);
    }
  };

  const resetHeartbeat = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
    }
    heartbeatTimer = setTimeout(() => {
      callbacks.onHeartbeatTimeout?.();
      if (!paused && !closed) {
        scheduleReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS + HEARTBEAT_GRACE_MS);
  };

  const stopPollingFallback = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const cleanup = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (drainTimer) {
      clearInterval(drainTimer);
      drainTimer = null;
    }
    stopPollingFallback();
  };

  const scheduleReconnect = () => {
    cleanup();
    if (closed || paused) {
      return;
    }
    const delay = RETRY_DELAYS[Math.min(reconnectAttempt, RETRY_DELAYS.length - 1)];
    callbacks.onReconnectSchedule?.(reconnectAttempt + 1, delay);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      start();
    }, delay);
  };

  const processEvent = (name: AutoImproveStreamEventName, event: MessageEvent<string>) => {
    if (event.lastEventId) {
      lastEventId = event.lastEventId;
    }
    if (name === HEARTBEAT_EVENT) {
      callbacks.onEvent?.(HEARTBEAT_EVENT, event);
      resetHeartbeat();
    } else {
      callbacks.onEvent?.(name, event);
    }
  };

  const drainQueue = () => {
    if (eventQueue.length === 0) {
      if (drainTimer) {
        clearInterval(drainTimer);
        drainTimer = null;
      }
      return;
    }

    const batch = eventQueue.splice(0, batchSize);
    batch.forEach(({ name, event }) => {
      processEvent(name, event);
    });
  };

  const enqueueEvent = (name: AutoImproveStreamEventName, event: MessageEvent<string>) => {
    if (eventQueue.length >= MAX_BUFFER_SIZE) {
      eventQueue.splice(0, eventQueue.length - MAX_BUFFER_SIZE + 1);
      callbacks.onBackpressure?.(eventQueue.length);
    }
    eventQueue.push({ name, event });
    if (!drainTimer) {
      drainTimer = setInterval(drainQueue, QUEUE_DRAIN_INTERVAL_MS);
    }
  };

  const derivePollingUrl = () => {
    const targetUrl = new URL(url, window.location.origin);
    if (targetUrl.pathname.endsWith('/stream')) {
      targetUrl.pathname = targetUrl.pathname.replace(/\/stream$/, '/events');
    }
    return targetUrl;
  };

  const pollEvents = async () => {
    if (closed || paused) {
      return;
    }

    try {
      const pollUrl = derivePollingUrl();
      if (lastEventId) {
        pollUrl.searchParams.set('lastEventId', lastEventId);
      } else if (sinceOverride) {
        pollUrl.searchParams.set('since', sinceOverride);
      }
      pollUrl.searchParams.set('limit', String(MAX_EVENTS_PER_SECOND));

      const response = await fetch(pollUrl.toString(), { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Polling fallback failed with status ${response.status}`);
      }

      const payload = await response.json();
      if (Array.isArray(payload?.events)) {
        payload.events.forEach((rawEvent: any) => {
          const eventName = (rawEvent?.eventName || rawEvent?.type || 'message') as AutoImproveStreamEventName;
          const messageEvent = new MessageEvent(eventName, {
            data: JSON.stringify(rawEvent),
            lastEventId: rawEvent?.id ?? ''
          });
          enqueueEvent(eventName, messageEvent);
        });
      }
    } catch (error) {
      console.error('❌ [AutoImproveStream] Polling fallback error:', error);
      callbacks.onError?.(new Event('error'));
    } finally {
      if (!closed && !paused) {
        pollTimer = setTimeout(pollEvents, POLL_INTERVAL_MS);
      }
    }
  };

  const startPollingFallback = () => {
    if (pollTimer || closed) {
      return;
    }
    notifyTransportChange('poll');
    console.warn('⚠️ [AutoImproveStream] Falling back to polling transport');
    stopPollingFallback();
    pollEvents();
  };

  const start = () => {
    if (closed || paused) {
      return;
    }

    cleanup();
    stopPollingFallback();
    notifyTransportChange('sse');

    const targetUrl = new URL(url, window.location.origin);
    const sinceParam = sinceOverride ?? lastEventId;
    if (sinceParam) {
      targetUrl.searchParams.set('since', sinceParam);
    }

    const init: EventSourceInit = { withCredentials: true };

    const lastEventHeader = sinceParam ?? lastEventId;
    if (lastEventHeader) {
      // EventSource standard does not support headers, but many backends accept Last-Event-ID via query.
      targetUrl.searchParams.set('lastEventId', lastEventHeader);
    }

    if (Object.keys(headers).length > 0) {
      // Some browsers (and polyfills) support passing headers via a non-standard `headers` option.
      // We cast here so TypeScript is aware of the potential property.
      (init as EventSourceInit & { headers?: Record<string, string> }).headers = headers;
    }

    const source = new EventSource(targetUrl.toString(), init);
    eventSource = source;

    source.onopen = (event) => {
      reconnectAttempt = 0;
      consecutiveErrors = 0;
      notifyTransportChange('sse');
      stopPollingFallback();
      resetHeartbeat();
      callbacks.onOpen?.(event);
    };

    source.onerror = (event) => {
      callbacks.onError?.(event);
      consecutiveErrors += 1;
      if (closed || paused) {
        return;
      }
      // Allow the browser to attempt auto-reconnect first; if it closes, schedule manual reconnect.
      if (source.readyState === EventSource.CLOSED) {
        scheduleReconnect();
      }
      if (consecutiveErrors >= POLL_RECONNECT_THRESHOLD && !pollTimer) {
        startPollingFallback();
      }
    };

    source.onmessage = (event) => {
      enqueueEvent('message', event);
      resetHeartbeat();
    };

    const typedEvents: AutoImproveStreamEventName[] = [
      'status',
      'action',
      'problem',
      'decision',
      'log',
      'metric',
      'error',
      HEARTBEAT_EVENT,
    ];

    typedEvents.forEach((eventName) => {
      source.addEventListener(eventName, (event) => {
        enqueueEvent(eventName, event as MessageEvent<string>);
      });
    });
  };

  const pause = () => {
    if (paused || closed) {
      return;
    }
    paused = true;
    cleanup();
    callbacks.onClose?.();
  };

  const resume = () => {
    if (!paused || closed) {
      return;
    }
    paused = false;
    start();
  };

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    cleanup();
    callbacks.onClose?.();
  };

  start();

  return {
    pause,
    resume,
    close,
    isPaused: () => paused,
    getLastEventId: () => lastEventId,
    getTransport: () => transport,
  };
}

export function useAutoImproveStream(
  url: string | null,
  callbacks: AutoImproveStreamCallbacks,
  options: StartOptions = {},
) {
  const controllerRef = useRef<AutoImproveStreamController | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [transport, setTransport] = useState<'sse' | 'poll'>('sse');
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const mergedCallbacks = useMemo<AutoImproveStreamCallbacks>(() => ({
    onOpen: (event) => callbacksRef.current.onOpen?.(event),
    onClose: () => callbacksRef.current.onClose?.(),
    onError: (event) => callbacksRef.current.onError?.(event),
    onEvent: (name, event) => callbacksRef.current.onEvent?.(name, event),
    onReconnectSchedule: (attempt, delayMs) => callbacksRef.current.onReconnectSchedule?.(attempt, delayMs),
    onHeartbeatTimeout: () => callbacksRef.current.onHeartbeatTimeout?.(),
    onBackpressure: (size) => callbacksRef.current.onBackpressure?.(size),
    onTransportChange: (mode) => {
      setTransport(mode);
      callbacksRef.current.onTransportChange?.(mode);
    }
  }), []);

  useEffect(() => {
    if (!url) {
      controllerRef.current?.close();
      controllerRef.current = null;
      return () => undefined;
    }

    controllerRef.current = connectAutoImproveStream(url, mergedCallbacks, options);
    setIsPaused(controllerRef.current.isPaused());
    setTransport(controllerRef.current.getTransport());

    return () => {
      controllerRef.current?.close();
      controllerRef.current = null;
    };
  }, [url, mergedCallbacks, options]);

  const pause = () => {
    controllerRef.current?.pause();
    setIsPaused(true);
  };

  const resume = () => {
    controllerRef.current?.resume();
    setIsPaused(Boolean(controllerRef.current?.isPaused()));
  };

  return {
    pause,
    resume,
    isPaused,
    lastEventId: controllerRef.current?.getLastEventId() ?? null,
    transport
  };
}

import { devConsoleEventBus, type DevConsoleConnectionStatus } from '@/lib/devConsoleEventBus';

export type AutoImproveStreamEventName =
  | 'heartbeat'
  | 'message'
  | 'status'
  | 'problem'
  | 'decision'
  | 'action'
  | 'metric'
  | 'update'
  | 'warning'
  | 'complete';

interface AutoImproveStreamOptions {
  onOpen?: () => void;
  onClose?: () => void;
  onTransportChange?: (mode: 'sse' | 'poll') => void;
  onBackpressure?: (size: number) => void;
  onError?: (error: unknown) => void;
  onEvent?: (eventName: AutoImproveStreamEventName, event: MessageEvent) => void;
  onHeartbeatTimeout?: () => void;
}

export interface AutoImproveStreamController {
  close: () => void;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  getTransport: () => 'sse' | 'poll';
}

const HEARTBEAT_TIMEOUT_MS = 30_000;
const RETRY_BASE_DELAY_MS = 5_000;
const RETRY_MAX_DELAY_MS = 60_000;

const STREAM_EVENT_NAMES: AutoImproveStreamEventName[] = [
  'heartbeat',
  'message',
  'status',
  'problem',
  'decision',
  'action',
  'metric',
  'update',
  'warning',
  'complete',
];

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const joinPaths = (...parts: Array<string | undefined>) => {
  const filtered = parts.filter(Boolean) as string[];
  if (!filtered.length) {
    return '';
  }

  const [first, ...rest] = filtered;
  const firstPart = first.replace(/\/+$/, '');
  const restParts = rest.map((part) => part.replace(/^\/+/, '').replace(/\/+$/, ''));
  return [firstPart, ...restParts.filter(Boolean)].join('/');
};

const resolveStreamUrl = (input?: string): string => {
  const envBase = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '/api';
  const defaultPath = joinPaths(envBase, 'console/events');
  const candidate = input && input.trim() ? input.trim() : defaultPath;

  if (isAbsoluteUrl(candidate)) {
    return candidate;
  }

  if (typeof window === 'undefined') {
    return candidate;
  }

  if (candidate.startsWith('/')) {
    return joinPaths(window.location.origin, candidate);
  }

  const base = isAbsoluteUrl(envBase)
    ? envBase
    : joinPaths(window.location.origin, envBase.startsWith('/') ? envBase : `/${envBase}`);

  return joinPaths(base, candidate);
};

export const connectAutoImproveStream = (
  url?: string,
  options: AutoImproveStreamOptions = {},
  _requestInit?: RequestInit,
): AutoImproveStreamController => {
  const targetUrl = resolveStreamUrl(url);
  const shouldEmitToBus = targetUrl.includes('/console/events');
  const emitStatus = (status: DevConsoleConnectionStatus, attempt: number) => {
    if (!shouldEmitToBus) {
      return;
    }
    devConsoleEventBus.emit({
      kind: 'status',
      status,
      attempt,
      timestamp: Date.now(),
    });
  };
  let eventSource: EventSource | null = null;
  let paused = false;
  let transport: 'sse' | 'poll' = 'sse';
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;
  let explicitlyClosed = false;
  let releaseListeners: (() => void) | null = null;

  const clearHeartbeatTimer = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const scheduleHeartbeatTimer = () => {
    clearHeartbeatTimer();
    heartbeatTimer = setTimeout(() => {
      options.onHeartbeatTimeout?.();
      emitStatus('retrying', retryAttempt + 1);
      restart();
    }, HEARTBEAT_TIMEOUT_MS);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const cleanupEventSource = () => {
    if (releaseListeners) {
      releaseListeners();
      releaseListeners = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    clearHeartbeatTimer();
    clearReconnectTimer();
  };

  const dispatchEvent = (eventName: AutoImproveStreamEventName, event: MessageEvent) => {
    scheduleHeartbeatTimer();
    options.onEvent?.(eventName, event);
    if (shouldEmitToBus) {
      devConsoleEventBus.emit({
        kind: 'event',
        eventName,
        event,
        receivedAt: Date.now(),
      });
    }
  };

  const connect = () => {
    if (paused || explicitlyClosed) {
      return;
    }

    cleanupEventSource();
    emitStatus('connecting', retryAttempt);

    const source = new EventSource(targetUrl, { withCredentials: true });

    const handleOpen = () => {
      retryAttempt = 0;
      emitStatus('connected', retryAttempt);
      scheduleHeartbeatTimer();
      options.onOpen?.();
      if (transport !== 'sse') {
        transport = 'sse';
        options.onTransportChange?.('sse');
      }
    };

    const handleError = (event: Event) => {
      options.onError?.(event);
      if (explicitlyClosed || paused) {
        return;
      }
      emitStatus('retrying', retryAttempt + 1);
      restart();
    };

    const eventListeners: Array<{ name: AutoImproveStreamEventName; handler: EventListener }> = [];

    STREAM_EVENT_NAMES.forEach((name) => {
      const handler = (event: Event) => {
        dispatchEvent(name, event as MessageEvent);
      };
      source.addEventListener(name, handler);
      eventListeners.push({ name, handler });
    });

    source.addEventListener('open', handleOpen);
    source.addEventListener('error', handleError);

    releaseListeners = () => {
      source.removeEventListener('open', handleOpen);
      source.removeEventListener('error', handleError);
      eventListeners.forEach(({ name, handler }) => {
        source.removeEventListener(name, handler);
      });
    };

    eventSource = source;
  };

  const scheduleReconnect = () => {
    if (paused || explicitlyClosed) {
      return;
    }

    clearReconnectTimer();
    retryAttempt += 1;
    const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (retryAttempt - 1), RETRY_MAX_DELAY_MS);
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  };

  const restart = () => {
    const wasActive = Boolean(eventSource);
    cleanupEventSource();
    if (wasActive && !explicitlyClosed && !paused) {
      options.onClose?.();
    }
    scheduleReconnect();
  };

  const close = () => {
    explicitlyClosed = true;
    cleanupEventSource();
    options.onClose?.();
    emitStatus('disconnected', retryAttempt);
  };

  const pause = () => {
    if (paused) {
      return;
    }

    paused = true;
    transport = 'poll';
    emitStatus('disconnected', retryAttempt);
    options.onTransportChange?.('poll');
    cleanupEventSource();
  };

  const resume = () => {
    if (!paused) {
      return;
    }

    paused = false;
    transport = 'sse';
    emitStatus('connecting', retryAttempt);
    options.onTransportChange?.('sse');
    explicitlyClosed = false;
    connect();
  };

  connect();

  return {
    close,
    disconnect: close,
    pause,
    resume,
    isPaused: () => paused,
    getTransport: () => transport,
  };
};


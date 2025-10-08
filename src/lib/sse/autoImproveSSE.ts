export type AutoImproveStreamEventName =
  | 'status'
  | 'problem'
  | 'decision'
  | 'action'
  | 'metric'
  | 'error'
  | 'log'
  | 'message'
  | 'heartbeat';

export interface AutoImproveStreamHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error?: unknown) => void;
  onEvent?: (eventName: AutoImproveStreamEventName, event: MessageEvent<string>) => void;
  onTransportChange?: (mode: 'sse' | 'poll') => void;
  onBackpressure?: (size: number) => void;
  onHeartbeatTimeout?: () => void;
}

export interface AutoImproveStreamController {
  close: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  getTransport: () => 'sse' | 'poll';
}

const HEARTBEAT_TIMEOUT_MS = 15000;

export const connectAutoImproveStream = (
  url: string,
  handlers: AutoImproveStreamHandlers,
): AutoImproveStreamController => {
  let source: EventSource | null = null;
  let paused = false;
  let transport: 'sse' | 'poll' = 'sse';
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  const clearHeartbeatTimer = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const armHeartbeatTimer = () => {
    clearHeartbeatTimer();
    if (!handlers.onHeartbeatTimeout) {
      return;
    }
    heartbeatTimer = setTimeout(() => {
      handlers.onHeartbeatTimeout?.();
    }, HEARTBEAT_TIMEOUT_MS);
  };

  const attachListeners = (eventSource: EventSource) => {
    eventSource.onopen = () => {
      handlers.onOpen?.();
      transport = 'sse';
      handlers.onTransportChange?.(transport);
      armHeartbeatTimer();
    };

    eventSource.onerror = (error) => {
      handlers.onError?.(error);
      armHeartbeatTimer();
    };

    const forward = (eventName: AutoImproveStreamEventName) => (event: MessageEvent<string>) => {
      if (eventName === 'heartbeat') {
        armHeartbeatTimer();
      }
      handlers.onEvent?.(eventName, event);
    };

    const knownEvents: AutoImproveStreamEventName[] = [
      'message',
      'status',
      'problem',
      'decision',
      'action',
      'metric',
      'error',
      'log',
      'heartbeat',
    ];

    knownEvents.forEach((eventName) => {
      eventSource.addEventListener(eventName, forward(eventName));
    });
  };

  const openSource = () => {
    if (paused) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      transport = 'poll';
      handlers.onTransportChange?.(transport);
      return;
    }

    source?.close();
    source = new EventSource(url);
    attachListeners(source);
  };

  const closeSource = () => {
    clearHeartbeatTimer();
    source?.close();
    source = null;
  };

  openSource();

  return {
    close: () => {
      closeSource();
      paused = true;
      handlers.onClose?.();
    },
    pause: () => {
      paused = true;
      closeSource();
    },
    resume: () => {
      if (!paused) {
        return;
      }
      paused = false;
      openSource();
    },
    isPaused: () => paused,
    getTransport: () => transport,
  };
};

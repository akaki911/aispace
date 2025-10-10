export type DevConsoleConnectionStatus = 'connecting' | 'connected' | 'retrying' | 'disconnected';

export interface DevConsoleStreamEventDetail {
  kind: 'event';
  eventName: string;
  event: MessageEvent;
  receivedAt: number;
}

export interface DevConsoleStreamStatusDetail {
  kind: 'status';
  status: DevConsoleConnectionStatus;
  attempt: number;
  timestamp: number;
}

export type DevConsoleEventDetail = DevConsoleStreamEventDetail | DevConsoleStreamStatusDetail;

const EVENT_NAME = 'devconsole:event';

const createFallbackEventTarget = (): EventTarget => {
  const listeners = new Set<EventListener>();
  const listenerMap = new WeakMap<EventListenerOrEventListenerObject, EventListener>();

  const resolveListener = (listener: EventListenerOrEventListenerObject): EventListener => {
    if (typeof listener === 'function') {
      return listener as EventListener;
    }

    const existing = listenerMap.get(listener);
    if (existing) {
      return existing;
    }

    const wrapped: EventListener = (event) => listener.handleEvent(event);
    listenerMap.set(listener, wrapped);
    return wrapped;
  };

  return {
    addEventListener(_type, listener) {
      if (!listener) {
        return;
      }
      listeners.add(resolveListener(listener));
    },
    removeEventListener(_type, listener) {
      if (!listener) {
        return;
      }
      const resolved = resolveListener(listener);
      listeners.delete(resolved);
    },
    dispatchEvent(event) {
      listeners.forEach((listener) => listener(event));
      return true;
    },
  } satisfies EventTarget;
};

const eventTarget: EventTarget =
  typeof window !== 'undefined' && typeof window.EventTarget === 'function'
    ? new EventTarget()
    : createFallbackEventTarget();

export const devConsoleEventBus = {
  addListener(handler: (detail: DevConsoleEventDetail) => void) {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<DevConsoleEventDetail>;
      handler(customEvent.detail);
    };
    eventTarget.addEventListener(EVENT_NAME, listener);
    return () => {
      eventTarget.removeEventListener(EVENT_NAME, listener);
    };
  },
  emit(detail: DevConsoleEventDetail) {
    eventTarget.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  },
};


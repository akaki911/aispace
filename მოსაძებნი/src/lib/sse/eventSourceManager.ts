const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 5000;

type MessageHandler = (event: MessageEvent<string>) => void;
type EventHandler = (event: Event) => void;

export interface SSEHandlers {
  onMessage?: MessageHandler;
  onError?: EventHandler;
  onOpen?: EventHandler;
}

export interface SSEConnectionOptions {
  withCredentials?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}

interface ConnectionEntry {
  key: string;
  baseUrl: string;
  options: SSEConnectionOptions;
  handlers: Map<number, SSEHandlers>;
  source: EventSource | null;
  reconnectDelay: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  isConnecting: boolean;
  lastEventId?: string;
}

const isBrowserEnvironment = () => typeof window !== 'undefined' && typeof window.EventSource !== 'undefined';

const normalizeBoolean = (value: boolean | string | number | null | undefined): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return undefined;
    }
    return value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
};

const buildQueryString = (params?: SSEConnectionOptions['query']) => {
  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();
  Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      const normalized = normalizeBoolean(value);
      if (normalized !== undefined) {
        searchParams.set(key, normalized);
      }
    });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const resolveUrl = (baseUrl: string): string => {
  if (!isBrowserEnvironment()) {
    return baseUrl;
  }

  try {
    return new URL(baseUrl, window.location.origin).toString();
  } catch (error) {
    console.warn('⚠️ [SSE] Failed to resolve URL, using raw value', error);
    return baseUrl;
  }
};

class EventSourceManager {
  private connections = new Map<string, ConnectionEntry>();

  private subscriptionCounter = 0;

  subscribe(url: string, handlers: SSEHandlers = {}, options: SSEConnectionOptions = {}): () => void {
    if (!isBrowserEnvironment()) {
      console.warn('⚠️ [SSE] EventSource not available in this environment.');
      return () => {};
    }

    const key = this.buildKey(url, options);
    let entry = this.connections.get(key);

    if (!entry) {
      entry = this.createEntry(key, url, options);
      this.connections.set(key, entry);
      this.open(entry);
    }

    const subscriptionId = ++this.subscriptionCounter;
    entry.handlers.set(subscriptionId, handlers);

    if (entry.source && entry.source.readyState === EventSource.OPEN && handlers.onOpen) {
      handlers.onOpen(new Event('open'));
    }

    if (!entry.source && !entry.isConnecting) {
      this.open(entry);
    }

    return () => {
      this.unsubscribe(entry!, subscriptionId);
    };
  }

  private unsubscribe(entry: ConnectionEntry, subscriptionId: number) {
    entry.handlers.delete(subscriptionId);

    if (entry.handlers.size > 0) {
      return;
    }

    this.teardown(entry);
    this.connections.delete(entry.key);
  }

  private createEntry(key: string, url: string, options: SSEConnectionOptions): ConnectionEntry {
    return {
      key,
      baseUrl: url,
      options,
      handlers: new Map(),
      source: null,
      reconnectDelay: INITIAL_RECONNECT_DELAY,
      reconnectTimer: null,
      isConnecting: false,
      lastEventId: undefined,
    };
  }

  private buildKey(url: string, options: SSEConnectionOptions): string {
    const credentialKey = options.withCredentials === false ? 'omit' : 'include';
    const queryKey = buildQueryString(options.query);
    return `${url}::${credentialKey}::${queryKey}`;
  }

  private buildTargetUrl(entry: ConnectionEntry): string {
    const base = resolveUrl(entry.baseUrl);
    const query = buildQueryString(entry.options.query);

    if (!query && !entry.lastEventId) {
      return base;
    }

    const url = new URL(base);

    if (query) {
      const queryParams = new URLSearchParams(query.replace(/^[?]/, ''));
      queryParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }

    if (entry.lastEventId && !url.searchParams.has('lastEventId')) {
      url.searchParams.set('lastEventId', entry.lastEventId);
    }

    return url.toString();
  }

  private open(entry: ConnectionEntry) {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (entry.source || entry.isConnecting) {
      return;
    }

    const targetUrl = this.buildTargetUrl(entry);
    entry.isConnecting = true;

    try {
      const eventSource = new EventSource(targetUrl, {
        withCredentials: entry.options.withCredentials !== false,
      });

      entry.source = eventSource;
      entry.reconnectDelay = INITIAL_RECONNECT_DELAY;

      if (entry.reconnectTimer) {
        clearTimeout(entry.reconnectTimer);
        entry.reconnectTimer = null;
      }

      eventSource.onopen = (event) => {
        entry.isConnecting = false;
        entry.reconnectDelay = INITIAL_RECONNECT_DELAY;
        entry.handlers.forEach((handler) => handler.onOpen?.(event));
      };

      eventSource.onmessage = (event) => {
        if (event.lastEventId) {
          entry.lastEventId = event.lastEventId;
        }

        entry.handlers.forEach((handler) => handler.onMessage?.(event));
      };

      eventSource.onerror = (event) => {
        entry.handlers.forEach((handler) => handler.onError?.(event));

        if (eventSource.readyState === EventSource.CLOSED) {
          entry.source = null;
        }

        if (eventSource.readyState !== EventSource.OPEN) {
          eventSource.close();
          entry.source = null;
        }

        this.scheduleReconnect(entry);
      };
    } catch (error) {
      entry.isConnecting = false;
      console.error('❌ [SSE] Failed to open EventSource', error);
      entry.handlers.forEach((handler) => handler.onError?.(error as Event));
      this.scheduleReconnect(entry);
    }
  }

  private scheduleReconnect(entry: ConnectionEntry) {
    if (entry.reconnectTimer || entry.handlers.size === 0) {
      return;
    }

    if (entry.source) {
      entry.source.close();
      entry.source = null;
    }

    entry.isConnecting = false;

    const delay = entry.reconnectDelay;
    entry.reconnectDelay = Math.min(Math.ceil(entry.reconnectDelay * 1.5), MAX_RECONNECT_DELAY);

    entry.reconnectTimer = setTimeout(() => {
      entry.reconnectTimer = null;
      this.open(entry);
    }, delay);
  }

  private teardown(entry: ConnectionEntry) {
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }

    if (entry.source) {
      entry.source.close();
      entry.source = null;
    }

    entry.isConnecting = false;
  }
}

export const sseManager = new EventSourceManager();

export type { EventSourceManager };

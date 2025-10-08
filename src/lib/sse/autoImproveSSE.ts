export type AutoImproveStreamEventName =
  | 'open'
  | 'message'
  | 'error'
  | 'status'
  | 'problem'
  | 'decision'
  | 'action'
  | 'metric'
  | 'heartbeat';

export interface AutoImproveStreamHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onHeartbeatTimeout?: () => void;
  onError?: () => void;
  onTransportChange?: (mode: 'sse' | 'poll') => void;
  onBackpressure?: (size: number) => void;
  onEvent?: (eventName: AutoImproveStreamEventName, event: MessageEvent) => void;
}

export interface AutoImproveStreamController {
  close(): void;
  disconnect(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  getTransport(): 'sse' | 'poll';
}

export const connectAutoImproveStream = (
  _url: string,
  handlers: AutoImproveStreamHandlers = {},
  _options?: { headers?: Record<string, string> },
): AutoImproveStreamController => {
  let paused = false;

  handlers.onOpen?.();
  handlers.onTransportChange?.('sse');

  const close = () => {
    handlers.onClose?.();
  };

  return {
    close,
    disconnect: close,
    pause() {
      paused = true;
      handlers.onTransportChange?.('poll');
    },
    resume() {
      paused = false;
      handlers.onTransportChange?.('sse');
    },
    isPaused() {
      return paused;
    },
    getTransport() {
      return paused ? 'poll' : 'sse';
    },
  };
};

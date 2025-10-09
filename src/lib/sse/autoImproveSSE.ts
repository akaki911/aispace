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

interface AutoImproveStreamController {
  close: () => void;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  getTransport: () => 'sse' | 'poll';
}

export const connectAutoImproveStream = (
  _url: string,
  options: AutoImproveStreamOptions = {},
  _requestInit?: RequestInit,
): AutoImproveStreamController => {
  const abortController = new AbortController();
  let paused = false;
  let transport: 'sse' | 'poll' = 'sse';

  options.onOpen?.();

  const disconnect = () => {
    abortController.abort();
    options.onClose?.();
  };

  return {
    close: disconnect,
    disconnect,
    pause: () => {
      paused = true;
      transport = 'poll';
      options.onTransportChange?.('poll');
    },
    resume: () => {
      paused = false;
      transport = 'sse';
      options.onTransportChange?.('sse');
    },
    isPaused: () => paused,
    getTransport: () => transport,
  };
};

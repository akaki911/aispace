export type AutoImproveStreamEventName = 'update' | 'warning' | 'complete';

interface AutoImproveStreamOptions {
  onTransportChange?: (mode: string) => void;
  onBackpressure?: (size: number) => void;
  onEvent?: (eventName: AutoImproveStreamEventName, event: MessageEvent) => void;
}

export const connectAutoImproveStream = (_options: AutoImproveStreamOptions = {}) => {
  const abortController = new AbortController();

  const disconnect = () => {
    abortController.abort();
  };

  return { disconnect };
};

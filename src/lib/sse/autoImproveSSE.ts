export type AutoImproveStreamEventName = 'open' | 'message' | 'error';

export const connectAutoImproveStream = () => {
  const disconnect = () => {
    // no-op stub disconnect
  };

  return {
    disconnect,
  };
};

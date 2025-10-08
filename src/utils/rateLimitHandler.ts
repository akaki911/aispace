export const rateLimitManager = {
  wrap: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  isPollingDisabled: (_key: string) => false,
  getBackoffDelay: (_key: string) => 0,
};

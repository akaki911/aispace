export const rateLimitManager = {
  wrap: <T extends (...args: any[]) => any>(fn: T): T => fn,
};

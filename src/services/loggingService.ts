export const logger = {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => console.debug(...args),
  async logTestsListRetry(_retries: number, _context?: Record<string, unknown>) {
    return Promise.resolve();
  },
  async logTestsListStatus(_status: string, _context?: Record<string, unknown>) {
    return Promise.resolve();
  },
  async logTestsRun(_stage: string, _context?: Record<string, unknown>) {
    return Promise.resolve();
  },
};

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  logTestsListRetry: (attempt: number, metadata?: Record<string, unknown>) => Promise<void>;
  logTestsListStatus: (status: string, metadata?: Record<string, unknown>) => Promise<void>;
  logTestsRun: (event: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const makeLogger = (): Logger => ({
  debug: (...args: unknown[]) => console.debug('[AISpace]', ...args),
  info: (...args: unknown[]) => console.info('[AISpace]', ...args),
  warn: (...args: unknown[]) => console.warn('[AISpace]', ...args),
  error: (...args: unknown[]) => console.error('[AISpace]', ...args),
  logTestsListRetry: async (attempt, metadata) => {
    console.info('[AISpace][Tests] list retry', attempt, metadata);
  },
  logTestsListStatus: async (status, metadata) => {
    console.info('[AISpace][Tests] list status', status, metadata);
  },
  logTestsRun: async (event, metadata) => {
    console.info('[AISpace][Tests] run event', event, metadata);
  },
});

export const logger = makeLogger();

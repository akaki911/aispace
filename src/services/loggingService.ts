type LogContext = Record<string, unknown>;

type TestsRunEvent =
  | 'start-request'
  | 'start-failed'
  | 'start-error'
  | 'started'
  | 'stop-request'
  | 'stop-failed'
  | 'stop-confirmed'
  | 'stop-error'
  | 'status';

const logAsync = async (label: string, context?: LogContext) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug(`[logger] ${label}`, context ?? {});
  }
};

export const logger = {
  logTestsListRetry: (retries: number, context?: LogContext) => logAsync(`tests:list:retry:${retries}`, context),
  logTestsListStatus: (status: 'ok' | 'empty' | 'error', context?: LogContext) =>
    logAsync(`tests:list:status:${status}`, context),
  logTestsRun: (event: TestsRunEvent, context?: LogContext) => logAsync(`tests:run:${event}`, context),
};

export default logger;

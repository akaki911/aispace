export interface ConsoleLogOptions {
  source?: string;
  line?: number | null;
  column?: number | null;
  type?: string;
  reason?: unknown;
}

export const consoleLogger = {
  addError(
    source: 'frontend' | 'backend' | 'ai' | string,
    message: string,
    error: Error,
    timeout: number,
    options: ConsoleLogOptions = {}
  ) {
    const payload = {
      source,
      message,
      timeout,
      ...options,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    };

    if (typeof console !== 'undefined') {
      console.error('[ConsoleLogger]', payload);
    }

    return payload;
  }
};

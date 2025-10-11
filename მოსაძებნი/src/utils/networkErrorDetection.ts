export interface NetworkErrorAnalysis {
  isNetworkError: boolean;
  code?: string;
  message?: string;
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
]);

const NETWORK_ERROR_FRAGMENTS = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'connection refused',
  'refused to connect',
  'socket hang up',
  'timed out',
];

export function analyzeNetworkError(error: unknown): NetworkErrorAnalysis {
  if (!error || typeof error !== 'object') {
    return { isNetworkError: false };
  }

  const candidate = error as { code?: unknown; message?: unknown; name?: unknown; cause?: unknown };
  const rawCode = (candidate.code ?? (candidate.cause as { code?: unknown } | undefined)?.code);
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const message = typeof candidate.message === 'string' ? candidate.message : undefined;
  const lowerMessage = message?.toLowerCase() ?? '';
  const name = typeof candidate.name === 'string' ? candidate.name : undefined;

  if (code && NETWORK_ERROR_CODES.has(code)) {
    return { isNetworkError: true, code, message };
  }

  if (name === 'AbortError') {
    return { isNetworkError: true, code: code ?? 'ABORT_ERR', message };
  }

  if (lowerMessage) {
    if (NETWORK_ERROR_FRAGMENTS.some(fragment => lowerMessage.includes(fragment))) {
      return { isNetworkError: true, code, message };
    }
  }

  if (name === 'TypeError' && lowerMessage.includes('fetch')) {
    return { isNetworkError: true, code: code ?? 'TYPEERROR_FETCH', message };
  }

  return { isNetworkError: false, code, message };
}

export function enhanceWithNetworkMetadata<T extends Error & {
  code?: string;
  status?: number;
  retryAfter?: number;
  isNetworkError?: boolean;
}>(error: T, analysis?: NetworkErrorAnalysis, defaultRetryAfter = 5000): T {
  const details = analysis ?? analyzeNetworkError(error);
  if (!details.isNetworkError) {
    return error;
  }

  if (details.code && !error.code) {
    error.code = details.code;
  }

  if (typeof error.status !== 'number') {
    error.status = 0;
  }

  error.isNetworkError = true;

  if (typeof error.retryAfter !== 'number' || Number.isNaN(error.retryAfter)) {
    error.retryAfter = defaultRetryAfter;
  }

  return error;
}

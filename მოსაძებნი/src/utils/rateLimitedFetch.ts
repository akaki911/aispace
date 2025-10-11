import type { RateLimitConfig } from './rateLimitHandler';
import { rateLimitManager } from './rateLimitHandler';
import { fetchWithDirectAiFallback } from './aiFallback';
import { getAdminAuthHeaders } from './adminToken';
import { mergeHeaders } from './httpHeaders';

interface RateLimitedFetchOptions extends RequestInit {
  /**
   * Unique key used by the rate limit manager to group requests.
   * Typically matches the SWR cache key prefix or API endpoint identifier.
   */
  key: string;
  /**
   * Optional overrides for the rate limiting configuration.
   */
  rateLimit?: Partial<RateLimitConfig>;
  /**
   * Milliseconds to keep the successful response in the shared cache.
   * Defaults to 0 to avoid masking fresh data for realtime feeds.
   */
  cacheTTL?: number;
  /**
   * Set to false to receive the raw Response object instead of parsed JSON.
   */
  parseJson?: boolean;
  /**
   * Maximum retry attempts for retryable responses (HTTP 429/5xx).
   * Defaults to 3 attempts after the initial try.
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds for exponential backoff.
   */
  retryBaseDelayMs?: number;
  /**
   * Maximum delay in milliseconds for exponential backoff.
   */
  retryMaxDelayMs?: number;
  /**
   * Randomisation factor applied to the computed backoff delay (0-1 range).
   */
  retryJitter?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 400;
const DEFAULT_RETRY_MAX_DELAY_MS = 8000;
const DEFAULT_RETRY_JITTER = 0.35;

const parseRetryAfter = (headerValue: string | null): number | undefined => {
  if (!headerValue) {
    return undefined;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds) * 1000;
  }

  const retryDate = new Date(headerValue);
  const retryMs = retryDate.getTime() - Date.now();
  return Number.isFinite(retryMs) ? Math.max(0, retryMs) : undefined;
};

const attachRateLimitMetadata = (error: Error, response: Response) => {
  const enhanced = error as Error & {
    status?: number;
    headers?: Response['headers'];
    retryAfter?: number;
  };

  enhanced.status = response.status;
  enhanced.headers = response.headers;
  enhanced.retryAfter = parseRetryAfter(response.headers.get('Retry-After'));

  return enhanced;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryError = (error: any): boolean => {
  const status = typeof error?.status === 'number' ? error.status : undefined;
  if (!status) {
    return false;
  }

  if (status === 429) {
    return true;
  }

  return status >= 500 && status < 600;
};

const computeBackoffDelay = (
  attempt: number,
  retryAfter: number | undefined,
  baseDelay: number,
  maxDelay: number,
  jitter: number,
) => {
  if (typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter, maxDelay);
  }

  const exponential = baseDelay * 2 ** attempt;
  const capped = Math.min(Math.max(exponential, baseDelay), maxDelay);
  const jitterRange = Math.max(0, Math.min(jitter, 1));

  if (jitterRange === 0) {
    return capped;
  }

  const min = capped * (1 - jitterRange);
  const max = capped * (1 + jitterRange);
  return Math.max(baseDelay, Math.min(maxDelay, min + Math.random() * (max - min)));
};

export const rateLimitedJsonFetch = async <T = unknown>(
  url: string,
  { key, rateLimit, cacheTTL = 0, parseJson = true, ...init }: RateLimitedFetchOptions,
): Promise<T> => {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
    retryJitter = DEFAULT_RETRY_JITTER,
    ...requestOverrides
  } = init;

  const requestInit: RequestInit = {
    ...requestOverrides,
    headers: mergeHeaders({ Accept: 'application/json' }, getAdminAuthHeaders(), requestOverrides.headers),
  };

  const performRequest = async (): Promise<T> => {
    const { response } = await fetchWithDirectAiFallback(url, requestInit);

    if (response.status === 429) {
      throw attachRateLimitMetadata(new Error('HTTP 429: Too Many Requests'), response);
    }

    if (!response.ok) {
      throw attachRateLimitMetadata(
        new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`),
        response,
      );
    }

    if (!parseJson) {
      return response as unknown as T;
    }

    return (await response.json()) as T;
  };

  const executeRequest = async () => {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        return await performRequest();
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!shouldRetryError(error) || attempt >= maxRetries) {
          throw lastError;
        }

        const delay = computeBackoffDelay(
          attempt,
          typeof error?.retryAfter === 'number' ? error.retryAfter : undefined,
          retryBaseDelayMs,
          retryMaxDelayMs,
          retryJitter,
        );

        await sleep(delay);
        attempt += 1;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  };

  if (!key) {
    return executeRequest();
  }

  return rateLimitManager.execute(key, executeRequest, rateLimit, cacheTTL);
};

export type { RateLimitedFetchOptions };

import { rateLimitManager } from './rateLimitHandler';

interface RateLimitOptions {
  maxRequests: number;
  timeWindow: number;
  retryDelay?: number;
}

export interface RateLimitedRequestOptions extends RequestInit {
  key: string;
  cacheTTL?: number;
  rateLimit?: RateLimitOptions;
}

interface CacheEntry<T> {
  timestamp: number;
  payload: T;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const requestLog = new Map<string, number[]>();

const getRequestLog = (key: string) => {
  const timestamps = requestLog.get(key) ?? [];
  const now = Date.now();
  const filtered = timestamps.filter((value) => now - value <= 60_000);
  requestLog.set(key, filtered);
  return filtered;
};

const recordRequest = (key: string) => {
  const timestamps = getRequestLog(key);
  timestamps.push(Date.now());
  requestLog.set(key, timestamps);
};

export async function rateLimitedJsonFetch<T>(url: string, options: RateLimitedRequestOptions): Promise<T> {
  const { key, cacheTTL, rateLimit, ...requestOptions } = options;

  if (cacheTTL && cacheTTL > 0) {
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.timestamp <= cacheTTL) {
      return cached.payload as T;
    }
  }

  if (rateLimit) {
    const timestamps = getRequestLog(key);
    const now = Date.now();
    const recent = timestamps.filter((value) => now - value <= rateLimit.timeWindow);
    if (recent.length >= rateLimit.maxRequests) {
      const delay = rateLimit.retryDelay ?? Math.min(rateLimit.timeWindow, 10_000);
      rateLimitManager.registerBackoff(key, delay);
      throw new Error(`Rate limit exceeded for ${key}`);
    }
  }

  recordRequest(key);

  const response = await fetch(url, requestOptions);

  if (response.status === 429) {
    const retryDelay = rateLimit?.retryDelay ?? 10_000;
    rateLimitManager.registerBackoff(key, retryDelay);
    throw new Error(`Rate limited fetching ${url}`);
  }

  if (!response.ok) {
    rateLimitManager.registerBackoff(key, rateLimit?.retryDelay ?? 2000);
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as T | null;
  if (payload === null) {
    throw new Error('Failed to parse JSON response');
  }

  responseCache.set(key, { timestamp: Date.now(), payload });
  rateLimitManager.reset(key);

  return payload;
}

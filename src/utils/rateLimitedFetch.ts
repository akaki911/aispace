export interface RateLimitedRequestInit extends RequestInit {
  key?: string;
  cacheTTL?: number;
  rateLimit?: {
    maxRequests: number;
    timeWindow: number;
    retryDelay?: number;
  };
}

export const rateLimitedJsonFetch = async <T = unknown>(
  _input: RequestInfo | URL,
  _init?: RateLimitedRequestInit,
): Promise<T> => {
  throw new Error('rateLimitedJsonFetch is unavailable in this build');
};

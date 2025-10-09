interface RateLimitedRequestInit extends RequestInit {
  key?: string;
  cacheTTL?: number;
  rateLimit?: {
    maxRequests?: number;
    timeWindow?: number;
    retryDelay?: number;
  };
}

export const rateLimitedJsonFetch = async <T>(input: RequestInfo, init?: RateLimitedRequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

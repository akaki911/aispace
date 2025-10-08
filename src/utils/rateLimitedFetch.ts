export const rateLimitedJsonFetch = async <T = unknown>(
  _input: RequestInfo | URL,
  _init?: RequestInit,
): Promise<T> => {
  throw new Error('rateLimitedJsonFetch is unavailable in this build');
};

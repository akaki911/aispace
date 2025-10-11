
import { useState, useCallback } from 'react';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}

export function useRetryFetch<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): FetchState<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = retryOptions;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithRetry = useCallback(async () => {
    setLoading(true);
    setError(null);

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Fetch attempt ${attempt + 1}/${maxRetries + 1}: ${url}`);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
        setLoading(false);
        console.log(`✅ Fetch successful on attempt ${attempt + 1}`);
        return;

      } catch (err) {
        lastError = err as Error;
        console.warn(`❌ Fetch attempt ${attempt + 1} failed:`, err);

        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * backoffFactor, maxDelay);
        }
      }
    }

    setError(lastError!.message);
    setLoading(false);
  }, [url, options, maxRetries, initialDelay, maxDelay, backoffFactor]);

  return { data, loading, error, retry: fetchWithRetry };
}

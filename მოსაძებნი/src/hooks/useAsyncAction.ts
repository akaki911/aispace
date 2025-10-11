
import { useState, useCallback } from 'react';

export interface AsyncActionOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  preventDuplicates?: boolean;
}

export const useAsyncAction = <T = any>(
  action: (...args: any[]) => Promise<T>,
  options: AsyncActionOptions = {}
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    // Prevent duplicate actions if enabled
    if (options.preventDuplicates && isLoading) {
      console.warn('🔄 Action already in progress, ignoring duplicate request');
      return null;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await action(...args);
      options.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options.onError?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [action, isLoading, options]);

  return {
    execute,
    isLoading,
    error,
    reset: () => {
      setError(null);
      setIsLoading(false);
    }
  };
};

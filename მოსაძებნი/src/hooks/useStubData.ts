import { useState, useEffect } from 'react';
import { User } from '../types/user';

// No stub data - all providers should be real

export const useStubData = (providerId: string | undefined) => {
  const [provider, setProvider] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.time('STUB: Provider data fetch');
    
    // No stub data available
    const timer = setTimeout(() => {
      setProvider(null);
      setError('No stub data available - use real providers only');
      setLoading(false);
      console.timeEnd('STUB: Provider data fetch');
    }, 100);

    return () => clearTimeout(timer);
  }, [providerId]);

  const updateProvider = async (updates: Partial<User>) => {
    console.time('STUB: Provider update');
    
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        console.timeEnd('STUB: Provider update');
        reject(new Error('Stub data not available'));
      }, 50); // update for testing
    });
  };

  return {
    provider,
    loading,
    error,
    updateProvider
  };
};
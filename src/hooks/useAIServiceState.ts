import { useEffect, useState } from 'react';

interface AIServiceState {
  status: 'online' | 'offline' | 'degraded';
  lastCheckedAt: string | null;
}

export const useAIServiceState = () => {
  const [state, setState] = useState<AIServiceState>({ status: 'online', lastCheckedAt: null });

  useEffect(() => {
    setState({ status: 'online', lastCheckedAt: new Date().toISOString() });
  }, []);

  return state;
};

export default useAIServiceState;

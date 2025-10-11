import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitHubConnectionStatus } from '../types';
import { buildAdminHeaders } from '../../../utils/adminToken';

interface GitHubConnectionHook {
  status: GitHubConnectionStatus;
  isLoading: boolean;
  error: string | null;
  connectOAuth: () => Promise<GitHubConnectionStatus | null>;
  savePAT: (token: string) => Promise<GitHubConnectionStatus | null>;
  test: () => Promise<GitHubConnectionStatus | null>;
  disconnect: () => Promise<GitHubConnectionStatus | null>;
  refreshStatus: () => Promise<GitHubConnectionStatus | null>;
}

const DEFAULT_STATUS: GitHubConnectionStatus = { connected: false };

type RequestFn = (signal: AbortSignal) => Promise<Response>;

export const useGitHubConnection = (): GitHubConnectionHook => {
  const [status, setStatus] = useState<GitHubConnectionStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runRequest = useCallback(
    async (requestFn: RequestFn): Promise<GitHubConnectionStatus | null> => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await requestFn(controller.signal);

        if (!response) {
          return null;
        }

        const contentType = response.headers.get('content-type') || '';
        const hasJson = contentType.includes('application/json');
        const payload: GitHubConnectionStatus | null = hasJson ? await response.json() : null;

        if (payload) {
          setStatus(payload);
          if (payload.error) {
            setError(payload.error);
          }
        } else {
          setStatus(DEFAULT_STATUS);
        }

        return payload;
      } catch (requestError) {
        if ((requestError as DOMException)?.name === 'AbortError') {
          return null;
        }

        const message = (requestError as Error)?.message || 'GitHub request failed';
        console.error('❌ GitHub connection request failed:', message);
        setError(message);
        setStatus(DEFAULT_STATUS);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    return runRequest((signal) =>
      fetch('/api/github/status', {
        method: 'GET',
        headers: buildAdminHeaders({ Accept: 'application/json' }),
        credentials: 'include',
        signal,
      }),
    );
  }, [runRequest]);

  const connectOAuth = useCallback(async () => {
    const result = await runRequest((signal) =>
      fetch('/api/github/connect', {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({}),
        signal,
      }),
    );

    if (result?.authorizationUrl && typeof window !== 'undefined') {
      window.open(result.authorizationUrl, '_blank', 'noopener');
    }

    return result;
  }, [runRequest]);

  const savePAT = useCallback(
    async (token: string) =>
      runRequest((signal) =>
        fetch('/api/github/connect', {
          method: 'POST',
          headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ token }),
          signal,
        }),
      ),
    [runRequest],
  );

  const test = useCallback(
    async () =>
      runRequest((signal) =>
        fetch('/api/github/test', {
          method: 'POST',
          headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
          credentials: 'include',
          signal,
        }),
      ),
    [runRequest],
  );

  const disconnect = useCallback(
    async () =>
      runRequest((signal) =>
        fetch('/api/github/disconnect', {
          method: 'POST',
          headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
          credentials: 'include',
          signal,
        }),
      ),
    [runRequest],
  );

  useEffect(() => {
    refreshStatus();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    connectOAuth,
    savePAT,
    test,
    disconnect,
    refreshStatus,
  };
};

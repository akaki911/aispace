import { useState, useEffect, useCallback } from 'react';

// Simple rate limiting
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests: number = 10, timeWindow: number = 120000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(10, 120000);

const isAbort = (e: any) => e?.name === 'AbortError' || e?.message?.includes('aborted');
const arr = <T>(v: T[] | undefined | null) => (Array.isArray(v) ? v : []);
const obj = <T extends object>(v: T | undefined | null, d: T) => v ?? d;
const normalizeError = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message || 'Unknown error';
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
};

const DEFAULT_STATUS = { ok: true, rateLimited: false };
const DEFAULTS = {
  status: DEFAULT_STATUS,
  stats: { prs: 0, issues: 0, stars: 0, forks: 0 },
  branches: [] as any[],
  commits: [] as any[],
  workflows: [] as any[],
  repos: [] as any[],
  pulls: [] as any[]
};

export const useGitHubData = () => {
  const [state, setState] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrationAvailable] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const GITHUB_CONFIG = { enabled: true };
  const endpointUrl = '/api/ai/github/data';

  const triggerRefetch = useCallback(() => {
    if (rateLimiter.canMakeRequest()) {
      rateLimiter.recordRequest();
      setRefetchTrigger(prev => prev + 1);
    } else {
      console.log('⏸️ Rate limited, please wait');
    }
  }, []);

  useEffect(() => {
    if (!GITHUB_CONFIG.enabled || !endpointUrl) return;

    let mounted = true;
    const controller = new AbortController();

    const fetchGitHubData = async () => {
      if (!mounted) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(endpointUrl, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }
        });

        if (!mounted) return;

        if (!response.ok) {
          setError(`Request failed with status ${response.status}`);
          return;
        }

        const res = await response.json().catch(() => ({}));
        if (!mounted) return;

        setState({
          status: obj(res.status, DEFAULTS.status),
          stats: obj(res.stats, DEFAULTS.stats),
          branches: arr(res.branches),
          commits: arr(res.commits),
          workflows: arr(res.workflows),
          repos: arr(res.repos),
          pulls: arr(res.pulls)
        });
      } catch (err: any) {
        if ((err as DOMException)?.name === 'AbortError' || isAbort(err)) {
          console.debug('abort:cleanup - Component cleanup, aborting pending request');
          return;
        }

        if (mounted) {
          setError(normalizeError(err));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchGitHubData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [endpointUrl, refetchTrigger]);

  const normalized = {
    status: obj(state.status, DEFAULT_STATUS),
    stats: obj(state.stats, DEFAULTS.stats),
    branches: arr(state.branches),
    commits: arr(state.commits),
    workflows: arr(state.workflows),
    repos: arr(state.repos),
    pulls: arr(state.pulls)
  };

  const isLoaded =
    normalized.repos.length > 0 ||
    normalized.branches.length > 0 ||
    normalized.workflows.length > 0 ||
    normalized.pulls.length > 0;

  return {
    ...normalized,
    loading,
    error,
    integrationAvailable,
    refetch: triggerRefetch,
    isLoaded
  };
};

import { useState, useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { getAdminAuthHeaders } from '@/utils/adminToken';
import { rateLimitedJsonFetch } from '@/utils/rateLimitedFetch';
import { rateLimitManager } from '@/utils/rateLimitHandler';
import { sseManager } from '@/lib/sse/eventSourceManager';

const AI_HEALTH_RATE_KEY = 'ai:health';
const AI_MODELS_RATE_KEY = 'ai:models';
const GURULO_STATUS_RATE_KEY = 'gurulo:status';
const GURULO_BRAIN_RATE_KEY = 'gurulo:brain-status';

export type AIServiceHealth = {
  ok: boolean;
  status: string;
  lastChecked?: string | number | null;
};

interface ModelInfo {
  id: string;
  label: string;
  category: 'small' | 'medium' | 'large';
  description?: string;
}

interface ModelControls {
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  model: string;
}

export type GuruloStatusTickerTone = 'ok' | 'warning' | 'error' | 'neutral';

export interface GuruloStatusTickerItem {
  id: string;
  label: string;
  value: string;
  tone: GuruloStatusTickerTone;
}

export interface GuruloStatusSnapshot {
  activePercent: number | null;
  queueDepth: number | null;
  responseMs: number | null;
  successRate: number | null;
  testsPassingPercent: number | null;
  errorCount: number | null;
  lastUpdate: string | number | null;
  throughputPerMin: number | null;
  mode: string | null;
  ticker: GuruloStatusTickerItem[];
}

export interface GuruloBrainStatusSnapshot {
  status: string | null;
  percent: number | null;
  tasksActive: number | null;
  lastUpdate: string | number | null;
  mode: string | null;
  headline: string | null;
}

// UPDATE 2024-10-01: Attach admin bearer tokens to AI service calls while
// preserving existing identity headers for auditing.
const buildAuthHeaders = (authUser: any) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...getAdminAuthHeaders(),
  };

  if (authUser?.personalId) {
    headers['X-User-ID'] = authUser.personalId;
  }

  if (authUser?.role) {
    headers['X-User-Role'] = authUser.role;
  }

  return headers;
};

const isNavigatorOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

const fallbackModels: ModelInfo[] = [
  {
    id: 'llama-3.1-8b-instant',
    label: 'LLaMA 3.1 8B (სწრაფი)',
    category: 'small',
    description: 'სწრაფი მოდელი ყოველდღიური ამოცანებისთვის',
  },
  {
    id: 'llama-3.3-70b-versatile',
    label: 'LLaMA 3.3 70B (ძლიერი)',
    category: 'large',
    description: 'ძლიერი მოდელი რთული ამოცანებისთვის',
  },
];

const normalizeHealthPayload = (payload: any): AIServiceHealth => {
  const statusValue =
    typeof payload?.status === 'string'
      ? payload.status
      : typeof payload?.ok === 'boolean'
        ? payload.ok
          ? 'ok'
          : 'error'
        : 'ok';

  const okValue =
    typeof payload?.ok === 'boolean'
      ? payload.ok
      : ['ok', 'healthy', 'ready'].includes(String(statusValue).toLowerCase());

  return {
    ok: okValue,
    status: statusValue,
    lastChecked: payload?.lastChecked ?? payload?.timestamp ?? Date.now(),
  };
};

const createEmptyGuruloStatus = (): GuruloStatusSnapshot => ({
  activePercent: null,
  queueDepth: null,
  responseMs: null,
  successRate: null,
  testsPassingPercent: null,
  errorCount: null,
  lastUpdate: null,
  throughputPerMin: null,
  mode: null,
  ticker: [],
});

const createEmptyGuruloBrainStatus = (): GuruloBrainStatusSnapshot => ({
  status: null,
  percent: null,
  tasksActive: null,
  lastUpdate: null,
  mode: null,
  headline: null,
});

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parsePercent = (value: unknown): number | null => {
  const numeric = parseNumber(value);
  if (numeric === null) {
    return null;
  }

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(100, Math.max(0, numeric));
};

const normalizeTickerItems = (value: unknown): GuruloStatusTickerItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const label = typeof item?.label === 'string' ? item.label : null;
      const textValue = typeof item?.value === 'string' ? item.value : null;
      const toneValue = typeof item?.tone === 'string' ? item.tone : 'neutral';

      if (!label || !textValue) {
        return null;
      }

      const safeTone: GuruloStatusTickerTone = ['ok', 'warning', 'error'].includes(toneValue)
        ? (toneValue as GuruloStatusTickerTone)
        : 'neutral';

      return {
        id: item?.id && typeof item.id === 'string' ? item.id : `ticker-${index}`,
        label,
        value: textValue,
        tone: safeTone,
      } satisfies GuruloStatusTickerItem;
    })
    .filter((item): item is GuruloStatusTickerItem => Boolean(item));
};

const normalizeGuruloStatus = (payload: any): GuruloStatusSnapshot => {
  if (!payload || typeof payload !== 'object') {
    return createEmptyGuruloStatus();
  }

  const errorRatePercent = parsePercent(payload.errorRate ?? payload.errorsPercent);
  const successRate =
    parsePercent(payload.successRate ?? payload.stability ?? null)
    ?? (errorRatePercent !== null ? Math.min(100, Math.max(0, 100 - errorRatePercent)) : null);

  return {
    activePercent: parsePercent(payload.activePercent ?? payload.activity ?? payload.activeRatio),
    queueDepth: parseNumber(payload.queueDepth ?? payload.queueLength ?? payload.queue),
    responseMs: parseNumber(payload.responseMs ?? payload.latencyMs ?? payload.p95ResponseMs),
    successRate,
    testsPassingPercent: parsePercent(payload.testsPassingPercent ?? payload.testsSuccessRate ?? payload.testing),
    errorCount: parseNumber(payload.errorCount ?? payload.errors ?? null),
    lastUpdate: payload.lastUpdate ?? payload.timestamp ?? null,
    throughputPerMin: parseNumber(payload.throughputPerMin ?? payload.throughput ?? payload.processingRate),
    mode: typeof payload.mode === 'string' ? payload.mode : null,
    ticker: normalizeTickerItems(payload.ticker ?? payload.lines ?? payload.statusLines),
  };
};

const normalizeGuruloBrainStatus = (payload: any): GuruloBrainStatusSnapshot => {
  if (!payload || typeof payload !== 'object') {
    return createEmptyGuruloBrainStatus();
  }

  const percent = parsePercent(payload.percent ?? payload.activity ?? payload.progress);
  const tasks = parseNumber(payload.tasksActive ?? payload.tasks ?? payload.queueDepth);

  return {
    status: typeof payload.status === 'string' ? payload.status : null,
    percent,
    tasksActive: tasks,
    lastUpdate: payload.lastUpdate ?? payload.updatedAt ?? payload.timestamp ?? null,
    mode: typeof payload.mode === 'string' ? payload.mode : null,
    headline: typeof payload.headline === 'string' ? payload.headline : null,
  };
};

const offlineHealth = (): AIServiceHealth => ({
  ok: false,
  status: 'offline',
  lastChecked: Date.now(),
});

export const useAIServiceState = (isAuthenticated?: boolean, authUser?: any) => {
  const [aiServiceHealth, setAiServiceHealth] = useState<AIServiceHealth | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelControls, setModelControls] = useState<ModelControls>({
    temperature: 0.2,
    maxTokens: 2200,
    topP: 0.9,
    presencePenalty: 0.0,
    model: 'llama-3.1-8b-instant',
  });
  const [isOnline, setIsOnline] = useState<boolean>(isNavigatorOnline());
  const [serviceState, setServiceState] = useState<'ok' | 'degraded' | 'offline'>(
    isNavigatorOnline() ? 'degraded' : 'offline',
  );
  const [sseStatus, setSseStatus] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const swrRetry = useCallback(
    (
      _error: unknown,
      key: string | string[],
      _config: unknown,
      revalidate: (opts?: { retryCount?: number }) => void,
      opts: { retryCount: number },
    ) => {
      if (!isNavigatorOnline()) {
        return;
      }

      if (opts.retryCount >= 4) {
        return;
      }

      const keyParts = Array.isArray(key) ? key : [key];
      const baseKey = typeof keyParts[0] === 'string' ? keyParts[0] : String(keyParts[0] ?? '');
      const backoff = rateLimitManager.getBackoffDelay(baseKey);
      const retryDelay = backoff > 0
        ? Math.min(Math.max(backoff, 5000), 120000)
        : Math.min(30000, 5000 * 2 ** opts.retryCount);

      setTimeout(() => revalidate({ retryCount: opts.retryCount + 1 }), retryDelay);
    },
    [],
  );

  const shouldFetchHealth = Boolean(isAuthenticated) && isOnline;
  const healthKey = shouldFetchHealth
    ? ['ai:health', authUser?.personalId ?? authUser?.id ?? 'anonymous']
    : null;

  const fetchHealth = useCallback(async () => {
    try {
      const payload = await rateLimitedJsonFetch<any>('/api/ai/health', {
        key: AI_HEALTH_RATE_KEY,
        credentials: 'include',
        headers: buildAuthHeaders(authUser),
        cacheTTL: 2000,
        rateLimit: { maxRequests: 6, timeWindow: 10000, retryDelay: 2000 },
      });

      return normalizeHealthPayload(payload);
    } catch (error: any) {
      if (error?.status === 401) {
        const normalized: AIServiceHealth = {
          ok: false,
          status: 'unauthorized',
          lastChecked: Date.now(),
        };
        throw Object.assign(error, { normalized });
      }

      if (error?.status && error.status !== 429) {
        const normalized: AIServiceHealth = {
          ok: false,
          status: 'error',
          lastChecked: Date.now(),
        };
        throw Object.assign(error, { normalized });
      }

      throw error;
    }
  }, [authUser]);

  const {
    data: healthData,
    error: healthError,
    mutate: mutateHealth,
    isLoading: isHealthLoading,
    isValidating: isHealthValidating,
  } = useSWR<AIServiceHealth>(healthKey, fetchHealth, {
    refreshInterval: () => {
      if (!shouldFetchHealth || !isOnline) {
        return 0;
      }

      if (rateLimitManager.isPollingDisabled(AI_HEALTH_RATE_KEY)) {
        return rateLimitManager.getBackoffDelay(AI_HEALTH_RATE_KEY) || 0;
      }

      const backoff = rateLimitManager.getBackoffDelay(AI_HEALTH_RATE_KEY);
      return backoff > 0 ? Math.max(backoff, 5000) : 5000;
    },
    revalidateOnFocus: false,
    isPaused: () =>
      !shouldFetchHealth || !isOnline || rateLimitManager.isPollingDisabled(AI_HEALTH_RATE_KEY),
    onErrorRetry: swrRetry,
  });

  useEffect(() => {
    if (!isOnline) {
      const offline = offlineHealth();
      setAiServiceHealth(offline);
      setServiceState('offline');
      return;
    }

    if (healthData) {
      setAiServiceHealth(healthData);
      setServiceState(healthData.ok ? 'ok' : 'degraded');
      return;
    }

    if (healthError) {
      const normalized = (healthError as { normalized?: AIServiceHealth })?.normalized;
      if (normalized) {
        setAiServiceHealth(normalized);
        setServiceState('degraded');
      } else {
        setAiServiceHealth({ ok: false, status: 'error', lastChecked: Date.now() });
        setServiceState('degraded');
      }
    }
  }, [healthData, healthError, isOnline]);

  const shouldFetchModels = Boolean(isAuthenticated) && isOnline;
  const modelsKey = shouldFetchModels
    ? ['ai:models', authUser?.personalId ?? authUser?.id ?? 'anonymous']
    : null;

  const shouldFetchGuruloStatus = Boolean(isAuthenticated) && isOnline;
  const guruloStatusKey = shouldFetchGuruloStatus
    ? ['gurulo:status', authUser?.personalId ?? authUser?.id ?? 'anonymous']
    : null;

  const shouldFetchGuruloBrainStatus = Boolean(isAuthenticated) && isOnline;
  const guruloBrainStatusKey = shouldFetchGuruloBrainStatus
    ? ['gurulo:brain-status', authUser?.personalId ?? authUser?.id ?? 'anonymous']
    : null;

  const shouldSubscribeToEvents = Boolean(isAuthenticated) && isOnline;

  const eventQueryParams = useMemo(() => {
    const params: Record<string, string> = {};

    if (authUser?.personalId) {
      params['x-user-id'] = String(authUser.personalId);
    }

    if (authUser?.role) {
      params['x-user-role'] = String(authUser.role);
    }

    return params;
  }, [authUser?.personalId, authUser?.role]);

  const fetchModels = useCallback(async () => {
    const data = await rateLimitedJsonFetch<{
      success?: boolean;
      models?: unknown;
      message?: string;
      error?: string;
    }>('/api/ai/models', {
      key: AI_MODELS_RATE_KEY,
      headers: {
        ...buildAuthHeaders(authUser),
        'Cache-Control': 'no-cache',
      },
      credentials: 'include',
      cacheTTL: 60000,
      rateLimit: { maxRequests: 4, timeWindow: 60000, retryDelay: 5000 },
    });

    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid response format - expected object payload');
    }

    const { success, models: rawModels, message, error: errorCode } = data;

    if (success !== true) {
      const serviceMessage = message || errorCode || 'AI service reported unsuccessful response';
      throw new Error(serviceMessage);
    }

    if (!Array.isArray(rawModels)) {
      throw new Error('Invalid response format - missing models array');
    }

    return rawModels as ModelInfo[];
  }, [authUser]);

  const {
    data: modelsData,
    error: modelsError,
    mutate: mutateModels,
    isLoading: isModelsLoading,
  } = useSWR<ModelInfo[]>(modelsKey, fetchModels, {
    refreshInterval: () => {
      if (!shouldFetchModels || !isOnline) {
        return 0;
      }

      if (rateLimitManager.isPollingDisabled(AI_MODELS_RATE_KEY)) {
        return rateLimitManager.getBackoffDelay(AI_MODELS_RATE_KEY) || 0;
      }

      const backoff = rateLimitManager.getBackoffDelay(AI_MODELS_RATE_KEY);
      const baseInterval = 120000;
      return backoff > 0 ? Math.max(backoff, baseInterval) : baseInterval;
    },
    revalidateOnFocus: false,
    isPaused: () =>
      !shouldFetchModels || !isOnline || rateLimitManager.isPollingDisabled(AI_MODELS_RATE_KEY),
    onErrorRetry: swrRetry,
  });

  const fetchGuruloStatus = useCallback(async () => {
    try {
      const data = await rateLimitedJsonFetch('/api/gurulo-status', {
        key: GURULO_STATUS_RATE_KEY,
        headers: buildAuthHeaders(authUser),
        credentials: 'include',
        cacheTTL: 4000,
        rateLimit: { maxRequests: 6, timeWindow: 10000, retryDelay: 2000 },
      });

      return normalizeGuruloStatus(data);
    } catch (error: any) {
      if (error?.status === 404) {
        return createEmptyGuruloStatus();
      }

      throw error;
    }
  }, [authUser]);

  const {
    data: guruloStatus,
    mutate: mutateGuruloStatus,
    isLoading: isGuruloStatusLoading,
  } = useSWR<GuruloStatusSnapshot>(guruloStatusKey, fetchGuruloStatus, {
    refreshInterval: () => {
      if (!shouldFetchGuruloStatus || !isOnline) {
        return 0;
      }

      if (rateLimitManager.isPollingDisabled(GURULO_STATUS_RATE_KEY)) {
        return rateLimitManager.getBackoffDelay(GURULO_STATUS_RATE_KEY) || 0;
      }

      const backoff = rateLimitManager.getBackoffDelay(GURULO_STATUS_RATE_KEY);
      return backoff > 0 ? Math.max(backoff, 5000) : 5000;
    },
    revalidateOnFocus: false,
    isPaused: () =>
      !shouldFetchGuruloStatus
      || !isOnline
      || rateLimitManager.isPollingDisabled(GURULO_STATUS_RATE_KEY),
    onErrorRetry: swrRetry,
  });

  const fetchGuruloBrainStatus = useCallback(async () => {
    try {
      const data = await rateLimitedJsonFetch('/api/gurulo-brain-status', {
        key: GURULO_BRAIN_RATE_KEY,
        headers: buildAuthHeaders(authUser),
        credentials: 'include',
        cacheTTL: 6000,
        rateLimit: { maxRequests: 6, timeWindow: 10000, retryDelay: 2000 },
      });

      return normalizeGuruloBrainStatus(data);
    } catch (error: any) {
      if (error?.status === 404) {
        return createEmptyGuruloBrainStatus();
      }

      throw error;
    }
  }, [authUser]);

  const {
    data: guruloBrainStatus,
    error: guruloBrainStatusError,
    mutate: mutateGuruloBrainStatus,
    isLoading: isGuruloBrainStatusLoading,
  } = useSWR<GuruloBrainStatusSnapshot>(guruloBrainStatusKey, fetchGuruloBrainStatus, {
    refreshInterval: () => {
      if (!shouldFetchGuruloBrainStatus || !isOnline) {
        return 0;
      }

      if (rateLimitManager.isPollingDisabled(GURULO_BRAIN_RATE_KEY)) {
        return rateLimitManager.getBackoffDelay(GURULO_BRAIN_RATE_KEY) || 0;
      }

      const backoff = rateLimitManager.getBackoffDelay(GURULO_BRAIN_RATE_KEY);
      const baseInterval = 10000;
      return backoff > 0 ? Math.max(backoff, baseInterval) : baseInterval;
    },
    revalidateOnFocus: false,
    isPaused: () =>
      !shouldFetchGuruloBrainStatus
      || !isOnline
      || rateLimitManager.isPollingDisabled(GURULO_BRAIN_RATE_KEY),
    onErrorRetry: swrRetry,
  });

  useEffect(() => {
    if (modelsData && Array.isArray(modelsData)) {
      setAvailableModels(modelsData);
    }
  }, [modelsData]);

  useEffect(() => {
    if (modelsError) {
      setAvailableModels(fallbackModels);
    }
  }, [modelsError]);

  const handleSseMessage = useCallback(
    (event: MessageEvent<string>) => {
      if (!event?.data) {
        return;
      }

      let parsed: any;

      try {
        parsed = JSON.parse(event.data);
      } catch (parseError) {
        console.warn('⚠️ [AI SSE] Failed to parse event payload:', parseError);
        return;
      }

      const rawType = typeof parsed?.type === 'string'
        ? parsed.type
        : typeof parsed?.event === 'string'
          ? parsed.event
          : '';
      const eventType = rawType.toLowerCase();
      const payload = parsed?.payload ?? parsed?.data ?? parsed;

      if (payload && typeof payload === 'object') {
        const healthSource = (() => {
          if (payload.health && typeof payload.health === 'object') {
            return payload.health;
          }

          if (eventType.includes('health')) {
            return payload;
          }

          if (typeof payload.status === 'string' || typeof payload.ok === 'boolean') {
            return payload;
          }

          return null;
        })();

        if (healthSource) {
          const normalized = normalizeHealthPayload(healthSource);
          setAiServiceHealth(normalized);
        }

        const modelsSource = (() => {
          if (Array.isArray(payload.models)) {
            return payload.models;
          }

          if (eventType.includes('model') && Array.isArray(payload)) {
            return payload;
          }

          return null;
        })();

        if (modelsSource) {
          setAvailableModels(modelsSource as ModelInfo[]);
        }

        if (typeof payload.defaultModel === 'string') {
          setSelectedModel(payload.defaultModel);
        } else if (typeof payload.model === 'string') {
          setSelectedModel(payload.model);
        }
      }
    },
    [setAiServiceHealth, setAvailableModels, setSelectedModel],
  );

  useEffect(() => {
    if (!shouldSubscribeToEvents) {
      return undefined;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    setSseStatus('connecting');

    const queryKeys = Object.keys(eventQueryParams);
    const unsubscribe = sseManager.subscribe(
      '/api/ai/events',
      {
        onOpen: () => setSseStatus('open'),
        onError: () => setSseStatus('error'),
        onMessage: handleSseMessage,
      },
      {
        withCredentials: true,
        query: queryKeys.length > 0 ? { ...eventQueryParams } : undefined,
      },
    );

    return () => {
      setSseStatus('idle');
      unsubscribe();
    };
  }, [eventQueryParams, handleSseMessage, shouldSubscribeToEvents]);

  useEffect(() => {
    if (!isOnline) {
      setServiceState('offline');
      return;
    }

    if (sseStatus === 'open') {
      setServiceState(aiServiceHealth?.ok ? 'ok' : 'degraded');
      return;
    }

    if (sseStatus === 'connecting') {
      setServiceState('degraded');
      return;
    }

    if (sseStatus === 'error') {
      setServiceState('degraded');
    }
  }, [aiServiceHealth?.ok, isOnline, sseStatus]);

  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      const defaultModel =
        availableModels.find((model: ModelInfo) => model.category === 'small') || availableModels[0];
      setSelectedModel(defaultModel.id);
    }
  }, [availableModels, selectedModel]);

  const checkAIServiceHealth = useCallback(async () => {
    if (!healthKey) {
      return null;
    }

    const result = await mutateHealth();
    return result ?? null;
  }, [healthKey, mutateHealth]);

  const loadModels = useCallback(async () => {
    if (!modelsKey) {
      return null;
    }

    const result = await mutateModels();
    return result ?? null;
  }, [modelsKey, mutateModels]);

  const refreshGuruloStatus = useCallback(async () => {
    if (!guruloStatusKey) {
      return null;
    }

    const result = await mutateGuruloStatus();
    return result ?? null;
  }, [guruloStatusKey, mutateGuruloStatus]);

  const refreshGuruloBrainStatus = useCallback(async () => {
    if (!guruloBrainStatusKey) {
      return null;
    }

    const result = await mutateGuruloBrainStatus();
    return result ?? null;
  }, [guruloBrainStatusKey, mutateGuruloBrainStatus]);

  const connectionState = useMemo(() => serviceState, [serviceState]);

  return {
    aiServiceHealth,
    availableModels,
    selectedModel,
    setSelectedModel,
    modelControls,
    setModelControls,
    checkAIServiceHealth,
    refreshHealth: checkAIServiceHealth,
    loadModels,
    isOnline,
    connectionState,
    isHealthLoading,
    isHealthValidating,
    isModelsLoading,
    guruloStatus: guruloStatus ?? createEmptyGuruloStatus(),
    refreshGuruloStatus,
    isGuruloStatusLoading,
    guruloBrainStatus: guruloBrainStatus ?? createEmptyGuruloBrainStatus(),
    guruloBrainStatusError,
    refreshGuruloBrainStatus,
    isGuruloBrainStatusLoading,
    sseStatus,
  };
};

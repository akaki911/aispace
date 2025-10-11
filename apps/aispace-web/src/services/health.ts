export type AISpaceHealthStatus = 'checking' | 'healthy' | 'degraded' | 'offline';

interface HealthResponsePayload {
  ok?: boolean;
  status?: string;
  detail?: string;
  errors?: Array<{ error?: string } | string>;
  lastChecked?: string | number;
  timestamp?: string | number;
}

const HEALTH_ENDPOINT = '/api/ai/health';
const VERSION_ENDPOINT = '/api/version';

const normalizeHealthStatus = (payload: HealthResponsePayload | null): {
  status: AISpaceHealthStatus;
  ok: boolean;
  detail?: string;
  lastChecked: number;
} => {
  if (!payload) {
    return { status: 'offline', ok: false, lastChecked: Date.now() };
  }

  const normalizedStatus = (() => {
    if (typeof payload?.status === 'string' && payload.status.trim().length > 0) {
      return payload.status;
    }

    if (payload?.ok === true) {
      return 'ok';
    }

    if (payload?.ok === false) {
      return 'error';
    }

    return 'unknown';
  })()
    .toString()
    .toLowerCase();

  const ok = Boolean(
    payload.ok ?? ['ok', 'healthy', 'ready'].includes(normalizedStatus),
  );

  let status: AISpaceHealthStatus = 'checking';
  if (ok) {
    status = 'healthy';
  } else if (['warn', 'warning', 'degraded'].includes(normalizedStatus)) {
    status = 'degraded';
  } else if (['offline', 'down', 'error', 'fail'].includes(normalizedStatus)) {
    status = 'offline';
  } else {
    status = ok ? 'healthy' : 'degraded';
  }

  const detail = Array.isArray(payload.errors)
    ? payload.errors
        .map((entry) => (typeof entry === 'string' ? entry : entry?.error))
        .filter(Boolean)
        .join('; ')
    : payload.detail;

  const lastChecked = Number(payload.lastChecked ?? payload.timestamp ?? Date.now());

  return { status, ok, detail, lastChecked };
};

export interface AISpaceHealthResult {
  status: AISpaceHealthStatus;
  ok: boolean;
  detail?: string;
  lastChecked: number;
}

export const fetchAISpaceHealth = async (): Promise<AISpaceHealthResult> => {
  try {
    const response = await fetch(HEALTH_ENDPOINT, { credentials: 'include' });
    if (!response.ok) {
      return { status: 'offline', ok: false, detail: `HTTP ${response.status}`, lastChecked: Date.now() };
    }

    const payload = (await response.json()) as HealthResponsePayload;
    return normalizeHealthStatus(payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Network error';
    return { status: 'offline', ok: false, detail, lastChecked: Date.now() };
  }
};

export interface AISpaceVersionInfo {
  version: string | null;
  buildCommit?: string | null;
  buildTime?: string | null;
}

export const fetchAISpaceVersion = async (): Promise<AISpaceVersionInfo> => {
  try {
    const response = await fetch(VERSION_ENDPOINT, { credentials: 'include' });
    if (!response.ok) {
      return { version: null };
    }

    const payload = await response.json();
    return {
      version: payload?.version ?? payload?.appVersion ?? null,
      buildCommit: payload?.commit ?? payload?.commitHash ?? null,
      buildTime: payload?.buildTime ?? payload?.builtAt ?? null,
    };
  } catch (error) {
    console.warn('Failed to fetch AISpace version', error);
    return { version: null };
  }
};


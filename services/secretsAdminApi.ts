export type SecretVisibility = 'hidden' | 'visible';
export type SecretSource = 'app' | 'account' | 'scanned';

export interface SecretSummary {
  key: string;
  visibility: SecretVisibility;
  source: SecretSource;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  hasValue: boolean;
  required: boolean;
}

export interface SecretListResponse {
  items: SecretSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SecretRevealResponse {
  key: string;
  value: string | null;
  visibility: SecretVisibility;
  hasValue: boolean;
  correlationId?: string;
}

export interface SecretScanSuggestion {
  key: string;
  foundIn: string[];
  suggestion: {
    scope: string;
    visibility: SecretVisibility;
  };
}

export interface SecretsScanResponse {
  missing: SecretScanSuggestion[];
  correlationId?: string;
}

export interface SecretUsageLocation {
  file: string;
  line: number;
  context: string;
}

export interface SecretUsageModules {
  frontend: SecretUsageLocation[];
  backend: SecretUsageLocation[];
  'ai-service': SecretUsageLocation[];
}

export interface SecretUsageResponse {
  key: string;
  modules: SecretUsageModules;
  correlationId?: string;
}

export interface SecretsListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  signal?: AbortSignal;
}

export interface SecretMutationPayload {
  key: string;
  value?: string;
  visibility?: SecretVisibility;
  source?: SecretSource;
  required?: boolean;
}

export type RequiredReasonType = 'integration' | 'scan' | 'flag';

export interface RequiredSecretReason {
  type: RequiredReasonType;
  integrationId?: string;
  integrationLabel?: string;
  description?: string;
  module?: string;
  count?: number;
}

export type RequiredSecretStatus = 'missing' | 'present';

export interface RequiredSecretItem {
  key: string;
  app: 'frontend' | 'backend' | 'ai-service';
  status: RequiredSecretStatus;
  reasons: RequiredSecretReason[];
  foundIn: string[];
  hasSecret: boolean;
  hasValue: boolean;
  required: boolean;
  pendingSync: boolean;
}

export interface RequiredSecretsResponse {
  items: RequiredSecretItem[];
  pendingSyncKeys: string[];
  correlationId?: string;
}

export interface SecretsSyncServiceState {
  status: 'ok' | 'degraded';
  missingKeys: string[];
  updatedKeys: string[];
  envPath: string;
  changed: boolean;
  backupPath: string | null;
}

export interface SecretsSyncResponse {
  services: Record<'frontend' | 'backend' | 'ai-service', SecretsSyncServiceState>;
  pendingSyncKeys: string[];
  timestamp: string;
  correlationId?: string;
}

export interface SecretsTelemetrySyncInfo {
  lastStatus: string;
  lastAction: string | null;
  lastCompletedAt: string | null;
  queueLength: number;
  pendingKeys: number;
}

export interface SecretsTelemetry {
  totals: {
    secrets: number;
    requiredMissing: number;
  };
  sync: SecretsTelemetrySyncInfo;
  services: Record<string, { status?: string; missingCount?: number; updatedCount?: number; changed?: boolean; restored?: boolean }>;
  observedAt: string;
  correlationId?: string;
}

export interface SecretsRollbackResponse {
  services: Record<string, { restored: boolean; backupPath?: string; reason?: string }>;
  timestamp: string;
  correlationId?: string;
}

export class SecretsApiError extends Error {
  status: number;
  code?: string;
  correlationId?: string;

  constructor(message: string, status: number, code?: string, correlationId?: string) {
    super(message);
    this.name = 'SecretsApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

const baseUrl = '/api/admin/secrets';

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new SecretsApiError('Invalid server response', response.status, 'INVALID_JSON');
  }
};

const handleError = async (response: Response): Promise<never> => {
  let message = 'Request failed';
  let code: string | undefined;
  let correlationId: string | undefined;

  try {
    const payload = await parseResponse<{ error?: string; code?: string; correlationId?: string }>(response);
    message = payload.error ?? message;
    code = payload.code;
    correlationId = payload.correlationId;
  } catch (error) {
    // ignore JSON parsing error since parseResponse already throws SecretsApiError
    if (error instanceof SecretsApiError && error.code === 'INVALID_JSON') {
      message = 'Invalid server response';
      code = error.code;
    } else {
      throw error;
    }
  }

  throw new SecretsApiError(message, response.status, code, correlationId);
};

const request = async <T>(input: RequestInfo, init: RequestInit = {}): Promise<T> => {
  const mergedHeaders = new Headers({ Accept: 'application/json' });
  const initHeaders = init.headers;

  if (initHeaders) {
    if (initHeaders instanceof Headers) {
      initHeaders.forEach((value, key) => {
        mergedHeaders.set(key, value);
      });
    } else if (Array.isArray(initHeaders)) {
      initHeaders.forEach(([key, value]) => {
        mergedHeaders.set(key, value);
      });
    } else {
      Object.entries(initHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          mergedHeaders.set(key, value as string);
        }
      });
    }
  }

  const { headers: _ignored, ...rest } = init;

  const config: RequestInit = {
    credentials: 'include',
    ...rest,
    headers: mergedHeaders,
  };

  try {
    const response = await fetch(input, config);
    if (!response.ok) {
      return handleError(response);
    }
    const payload = await parseResponse<{ success?: boolean; data?: T; correlationId?: string }>(response);
    if (payload && typeof payload === 'object' && 'data' in payload) {
      const typed = payload.data as T;
      if (payload.correlationId && typed && typeof typed === 'object') {
        (typed as Record<string, unknown>).correlationId = payload.correlationId;
      }
      return typed;
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof SecretsApiError) {
      throw error;
    }
    throw new SecretsApiError((error as Error)?.message ?? 'Unexpected error', 500, 'NETWORK_ERROR');
  }
};

export const listSecrets = async ({
  page = 1,
  pageSize = 50,
  search = '',
  signal,
}: SecretsListParams = {}): Promise<SecretListResponse & { correlationId?: string }> => {
  const query = toQueryString({ page, pageSize, search });
  return request<SecretListResponse & { correlationId?: string }>(`${baseUrl}/list${query}`, { signal });
};

export const createSecret = async ({
  key,
  value,
  visibility = 'hidden',
  source = 'app',
  required = false,
}: SecretMutationPayload): Promise<SecretSummary & { correlationId?: string }> => {
  return request<SecretSummary & { correlationId?: string }>(`${baseUrl}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, visibility, source, required }),
  });
};

export const updateSecret = async (
  key: string,
  { value, visibility, source, required }: Omit<SecretMutationPayload, 'key'>,
): Promise<SecretSummary & { correlationId?: string }> => {
  return request<SecretSummary & { correlationId?: string }>(`${baseUrl}/update/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, visibility, source, required }),
  });
};

export const deleteSecret = async (key: string): Promise<{ key: string; correlationId?: string }> => {
  return request<{ key: string; correlationId?: string }>(`${baseUrl}/delete/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
};

export const revealSecret = async (
  key: string,
  signal?: AbortSignal,
): Promise<SecretRevealResponse> => {
  return request<SecretRevealResponse>(`${baseUrl}/reveal/${encodeURIComponent(key)}`, { signal });
};

export const scanSecrets = async (signal?: AbortSignal): Promise<SecretsScanResponse> => {
  return request<SecretsScanResponse>(`${baseUrl}/scan`, {
    method: 'POST',
    signal,
  });
};

export const fetchSecretUsages = async (
  key: string,
  signal?: AbortSignal,
): Promise<SecretUsageResponse> => {
  return request<SecretUsageResponse>(`${baseUrl}/usages/${encodeURIComponent(key)}`, { signal });
};

export const fetchRequiredSecrets = async (): Promise<RequiredSecretsResponse> => {
  return request<RequiredSecretsResponse>(`${baseUrl}/required`, {
    method: 'POST',
  });
};

export const syncSecrets = async (): Promise<SecretsSyncResponse> => {
  return request<SecretsSyncResponse>(`${baseUrl}/sync`, {
    method: 'POST',
  });
};

export const rollbackSecrets = async (): Promise<SecretsRollbackResponse> => {
  return request<SecretsRollbackResponse>(`${baseUrl}/rollback`, {
    method: 'POST',
  });
};

export const fetchSecretsTelemetry = async (
  signal?: AbortSignal,
): Promise<SecretsTelemetry & { correlationId?: string }> => {
  return request<SecretsTelemetry & { correlationId?: string }>(`${baseUrl}/telemetry`, { signal });
};

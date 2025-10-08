export type SecretSource =
  | 'environment'
  | 'vault'
  | 'runtime'
  | 'config'
  | 'app'
  | 'scanned'
  | 'account';
export type SecretVisibility = 'private' | 'internal' | 'public' | 'hidden' | 'visible';

export interface SecretSummary {
  key: string;
  source: SecretSource;
  visibility: SecretVisibility;
  updatedAt?: string | null;
  required?: boolean;
  hasValue?: boolean;
}

export interface SecretsTelemetry {
  total: number;
  requiredMissing: number;
  lastStatus: string;
  queueLength: number;
  pendingKeys: number;
  lastAction: string | null;
  lastCompletedAt: string | null;
}

export interface SecretScanSuggestion {
  key: string;
  suggestion: { visibility: SecretVisibility; source: SecretSource };
  status?: 'missing' | 'present';
}

export interface RequiredSecretItem {
  key: string;
  description?: string;
  required: boolean;
  source: SecretSource;
  status?: 'missing' | 'configured';
  app?: string;
}

export interface RequiredSecretsResponse {
  items: RequiredSecretItem[];
  generatedAt: string;
  pendingSyncKeys: string[];
}

export interface SecretsSyncResponse {
  applied: number;
  skipped: number;
  correlationId?: string | null;
  services: Record<'frontend' | 'backend' | 'ai-service', { applied: number; skipped: number }>;
}

export interface SecretUsageItem {
  file: string;
  line: number;
  description?: string;
}

export interface SecretUsageModule {
  id: string;
  title: string;
  items: SecretUsageItem[];
}

export interface SecretUsageModules {
  frontend: SecretUsageItem[];
  backend: SecretUsageItem[];
  'ai-service': SecretUsageItem[];
}

export interface SecretUsageResponse {
  modules: SecretUsageModules;
  generatedAt: string;
  correlationId?: string | null;
}

export interface SecretInput {
  key: string;
  value: string;
  visibility: SecretVisibility;
  source: SecretSource;
  required?: boolean;
}

export interface SecretUpdateInput {
  value?: string;
  visibility?: SecretVisibility;
  source?: SecretSource;
  required?: boolean;
}

export class SecretsApiError extends Error {
  correlationId: string | null;

  constructor(message: string, correlationId: string | null = null) {
    super(message);
    this.name = 'SecretsApiError';
    this.correlationId = correlationId;
  }
}

export const fetchSecretsTelemetry = async (): Promise<SecretsTelemetry> => ({
  total: 0,
  requiredMissing: 0,
  lastStatus: 'demo',
  queueLength: 0,
  pendingKeys: 0,
  lastAction: null,
  lastCompletedAt: null,
});

export const fetchRequiredSecrets = async (): Promise<RequiredSecretsResponse> => ({
  items: [],
  generatedAt: new Date().toISOString(),
  pendingSyncKeys: [],
});

export const scanSecrets = async (): Promise<{ missing: SecretScanSuggestion[]; correlationId: string | null }> => ({
  missing: [],
  correlationId: null,
});

export const syncSecrets = async (): Promise<SecretsSyncResponse> => ({
  applied: 0,
  skipped: 0,
  correlationId: null,
  services: {
    frontend: { applied: 0, skipped: 0 },
    backend: { applied: 0, skipped: 0 },
    'ai-service': { applied: 0, skipped: 0 },
  },
});

export const rollbackSecrets = async (): Promise<SecretsSyncResponse> => ({
  applied: 0,
  skipped: 0,
  correlationId: null,
  services: {
    frontend: { applied: 0, skipped: 0 },
    backend: { applied: 0, skipped: 0 },
    'ai-service': { applied: 0, skipped: 0 },
  },
});

export const deleteSecret = async (_key: string): Promise<{ success: boolean; correlationId?: string | null }> => ({
  success: true,
  correlationId: null,
});

export const fetchSecretUsages = async (
  _secretKey: string,
  _signal?: AbortSignal,
): Promise<SecretUsageResponse> => ({
  modules: {
    frontend: [],
    backend: [],
    'ai-service': [],
  },
  generatedAt: new Date().toISOString(),
  correlationId: null,
});

export const createSecret = async (_input: SecretInput): Promise<{
  secret: SecretSummary;
  correlationId?: string | null;
}> => ({
  secret: {
    key: _input.key,
    visibility: _input.visibility,
    source: _input.source,
    hasValue: _input.value.length > 0,
    required: _input.required ?? false,
    updatedAt: new Date().toISOString(),
  },
  correlationId: null,
});

export const updateSecret = async (
  key: string,
  _input: SecretUpdateInput,
): Promise<{ secret: SecretSummary; correlationId?: string | null }> => ({
  secret: {
    key,
    visibility: _input.visibility ?? 'hidden',
    source: _input.source ?? 'app',
    hasValue: typeof _input.value === 'string' ? _input.value.length > 0 : undefined,
    required: _input.required,
    updatedAt: new Date().toISOString(),
  },
  correlationId: null,
});

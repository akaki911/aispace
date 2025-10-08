interface RequestOptions extends RequestInit {
  parseJson?: boolean;
}

const ADMIN_BASE_PATH = '/api/ai/admin';

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { parseJson = true, ...fetchOptions } = options;
  const response = await fetch(`${ADMIN_BASE_PATH}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    const error = new Error(`Admin AI request failed: ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  if (!parseJson) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchErrorLogs(): Promise<string[]> {
  try {
    const payload = await request<{ logs?: string[] }>('/error-logs');
    return payload.logs ?? [];
  } catch (error) {
    console.warn('Failed to fetch error logs, using fallback', error);
    return [];
  }
}

export async function savePrompt(prompt: { id: string; value: string; label: string; placeholder: string }): Promise<void> {
  await request('/prompts', {
    method: 'POST',
    body: JSON.stringify(prompt),
  });
}

export async function banUser(userId: string): Promise<void> {
  await request(`/users/${encodeURIComponent(userId)}/ban`, {
    method: 'POST',
    parseJson: false,
  });
}

export async function rotateKey(): Promise<string | null> {
  const payload = await request<{ key?: string }>('/keys/rotate', {
    method: 'POST',
  });
  return payload.key ?? null;
}

export async function triggerBackup(): Promise<void> {
  await request('/backup', {
    method: 'POST',
    parseJson: false,
  });
}

export async function triggerRestore(): Promise<void> {
  await request('/restore', {
    method: 'POST',
    parseJson: false,
  });
}

export interface FallbackStatusResponse {
  backupMode: boolean;
  forced: boolean;
  provider: string;
  updatedAt: string;
}

export async function fetchFallbackStatus(): Promise<FallbackStatusResponse> {
  const payload = await request<{ backupMode: boolean; forced: boolean; provider: string; updatedAt: string }>('/fallback');
  return {
    backupMode: Boolean(payload.backupMode),
    forced: Boolean(payload.forced),
    provider: payload.provider ?? 'offline',
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateFallbackStatus(enabled: boolean): Promise<FallbackStatusResponse> {
  const payload = await request<{ backupMode: boolean; forced?: boolean; provider?: string; updatedAt?: string }>(
    '/fallback',
    {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    },
  );

  return {
    backupMode: Boolean(payload.backupMode),
    forced: Boolean(payload.forced),
    provider: payload.provider ?? 'offline',
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };
}

import { useCallback, useState } from 'react';

export const BACKUP_SERVICE_DISABLED_ERROR = 'backup_service_disabled';

export interface BackupStatus extends Record<string, unknown> {
  status?: string;
  state?: string;
  enabled?: boolean;
  disabled?: boolean;
  lastBackupAt?: string;
  last_backup_at?: string;
  lastBackup?: string;
  last_successful_backup?: string;
  lastSuccessfulBackup?: string;
  last_run_at?: string;
  lastRunAt?: string;
  totalBackups?: number;
  backupCount?: number;
  total?: number;
  count?: number;
  backups?: unknown;
  storagePath?: string;
  storage_location?: string;
  location?: string;
  target?: string;
  destination?: string;
}

export interface BackupRecord extends Record<string, unknown> {
  id?: string;
  backupId?: string;
  name?: string;
  timestamp?: string;
  createdAt?: string;
  created_at?: string;
  size?: number;
  totalSize?: number;
  bytes?: number;
  status?: string;
  state?: string;
}

type ActionType = 'create' | 'restore' | 'delete';

interface ActionState {
  type: ActionType;
  id?: string;
}

type BackupStatusResponse = BackupStatus & {
  success: boolean;
  enabled: boolean;
  provider: string | null;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  items: number;
  message: string;
  timestamp: string;
};

interface BackupListResponse {
  success: boolean;
  enabled: boolean;
  backups: BackupRecord[];
  count: number;
  message: string;
  timestamp: string;
}

async function safeJson(res: Response) {
  if (!res.ok) {
    if (res.status === 404) {
      return {
        success: true,
        enabled: false,
        backups: [],
        count: 0,
        message: 'Backup disabled',
        timestamp: new Date().toISOString(),
      };
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBackupStatus(signal?: AbortSignal): Promise<BackupStatusResponse> {
  try {
    const res = await fetch('/api/backup_system/status', { signal });
    const data = await safeJson(res);
    return {
      ...((typeof data === 'object' && data !== null ? data : {}) as BackupStatus),
      success: true,
      enabled: Boolean((data as any).enabled),
      provider: (data as any).provider ?? null,
      lastBackupAt: (data as any).lastBackupAt ?? null,
      nextBackupAt: (data as any).nextBackupAt ?? null,
      items: Number((data as any).items ?? 0),
      message: (data as any).message ?? '',
      timestamp: (data as any).timestamp ?? new Date().toISOString(),
    };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return {
        success: true,
        enabled: false,
        provider: null,
        lastBackupAt: null,
        nextBackupAt: null,
        items: 0,
        message: 'aborted',
        timestamp: new Date().toISOString(),
      } as BackupStatusResponse;
    }
    return {
      success: true,
      enabled: false,
      provider: null,
      lastBackupAt: null,
      nextBackupAt: null,
      items: 0,
      message: 'unavailable',
      timestamp: new Date().toISOString(),
    } as BackupStatusResponse;
  }
}

export async function fetchBackupList(signal?: AbortSignal): Promise<BackupListResponse> {
  try {
    const res = await fetch('/api/backup_system/list', { signal });
    const data = await safeJson(res);
    return {
      success: true,
      enabled: Boolean((data as any).enabled),
      backups: Array.isArray((data as any).backups) ? (data as any).backups : [],
      count: Number((data as any).count ?? 0),
      message: (data as any).message ?? '',
      timestamp: (data as any).timestamp ?? new Date().toISOString(),
    };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return {
        success: true,
        enabled: false,
        backups: [],
        count: 0,
        message: 'aborted',
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      enabled: false,
      backups: [],
      count: 0,
      message: 'unavailable',
      timestamp: new Date().toISOString(),
    };
  }
}

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Failed to parse JSON response from backup service', error);
    return null;
  }
};

const extractErrorMessage = (data: any, fallback: string) => {
  if (!data) {
    return fallback;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data.error === 'string') {
    return data.error;
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  return fallback;
};

export interface UseBackupServiceResult {
  status: BackupStatus | null;
  backups: BackupRecord[];
  isLoading: boolean;
  error: string | null;
  isDisabled: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
  createBackup: () => Promise<any>;
  restoreBackup: (id: string) => Promise<any>;
  deleteBackup: (id: string) => Promise<any>;
  actionState: ActionState | null;
}

export const useBackupService = (): UseBackupServiceResult => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [actionState, setActionState] = useState<ActionState | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await fetchBackupStatus();
      const disabled = data.enabled === false || Boolean(data.disabled);
      setIsDisabled(disabled);
      setStatus(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch backup status', err);
      throw err;
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const data = await fetchBackupList();
      setIsDisabled(!data.enabled);
      setBackups(data.backups);
      return data.backups;
    } catch (err) {
      console.error('Failed to fetch backup list', err);
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([fetchStatus(), fetchList()]);
      setLastUpdated(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, fetchList]);

  const request = useCallback(
    async (url: string, options: RequestInit, actionType: ActionState) => {
      setActionState(actionType);
      setError(null);

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          credentials: 'include',
        });

        if (response.status === 404) {
          setIsDisabled(true);
          throw new Error(BACKUP_SERVICE_DISABLED_ERROR);
        }

        const data = await parseJson(response);

        if (!response.ok) {
          throw new Error(extractErrorMessage(data, `HTTP ${response.status}`));
        }

        setIsDisabled(false);
        return data;
      } catch (err) {
        if (err instanceof Error && err.message !== BACKUP_SERVICE_DISABLED_ERROR) {
          setError(err.message);
        }
        throw err;
      } finally {
        setActionState(null);
      }
    },
    [],
  );

  const createBackup = useCallback(async () => {
    return request(
      '/api/backup_system/create',
      {
        method: 'POST',
      },
      { type: 'create' },
    );
  }, [request]);

  const restoreBackup = useCallback(
    async (id: string) => {
      return request(
        '/api/backup_system/restore',
        {
          method: 'POST',
          body: JSON.stringify({ id }),
        },
        { type: 'restore', id },
      );
    },
    [request],
  );

  const deleteBackup = useCallback(
    async (id: string) => {
      return request(
        `/api/backup_system/delete/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        },
        { type: 'delete', id },
      );
    },
    [request],
  );

  return {
    status,
    backups,
    isLoading,
    error,
    isDisabled,
    lastUpdated,
    refresh,
    createBackup,
    restoreBackup,
    deleteBackup,
    actionState,
  };
};

export default useBackupService;

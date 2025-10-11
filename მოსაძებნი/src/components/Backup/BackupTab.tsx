import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Archive,
  Clock,
  HardDrive,
  Loader2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import useBackupService, {
  BACKUP_SERVICE_DISABLED_ERROR,
  BackupRecord,
  BackupStatus,
} from '@/hooks/useBackupService';

interface BackupTabProps {
  hasDevConsoleAccess?: boolean;
}

const gradientBackground =
  'bg-gradient-to-br from-[#0E1116]/90 via-[#1A1533]/90 to-[#351D6A]/90 text-[#E6E8EC]';
const surfaceCard =
  'rounded-3xl border border-white/10 bg-[#0F1320]/80 p-6 shadow-[0_32px_70px_rgba(5,10,30,0.6)] backdrop-blur-2xl';
const secondarySurface =
  'rounded-2xl border border-white/10 bg-[#121622]/80 p-5 shadow-[0_24px_60px_rgba(5,10,30,0.55)] backdrop-blur-2xl';
const glassButton =
  'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#E6E8EC] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7C6CFF]/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60';
const primaryButton =
  'inline-flex items-center gap-2 rounded-xl border border-[#7C6CFF]/60 bg-gradient-to-br from-[#7C6CFF] via-[#4B3FA8] to-[#351D6A] px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(124,108,255,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(124,108,255,0.45)] disabled:cursor-not-allowed disabled:opacity-70';
const dangerButton =
  'inline-flex items-center gap-2 rounded-xl border border-[#E14B8E]/60 bg-[#E14B8E]/15 px-4 py-2 text-xs font-semibold text-[#F5B0D1] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#E14B8E]/25 disabled:cursor-not-allowed disabled:opacity-60';
const tableWrapper =
  'rounded-3xl border border-white/10 bg-[#121622]/80 shadow-[0_28px_65px_rgba(5,10,30,0.55)] backdrop-blur-2xl overflow-hidden';

interface NormalizedBackup {
  key: string;
  id: string | null;
  label: string;
  timestamp: string | number | null;
  size: number | null;
  status: string | null;
  raw: BackupRecord;
}

const AUTO_REFRESH_INTERVAL = 45000;

const formatDate = (value: string | number | null | undefined, fallback: string) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const formatBytes = (value: number | null | undefined, fallback: string) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const deriveStatusState = (status: BackupStatus | null, disabledLabel: string, unknownLabel: string) => {
  if (!status) {
    return unknownLabel;
  }

  if (status.disabled) {
    return disabledLabel;
  }

  if (status.enabled === false) {
    return disabledLabel;
  }

  const value = status.status ?? status.state;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return unknownLabel;
};

const deriveLastBackupTimestamp = (status: BackupStatus | null): string | number | null => {
  if (!status) {
    return null;
  }

  return (
    status.lastBackupAt ??
    status.last_backup_at ??
    status.lastBackup ??
    status.last_successful_backup ??
    status.lastSuccessfulBackup ??
    status.last_run_at ??
    status.lastRunAt ??
    null
  );
};

const deriveTotalBackups = (status: BackupStatus | null): number | null => {
  if (!status) {
    return null;
  }

  if (typeof status.totalBackups === 'number') {
    return status.totalBackups;
  }

  if (typeof status.backupCount === 'number') {
    return status.backupCount;
  }

  const totals = [status.total, status.count, status.backups];
  for (const value of totals) {
    if (typeof value === 'number') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return null;
};

const deriveStorageLocation = (status: BackupStatus | null): string | null => {
  if (!status) {
    return null;
  }

  const candidates = [
    status.storagePath,
    status.storage_location,
    status.location,
    status.target,
    status.destination,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
};

const normalizeBackups = (backups: BackupRecord[]): NormalizedBackup[] => {
  return backups.map((backup, index) => {
    const idCandidate =
      (typeof backup.id === 'string' && backup.id) ||
      (typeof backup.backupId === 'string' && backup.backupId) ||
      (typeof backup.name === 'string' && backup.name) ||
      null;

    const timestamp =
      (typeof backup.timestamp === 'string' || typeof backup.timestamp === 'number')
        ? backup.timestamp
        : (typeof backup.createdAt === 'string' || typeof backup.createdAt === 'number')
        ? backup.createdAt
        : (typeof backup.created_at === 'string' || typeof backup.created_at === 'number')
        ? backup.created_at
        : null;

    const size =
      typeof backup.size === 'number'
        ? backup.size
        : typeof backup.totalSize === 'number'
        ? backup.totalSize
        : typeof backup.bytes === 'number'
        ? backup.bytes
        : null;

    const statusValue =
      (typeof backup.status === 'string' && backup.status) ||
      (typeof backup.state === 'string' && backup.state) ||
      null;

    return {
      key: idCandidate ?? `backup-${index}`,
      id: idCandidate,
      label: idCandidate ?? `backup-${index + 1}`,
      timestamp,
      size,
      status: statusValue,
      raw: backup,
    };
  });
};

const BackupTab: React.FC<BackupTabProps> = ({ hasDevConsoleAccess = false }) => {
  const { t } = useTranslation();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const {
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
  } = useBackupService();

  useEffect(() => {
    refresh().catch((err) => {
      console.error('Failed to load backup data', err);
      toast.error(t('backup.actionError', { action: t('backup.refresh') }));
    });
  }, [refresh, t]);

  useEffect(() => {
    if (!autoRefresh || isDisabled) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const id = window.setInterval(() => {
      refresh().catch((err) => {
        console.error('Failed to auto-refresh backups', err);
      });
    }, AUTO_REFRESH_INTERVAL);

    return () => window.clearInterval(id);
  }, [autoRefresh, isDisabled, refresh]);

  const normalizedStatus = useMemo(
    () => ({
      state: isDisabled
        ? t('backup.disabled')
        : deriveStatusState(status, t('backup.disabled'), t('backup.statusUnknown')),
      lastBackup: deriveLastBackupTimestamp(status),
      total: deriveTotalBackups(status),
      storage: deriveStorageLocation(status),
    }),
    [isDisabled, status, t],
  );

  const normalizedBackups = useMemo(() => normalizeBackups(backups), [backups]);

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) {
      return '—';
    }

    return new Date(lastUpdated).toLocaleTimeString();
  }, [lastUpdated]);

  const handleActionError = (errorValue: unknown, actionLabel: string) => {
    const message = errorValue instanceof Error ? errorValue.message : String(errorValue ?? '');

    if (message === BACKUP_SERVICE_DISABLED_ERROR) {
      toast.error(t('backup.disabled'));
      return;
    }

    const fallback = t('backup.actionError', { action: actionLabel });
    toast.error(message ? `${fallback}: ${message}` : fallback);
  };

  const handleCreate = async () => {
    try {
      await createBackup();
      toast.success(t('backup.createSuccess'));
      await refresh();
    } catch (err) {
      console.error('Failed to create backup', err);
      handleActionError(err, t('backup.create'));
    }
  };

  const handleRestore = async (id: string | null) => {
    if (!id) {
      return;
    }

    try {
      await restoreBackup(id);
      toast.success(t('backup.restoreSuccess'));
      await refresh();
    } catch (err) {
      console.error('Failed to restore backup', err);
      handleActionError(err, t('backup.restore'));
    }
  };

  const handleDelete = async (id: string | null) => {
    if (!id) {
      return;
    }

    try {
      await deleteBackup(id);
      toast.success(t('backup.deleteSuccess'));
      await refresh();
    } catch (err) {
      console.error('Failed to delete backup', err);
      handleActionError(err, t('backup.delete'));
    }
  };

  const handleManualRefresh = async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('Failed to refresh backup data', err);
      handleActionError(err, t('backup.refresh'));
    }
  };

  if (!hasDevConsoleAccess) {
    return (
      <div className={`flex h-full items-center justify-center ${gradientBackground} px-6`}>
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 px-10 py-12 text-center text-[#E6E8EC] shadow-[0_24px_60px_rgba(5,10,30,0.55)] backdrop-blur-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl">🔒</div>
          <div className="text-lg font-semibold tracking-wide">{t('admin.accessDenied', 'Access restricted')}</div>
          <div className="mt-2 text-sm text-[#A0A4AD]">
            {t('admin.superAdminOnly', 'Only administrators can access backups')}
          </div>
        </div>
      </div>
    );
  }

  if (isDisabled || status?.enabled === false) {
    return (
      <div className={`${gradientBackground} h-full overflow-y-auto`}>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className={`${surfaceCard} text-center text-sm text-[#A0A4AD]`}>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-[#7C6CFF]/50 bg-[#7C6CFF]/10 text-[#C8C5FF] shadow-[0_18px_32px_rgba(124,108,255,0.35)]">
              <Archive className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('backup.disabled', 'Backups are disabled')}</h2>
            <p className="mt-3 leading-relaxed">
              {t('backup.disabledDescription', 'The backup service is currently unavailable. Actions are disabled.')}
            </p>
            <p className="mt-2 text-xs text-[#7C7F8F]">
              {t('backup.enableHint', 'Enable the backup provider from Settings to restore automated snapshots.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${gradientBackground} h-full overflow-y-auto`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <div className={`${surfaceCard} flex flex-col gap-6 md:flex-row md:items-center md:justify-between`}>
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A4AD]">
              <HardDrive className="h-4 w-4 text-[#7C6CFF]" />
              Backup Ops
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('backup.title')}</h2>
            <p className="flex items-center gap-2 text-sm text-[#A0A4AD]">
              <Clock className="h-4 w-4" />
              <span>
                {t('backup.lastUpdated')}: {formattedLastUpdated}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[#E6E8EC]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-[#0F1320] text-[#25D98E] focus:ring-[#25D98E]"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              {t('backup.autoRefresh')}
            </label>
            <button type="button" onClick={handleManualRefresh} disabled={isLoading} className={glassButton}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('backup.refresh')}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isDisabled || actionState?.type === 'create'}
              className={primaryButton}
            >
              {actionState?.type === 'create' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4" />
              )}
              {t('backup.create')}
            </button>
          </div>
        </div>

        {error && !isDisabled && (
          <div className={`${secondarySurface} flex items-start gap-3 border border-[#E14B8E]/40 bg-[#E14B8E]/10 text-[#F5B0D1]`}>
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-white">{t('backup.status')}</p>
              <p className="text-xs text-[#F8C4DE] md:text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className={secondarySurface}>
            <div className="text-xs uppercase tracking-[0.3em] text-[#7C7F8F]">{t('backup.status')}</div>
            <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-white">
              <HardDrive className="h-5 w-5 text-[#25D98E]" />
              <span>{normalizedStatus.state}</span>
            </div>
          </div>
          <div className={secondarySurface}>
            <div className="text-xs uppercase tracking-[0.3em] text-[#7C7F8F]">{t('backup.lastBackup')}</div>
            <div className="mt-3 text-lg font-semibold text-white">
              {formatDate(normalizedStatus.lastBackup, t('backup.lastBackupUnknown'))}
            </div>
          </div>
          <div className={secondarySurface}>
            <div className="text-xs uppercase tracking-[0.3em] text-[#7C7F8F]">{t('backup.totalBackups')}</div>
            <div className="mt-3 text-lg font-semibold text-white">{normalizedStatus.total ?? '—'}</div>
            {normalizedStatus.storage && (
              <div className="mt-3 text-xs text-[#A0A4AD]">
                {t('backup.storageLocation')}: <span className="font-medium text-white/80">{normalizedStatus.storage}</span>
              </div>
            )}
          </div>
        </div>

        <div className={tableWrapper}>
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h3 className="text-lg font-semibold text-white">{t('backup.list')}</h3>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#A0A4AD]">
              {normalizedBackups.length} {t('backup.totalBackups')}
            </div>
          </div>

          {normalizedBackups.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[#A0A4AD]">{t('backup.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-[#A0A4AD]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.25em]">{t('backup.id')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.25em]">{t('backup.lastBackup')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.25em]">{t('backup.size')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.25em]">{t('backup.status')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.25em]">{t('backup.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[#E6E8EC]">
                  {normalizedBackups.map((backup) => {
                    const isRestoreLoading = actionState?.type === 'restore' && actionState.id === backup.id;
                    const isDeleteLoading = actionState?.type === 'delete' && actionState.id === backup.id;

                    return (
                      <tr key={backup.key} className="transition-colors duration-200 hover:bg-white/5">
                        <td className="px-6 py-4 font-mono text-xs text-[#D1D4E5]">{backup.label}</td>
                        <td className="px-6 py-4 text-sm text-[#C8CBE0]">
                          {formatDate(backup.timestamp, t('backup.lastBackupUnknown'))}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#C8CBE0]">
                          {formatBytes(backup.size, t('backup.sizeUnknown'))}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white">
                            {backup.status ?? t('backup.statusUnknown')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleRestore(backup.id)}
                              disabled={isDisabled || !backup.id || isRestoreLoading}
                              className={glassButton}
                            >
                              {isRestoreLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                              {t('backup.restore')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(backup.id)}
                              disabled={isDisabled || !backup.id || isDeleteLoading}
                              className={dangerButton}
                            >
                              {isDeleteLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {t('backup.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupTab;

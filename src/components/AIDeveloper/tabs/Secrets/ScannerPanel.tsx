import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import {
  scanSecrets,
  fetchRequiredSecrets,
  syncSecrets,
  rollbackSecrets,
  type SecretScanSuggestion,
  type SecretVisibility,
  type SecretSource,
  type RequiredSecretsResponse,
  type RequiredSecretItem,
  type SecretsSyncResponse,
  SecretsApiError,
} from '@aispace/services/secretsAdminApi';
import type { CreatePlaceholderOptions, SyncResult } from './types';

interface ScannerPanelProps {
  existingKeys: Set<string>;
  onCreatePlaceholder: (options: CreatePlaceholderOptions) => void;
  onRefreshSecrets: () => void;
  pendingSync: boolean;
  onSyncCompleted: (result: SyncResult) => void;
  lastSync: SyncResult;
}

type ScannerStatus = 'missing' | 'ready' | 'exists';

const statusColors: Record<ScannerStatus, string> = {
  missing: 'text-amber-300',
  ready: 'text-sky-300',
  exists: 'text-emerald-300',
};

const healthColors: Record<'ok' | 'degraded', string> = {
  ok: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  degraded: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
};

const determineVisibility = (): SecretVisibility => 'hidden';

const ScannerPanel: React.FC<ScannerPanelProps> = ({
  existingKeys,
  onCreatePlaceholder,
  onRefreshSecrets,
  pendingSync,
  onSyncCompleted,
  lastSync,
}) => {
  const { t } = useTranslation();
  const [scanResults, setScanResults] = useState<SecretScanSuggestion[]>([]);
  const [acknowledgedScanKeys, setAcknowledgedScanKeys] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanCorrelationId, setScanCorrelationId] = useState<string | null>(null);

  const [requiredData, setRequiredData] = useState<RequiredSecretsResponse | null>(null);
  const [requiredError, setRequiredError] = useState<string | null>(null);
  const [requiredCorrelationId, setRequiredCorrelationId] = useState<string | null>(null);
  const [isLoadingRequired, setIsLoadingRequired] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncCorrelationId, setSyncCorrelationId] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rollbackCorrelationId, setRollbackCorrelationId] = useState<string | null>(null);

  const loadRequired = useCallback(async () => {
    try {
      setIsLoadingRequired(true);
      setRequiredError(null);
      setRequiredCorrelationId(null);
      const response = await fetchRequiredSecrets();
      setRequiredData(response);
      setRequiredCorrelationId(response.correlationId ?? null);
    } catch (error) {
      if (error instanceof SecretsApiError) {
        setRequiredError(error.message);
        setRequiredCorrelationId(error.correlationId ?? null);
      } else {
        setRequiredError(t('aiDeveloper.secrets.required.error', 'Unable to load required secrets.'));
      }
    } finally {
      setIsLoadingRequired(false);
    }
  }, [t]);

  useEffect(() => {
    loadRequired();
  }, [loadRequired]);

  const handleScan = useCallback(async () => {
    try {
      setIsScanning(true);
      setScanError(null);
      setScanCorrelationId(null);
      const response = await scanSecrets();
      setScanResults(response.missing ?? []);
      setScanCorrelationId(response.correlationId ?? null);
      setAcknowledgedScanKeys(new Set());
      if ((response.missing ?? []).length === 0) {
        toast.success(t('aiDeveloper.secrets.scanner.noFindings', 'No missing secrets detected.'));
      }
    } catch (error) {
      if (error instanceof SecretsApiError) {
        setScanError(error.message);
        setScanCorrelationId(error.correlationId ?? null);
      } else {
        setScanError(t('aiDeveloper.secrets.scanner.error', 'Unable to run scan.'));
      }
    } finally {
      setIsScanning(false);
    }
  }, [t]);

  const scanRows = useMemo(() => {
    return scanResults.map((item) => {
      let status: ScannerStatus = 'missing';
      if (existingKeys.has(item.key)) {
        status = 'exists';
      } else if (acknowledgedScanKeys.has(item.key)) {
        status = 'ready';
      }

      return {
        ...item,
        status,
      };
    });
  }, [scanResults, existingKeys, acknowledgedScanKeys]);

  const requiredItems = useMemo<RequiredSecretItem[]>(() => {
    if (!requiredData?.items) {
      return [];
    }
    return [...requiredData.items].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'missing' ? -1 : 1;
      }
      if (a.app !== b.app) {
        return a.app.localeCompare(b.app);
      }
      return a.key.localeCompare(b.key);
    });
  }, [requiredData]);

  const pendingQueueCount = requiredData?.pendingSyncKeys?.length ?? 0;
  const showSyncCallout = pendingSync || pendingQueueCount > 0;

  const handleCreateFromScan = useCallback(
    (item: SecretScanSuggestion) => {
      setAcknowledgedScanKeys((prev) => new Set(prev).add(item.key));
      onCreatePlaceholder({ key: item.key, visibility: item.suggestion.visibility, source: 'scanned' });
      toast.success(t('aiDeveloper.secrets.scanner.placeholder', 'Opening editor with suggested values.'));
    },
    [onCreatePlaceholder, t],
  );

  const handleCreateFromRequired = useCallback(
    (item: RequiredSecretItem) => {
      onCreatePlaceholder({
        key: item.key,
        visibility: determineVisibility(),
        source: 'app',
        markRequired: true,
      });
      toast.success(t('aiDeveloper.secrets.required.createPlaceholder', 'Opening editor for required secret.'));
    },
    [onCreatePlaceholder, t],
  );

  const handleSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      setSyncCorrelationId(null);
      const result = await syncSecrets();
      setSyncCorrelationId(result.correlationId ?? null);
      toast.success(t('aiDeveloper.secrets.sync.success', 'Environment files updated.'));
      onSyncCompleted(result);
      await loadRequired();
    } catch (error) {
      if (error instanceof SecretsApiError) {
        setSyncError(error.message);
        setSyncCorrelationId(error.correlationId ?? null);
      } else {
        setSyncError(t('aiDeveloper.secrets.sync.error', 'Unable to sync environment files.'));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncCompleted, loadRequired, t]);

  const handleRollback = useCallback(async () => {
    try {
      setIsRollingBack(true);
      setRollbackError(null);
      setRollbackCorrelationId(null);
      const result = await rollbackSecrets();
      setRollbackCorrelationId(result.correlationId ?? null);
      toast.success(t('aiDeveloper.secrets.sync.rollbackSuccess', 'Latest backups restored.'));
      onSyncCompleted(null);
      await loadRequired();
    } catch (error) {
      if (error instanceof SecretsApiError) {
        setRollbackError(error.message);
        setRollbackCorrelationId(error.correlationId ?? null);
      } else {
        setRollbackError(t('aiDeveloper.secrets.sync.rollbackError', 'Unable to restore previous .env backups.'));
      }
    } finally {
      setIsRollingBack(false);
    }
  }, [onSyncCompleted, loadRequired, t]);

  const healthCards = useMemo(() => {
    if (!lastSync?.services) {
      return [];
    }
    const order: Array<'frontend' | 'backend' | 'ai-service'> = ['frontend', 'backend', 'ai-service'];
    return order.map((service) => {
      const info = lastSync.services[service];
      if (!info) {
        return null;
      }
      return {
        service,
        info,
      };
    }).filter(Boolean) as Array<{ service: 'frontend' | 'backend' | 'ai-service'; info: SecretsSyncResponse['services']['frontend'] }>;
  }, [lastSync]);

  const renderReason = useCallback(
    (reason: RequiredSecretItem['reasons'][number]) => {
      switch (reason.type) {
        case 'integration':
          return t('aiDeveloper.secrets.required.reason.integration', '{{label}} – {{description}}', {
            label: reason.integrationLabel || reason.integrationId || 'integration',
            description: reason.description || '',
          });
        case 'scan':
          return t('aiDeveloper.secrets.required.reason.scan', 'Referenced in {{module}} ({{count}})', {
            module: t(`aiDeveloper.secrets.apps.${reason.module}`, reason.module ?? 'module'),
            count: reason.count ?? 0,
          });
        case 'flag':
        default:
          return t('aiDeveloper.secrets.required.reason.flag', 'Marked as required by an admin');
      }
    },
    [t],
  );

  return (
    <section className="mt-4 space-y-5 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 text-slate-100 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-violet-300" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-white">
              {t('aiDeveloper.secrets.scanner.title', 'Repository scanner')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('aiDeveloper.secrets.scanner.subtitle', 'Scan source files for env usages and propose placeholders.')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRequired}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800/70 px-3 py-1.5 text-xs text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            disabled={isLoadingRequired}
          >
            {isLoadingRequired ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{t('aiDeveloper.secrets.required.refresh', 'Refresh required')}</span>
          </button>
          {isScanning ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-violet-500/60 px-3 py-1 text-sm text-violet-200">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('aiDeveloper.secrets.scanner.running', 'Scanning…')}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleScan}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/70 bg-violet-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              {t('aiDeveloper.secrets.scanner.cta', 'Scan files')}
            </button>
          )}
        </div>
      </div>

      {showSyncCallout && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-50">
                {t('aiDeveloper.secrets.sync.callout.title', 'Sync required to apply secret changes')}
              </p>
              <p className="text-amber-100/80">
                {t(
                  'aiDeveloper.secrets.sync.callout.body',
                  'Apply secrets to .env files, then restart the frontend (Vite dev server), backend (Express API), and AI service worker to load the new configuration.',
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-400/20 px-4 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-60"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
              {t('aiDeveloper.secrets.sync.callout.syncAction', 'Sync .env now')}
            </button>
            <button
              type="button"
              onClick={handleRollback}
              disabled={isRollingBack}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300/40 px-4 py-1.5 text-xs text-amber-100 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-60"
            >
              {isRollingBack ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
              {t('aiDeveloper.secrets.sync.callout.rollbackAction', 'Restore last backup')}
            </button>
            {pendingQueueCount > 0 && (
              <span className="text-xs text-amber-100/80">
                {t('aiDeveloper.secrets.sync.callout.queue', '{{count}} key(s) waiting in sync queue', {
                  count: pendingQueueCount,
                })}
              </span>
            )}
          </div>
          {syncError && (
            <p className="text-xs text-amber-100/80">
              {syncError}
              {syncCorrelationId && (
                <span className="ml-2 text-amber-200/70">
                  {t('aiDeveloper.secrets.error.correlation', 'Correlation ID: {{id}}', { id: syncCorrelationId })}
                </span>
              )}
            </p>
          )}
          {rollbackError && (
            <p className="text-xs text-amber-100/80">
              {rollbackError}
              {rollbackCorrelationId && (
                <span className="ml-2 text-amber-200/70">
                  {t('aiDeveloper.secrets.error.correlation', 'Correlation ID: {{id}}', { id: rollbackCorrelationId })}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {lastSync && healthCards.length > 0 && (
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                {t('aiDeveloper.secrets.health.title', 'Sync health status')}
              </h4>
              <p className="text-xs text-slate-400">
                {t('aiDeveloper.secrets.health.timestamp', 'Last sync: {{time}}', {
                  time: new Date(lastSync.timestamp).toLocaleString(),
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {healthCards.map(({ service, info }) => (
              <div
                key={service}
                className={`rounded-lg border px-4 py-3 text-sm ${healthColors[info.status]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide">
                    {t(`aiDeveloper.secrets.apps.${service}`, service)}
                  </span>
                  {info.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-2 text-xs">
                  {t('aiDeveloper.secrets.health.missing', '{{count}} missing key(s)', {
                    count: info.missingKeys.length,
                  })}
                </p>
                {info.updatedKeys.length > 0 && (
                  <p className="mt-1 text-xs">
                    {t('aiDeveloper.secrets.health.updated', '{{count}} key(s) written', {
                      count: info.updatedKeys.length,
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {scanError && (
        <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          <p>{scanError}</p>
          {scanCorrelationId && (
            <p className="mt-1 text-xs text-rose-300">
              {t('aiDeveloper.secrets.scanner.correlation', 'Correlation ID: {{id}}', { id: scanCorrelationId })}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        {scanRows.length === 0 && !scanError ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400">
            {t('aiDeveloper.secrets.scanner.empty', 'Run the scanner to see missing secrets suggestions.')}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2">{t('aiDeveloper.secrets.scanner.columns.key', 'Key')}</th>
                <th className="px-3 py-2">{t('aiDeveloper.secrets.scanner.columns.foundIn', 'Found in')}</th>
                <th className="px-3 py-2">{t('aiDeveloper.secrets.scanner.columns.scope', 'Scope')}</th>
                <th className="px-3 py-2">{t('aiDeveloper.secrets.scanner.columns.visibility', 'Visibility')}</th>
                <th className="px-3 py-2">{t('aiDeveloper.secrets.scanner.columns.status', 'Status')}</th>
                <th className="px-3 py-2 text-right">{t('aiDeveloper.secrets.scanner.columns.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {scanRows.map((item) => (
                <tr key={item.key} className="align-top">
                  <td className="px-3 py-3 font-mono text-xs text-violet-200">{item.key}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">
                    <div className="flex flex-wrap gap-2">
                      {item.foundIn.slice(0, 3).map((location) => (
                        <span
                          key={`${item.key}-${location}`}
                          className="inline-flex items-center rounded-md border border-slate-800/70 bg-slate-900/60 px-2 py-1"
                        >
                          {location}
                        </span>
                      ))}
                      {item.foundIn.length > 3 && (
                        <span className="text-slate-500">+{item.foundIn.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-300">{item.suggestion.scope}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">
                    {t(`aiDeveloper.secrets.visibility.${item.suggestion.visibility}`, item.suggestion.visibility)}
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold">
                    <span className={statusColors[item.status]}>
                      {t(`aiDeveloper.secrets.scanner.status.${item.status}`, item.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCreateFromScan(item)}
                        className="rounded-md border border-violet-500/60 px-3 py-1 font-medium text-violet-200 transition hover:border-violet-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        disabled={item.status === 'exists'}
                      >
                        {t('aiDeveloper.secrets.scanner.create', 'Create placeholder')}
                      </button>
                      {item.status === 'exists' && (
                        <button
                          type="button"
                          onClick={onRefreshSecrets}
                          className="rounded-md border border-slate-800/70 px-3 py-1 text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          {t('aiDeveloper.secrets.scanner.refresh', 'Refresh list')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-300" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-white">
            {t('aiDeveloper.secrets.required.title', 'Required by apps')}
          </h4>
          <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            {t('aiDeveloper.secrets.required.badge', 'Must fill')}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {t('aiDeveloper.secrets.required.subtitle', 'Keys referenced by the system or integrations that still need values.')}
        </p>

        {requiredError && (
          <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            <p>{requiredError}</p>
            {requiredCorrelationId && (
              <p className="mt-1 text-xs text-rose-300">
                {t('aiDeveloper.secrets.error.correlation', 'Correlation ID: {{id}}', { id: requiredCorrelationId })}
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          {requiredItems.length === 0 ? (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400">
              {t('aiDeveloper.secrets.required.empty', 'All tracked services have their required keys configured. 🎉')}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2">{t('aiDeveloper.secrets.required.columns.key', 'Key')}</th>
                  <th className="px-3 py-2">{t('aiDeveloper.secrets.required.columns.app', 'App')}</th>
                  <th className="px-3 py-2">{t('aiDeveloper.secrets.required.columns.why', 'Why required')}</th>
                  <th className="px-3 py-2">{t('aiDeveloper.secrets.required.columns.status', 'Status')}</th>
                  <th className="px-3 py-2 text-right">{t('aiDeveloper.secrets.required.columns.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {requiredItems.map((item) => (
                  <tr key={`${item.app}-${item.key}`} className="align-top">
                    <td className="px-3 py-3 font-mono text-xs text-violet-200">{item.key}</td>
                    <td className="px-3 py-3 text-xs text-slate-300">
                      {t(`aiDeveloper.secrets.apps.${item.app}`, item.app)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-300">
                      <ul className="space-y-1">
                        {item.reasons.map((reason, index) => (
                          <li key={`${item.key}-reason-${index}`}>{renderReason(reason)}</li>
                        ))}
                        {item.foundIn.length > 0 && (
                          <li className="text-[11px] text-slate-500">
                            {t('aiDeveloper.secrets.required.foundIn', 'Found in {{count}} file(s)', {
                              count: item.foundIn.length,
                            })}
                          </li>
                        )}
                      </ul>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      <span className={item.status === 'missing' ? 'text-amber-300' : 'text-emerald-300'}>
                        {t(`aiDeveloper.secrets.required.status.${item.status}`, item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCreateFromRequired(item)}
                          className="rounded-md border border-amber-400/60 px-3 py-1 font-medium text-amber-100 transition hover:border-amber-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                          disabled={item.hasSecret && item.hasValue}
                        >
                          {t('aiDeveloper.secrets.required.actions.create', 'Add & mark as required')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
};

export default ScannerPanel;

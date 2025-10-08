// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import {
  listSecrets,
  revealSecret,
  SecretSummary,
  SecretsApiError,
  SecretVisibility,
  SecretSource,
} from '@aispace/services/secretsAdminApi';
import type {
  EditorState,
  RevealState,
  SecretsPageVariant,
  CreatePlaceholderOptions,
  SyncResult,
} from './types';
import SecretList from './SecretList';
import SecretEditorModal from './SecretEditorModal';
import ConfirmDeleteModal from './ConfirmDelete';
import UsagesDrawer from './UsagesDrawer';
import ScannerPanel from './ScannerPanel';

const PAGE_SIZE = 50;

interface SecretsPageProps {
  variant?: SecretsPageVariant;
}

const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
};

const SecretsPage: React.FC<SecretsPageProps> = ({ variant = 'panel' }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretSummary | null>(null);
  const [usagesKey, setUsagesKey] = useState<string | null>(null);
  const [revealState, setRevealState] = useState<Record<string, RevealState>>({});
  const revealControllers = useRef(new Map<string, AbortController>());
  const [pendingSync, setPendingSync] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult>(null);

  const {
    data: listData,
    error: listError,
    isLoading,
    mutate,
  } = useSWR(
    ['secrets:list', page, debouncedSearch],
    ([, pageIndex, searchTerm]) =>
      listSecrets({ page: pageIndex as number, pageSize: PAGE_SIZE, search: searchTerm as string }),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const secrets = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const pageSize = listData?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    return () => {
      revealControllers.current.forEach((controller) => controller.abort());
      setRevealState({});
    };
  }, []);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleCopyKey = useCallback(
    async (secret: SecretSummary) => {
      try {
        await navigator.clipboard.writeText(secret.key);
        toast.success(t('aiDeveloper.secrets.clipboard.copiedKey', 'Key copied to clipboard'));
      } catch (error) {
        console.error('Failed to copy key', error);
        toast.error(t('aiDeveloper.secrets.clipboard.failed', 'Unable to copy to clipboard'));
      }
    },
    [t],
  );

  const handleCopyValue = useCallback(
    async (secret: SecretSummary) => {
      if (!secret.hasValue) {
        toast.error(t('aiDeveloper.secrets.clipboard.noValue', 'No value available to copy.'));
        return;
      }
      const current = revealState[secret.key];
      const maskedValue =
        current?.revealed && typeof current.value === 'string' && current.value.length > 0
          ? `masked(len:${current.value.length})`
          : 'masked(len:unknown)';
      try {
        await navigator.clipboard.writeText(maskedValue);
        toast.success(t('aiDeveloper.secrets.clipboard.copiedMasked', 'Masked value copied to clipboard'));
      } catch (error) {
        console.error('Failed to copy value', error);
        toast.error(t('aiDeveloper.secrets.clipboard.failed', 'Unable to copy to clipboard'));
      }
    },
    [revealState, t],
  );

  const handleToggleReveal = useCallback(
    async (secret: SecretSummary) => {
      if (secret.visibility !== 'visible') {
        toast.error(t('aiDeveloper.secrets.reveal.hiddenTooltip', 'This value is currently hidden.'));
        return;
      }

      const existing = revealState[secret.key];
      if (existing?.loading) {
        return;
      }

      if (existing?.revealed) {
        setRevealState((prev) => {
          const next = { ...prev };
          delete next[secret.key];
          return next;
        });
        return;
      }

      const controller = new AbortController();
      revealControllers.current.set(secret.key, controller);

      setRevealState((prev) => ({
        ...prev,
        [secret.key]: { value: null, revealed: false, loading: true },
      }));

      try {
        const result = await revealSecret(secret.key, controller.signal);
        setRevealState((prev) => ({
          ...prev,
          [secret.key]: {
            value: result.value ?? '',
            revealed: Boolean(result.value),
            loading: false,
            correlationId: result.correlationId,
          },
        }));
        if (result.value) {
          toast.success(
            t('aiDeveloper.secrets.reveal.ready', 'Value revealed. Use the copy button to grab it.'),
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        const message =
          error instanceof SecretsApiError
            ? error.message
            : t('aiDeveloper.secrets.reveal.failed', 'Unable to reveal value');
        setRevealState((prev) => ({
          ...prev,
          [secret.key]: { value: null, revealed: false, loading: false, error: message },
        }));
        toast.error(message);
      } finally {
        revealControllers.current.delete(secret.key);
      }
    },
    [revealState, t],
  );

  const handleOpenEditor = useCallback(() => {
    setEditorState({ mode: 'create', open: true });
  }, []);

  const handleEditSecret = useCallback((secret: SecretSummary) => {
    setEditorState({ mode: 'edit', open: true, secret });
  }, []);

  const handleCreateFromScanner = useCallback(
    ({ key, visibility, source, markRequired }: CreatePlaceholderOptions) => {
      setEditorState({
        mode: 'create',
        open: true,
        initialKey: key,
        initialVisibility: visibility,
        initialSource: source,
        initialRequired: markRequired,
      });
    },
    [],
  );

  const handleCloseEditor = useCallback(() => {
    setEditorState(null);
  }, []);

  const handleDeleteSecret = useCallback((secret: SecretSummary) => {
    setDeleteTarget(secret);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const existingKeys = useMemo(() => new Set(secrets.map((secret) => secret.key)), [secrets]);

  const handleMutationComplete = useCallback(() => {
    mutate();
    setPendingSync(true);
  }, [mutate]);

  const handleOpenUsages = useCallback((secret: SecretSummary) => {
    setUsagesKey(secret.key);
  }, []);

  const handleCloseUsages = useCallback(() => {
    setUsagesKey(null);
  }, []);

  const handleSyncCompleted = useCallback(
    (result: SyncResult) => {
      setLastSyncResult(result);
      setPendingSync(false);
      mutate();
    },
    [mutate],
  );

  const secretExists = usagesKey ? existingKeys.has(usagesKey) : false;

  const headerClasses =
    variant === 'panel'
      ? 'flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 shadow-lg'
      : 'flex flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/80 p-6 shadow-xl';

  const wrapperClasses =
    variant === 'panel'
      ? 'flex h-full flex-col gap-4 overflow-hidden text-slate-100'
      : 'min-h-screen bg-slate-950/70 px-6 py-8 text-slate-100';

  const listWrapperClasses = variant === 'panel' ? 'flex flex-1 flex-col overflow-hidden gap-4' : 'flex flex-col gap-4';

  const toolbarClasses = 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';

  const searchWrapperClasses =
    'relative flex items-center gap-2 rounded-xl border border-slate-800/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus-within:border-violet-500/70 focus-within:ring-2 focus-within:ring-violet-500/40';

  const actionGroupClasses = 'flex items-center gap-2';

  const pageLabel = t('aiDeveloper.secrets.pagination.page', 'Page');
  const ofLabel = t('aiDeveloper.secrets.pagination.of', 'of');

  return (
    <div className={wrapperClasses}>
      <div className={listWrapperClasses}>
        <div className={headerClasses}>
          <div className={toolbarClasses}>
            <div className="flex items-center gap-3">
              <div className={searchWrapperClasses}>
                <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  placeholder={t('aiDeveloper.secrets.searchPlaceholder', 'Search secrets by key')}
                  aria-label={t('aiDeveloper.secrets.searchAria', 'Search secrets by key')}
                />
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 text-sm font-medium text-slate-200 transition hover:border-violet-500/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label={t('aiDeveloper.secrets.actions.refresh', 'Refresh secrets list')}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('aiDeveloper.secrets.actions.refresh', 'Refresh secrets list')}</span>
              </button>
            </div>
            <div className={actionGroupClasses}>
              <button
                type="button"
                onClick={handleOpenEditor}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-500/70 bg-violet-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('aiDeveloper.secrets.actions.new', 'New secret')}
              </button>
            </div>
          </div>

          {listError instanceof SecretsApiError && (
            <div
              className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              role="alert"
            >
              <p>{listError.message}</p>
              {listError.correlationId && (
                <p className="mt-1 text-xs text-rose-300">
                  {t('aiDeveloper.secrets.error.correlation', 'Correlation ID: {{id}}', {
                    id: listError.correlationId,
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <SecretList
          secrets={secrets}
          isLoading={isLoading}
          revealState={revealState}
          onCopyKey={handleCopyKey}
          onCopyValue={handleCopyValue}
          onToggleReveal={handleToggleReveal}
          onEdit={handleEditSecret}
          onDelete={handleDeleteSecret}
          onFindUsages={handleOpenUsages}
          total={total}
          searchTerm={debouncedSearch}
          variant={variant}
        />
      </div>

      <ScannerPanel
        existingKeys={existingKeys}
        onCreatePlaceholder={handleCreateFromScanner}
        onRefreshSecrets={handleMutationComplete}
        pendingSync={pendingSync}
        onSyncCompleted={handleSyncCompleted}
        lastSync={lastSyncResult}
      />

      <SecretEditorModal
        state={editorState}
        onClose={handleCloseEditor}
        onCompleted={handleMutationComplete}
      />

      <ConfirmDeleteModal
        secret={deleteTarget}
        onClose={handleCloseDelete}
        onDeleted={handleMutationComplete}
      />

      <UsagesDrawer
        secretKey={usagesKey}
        onClose={handleCloseUsages}
        onCreateSecret={handleCreateFromScanner}
        canCreate={!secretExists}
      />

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-3 text-xs text-slate-400">
          <span>
            {pageLabel} {page} {ofLabel} {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-800/70 px-3 py-1 text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('aiDeveloper.secrets.pagination.previous', 'Previous')}
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-800/70 px-3 py-1 text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('aiDeveloper.secrets.pagination.next', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsPage;
// @ts-nocheck

import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Copy, Eye, EyeOff, FileSearch, Pencil, ShieldCheck, Trash2 } from 'lucide-react';

import type { SecretSummary } from '@aispace/services/secretsAdminApi';
import type { RevealState, SecretsPageVariant } from './types';

interface SecretListProps {
  secrets: SecretSummary[];
  isLoading: boolean;
  total: number;
  searchTerm: string;
  revealState: Record<string, RevealState | undefined>;
  onCopyKey: (secret: SecretSummary) => void;
  onCopyValue: (secret: SecretSummary) => void;
  onToggleReveal: (secret: SecretSummary) => void;
  onEdit: (secret: SecretSummary) => void;
  onDelete: (secret: SecretSummary) => void;
  onFindUsages: (secret: SecretSummary) => void;
  variant: SecretsPageVariant;
}

const formatDateTime = (value: string) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const SecretList: React.FC<SecretListProps> = ({
  secrets,
  isLoading,
  total,
  searchTerm,
  revealState,
  onCopyKey,
  onCopyValue,
  onToggleReveal,
  onEdit,
  onDelete,
  onFindUsages,
  variant,
}) => {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement | null>(null);

  const itemCount = secrets.length;

  const rowVirtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 10,
  });

  const emptyState = useMemo(() => {
    if (isLoading) {
      return null;
    }

    if (total === 0) {
      if (searchTerm) {
        return {
          title: t('aiDeveloper.secrets.empty.searchTitle', 'No results for this search'),
          description: t('aiDeveloper.secrets.empty.searchDescription', 'Try a different key or clear the filter.'),
        };
      }
      return {
        title: t('aiDeveloper.secrets.empty.title', 'No secrets yet'),
        description: t(
          'aiDeveloper.secrets.empty.description',
          'Create your first secret to securely store credentials for the automation stack.',
        ),
      };
    }

    return null;
  }, [isLoading, total, searchTerm, t]);

  const baseTableClasses = 'flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/70 shadow-lg backdrop-blur';
  const tableClasses =
    variant === 'page'
      ? `${baseTableClasses} border-slate-800/60 bg-slate-950/80 shadow-xl`
      : baseTableClasses;

  return (
    <div className={tableClasses}>
      <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,220px)] border-b border-slate-800/60 bg-slate-900/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>{t('aiDeveloper.secrets.table.key', 'Key')}</span>
        <span>{t('aiDeveloper.secrets.table.value', 'Value')}</span>
        <span>{t('aiDeveloper.secrets.table.visibility', 'Visibility')}</span>
        <span>{t('aiDeveloper.secrets.table.source', 'Source')}</span>
        <span className="text-right">{t('aiDeveloper.secrets.table.updated', 'Last updated')}</span>
      </div>

      <div
        ref={parentRef}
        className={`overflow-y-auto ${variant === 'panel' ? 'h-full max-h-[420px]' : 'max-h-[520px]'}`}
      >
        {isLoading && itemCount === 0 ? (
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`secret-skeleton-${index}`}
                className="h-12 animate-pulse rounded-xl bg-slate-900/60"
              />
            ))}
          </div>
        ) : itemCount === 0 && emptyState ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center text-slate-300">
            <ShieldCheck className="h-10 w-10 text-slate-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-slate-100">{emptyState.title}</h3>
            <p className="text-sm text-slate-400">{emptyState.description}</p>
          </div>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const secret = secrets[virtualRow.index];
              const reveal = revealState[secret.key];
              const isVisible = secret.visibility === 'visible';
              const isRevealLoading = Boolean(reveal?.loading);
              const valueDisplay = isRevealLoading
                ? t('aiDeveloper.secrets.reveal.loading', 'Revealing…')
                : reveal?.revealed
                  ? reveal.value || t('aiDeveloper.secrets.value.empty', 'No value set')
                  : secret.hasValue
                    ? t('aiDeveloper.secrets.value.masked', '•••• (hidden)')
                    : t('aiDeveloper.secrets.value.empty', 'No value set');
              const isValueCopyable = Boolean(secret.hasValue);

              return (
                <div
                  key={secret.key}
                  className="absolute left-0 right-0 border-b border-slate-900/40 px-4 py-3 text-sm text-slate-200"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,220px)] items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="truncate font-semibold text-slate-100">{secret.key}</span>
                      {secret.required && (
                        <span className="inline-flex w-fit items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                          {t('aiDeveloper.secrets.flags.required', 'Must fill')}
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>
                          {secret.hasValue
                            ? t('aiDeveloper.secrets.flags.hasValue', 'Encrypted value stored')
                            : t('aiDeveloper.secrets.flags.noValue', 'No value yet')}
                        </span>
                        <button
                          type="button"
                          onClick={() => onFindUsages(secret)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-800/70 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-violet-500/70 hover:text-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('aiDeveloper.secrets.actions.findUsages', 'Find usages')}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="truncate text-slate-100" title={reveal?.revealed ? reveal.value ?? undefined : undefined}>
                        {valueDisplay}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleReveal(secret)}
                        disabled={!isVisible || isRevealLoading}
                        className="rounded-md border border-slate-800/70 p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={
                          isVisible
                            ? reveal?.revealed
                              ? t('aiDeveloper.secrets.actions.hideValue', 'Hide value')
                              : t('aiDeveloper.secrets.actions.showValue', 'Reveal value')
                            : t('aiDeveloper.secrets.reveal.disabled', 'Value is hidden')
                        }
                      >
                        {reveal?.revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyValue(secret)}
                        disabled={!isValueCopyable}
                        className="rounded-md border border-slate-800/70 p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t('aiDeveloper.secrets.actions.copyMaskedValue', 'Copy masked value')}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-sm capitalize text-slate-200">
                      {secret.visibility === 'visible'
                        ? t('aiDeveloper.secrets.visibility.visible', 'Visible')
                        : t('aiDeveloper.secrets.visibility.hidden', 'Hidden')}
                    </div>

                    <div className="text-sm capitalize text-slate-200">
                      {t(`aiDeveloper.secrets.source.${secret.source}`, secret.source)}
                    </div>

                    <div className="flex items-center justify-end gap-3 text-xs text-slate-400">
                      <span>{formatDateTime(secret.updatedAt)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onCopyKey(secret)}
                          className="rounded-md border border-slate-800/70 p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                          aria-label={t('aiDeveloper.secrets.actions.copyKey', 'Copy key')}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(secret)}
                          className="rounded-md border border-slate-800/70 p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                          aria-label={t('aiDeveloper.secrets.actions.edit', 'Edit secret')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(secret)}
                          className="rounded-md border border-rose-500/60 p-1 text-rose-300 transition hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          aria-label={t('aiDeveloper.secrets.actions.delete', 'Delete secret')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {reveal?.error && (
                      <div className="col-span-full mt-2 text-xs text-rose-300">
                        {reveal.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecretList;

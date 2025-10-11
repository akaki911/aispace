import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileCode, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import {
  fetchSecretUsages,
  type SecretUsageModules,
  type SecretUsageResponse,
  SecretsApiError,
} from '@aispace/services/secretsAdminApi';
import type { CreatePlaceholderOptions } from './types';

const determineVisibility = (key: string): CreatePlaceholderOptions['visibility'] =>
  key.startsWith('VITE_') ? 'visible' : 'hidden';

interface UsagesDrawerProps {
  secretKey: string | null;
  onClose: () => void;
  onCreateSecret: (options: CreatePlaceholderOptions) => void;
  canCreate: boolean;
}

const moduleOrder: Array<{ id: keyof SecretUsageModules; labelKey: string; fallback: string }> = [
  { id: 'frontend', labelKey: 'aiDeveloper.secrets.usages.modules.frontend', fallback: 'Frontend' },
  { id: 'backend', labelKey: 'aiDeveloper.secrets.usages.modules.backend', fallback: 'Backend' },
  { id: 'ai-service', labelKey: 'aiDeveloper.secrets.usages.modules.ai', fallback: 'AI Service' },
];

const focusableSelectors = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const UsagesDrawer: React.FC<UsagesDrawerProps> = ({ secretKey, onClose, onCreateSecret, canCreate }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<SecretUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const isOpen = Boolean(secretKey);

  useEffect(() => {
    if (!secretKey) {
      setData(null);
      setError(null);
      setCorrelationId(null);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setCorrelationId(null);
        const response = await fetchSecretUsages(secretKey, controller.signal);
        setData(response);
        setCorrelationId(response.correlationId ?? null);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return;
        }
        if (fetchError instanceof SecretsApiError) {
          setError(fetchError.message);
          setCorrelationId(fetchError.correlationId ?? null);
        } else {
          setError(t('aiDeveloper.secrets.usages.error', 'Unable to load usages.'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [secretKey, t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimeout = window.setTimeout(() => {
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelectors);
      focusable?.[0]?.focus();
    }, 80);

    return () => window.clearTimeout(focusTimeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(focusableSelectors);
        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyLocation = useCallback(
    async (location: { file: string; line: number }) => {
      try {
        await navigator.clipboard.writeText(`${location.file}:${location.line}`);
        toast.success(t('aiDeveloper.secrets.usages.copySuccess', 'Location copied.'));
      } catch (copyError) {
        console.error('Failed to copy usage location', copyError);
        toast.error(t('aiDeveloper.secrets.clipboard.failed', 'Unable to copy to clipboard'));
      }
    },
    [t],
  );

  const usagesByModule = useMemo(() => {
    if (!data) {
      return [] as Array<{ id: keyof SecretUsageModules; label: string; items: SecretUsageResponse['modules'][keyof SecretUsageModules] }>;
    }

    return moduleOrder.map(({ id, labelKey, fallback }) => ({
      id,
      label: t(labelKey, fallback),
      items: data.modules[id] ?? [],
    }));
  }, [data, t]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleCreateSecret = useCallback(() => {
    if (!secretKey) {
      return;
    }
    onCreateSecret({
      key: secretKey,
      visibility: determineVisibility(secretKey),
      source: 'scanned',
      markRequired: false,
    });
    onClose();
  }, [onCreateSecret, onClose, secretKey]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex justify-end bg-slate-950/60 backdrop-blur"
      aria-hidden={!isOpen}
      onClick={handleOverlayClick}
    >
      <div
        ref={drawerRef}
        className="flex h-full w-full max-w-xl flex-col border-l border-slate-800/60 bg-slate-950/95 p-6 text-slate-100 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-usages-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="secret-usages-title" className="text-lg font-semibold text-white">
              {t('aiDeveloper.secrets.usages.title', 'Usages for {{key}}', { key: secretKey })}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {t('aiDeveloper.secrets.usages.subtitle', 'All references grouped by workspace module.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateSecret}
              disabled={!canCreate || !secretKey}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/60 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:border-violet-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('aiDeveloper.secrets.usages.create', 'Create secret')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-label={t('aiDeveloper.secrets.usages.close', 'Close usages drawer')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`usage-skeleton-${index}`} className="h-14 animate-pulse rounded-lg bg-slate-900/60" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            <p>{error}</p>
            {correlationId && (
              <p className="mt-1 text-xs text-rose-300">
                {t('aiDeveloper.secrets.error.correlation', 'Correlation ID: {{id}}', { id: correlationId })}
              </p>
            )}
          </div>
        ) : data && usagesByModule.every((module) => module.items.length === 0) ? (
          <div className="mt-10 flex flex-1 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <FileCode className="h-10 w-10 text-slate-600" aria-hidden="true" />
            <p className="text-sm">
              {t('aiDeveloper.secrets.usages.empty', 'No usages found in the indexed modules.')}
            </p>
          </div>
        ) : (
          <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-2">
            {usagesByModule.map((module) => (
              <section key={module.id}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{module.label}</h3>
                {module.items.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {t('aiDeveloper.secrets.usages.sectionEmpty', 'No references in this module.')}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {module.items.map((item, index) => (
                      <li
                        key={`${module.id}-${item.file}-${item.line}-${index}`}
                        className="rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-mono text-xs text-violet-200">
                            {item.file}:{item.line}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLocation(item)}
                            className="rounded-md border border-slate-800/70 p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                            aria-label={t('aiDeveloper.secrets.usages.copyPath', 'Copy file path')}
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="mt-2 truncate text-xs text-slate-400" title={item.context}>
                          {item.context || t('aiDeveloper.secrets.usages.noContext', 'No preview available.')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsagesDrawer;

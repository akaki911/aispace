// @ts-nocheck

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { deleteSecret, SecretsApiError, type SecretSummary } from '@aispace/services/secretsAdminApi';

interface ConfirmDeleteProps {
  secret: SecretSummary | null;
  onClose: () => void;
  onDeleted: () => void;
}

const focusableSelectors = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const ConfirmDeleteModal: React.FC<ConfirmDeleteProps> = ({ secret, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const isOpen = Boolean(secret);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError(null);
    setCorrelationId(null);

    const focusTimeout = window.setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

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

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelectors);
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

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleDelete = useCallback(async () => {
    if (!secret) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      setCorrelationId(null);
      const result = await deleteSecret(secret.key);
      setCorrelationId(result.correlationId ?? null);
      toast.success(t('aiDeveloper.secrets.delete.success', 'Secret deleted.'));
      onDeleted();
      onClose();
    } catch (deleteError) {
      if (deleteError instanceof SecretsApiError) {
        setError(deleteError.message);
        setCorrelationId(deleteError.correlationId ?? null);
      } else {
        setError(t('aiDeveloper.secrets.delete.error', 'Unable to delete secret.'));
      }
    } finally {
      setIsDeleting(false);
    }
  }, [secret, t, onDeleted, onClose]);

  if (!isOpen || !secret) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-950/90 p-6 text-slate-100 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-rose-500/10 p-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="confirm-delete-title" className="text-lg font-semibold text-white">
              {t('aiDeveloper.secrets.delete.title', 'Delete secret?')}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {t('aiDeveloper.secrets.delete.description', 'This action will remove {{key}} and cannot be undone.', {
                key: secret.key,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            aria-label={t('aiDeveloper.secrets.delete.close', 'Close confirmation dialog')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            <p>{error}</p>
            {correlationId && (
              <p className="mt-1 text-xs text-rose-300">
                {t('aiDeveloper.secrets.error.correlation', 'Correlation ID: {{id}}', { id: correlationId })}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800/70 px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            {t('aiDeveloper.secrets.modals.cancel', 'Cancel')}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/70 bg-rose-600/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-600/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting
              ? t('aiDeveloper.secrets.delete.deleting', 'Deleting…')
              : t('aiDeveloper.secrets.delete.confirm', 'Delete secret')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
// @ts-nocheck

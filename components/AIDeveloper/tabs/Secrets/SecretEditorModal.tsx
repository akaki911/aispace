import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import {
  createSecret,
  updateSecret,
  SecretVisibility,
  SecretSource,
  SecretsApiError,
} from '@aispace/services/secretsAdminApi';
import type { EditorState } from './types';

interface SecretEditorModalProps {
  state: EditorState;
  onClose: () => void;
  onCompleted: () => void;
}

const visibilityOptions: { value: SecretVisibility; labelKey: string; fallback: string }[] = [
  { value: 'hidden', labelKey: 'aiDeveloper.secrets.visibility.hidden', fallback: 'Hidden' },
  { value: 'visible', labelKey: 'aiDeveloper.secrets.visibility.visible', fallback: 'Visible' },
];

const sourceOptions: { value: SecretSource; labelKey: string; fallback: string }[] = [
  { value: 'app', labelKey: 'aiDeveloper.secrets.source.app', fallback: 'App' },
  { value: 'account', labelKey: 'aiDeveloper.secrets.source.account', fallback: 'Account' },
  { value: 'scanned', labelKey: 'aiDeveloper.secrets.source.scanned', fallback: 'Scanned' },
];

const focusableSelectors = [
  'a[href]',
  'button:not([disabled])',
  'textarea',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SecretEditorModal: React.FC<SecretEditorModalProps> = ({ state, onClose, onCompleted }) => {
  const { t } = useTranslation();
  const [keyInput, setKeyInput] = useState('');
  const [visibility, setVisibility] = useState<SecretVisibility>('hidden');
  const [source, setSource] = useState<SecretSource>('app');
  const [valueInput, setValueInput] = useState('');
  const [valueTouched, setValueTouched] = useState(false);
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const isOpen = Boolean(state && state.open);
  const isEditMode = state?.mode === 'edit';
  const secretKeyLabel = t('aiDeveloper.secrets.modals.keyLabel', 'Key');
  const valueLabel = t('aiDeveloper.secrets.modals.valueLabel', 'Value');
  const visibilityLabel = t('aiDeveloper.secrets.modals.visibilityLabel', 'Visibility');
  const sourceLabel = t('aiDeveloper.secrets.modals.sourceLabel', 'Source');
  const cancelLabel = t('aiDeveloper.secrets.modals.cancel', 'Cancel');
  const saveLabel = isEditMode
    ? t('aiDeveloper.secrets.modals.save', 'Save changes')
    : t('aiDeveloper.secrets.modals.create', 'Create secret');
  const requiredLabel = t('aiDeveloper.secrets.modals.requiredLabel', 'Mark as required');
  const requiredDescription = t(
    'aiDeveloper.secrets.modals.requiredDescription',
    'Required secrets will surface in the Required by apps panel until a value is provided.',
  );

  useEffect(() => {
    if (!isOpen || !state) {
      return;
    }

    if (state.mode === 'create') {
      setKeyInput(state.initialKey ?? '');
      setVisibility(state.initialVisibility ?? 'hidden');
      setSource(state.initialSource ?? 'app');
      setValueInput('');
      setValueTouched(false);
      setRequired(state.initialRequired ?? false);
    } else {
      setKeyInput(state.secret.key);
      setVisibility(state.secret.visibility);
      setSource(state.secret.source);
      setValueInput('');
      setValueTouched(false);
      setRequired(Boolean(state.secret.required));
    }

    setError(null);
    setCorrelationId(null);

    const focusTimeout = window.setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 50);

    return () => {
      window.clearTimeout(focusTimeout);
    };
  }, [isOpen, state]);

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

  const handleValueChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValueInput(event.target.value);
    setValueTouched(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state) {
      return;
    }

    const trimmedKey = keyInput.trim();
    if (!trimmedKey) {
      setError(t('aiDeveloper.secrets.modals.validation.keyRequired', 'Key is required.'));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setCorrelationId(null);

      if (state.mode === 'create') {
        const result = await createSecret({
          key: trimmedKey,
          value: valueInput,
          visibility,
          source,
          required,
        });
        setCorrelationId(result.correlationId ?? null);
        toast.success(t('aiDeveloper.secrets.modals.successCreated', 'Secret created successfully.'));
      } else {
        const hasValueChange = valueTouched;
        const hasVisibilityChange = visibility !== state.secret.visibility;
        const hasSourceChange = source !== state.secret.source;
        const hasRequiredChange = required !== Boolean(state.secret.required);

        if (!hasValueChange && !hasVisibilityChange && !hasSourceChange && !hasRequiredChange) {
          setError(t('aiDeveloper.secrets.modals.validation.noChanges', 'No changes to save.'));
          setIsSubmitting(false);
          return;
        }

        const payload: {
          value?: string;
          visibility?: SecretVisibility;
          source?: SecretSource;
          required?: boolean;
        } = {};
        if (hasValueChange) {
          payload.value = valueInput;
        }
        if (hasVisibilityChange) {
          payload.visibility = visibility;
        }
        if (hasSourceChange) {
          payload.source = source;
        }
        if (hasRequiredChange) {
          payload.required = required;
        }

        const result = await updateSecret(state.secret.key, payload);
        setCorrelationId(result.correlationId ?? null);
        toast.success(t('aiDeveloper.secrets.modals.successUpdated', 'Secret updated successfully.'));
      }

      onCompleted();
      onClose();
    } catch (submitError) {
      if (submitError instanceof SecretsApiError) {
        setError(submitError.message);
        setCorrelationId(submitError.correlationId ?? null);
      } else {
        setError(t('aiDeveloper.secrets.modals.error.generic', 'Unable to save secret.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [keyInput, valueInput, visibility, source, valueTouched, state, onCompleted, onClose, t]);

  if (!isOpen || !state) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-editor-title"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-2xl border border-slate-800/80 bg-slate-950/90 p-6 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="secret-editor-title" className="text-xl font-semibold text-white">
              {isEditMode
                ? t('aiDeveloper.secrets.modals.editTitle', 'Edit secret')
                : t('aiDeveloper.secrets.modals.createTitle', 'Create secret')}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {t('aiDeveloper.secrets.modals.subtitle', 'Store sensitive values securely with encryption.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-label={t('aiDeveloper.secrets.modals.close', 'Close editor')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <label className="block text-sm font-medium text-slate-200">
            {secretKeyLabel}
            <input
              ref={firstFieldRef}
              type="text"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
              placeholder="VITE_SERVICE_TOKEN"
              disabled={isEditMode}
              aria-required="true"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            {valueLabel}
            <textarea
              value={valueInput}
              onChange={handleValueChange}
              className="mt-2 h-28 w-full resize-y rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder={t('aiDeveloper.secrets.modals.valueHint', 'Leave blank to keep existing value.')}
              aria-describedby="secret-value-hint"
            />
            <span id="secret-value-hint" className="mt-1 block text-xs text-slate-500">
              {t('aiDeveloper.secrets.modals.valueDescription', 'Values are encrypted before storage. They never leave the server unencrypted.')}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-200">
              {visibilityLabel}
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as SecretVisibility)}
                className="mt-2 w-full rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey, option.fallback)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-200">
              {sourceLabel}
              <select
                value={source}
                onChange={(event) => setSource(event.target.value as SecretSource)}
                className="mt-2 w-full rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey, option.fallback)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-3">
            <input
              id="secret-required-toggle"
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-500 focus:ring-violet-500"
            />
            <div>
              <label htmlFor="secret-required-toggle" className="text-sm font-medium text-slate-200">
                {requiredLabel}
              </label>
              <p className="mt-1 text-xs text-slate-400">{requiredDescription}</p>
            </div>
          </div>
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
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/70 bg-violet-600/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? t('aiDeveloper.secrets.modals.saving', 'Saving…')
              : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecretEditorModal;

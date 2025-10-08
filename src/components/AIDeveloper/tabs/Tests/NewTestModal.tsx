import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { DevTestItem, DevTestType } from './types';
import { useTranslation } from 'react-i18next';

interface NewTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (test: DevTestItem) => void;
}

const NODE_LOCATIONS = [
  { value: 'src/__tests__', label: 'src/__tests__ (frontend)' },
  { value: 'backend/__tests__', label: 'backend/__tests__ (backend)' },
];

const CYPRESS_LOCATIONS = [{ value: 'cypress/e2e', label: 'cypress/e2e (end-to-end)' }];

const NewTestModal: React.FC<NewTestModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<DevTestType>('node');
  const [location, setLocation] = useState<string>(NODE_LOCATIONS[0]?.value ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const nameRequiredMessage = t('aiDeveloper.tests.modal.errors.nameRequired', 'Name is required');
  const locationRequiredMessage = t(
    'aiDeveloper.tests.modal.errors.locationRequired',
    'Select a target folder',
  );
  const createFailedMessage = t(
    'aiDeveloper.tests.modal.errors.createFailed',
    'Unable to create test',
  );
  const unexpectedErrorMessage = t(
    'aiDeveloper.tests.modal.errors.unexpected',
    'Unexpected error while creating test',
  );

  const locationOptions = useMemo(() => {
    return type === 'cypress' ? CYPRESS_LOCATIONS : NODE_LOCATIONS;
  }, [type]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 50);
    } else {
      setName('');
      setType('node');
      setLocation(NODE_LOCATIONS[0]?.value ?? '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!locationOptions.some((option) => option.value === location)) {
      setLocation(locationOptions[0]?.value ?? '');
    }
  }, [locationOptions, location]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError(nameRequiredMessage);
      return;
    }

    if (!location) {
      setError(locationRequiredMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch('/api/dev/tests/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), type, location }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: createFailedMessage }));
        setError(payload?.error ?? createFailedMessage);
        setIsSubmitting(false);
        return;
      }

      const payload = (await response.json()) as { test: DevTestItem };
      onCreated(payload.test);
      onClose();
    } catch (submitError) {
      console.error('Failed to create test', submitError);
      setError(unexpectedErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [name, type, location, onCreated, onClose, nameRequiredMessage, locationRequiredMessage, createFailedMessage, unexpectedErrorMessage]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-test-modal-title"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800/70 bg-slate-950/90 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="new-test-modal-title" className="text-lg font-semibold text-slate-100">
              {t('aiDeveloper.tests.modal.title', 'Create a new test')}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {t('aiDeveloper.tests.modal.subtitle', 'Choose test type and location to scaffold a template.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            aria-label={t('aiDeveloper.tests.modal.close', 'Close')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <label className="block text-sm font-medium text-slate-300">
            {t('aiDeveloper.tests.modal.nameLabel', 'Test name')}
            <input
              ref={firstFieldRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              placeholder="Smoke test"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            {t('aiDeveloper.tests.modal.typeLabel', 'Test type')}
            <select
              value={type}
              onChange={(event) => setType(event.target.value as DevTestType)}
              className="mt-2 w-full rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="node">{t('aiDeveloper.tests.modal.nodeOption', 'Node test (node:test)')}</option>
              <option value="cypress">{t('aiDeveloper.tests.modal.cypressOption', 'Cypress e2e')}</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-300">
            {t('aiDeveloper.tests.modal.locationLabel', 'Location')}
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t('aiDeveloper.tests.modal.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/70 bg-violet-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/70 disabled:text-slate-400"
          >
            {isSubmitting
              ? t('aiDeveloper.tests.modal.submitting', 'Creating…')
              : t('aiDeveloper.tests.modal.submit', 'Create test')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTestModal;

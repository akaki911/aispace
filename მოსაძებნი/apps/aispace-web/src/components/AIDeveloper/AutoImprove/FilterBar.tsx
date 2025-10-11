import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  models: Array<{ id: string; label: string }>;
  selectedModel: string | null;
  onModelChange: (value: string | null) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  disabled?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  models,
  selectedModel,
  onModelChange,
  onRefresh,
  isRefreshing = false,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const options = useMemo(
    () => [
      { id: 'all', label: t('aiImprove.filters.allModels', 'ყველა მოდელი') },
      ...models,
    ],
    [models, t],
  );

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 md:flex-row md:items-center"
      role="search"
      aria-label={t('aiImprove.filters.ariaLabel', 'ფილტრები auto-improve ჩანართისთვის')}
      data-testid="ai-imp:filter:container"
    >
      <label className="relative flex flex-1 items-center">
        <span className="sr-only">{t('aiImprove.filters.searchLabel', 'ძიება')}</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 h-5 w-5 text-slate-500" aria-hidden="true" />
        <input
          data-testid="ai-imp:filter:search"
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-md border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-sm text-slate-100 shadow-inner shadow-violet-500/5 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          placeholder={t('aiImprove.filters.searchPlaceholder', 'ძიება მენეჯერებში...')}
          aria-label={t('aiImprove.filters.searchLabel', 'ძიება')}
        />
      </label>

      <label className="relative flex w-full items-center md:w-64">
        <span className="sr-only">{t('aiImprove.filters.modelLabel', 'მოდელი')}</span>
        <select
          data-testid="ai-imp:filter:select"
          className="w-full appearance-none rounded-md border border-slate-800 bg-slate-950/80 py-2 pl-3 pr-8 text-sm text-slate-100 shadow-inner shadow-violet-500/5 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          value={selectedModel ?? 'all'}
          onChange={(event) => onModelChange(event.target.value === 'all' ? null : event.target.value)}
          aria-label={t('aiImprove.filters.modelLabel', 'მოდელის შერჩევა')}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id} className="bg-gray-900">
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </label>

      <button
        type="button"
        data-testid="ai-imp:filter:refresh"
        onClick={onRefresh}
        className={classNames(
          'inline-flex items-center justify-center gap-2 rounded-md border border-violet-500/60 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-70',
          isRefreshing && 'animate-pulse',
        )}
        aria-live="polite"
        aria-busy={isRefreshing}
        aria-disabled={disabled}
        disabled={disabled}
      >
        <ArrowPathIcon className={classNames('h-5 w-5', isRefreshing && 'animate-spin')} aria-hidden="true" />
        {t('aiImprove.filters.refresh', 'განახლება')}
      </button>
    </div>
  );
};

export default FilterBar;

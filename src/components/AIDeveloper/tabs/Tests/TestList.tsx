import React from 'react';
import classNames from 'classnames';
import { Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DevTestItem, DevTestType } from './types';

interface TestSection {
  key: DevTestType;
  title: string;
  description: string;
  tests: DevTestItem[];
}

interface TestListProps {
  sections: TestSection[];
  onRun: (test: DevTestItem) => void;
  activeTestId?: string | null;
  isRunInProgress: boolean;
  disabledReason?: string | null;
}

const statusTone: Record<'default' | 'active', string> = {
  default:
    'border-slate-800/70 bg-slate-900/60 hover:border-violet-500/40 hover:bg-slate-900/80',
  active: 'border-violet-500/60 bg-slate-900 text-white shadow-[0_0_0_1px_rgba(129,64,255,0.4)]',
};

const TestList: React.FC<TestListProps> = ({
  sections,
  onRun,
  activeTestId,
  isRunInProgress,
  disabledReason,
}) => {
  const { t } = useTranslation();
  const runningBadgeLabel = t('aiDeveloper.tests.list.runningBadge', 'Running');
  const runButtonLabel = t('aiDeveloper.tests.buttons.run', 'Run');
  const fallbackDisabledReason = t(
    'aiDeveloper.tests.list.disabledReason',
    'A test is already running',
  );
  const legacyBadgeLabel = t('aiDeveloper.tests.list.legacyBadge', 'Legacy');
  const legacyDisabledLabel = t(
    'aiDeveloper.tests.list.legacyDisabled',
    'Legacy files cannot run from this panel.',
  );
  const getOutdatedMessage = (test: DevTestItem) => {
    if (!test.outdated) {
      return null;
    }
    if (test.outdatedReason === 'documentation') {
      return t(
        'aiDeveloper.tests.list.outdated.documentation',
        'Documentation artifact — safe to remove if unused.',
      );
    }
    if (test.outdatedReason === 'unsupported-extension') {
      return t(
        'aiDeveloper.tests.list.outdated.unsupportedExtension',
        'Unsupported extension {{extension}} — convert to node:test or remove.',
        { extension: test.outdatedDetail ?? '' },
      );
    }
    return t('aiDeveloper.tests.list.outdated.generic', 'Outdated test file — safe to remove.');
  };
  return (
    <div className="flex flex-col gap-8" aria-label="Test sources">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`tests-section-${section.key}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3
                id={`tests-section-${section.key}`}
                className="text-sm font-semibold uppercase tracking-wide text-slate-300"
              >
                {section.title}
              </h3>
              <p className="mt-1 text-xs text-slate-400">{section.description}</p>
            </div>
            {section.tests.length > 0 && isRunInProgress && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {runningBadgeLabel}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {section.tests.map((test) => {
              const isActive = activeTestId === test.id;
              const runAriaLabel = t('aiDeveloper.tests.list.runAria', 'Run {{label}}', {
                label: test.label,
              });
              const outdatedMessage = getOutdatedMessage(test);
              const isLegacy = test.type === 'legacy' || Boolean(test.outdated);
              const isRunDisabled = isRunInProgress || test.runnable === false;
              const disabledTitle = isRunDisabled
                ? test.runnable === false
                  ? legacyDisabledLabel
                  : disabledReason ?? fallbackDisabledReason
                : runAriaLabel;
              return (
                <article
                  key={test.id}
                  className={classNames(
                    'flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-violet-500',
                    statusTone[isActive ? 'active' : 'default'],
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-100" title={test.label}>
                        {test.label}
                      </p>
                      {isLegacy && (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                          {legacyBadgeLabel}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400" title={test.detail ?? test.pathOrScript}>
                      {test.detail ?? test.pathOrScript}
                    </p>
                    {outdatedMessage && (
                      <p className="mt-1 text-xs text-amber-200">{outdatedMessage}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/60 bg-violet-600/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-100 transition hover:bg-violet-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/70 disabled:text-slate-400"
                    onClick={() => onRun(test)}
                    data-test-id={`dev-test-${test.id}`}
                    disabled={isRunDisabled}
                    title={disabledTitle}
                    aria-label={runAriaLabel}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {runButtonLabel}
                  </button>
                </article>
              );
            })}
            {section.tests.length === 0 && (
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
                {t('aiDeveloper.tests.sections.empty', 'No {{section}} available.', {
                  section: section.title,
                })}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
};

export default TestList;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Beaker, Filter, PlusCircle, RefreshCcw, Search } from 'lucide-react';
import TestList from './TestList';
import TestRunnerPanel from './TestRunnerPanel';
import NewTestModal from './NewTestModal';
import type { ActiveRunState, DevTestItem, DevTestsResponse, DevTestType, TestRunStatus } from './types';
import { logger } from '@/services/loggingService';
import { buildAdminHeaders } from '@/utils/adminToken';

const escapeSelector = (value: string) =>
  value.replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, '\\$1');

const isAbortError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  const candidate = error as { name?: string; message?: string };
  const name = candidate?.name ?? '';
  if (name === 'AbortError') {
    return true;
  }
  const message = candidate?.message ?? '';
  if (typeof message === 'string' && message.toLowerCase().includes('abort')) {
    return true;
  }
  return typeof message === 'string' && message.toLowerCase().includes('tab-switch');
};

type ListStatus = 'loading' | 'ok' | 'empty' | 'error';

const TestsPage: React.FC = () => {
  const { t } = useTranslation();
  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: t('aiDeveloper.tests.filters.all', 'All') },
      { key: 'npm' as const, label: t('aiDeveloper.tests.filters.npm', 'npm') },
      { key: 'node' as const, label: t('aiDeveloper.tests.filters.node', 'node') },
      { key: 'cypress' as const, label: t('aiDeveloper.tests.filters.cypress', 'cypress') },
      { key: 'legacy' as const, label: t('aiDeveloper.tests.filters.legacy', 'Legacy') },
    ],
    [t],
  );
  const headingTitle = t('aiDeveloper.tests.heading.title', 'Tests lab');
  const refreshingLabel = t('aiDeveloper.tests.heading.refreshing', 'Refreshing…');
  const newTestLabel = t('aiDeveloper.tests.buttons.new', 'New Test');
  const warmupMessage = t(
    'aiDeveloper.tests.status.warmup',
    'Service warming up — tests will appear shortly.',
  );
  const serviceUnavailableMessage = t(
    'aiDeveloper.tests.status.unavailable',
    'Test service temporarily unavailable (503).',
  );
  const loadingLabel = t('aiDeveloper.tests.status.loading', 'Loading tests…');
  const warmupTitle = t('aiDeveloper.tests.status.warmupTitle', 'Service warming up');
  const warmupDescription = t(
    'aiDeveloper.tests.status.warmupDescription',
    'The test service is starting up. Results will appear automatically once discovery finishes.',
  );
  const emptyTitle = t('aiDeveloper.tests.status.emptyTitle', 'No tests found');
  const emptyDescription = t(
    'aiDeveloper.tests.status.emptyDescription',
    'Create your first test to start monitoring and running suites directly from the AI Developer panel.',
  );
  const retryLabel = t('aiDeveloper.tests.buttons.retry', 'Retry now');
  const newPrimaryLabel = t('aiDeveloper.tests.buttons.newPrimary', 'Create your first test');
  const searchPlaceholder = t('aiDeveloper.tests.searchPlaceholder', 'Search by name or path');
  const disabledReasonLabel = t('aiDeveloper.tests.list.disabledReason', 'A test is already running');
  const legacyDisabledMessage = t(
    'aiDeveloper.tests.list.legacyDisabled',
    'Legacy files cannot run from this panel.',
  );
  const summaryTotalLabel = t('aiDeveloper.tests.summary.total', 'Total test files');
  const summaryRunnableLabel = t('aiDeveloper.tests.summary.runnable', 'Runnable tests');
  const summaryLegacyLabel = t('aiDeveloper.tests.summary.legacy', 'Legacy files');
  const tsxWarningText = t(
    'aiDeveloper.tests.warnings.tsx',
    'TypeScript node:test files detected. Install "tsx" to execute them from the panel.',
  );
  const startFailedMessage = t(
    'aiDeveloper.tests.alerts.startFailed',
    'Unable to start test run',
  );
  const startErrorMessage = t(
    'aiDeveloper.tests.alerts.startError',
    'Failed to start test. Check console for details.',
  );
  const stopFailedMessage = t(
    'aiDeveloper.tests.alerts.stopFailed',
    'Failed to stop test run',
  );
  const stopErrorMessage = t(
    'aiDeveloper.tests.alerts.stopError',
    'Failed to stop test run. Check console for details.',
  );
  const [data, setData] = useState<DevTestsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listStatus, setListStatus] = useState<ListStatus>('loading');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DevTestType>('all');
  const [search, setSearch] = useState('');
  const [activeRun, setActiveRun] = useState<ActiveRunState | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);
  const initialFetchRef = useRef(false);
  const activeRunRef = useRef<ActiveRunState | null>(null);

  useEffect(() => {
    activeRunRef.current = activeRun;
  }, [activeRun]);

  const abortOngoingFetch = useCallback((reason?: string) => {
    const controller = abortControllerRef.current;
    if (!controller) {
      return;
    }
    if (!controller.signal.aborted) {
      try {
        controller.abort(reason);
      } catch {
        // no-op
      }
    }
    abortControllerRef.current = null;
  }, []);

  const fetchTests = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const initialLoad = !hasLoadedRef.current;

      if (!silent) {
        if (initialLoad) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
      }

      if (!silent) {
        setListStatus('loading');
      }
      setStatusBanner(null);

      abortOngoingFetch('refresh');
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const finalize = () => {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (!silent) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      };

      const maxAttempts = 3;
      let retries = 0;
      let payload: DevTestsResponse | null = null;
      let lastError: unknown = null;
      let lastStatusCode: number | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const response = await fetch('/api/dev/tests', {
            method: 'GET',
            credentials: 'include',
            headers: buildAdminHeaders(),
            signal: controller.signal,
          });
          lastStatusCode = response.status;
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          payload = (await response.json()) as DevTestsResponse;
          break;
        } catch (error) {
          const abortReason = (controller.signal as { reason?: unknown }).reason;
          if (
            controller.signal.aborted ||
            isAbortError(error) ||
            abortReason === 'tab-switch'
          ) {
            finalize();
            return null;
          }

          const fallbackMessage = (() => {
            if (error instanceof Error) {
              return error.message;
            }
            if (typeof error === 'string') {
              return error;
            }
            if (error && typeof error === 'object') {
              try {
                return JSON.stringify(error);
              } catch {
                return Object.prototype.toString.call(error);
              }
            }
            return 'Unknown tests fetch error';
          })();
          const normalizedError =
            error instanceof Error ? error : new Error(fallbackMessage);
          if (!(error instanceof Error) && typeof (error as { name?: string })?.name === 'string') {
            normalizedError.name = (error as { name?: string }).name as string;
          }

          lastError = normalizedError;

          const normalizedMessage = normalizedError.message?.toLowerCase?.() ?? '';
          const isTransientError =
            normalizedMessage.includes('failed to fetch') ||
            normalizedMessage.includes('network') ||
            normalizedMessage.includes('timeout');

          if (!isTransientError || attempt === maxAttempts - 1) {
            break;
          }

          retries += 1;
          const delay = Math.min(200 * 2 ** attempt, 800);
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, delay);
            controller.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeout);
                resolve();
              },
              { once: true },
            );
          });
        }
      }

      if (!payload || payload.success === false) {
        finalize();
        const fallbackMessage =
          payload?.message ||
          (lastStatusCode === 503 ? serviceUnavailableMessage : warmupMessage);
        if (lastError) {
          console.warn('⚠️ Tests list falling back to empty response', lastError);
        }
        const fallback: DevTestsResponse = {
          success: payload?.success ?? false,
          npmScripts: [],
          nodeTests: [],
          cypressTests: [],
          legacyTests: [],
          hasCypress: false,
          tsxAvailable: payload?.tsxAvailable ?? false,
          activeRun: null,
          status: 'error',
          message: fallbackMessage,
          items: [],
          summary: {
            totalFiles: 0,
            runnable: 0,
            legacy: 0,
            npm: 0,
            node: 0,
            cypress: 0,
          },
        };
        setData(fallback);
        setActiveRun(null);
        setListStatus('error');
        setStatusBanner(fallbackMessage);
        hasLoadedRef.current = true;

        if (retries > 0) {
          void logger.logTestsListRetry(retries, { phase: 'fallback' }).catch(() => undefined);
        }
        void logger
          .logTestsListStatus('error', {
            retries,
            error:
              lastError instanceof Error
                ? lastError.message
                : String(lastError ?? 'unknown'),
          })
          .catch(() => undefined);
        return null;
      }

      const normalized: DevTestsResponse = {
        ...payload,
        npmScripts: payload.npmScripts ?? [],
        nodeTests: payload.nodeTests ?? [],
        cypressTests: payload.cypressTests ?? [],
        legacyTests: payload.legacyTests ?? [],
        items:
          payload.items ??
          [
            ...(payload.npmScripts ?? []),
            ...(payload.nodeTests ?? []),
            ...(payload.cypressTests ?? []),
            ...(payload.legacyTests ?? []),
          ],
        hasCypress: Boolean(payload.hasCypress),
        tsxAvailable: Boolean(payload.tsxAvailable),
        activeRun: payload.activeRun ?? null,
        status: payload.status,
        message: payload.message ?? null,
        summary:
          payload.summary ?? {
            totalFiles:
              (payload.npmScripts?.length ?? 0) +
              (payload.nodeTests?.length ?? 0) +
              (payload.cypressTests?.length ?? 0) +
              (payload.legacyTests?.length ?? 0),
            runnable:
              (payload.npmScripts?.length ?? 0) +
              (payload.nodeTests?.length ?? 0) +
              (payload.cypressTests?.length ?? 0),
            legacy: payload.legacyTests?.length ?? 0,
            npm: payload.npmScripts?.length ?? 0,
            node: payload.nodeTests?.length ?? 0,
            cypress: payload.cypressTests?.length ?? 0,
          },
      };

      setData(normalized);

      if (normalized.activeRun) {
        const activeRun = normalized.activeRun;
        setActiveRun((previous) => {
          if (previous && previous.runId === activeRun.runId) {
            return previous;
          }
          const { runId, label, pathOrScript, type, id, startedAt } = activeRun;
          const descriptor: DevTestItem = {
            id,
            type,
            label,
            pathOrScript,
          };
          return {
            runId,
            test: descriptor,
            status: 'running',
            startedAt: startedAt ?? Date.now(),
            exitCode: null,
          };
        });
      }

      const total =
        normalized.items?.length ??
        (normalized.npmScripts.length +
          normalized.nodeTests.length +
          normalized.cypressTests.length);

      const derivedStatus: ListStatus =
        normalized.status === 'error'
          ? 'error'
          : total > 0
            ? 'ok'
            : 'empty';

      setListStatus(derivedStatus);
      if (normalized.message) {
        setStatusBanner(normalized.message);
      } else if (derivedStatus === 'error') {
        setStatusBanner(
          lastStatusCode === 503 ? serviceUnavailableMessage : warmupMessage,
        );
      } else {
        setStatusBanner(null);
      }

      hasLoadedRef.current = true;
      finalize();

      if (retries > 0) {
        void logger.logTestsListRetry(retries, { phase: 'success' }).catch(() => undefined);
      }
      const statusForLog: 'ok' | 'empty' | 'error' =
        derivedStatus === 'ok' || derivedStatus === 'empty' ? derivedStatus : 'error';
      void logger
        .logTestsListStatus(statusForLog, {
          total,
          retries,
          hasCypress: normalized.hasCypress,
        })
        .catch(() => undefined);

      return normalized;
    },
    [abortOngoingFetch],
  );

  useEffect(() => {
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      void fetchTests();
    }
    return () => {
      abortOngoingFetch('tab-switch');
    };
  }, [fetchTests, abortOngoingFetch]);

  useEffect(() => {
    if (!pendingFocusId) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      const selector = `[data-test-id="dev-test-${escapeSelector(pendingFocusId)}"]`;
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (button) {
        button.focus();
        setPendingFocusId(null);
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [pendingFocusId, data]);

  const testsByType = useMemo(() => {
    if (!data) {
      return {
        npm: [] as DevTestItem[],
        node: [] as DevTestItem[],
        cypress: [] as DevTestItem[],
        legacy: [] as DevTestItem[],
      };
    }
    return {
      npm: data.npmScripts ?? [],
      node: data.nodeTests ?? [],
      cypress: data.cypressTests ?? [],
      legacy: data.legacyTests ?? [],
    };
  }, [data]);

  const filteredSections = useMemo(() => {
    const matchesFilter = (test: DevTestItem) => filter === 'all' || test.type === filter;
    const matchesSearch = (test: DevTestItem) => {
      if (!search.trim()) {
        return true;
      }
      const haystack = [test.label, test.pathOrScript, test.detail ?? '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    };

    const filterTests = (tests: DevTestItem[]) => tests.filter((test) => matchesFilter(test) && matchesSearch(test));

    const sections = [
      {
        key: 'npm' as DevTestType,
        title: 'npm Scripts',
        description: 'package.json test scripts',
        tests: filterTests(testsByType.npm),
      },
      {
        key: 'node' as DevTestType,
        title: 'Node test suites',
        description: 'node:test files from __tests__ folders',
        tests: filterTests(testsByType.node),
      },
      {
        key: 'cypress' as DevTestType,
        title: 'Cypress suites',
        description: 'End-to-end scenarios',
        tests: data?.hasCypress ? filterTests(testsByType.cypress) : [],
      },
      {
        key: 'legacy' as DevTestType,
        title: 'Legacy files',
        description: 'Outdated or non-executable test artifacts',
        tests: filterTests(testsByType.legacy),
      },
    ];

    return sections.filter((section) => {
      if (section.key === 'cypress') {
        return data?.hasCypress;
      }
      if (section.key === 'legacy') {
        return (data?.legacyTests?.length ?? 0) > 0;
      }
      return true;
    });
  }, [filter, search, testsByType, data?.hasCypress, data?.legacyTests]);

  const summaryCounts = useMemo(() => {
    if (!data) {
      return { total: 0, runnable: 0, legacy: 0 } as const;
    }
    const fallbackRunnable =
      (data.npmScripts?.length ?? 0) +
      (data.nodeTests?.length ?? 0) +
      (data.cypressTests?.length ?? 0);
    const legacy = data.summary?.legacy ?? data.legacyTests?.length ?? 0;
    const total =
      data.summary?.totalFiles ??
      (data.items?.length ?? fallbackRunnable + legacy);
    const runnable = data.summary?.runnable ?? fallbackRunnable;
    return { total, runnable, legacy } as const;
  }, [data]);

  const summaryCards = useMemo(
    () => [
      {
        key: 'total',
        label: summaryTotalLabel,
        value: summaryCounts.total,
        tone: 'text-slate-100',
      },
      {
        key: 'runnable',
        label: summaryRunnableLabel,
        value: summaryCounts.runnable,
        tone: 'text-emerald-300',
      },
      {
        key: 'legacy',
        label: summaryLegacyLabel,
        value: summaryCounts.legacy,
        tone: summaryCounts.legacy > 0 ? 'text-amber-300' : 'text-slate-400',
      },
    ],
    [summaryCounts, summaryTotalLabel, summaryRunnableLabel, summaryLegacyLabel],
  );

  const totalVisibleTests = filteredSections.reduce((acc, section) => acc + section.tests.length, 0);
  const isRunInProgress = activeRun?.status === 'running';

  const handleRun = useCallback(
    async (test: DevTestItem) => {
      try {
        if (test.runnable === false) {
          setAlert(legacyDisabledMessage);
          return;
        }
        setAlert(null);
        void logger
          .logTestsRun('start-request', {
            id: test.id,
            type: test.type,
            label: test.label,
            path: test.pathOrScript,
          })
          .catch(() => undefined);
        const response = await fetch('/api/dev/tests/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: test.id,
            type: test.type,
            pathOrScript: test.pathOrScript,
            label: test.label,
          }),
        });

        const payload = (await response
          .json()
          .catch(() => ({ success: false, error: 'Unable to start test run' }))) as {
          success?: boolean;
          runId?: string;
          error?: string;
          status?: string;
        };

        if (!response.ok || payload?.success === false) {
          setAlert(payload?.error ?? 'Unable to start test run');
          void logger
            .logTestsRun('start-failed', {
              id: test.id,
              type: test.type,
              status: response.status,
              error: payload?.error ?? null,
            })
            .catch(() => undefined);
          return;
        }

        if (!payload.runId) {
          setAlert('Failed to start test run');
          return;
        }

        setActiveRun({
          runId: payload.runId,
          test,
          status: 'running',
          startedAt: Date.now(),
          exitCode: null,
        });
        void logger
          .logTestsRun('started', {
            runId: payload.runId,
            id: test.id,
            type: test.type,
          })
          .catch(() => undefined);
      } catch (error) {
        console.error('Failed to run test', error);
        setAlert(startErrorMessage);
        void logger
          .logTestsRun('start-error', {
            id: test.id,
            type: test.type,
            error: error instanceof Error ? error.message : String(error ?? ''),
          })
          .catch(() => undefined);
      }
    },
    [legacyDisabledMessage, startErrorMessage],
  );

  const handleStop = useCallback(async (runId: string) => {
    try {
      void logger
        .logTestsRun('stop-request', {
          runId,
          testId: activeRunRef.current?.test.id ?? null,
          type: activeRunRef.current?.test.type ?? null,
        })
        .catch(() => undefined);
      const response = await fetch(`/api/dev/tests/run/${encodeURIComponent(runId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await response
        .json()
        .catch(() => ({ success: false, error: 'Failed to stop test run' }))) as {
        success?: boolean;
        error?: string;
        status?: string;
      };
      if (!response.ok || payload?.success === false) {
        setAlert(payload?.error ?? 'Failed to stop test run');
        void logger
          .logTestsRun('stop-failed', {
            runId,
            status: response.status,
            error: payload?.error ?? null,
          })
          .catch(() => undefined);
        return;
      }
      void logger
        .logTestsRun('stop-confirmed', { runId })
        .catch(() => undefined);
    } catch (error) {
      console.error('Failed to stop test run', error);
      setAlert(stopErrorMessage);
      void logger
        .logTestsRun('stop-error', {
          runId,
          error: error instanceof Error ? error.message : String(error ?? ''),
        })
        .catch(() => undefined);
    }
  }, []);

  const handleStatusChange = useCallback((status: TestRunStatus, exitCode: number | null) => {
    const current = activeRunRef.current;
    void logger
      .logTestsRun('status', {
        runId: current?.runId ?? null,
        id: current?.test.id ?? null,
        type: current?.test.type ?? null,
        status,
        exitCode,
      })
      .catch(() => undefined);
    setActiveRun((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        status,
        exitCode,
      };
    });
    if (status === 'passed' || status === 'failed') {
      void fetchTests({ silent: true });
    }
  }, [fetchTests]);

  const handleModalCreated = useCallback(
    (test: DevTestItem) => {
      setPendingFocusId(test.id);
      void fetchTests();
    },
    [fetchTests],
  );

  const tsxWarning = useMemo(() => {
    if (!data || data.tsxAvailable) {
      return null;
    }
    const hasTsTests = data.nodeTests?.some((test) => test.pathOrScript.endsWith('.ts') || test.pathOrScript.endsWith('.tsx'));
    if (!hasTsTests) {
      return null;
    }
    return tsxWarningText;
  }, [data]);

  const renderLoadingSkeleton = () => (
    <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`skeleton-list-${index}`}
            className="flex flex-col gap-3 rounded-xl border border-slate-900/80 bg-slate-900/60 p-4"
          >
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-700/60" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800/60" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-24 animate-pulse rounded-full bg-slate-800/60" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-slate-900/70" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4 lg:flex">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-700/60" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800/60" />
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`skeleton-log-${index}`}
              className="h-3 w-full animate-pulse rounded bg-slate-900/70"
            />
          ))}
        </div>
        <div className="h-9 w-32 animate-pulse rounded-full bg-slate-800/60" />
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
          <Beaker className="h-5 w-5 text-violet-300" aria-hidden="true" />
          {headingTitle}
          {isRefreshing && (
            <span className="text-xs font-normal text-slate-400">{refreshingLabel}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-slate-800/70 bg-slate-900/60 px-2 py-1 text-xs text-slate-300">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={
                  option.key === filter
                    ? 'rounded-full bg-violet-600/40 px-3 py-1 font-semibold text-violet-100'
                    : 'rounded-full px-3 py-1 text-slate-400 transition hover:text-white'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-56 rounded-full border border-slate-800/70 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/60 bg-violet-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {newTestLabel}
          </button>
        </div>
      </header>

      {tsxWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {tsxWarning}
        </div>
      )}

      {alert && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {alert}
        </div>
      )}

      {statusBanner && (
        <div
          className={
            listStatus === 'error'
              ? 'rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200'
              : 'rounded-xl border border-slate-700/40 bg-slate-900/60 px-4 py-3 text-sm text-slate-200'
          }
        >
          {statusBanner}
        </div>
      )}

      {!isLoading && data && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-4 py-3"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </div>
              <div className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        renderLoadingSkeleton()
      ) : totalVisibleTests === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 text-center text-slate-400">
          <Beaker className="h-10 w-10 text-violet-400" aria-hidden="true" />
          <div className="text-lg font-semibold text-slate-100">
            {listStatus === 'error' ? warmupTitle : emptyTitle}
          </div>
          <p className="max-w-sm text-sm text-slate-400">
            {listStatus === 'error' ? warmupDescription : emptyDescription}
          </p>
          {listStatus === 'error' ? (
            <button
              type="button"
              onClick={() => {
                void fetchTests();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/60 bg-violet-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {retryLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/60 bg-violet-600/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {newPrimaryLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="flex flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <TestList
              sections={filteredSections}
              onRun={handleRun}
              activeTestId={activeRun?.test.id}
              isRunInProgress={Boolean(isRunInProgress)}
              disabledReason={isRunInProgress ? disabledReasonLabel : null}
            />
          </div>
          <TestRunnerPanel activeRun={activeRun} onStop={handleStop} onStatusChange={handleStatusChange} />
        </div>
      )}

      <NewTestModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onCreated={handleModalCreated} />
    </div>
  );
};

export default TestsPage;

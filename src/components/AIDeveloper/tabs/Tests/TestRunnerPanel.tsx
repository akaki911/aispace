import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, Loader2, StopCircle, XCircle } from 'lucide-react';
import classNames from 'classnames';
import type { ActiveRunState, TestRunStatus } from './types';
import { useTranslation } from 'react-i18next';

interface TestRunnerPanelProps {
  activeRun: ActiveRunState | null;
  onStop: (runId: string) => Promise<void> | void;
  onStatusChange?: (status: TestRunStatus, exitCode: number | null) => void;
}

interface IncomingChunkEvent {
  text?: string;
  timestamp?: number;
}

interface BootstrapEvent {
  status?: TestRunStatus;
  startedAt?: number;
  logLines?: string[];
  exitCode?: number | null;
}

const statusTone: Record<TestRunStatus, string> = {
  idle: 'bg-slate-800/60 text-slate-300',
  running: 'bg-blue-500/10 text-blue-200 border border-blue-500/40',
  passed: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40',
  failed: 'bg-rose-500/10 text-rose-200 border border-rose-500/40',
};

const statusIcon: Record<TestRunStatus, React.ReactNode> = {
  idle: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
  running: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
  passed: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  failed: <XCircle className="h-4 w-4" aria-hidden="true" />,
};

const TestRunnerPanel: React.FC<TestRunnerPanelProps> = ({ activeRun, onStop, onStatusChange }) => {
  const { t } = useTranslation();
  const statusLabel = useMemo(
    () => ({
      idle: t('aiDeveloper.tests.runner.status.idle', 'Idle'),
      running: t('aiDeveloper.tests.runner.status.running', 'Running'),
      passed: t('aiDeveloper.tests.runner.status.passed', 'Passed'),
      failed: t('aiDeveloper.tests.runner.status.failed', 'Failed'),
    }),
    [t],
  );
  const runnerTitle = t('aiDeveloper.tests.runner.title', 'Test runner');
  const runnerSubtitle = t(
    'aiDeveloper.tests.runner.subtitle',
    'Select a test to begin streaming logs.',
  );
  const filterPlaceholder = t('aiDeveloper.tests.runner.filterPlaceholder', 'Filter logs');
  const filterAria = t('aiDeveloper.tests.runner.filterAria', 'Filter log output');
  const copyLabel = t('aiDeveloper.tests.runner.copy', 'Copy');
  const stopLabel = t('aiDeveloper.tests.buttons.stop', 'Stop');
  const copySuccessMessage = t('aiDeveloper.tests.runner.copied', 'Copied!');
  const copyFailureMessage = t('aiDeveloper.tests.runner.copyFailed', 'Copy failed');
  const noLogsMessage = t(
    'aiDeveloper.tests.runner.noLogs',
    'No log output yet. Logs will appear here once the test starts emitting.',
  );
  const [status, setStatus] = useState<TestRunStatus>('idle');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) {
      return logs;
    }
    const lower = searchTerm.toLowerCase();
    return logs.filter((line) => line.toLowerCase().includes(lower));
  }, [logs, searchTerm]);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLogs([]);
    setStatus(activeRun ? activeRun.status : 'idle');
    setExitCode(activeRun ? activeRun.exitCode : null);
    setSearchTerm('');
    setCopyFeedback(null);

    closeEventSource();

    if (!activeRun) {
      return;
    }

    const source = new EventSource(`/api/dev/tests/run/stream/${encodeURIComponent(activeRun.runId)}`);

    source.addEventListener('bootstrap', (event) => {
      try {
        const payload: BootstrapEvent = JSON.parse((event as MessageEvent<string>).data);
        if (Array.isArray(payload.logLines)) {
          setLogs(payload.logLines.slice(-2000));
        }
        if (payload.status) {
          setStatus(payload.status);
        }
        if (typeof payload.exitCode === 'number' || payload.exitCode === null) {
          setExitCode(payload.exitCode);
        }
      } catch (error) {
        console.error('Failed to parse bootstrap event', error);
      }
    });

    source.addEventListener('chunk', (event) => {
      try {
        const payload: IncomingChunkEvent = JSON.parse((event as MessageEvent<string>).data);
        const text = payload.text ?? '';
        const nextLines = text.split(/\r?\n/);
        setLogs((prev) => {
          const combined = [...prev, ...nextLines];
          return combined.slice(-2000);
        });
        const meaningful = nextLines.filter((line) => line.trim().length > 0);
        if (meaningful.length > 0 && liveRegionRef.current) {
          liveRegionRef.current.textContent = meaningful[meaningful.length - 1];
        }
      } catch (error) {
        console.error('Failed to parse chunk event', error);
      }
    });

    source.addEventListener('status', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          status?: TestRunStatus;
          code?: number | null;
          reason?: string;
        };
        if (payload.status) {
          setStatus(payload.status);
          if (payload.status !== 'running') {
            setIsStopping(false);
          }
          if (payload.status === 'passed' || payload.status === 'failed') {
            setExitCode(payload.code ?? null);
          }
          onStatusChange?.(payload.status, payload.code ?? null);
        }
        if (payload.reason) {
          setLogs((prev) => {
            const augmented = [...prev, `[status] ${payload.reason}`];
            return augmented.slice(-2000);
          });
        }
      } catch (error) {
        console.error('Failed to parse status event', error);
      }
    });

    source.onerror = (event) => {
      console.error('Test run stream error', event);
      setStatus('failed');
      onStatusChange?.('failed', null);
    };

    eventSourceRef.current = source;

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [activeRun?.runId, activeRun?.status, closeEventSource, onStatusChange]);

  const handleCopyLogs = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopyFeedback(copySuccessMessage);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to copy logs', error);
      setCopyFeedback(copyFailureMessage);
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  }, [logs]);

  const handleStop = useCallback(async () => {
    if (!activeRun) {
      return;
    }
    try {
      setIsStopping(true);
      await onStop(activeRun.runId);
    } catch (error) {
      console.error('Failed to stop test run', error);
    } finally {
      setTimeout(() => setIsStopping(false), 500);
    }
  }, [activeRun, onStop]);

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{runnerTitle}</h2>
          <p className="text-xs text-slate-400">
            {activeRun ? activeRun.test.label : runnerSubtitle}
          </p>
        </div>
        <div className={classNames('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', statusTone[status])}>
          {statusIcon[status]}
          <span>{statusLabel[status]}</span>
          {exitCode !== null && status !== 'running' && (
            <span className="ml-1 text-[11px] font-normal">
              {t('aiDeveloper.tests.runner.codeLabel', '(code {{code}})', { code: exitCode })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={filterPlaceholder}
          className="flex-1 rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          aria-label={filterAria}
        />
        <button
          type="button"
          onClick={handleCopyLogs}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-violet-500/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Clipboard className="h-4 w-4" aria-hidden="true" />
          {copyLabel}
        </button>
        {activeRun && status === 'running' ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={isStopping}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-600/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:bg-rose-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500"
          >
            <StopCircle className="h-4 w-4" aria-hidden="true" />
            {stopLabel}
          </button>
        ) : null}
      </div>

      {copyFeedback && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {copyFeedback}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/70">
        {filteredLogs.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <p>{noLogsMessage}</p>
            </div>
          </div>
        ) : null}
        <pre
          className="h-full w-full overflow-auto bg-transparent p-4 text-xs text-slate-200"
          aria-live="polite"
        >
          {filteredLogs.map((line, index) => (
            <div key={`${index}-${line}`} className="whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </pre>
      </div>
      <div ref={liveRegionRef} className="sr-only" aria-live="polite" />
    </div>
  );
};

export default TestRunnerPanel;

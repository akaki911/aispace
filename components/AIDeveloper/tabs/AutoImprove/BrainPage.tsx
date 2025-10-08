import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { useAuth } from '@/contexts/useAuth';
import StatusStrip from '@aispace/components/AIDeveloper/AutoImprove/Brain/StatusStrip';
import ThinkingNow from '@aispace/components/AIDeveloper/AutoImprove/Brain/ThinkingNow';
import LastOutcome from '@aispace/components/AIDeveloper/AutoImprove/Brain/LastOutcome';
import NextAction from '@aispace/components/AIDeveloper/AutoImprove/Brain/NextAction';
import LiveFeed from '@aispace/components/AIDeveloper/AutoImprove/Brain/LiveFeed';
import Metrics from '@aispace/components/AIDeveloper/AutoImprove/Brain/Metrics';
import Controls from '@aispace/components/AIDeveloper/AutoImprove/Brain/Controls';
import History from '@aispace/components/AIDeveloper/AutoImprove/Brain/History';
import type {
  ActionEventPayload,
  BrainEventRecord,
  BrainHistoryEntry,
  DecisionEventPayload,
  ErrorEventPayload,
  LogEventPayload,
  MetricEventPayload,
  ProblemEventPayload,
  StatusEventPayload,
} from '@aispace/components/AIDeveloper/AutoImprove/Brain/types';
import { connectAutoImproveStream, type AutoImproveStreamEventName } from '@/lib/sse/autoImproveSSE';
import { createBrainMachine, type BrainMachineSnapshot } from '@/state/brainMachine';
import toast from 'react-hot-toast';

const STREAM_URL = '/api/ai/autoimprove/monitor/stream';
const LOG_RATE_LIMIT = 200;
const LOG_WINDOW_MS = 1000;

const createRecordId = (base?: string | null) => {
  if (base && base.trim().length > 0) {
    return base;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const authorised = (user: ReturnType<typeof useAuth>['user']) => {
  if (!user) {
    return false;
  }
  return user.role === 'SUPER_ADMIN' || user.personalId === '01019062020';
};

const BrainPage: React.FC = () => {
  const { user } = useAuth();
  const machineRef = useRef(createBrainMachine());
  const [connection, setConnection] = useState<BrainMachineSnapshot>(machineRef.current.current);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusEventPayload | null>(null);
  const [currentProblem, setCurrentProblem] = useState<ProblemEventPayload | null>(null);
  const [lastDecision, setLastDecision] = useState<DecisionEventPayload | null>(null);
  const [lastAction, setLastAction] = useState<ActionEventPayload | null>(null);
  const [metric, setMetric] = useState<MetricEventPayload | null>(null);
  const [events, setEvents] = useState<BrainEventRecord[]>([]);
  const [history, setHistory] = useState<BrainHistoryEntry[]>([]);
  const [activeTypes, setActiveTypes] = useState<BrainEventRecord['type'][]>([
    'status',
    'action',
    'decision',
    'problem',
    'log',
    'metric',
    'error',
  ]);
  const [isPaused, setIsPaused] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const controllerRef = useRef<ReturnType<typeof connectAutoImproveStream> | null>(null);
  const recentLogTimestamps = useRef<number[]>([]);
  const hasAccess = authorised(user);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const [transport, setTransport] = useState<'sse' | 'poll'>('sse');
  const [backpressure, setBackpressure] = useState<number>(0);
  const [lastDiffUrl, setLastDiffUrl] = useState<string | null>(null);
  const [lastCheckpointId, setLastCheckpointId] = useState<string | null>(null);
  const [latencyAlerted, setLatencyAlerted] = useState(false);
  const [errorAlerted, setErrorAlerted] = useState(false);

  const activeTypeSet = useMemo(() => new Set(activeTypes), [activeTypes]);
  const historyToneRank: Record<BrainHistoryEntry['tone'], number> = { info: 0, warning: 1, error: 2 };

  const liftTone = (current: BrainHistoryEntry['tone'], candidate: BrainHistoryEntry['tone']) =>
    historyToneRank[candidate] > historyToneRank[current] ? candidate : current;

  useEffect(() => {
    if (!hasAccess) {
      controllerRef.current?.close();
      controllerRef.current = null;
      return;
    }

    const machine = machineRef.current;

    const controller = connectAutoImproveStream(
      STREAM_URL,
      {
        onOpen: () => {
          const snapshot = machine.send({ type: 'SSE_OPEN' });
          setConnection(snapshot);
        },
        onClose: () => {
          setConnection(
            machine.send(
              pausedRef.current
                ? { type: 'PAUSE' }
                : { type: 'SSE_ERROR', fatal: true },
            ),
          );
        },
        onHeartbeatTimeout: () => {
          setConnection(machine.send({ type: 'HEARTBEAT_TIMEOUT' }));
        },
        onError: () => {
          setConnection(machine.send({ type: 'SSE_ERROR' }));
        },
        onTransportChange: (mode) => {
          setTransport(mode);
          if (mode === 'poll') {
            toast('Live feed დაქვეითდა — polling fallback გააქტიურებულია.', { duration: 4000 });
          }
        },
        onBackpressure: (size) => {
          setBackpressure(size);
        },
        onEvent: (eventName: AutoImproveStreamEventName, event) => {
          if (eventName === 'heartbeat') {
            setLastHeartbeatAt(Date.now());
            setConnection(machine.send({ type: 'SSE_MESSAGE' }));
            return;
          }

          if (!event.data) {
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(event.data as string);
          } catch (error) {
            console.warn('Failed to parse brain event payload', error);
            return;
          }

          const runId = typeof (parsed as { runId?: string }).runId === 'string' ? (parsed as { runId?: string }).runId! : null;
          const diffUrl = typeof (parsed as { diffUrl?: string }).diffUrl === 'string' ? (parsed as { diffUrl?: string }).diffUrl! : null;
          const checkpointId = typeof (parsed as { checkpointId?: string }).checkpointId === 'string'
            ? (parsed as { checkpointId?: string }).checkpointId!
            : null;
          const correlationId = typeof (parsed as { correlationId?: string }).correlationId === 'string'
            ? (parsed as { correlationId?: string }).correlationId!
            : null;
          const eventTransport = typeof (parsed as { transport?: 'sse' | 'poll' }).transport === 'string'
            ? (parsed as { transport?: 'sse' | 'poll' }).transport!
            : transport;

          if (runId) {
            setCurrentRunId(runId);
          }
          if (diffUrl) {
            setLastDiffUrl(diffUrl);
          }
          if (checkpointId) {
            setLastCheckpointId(checkpointId);
          }

          if (eventName === 'message') {
            const logPayload: LogEventPayload = {
              level: 'info',
              message: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
              ts: Date.now(),
              runId,
              diffUrl,
              correlationId,
              transport: eventTransport,
            };
            parsed = logPayload;
          }

          if (eventName === 'status') {
            const payload = parsed as StatusEventPayload;
            setStatus(payload);
            const payloadRunId = payload.runId ?? null;
            if (payloadRunId && payloadRunId !== currentRunIdRef.current) {
              currentRunIdRef.current = payloadRunId;
              setCurrentRunId(payloadRunId);
            }
            if (!payloadRunId && currentRunIdRef.current) {
              currentRunIdRef.current = null;
              setCurrentRunId(null);
            }
          }
          if (eventName === 'problem') {
            setCurrentProblem(parsed as ProblemEventPayload);
          }
          if (eventName === 'decision') {
            setLastDecision(parsed as DecisionEventPayload);
          }
          if (eventName === 'action') {
            setLastAction(parsed as ActionEventPayload);
          }
          if (eventName === 'metric') {
            const payload = parsed as MetricEventPayload;
            setMetric({
              cpu: payload.cpu ?? null,
              mem: payload.mem ?? null,
              reqRate: payload.reqRate ?? null,
              errorRate: payload.errorRate ?? null,
              latencyP95: payload.latencyP95 ?? null,
              timestamp: payload.timestamp ?? Date.now(),
            });
          }

          const now = Date.now();
          recentLogTimestamps.current = recentLogTimestamps.current.filter((ts) => now - ts < LOG_WINDOW_MS);
          if (recentLogTimestamps.current.length >= LOG_RATE_LIMIT) {
            return;
          }
          recentLogTimestamps.current.push(now);

          const type: BrainEventRecord['type'] = ['status', 'action', 'decision', 'problem', 'log', 'metric', 'error'].includes(
            eventName as BrainEventRecord['type'],
          )
            ? (eventName as BrainEventRecord['type'])
            : 'log';

          const record: BrainEventRecord = {
            id: createRecordId(event.lastEventId),
            type,
            data: parsed as never,
            runId,
            receivedAt: now,
            diffUrl,
            checkpointId,
            transport: eventTransport,
            correlationId,
          };

          setEvents((prev) => {
            const activeRunId = currentRunIdRef.current;
            const next = [...prev.slice(-199), record];
            if (!activeRunId) {
              return next.filter((entry) => entry.runId === null).slice(-100);
            }
            return next
              .filter((entry) => entry.runId === activeRunId || entry.runId === null)
              .slice(-200);
          });
          setHistory((prev) => {
            if (!record.runId) {
              return prev;
            }

            const existing = prev.find((entry) => entry.runId === record.runId);
            const payloadDiffUrl =
              record.data && typeof record.data === 'object' && 'diffUrl' in record.data
                ? ((record.data as { diffUrl?: string | null }).diffUrl ?? null)
                : null;
            const transportMode = record.transport ?? 'sse';

            const base: BrainHistoryEntry =
              existing ?? {
                runId: record.runId,
                updatedAt: record.receivedAt,
                phase: null,
                headline: 'Monitoring run',
                detail: null,
                tone: 'info',
                diffUrl: record.diffUrl ?? null,
              };

            const updated: BrainHistoryEntry = {
              ...base,
              updatedAt: record.receivedAt,
              diffUrl: record.diffUrl ?? base.diffUrl ?? null,
            };

            switch (record.type) {
              case 'status': {
                updated.phase = record.data.phase ?? updated.phase;
                if (!base.headline || base.headline === 'Monitoring run') {
                  updated.headline = record.data.phase ?? 'Status update';
                }
                break;
              }
              case 'problem': {
                updated.headline = record.data.title;
                updated.detail = record.data.severity
                  ? `Severity: ${record.data.severity}`
                  : record.data.stackKey ?? null;
                updated.tone = liftTone(updated.tone, 'warning');
                break;
              }
              case 'decision': {
                updated.headline = record.data.chosenPath;
                updated.detail = record.data.reason ?? null;
                updated.tone = liftTone(updated.tone, 'info');
                break;
              }
              case 'action': {
                updated.headline = record.data.summary;
                updated.detail = record.data.result ?? null;
                updated.tone = liftTone(updated.tone, 'info');
                break;
              }
              case 'metric': {
                if (!updated.detail) {
                  updated.detail = `CPU ${record.data.cpu ?? '—'}% · ERR ${record.data.errorRate ?? '—'}%`;
                }
                break;
              }
              case 'error': {
                const payload = record.data as ErrorEventPayload;
                updated.headline = payload.message;
                updated.detail = payload.hint ?? String(payload.code);
                updated.tone = 'error';
                break;
              }
              default:
                break;
            }

            const others = prev.filter((entry) => entry.runId !== record.runId);
            return [...others, updated]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 20);
          });

          setConnection(machine.send({ type: 'SSE_MESSAGE' }));
        },
      },
      { headers: { Accept: 'text/event-stream' } },
    );

    controllerRef.current = controller;
    setIsPaused(controller.isPaused());
    setTransport(controller.getTransport());

    return () => {
      pausedRef.current = false;
      controller.close();
      controllerRef.current = null;
    };
  }, [hasAccess]);

  useEffect(() => {
    if (!metric) {
      return;
    }

    if (metric.latencyP95 && metric.latencyP95 > 2500 && !latencyAlerted) {
      toast.error('AI მონიტორის latency ზღვარს გადასცდა (p95 > 2500ms)', { duration: 4000 });
      setLatencyAlerted(true);
    }

    if (metric.latencyP95 && metric.latencyP95 <= 1800 && latencyAlerted) {
      setLatencyAlerted(false);
    }

    if (metric.errorRate && metric.errorRate > 5 && !errorAlerted) {
      toast.error('სავალდებულოა შემოწმება — შეცდომების მაჩვენებელი მაღალია', { duration: 4000 });
      setErrorAlerted(true);
    }

    if (metric.errorRate && metric.errorRate <= 2 && errorAlerted) {
      setErrorAlerted(false);
    }
  }, [metric, latencyAlerted, errorAlerted]);

  useEffect(() => {
    return () => {
      pausedRef.current = false;
      controllerRef.current?.close();
      controllerRef.current = null;
    };
  }, []);

  const toggleType = (type: BrainEventRecord['type']) => {
    setActiveTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((entry) => entry !== type);
      }
      return [...prev, type];
    });
  };

  const onPause = () => {
    pausedRef.current = true;
    controllerRef.current?.pause();
    setIsPaused(true);
    setConnection(machineRef.current.send({ type: 'PAUSE' }));
  };

  const onResume = () => {
    pausedRef.current = false;
    controllerRef.current?.resume();
    setIsPaused(false);
    setConnection(machineRef.current.send({ type: 'RESUME' }));
  };

  const postAction = async (path: string, payload: Record<string, unknown>) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed: ${response.status}`);
    }
  };

  const onRetry = async (runId?: string | null) => {
    if (isRetrying) {
      return;
    }
    try {
      setIsRetrying(true);
      await postAction('/api/ai/autoimprove/actions/retry', { runId });
    } catch (error) {
      console.error('Retry failed', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const onRollback = async (runId?: string | null, checkpointId?: string | null) => {
    if (isRollingBack) {
      return;
    }
    try {
      setIsRollingBack(true);
      const effectiveCheckpoint = checkpointId ?? lastCheckpointId;
      if (!effectiveCheckpoint) {
        console.warn('Rollback requested without checkpoint. Button should have been disabled.');
        return;
      }
      await postAction('/api/ai/autoimprove/actions/rollback', {
        runId: runId ?? currentRunId,
        checkpointId: effectiveCheckpoint,
      });
    } catch (error) {
      console.error('Rollback failed', error);
    } finally {
      setIsRollingBack(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="rounded-3xl border border-slate-800/60 bg-slate-950/80 p-8 text-center text-slate-300">
        <p className="text-lg font-semibold">Access Restricted</p>
        <p className="mt-2 text-sm">Only Gurulo control leads can view the live brain monitor.</p>
      </div>
    );
  }

  const filteredEvents = events.filter((event) => activeTypeSet.has(event.type));
  const runSummary = {
    runId: status?.runId ?? currentRunId ?? '—',
    phase: status?.phase ?? '—',
    focus: currentProblem?.title ?? 'Stable',
    decision: lastDecision?.chosenPath ?? '—',
  };
  const connectionStateLabel = connection.isOffline
    ? 'Offline'
    : connection.isDegraded
      ? 'Degraded'
      : connection.isConnected
        ? 'Online'
        : 'Connecting';
  const connectionModeLabel = connection.value.toUpperCase();
  const heartbeatDisplay = lastHeartbeatAt
    ? new Date(lastHeartbeatAt).toLocaleTimeString()
    : '—';
  const visibleEventsCount = filteredEvents.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-4 rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-slate-950 via-slate-950 to-black p-6 shadow-[0_40px_120px_rgba(76,29,149,0.35)]">
        <StatusStrip
          status={status}
          connection={connection}
          lastHeartbeatAt={lastHeartbeatAt}
          transport={transport}
          backpressure={backpressure}
        />
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <ThinkingNow status={status} problem={currentProblem} decision={lastDecision} />
            <div className="grid gap-4 md:grid-cols-2">
              <LastOutcome action={lastAction} diffUrl={lastDiffUrl} transport={transport} />
              <NextAction decision={lastDecision} statusPhase={status?.phase ?? null} />
            </div>
            <Metrics metric={metric} />
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl border border-purple-500/20 bg-black/40 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-purple-200/80">Current Run</p>
              <dl className="mt-3 space-y-3 text-sm text-slate-200">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Run ID</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-100">{runSummary.runId}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Phase</dt>
                  <dd className="mt-1 text-sm text-slate-100">{runSummary.phase}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Focus</dt>
                  <dd className="mt-1 text-sm text-slate-100">{runSummary.focus}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Decision</dt>
                  <dd className="mt-1 text-sm text-slate-100">{runSummary.decision}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-3xl border border-purple-500/20 bg-black/40 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-purple-200/80">Connection</p>
              <div className="mt-3 space-y-3 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Mode</span>
                  <span className="text-sm font-semibold text-slate-100">{connectionModeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">State</span>
                  <span
                    className={classNames(
                      'rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]',
                      connection.isOffline
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                        : connection.isDegraded
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
                    )}
                  >
                    {connectionStateLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Heartbeat</span>
                  <span className="text-sm text-slate-100">{heartbeatDisplay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Live Events</span>
                  <span className="text-sm text-slate-100">{visibleEventsCount}</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {lastDecision?.reason ?? 'Awaiting the next decision rationale.'}
              </p>
            </div>
          </div>
        </div>
        <Controls
          onPause={onPause}
          onResume={onResume}
          onRetry={onRetry}
          onRollback={onRollback}
          isPaused={isPaused}
          isRetrying={isRetrying}
          isRollingBack={isRollingBack}
          hasRollbackCheckpoint={Boolean(lastCheckpointId)}
          currentRunId={currentRunId}
        />
      </div>
      <div className={classNames('grid gap-6 lg:grid-cols-[2fr_1fr]')}>
        <LiveFeed events={filteredEvents} activeTypes={activeTypeSet} onToggleType={toggleType} />
        <History
          entries={history}
          onSelect={(entry) => {
            console.debug('History selected', entry);
          }}
          onDiffNavigate={(_, diffUrl) => {
            if (diffUrl) {
              setLastDiffUrl(diffUrl);
            }
          }}
        />
      </div>
    </div>
  );
};

export default BrainPage;

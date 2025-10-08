export type BrainMachineTone = 'green' | 'yellow' | 'red' | 'purple' | 'slate';

export type BrainMachineMode = 'offline' | 'connecting' | 'online' | 'degraded';

export interface BrainMachineSnapshot {
  headline?: string;
  status?: string;
  percent?: number;
  tasksActive?: number;
  value: BrainMachineMode;
  color: BrainMachineTone;
  isOffline: boolean;
  isDegraded: boolean;
  isConnected: boolean;
}

type BrainMachineEvent =
  | { type: 'SSE_OPEN' }
  | { type: 'SSE_MESSAGE' }
  | { type: 'SSE_ERROR'; fatal?: boolean }
  | { type: 'HEARTBEAT_TIMEOUT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' };

export interface BrainMachineController {
  current: BrainMachineSnapshot;
  snapshot(): BrainMachineSnapshot;
  send(event: BrainMachineEvent): BrainMachineSnapshot;
  pause(): BrainMachineSnapshot;
  resume(): BrainMachineSnapshot;
  shutdown(): BrainMachineSnapshot;
}

const deriveColor = (value: BrainMachineMode, fatal = false): BrainMachineTone => {
  if (fatal) {
    return 'red';
  }

  switch (value) {
    case 'online':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'connecting':
      return 'purple';
    default:
      return 'slate';
  }
};

const createSnapshot = (
  value: BrainMachineMode,
  overrides: Partial<Omit<BrainMachineSnapshot, 'value' | 'color' | 'isOffline' | 'isDegraded' | 'isConnected'>> = {},
  fatal = false,
): BrainMachineSnapshot => {
  return {
    headline: overrides.headline ?? (value === 'online' ? 'Live connection established' : 'Connection offline'),
    status: overrides.status ?? value,
    percent: overrides.percent ?? (value === 'online' ? 100 : 0),
    tasksActive: overrides.tasksActive ?? (value === 'online' ? 1 : 0),
    value,
    color: deriveColor(value, fatal),
    isOffline: value === 'offline',
    isDegraded: value === 'degraded',
    isConnected: value === 'online',
  };
};

const transition = (snapshot: BrainMachineSnapshot, event: BrainMachineEvent): BrainMachineSnapshot => {
  switch (event.type) {
    case 'SSE_OPEN':
      return createSnapshot('online', { headline: 'Live monitor connected', status: 'online' });
    case 'SSE_MESSAGE':
      return createSnapshot('online', { headline: snapshot.headline, status: 'online' });
    case 'HEARTBEAT_TIMEOUT':
      return createSnapshot('degraded', {
        headline: 'Heartbeat timeout',
        status: 'degraded',
        percent: snapshot.percent,
        tasksActive: snapshot.tasksActive,
      });
    case 'PAUSE':
      return createSnapshot('connecting', {
        headline: 'Monitoring paused',
        status: 'paused',
        percent: snapshot.percent,
        tasksActive: snapshot.tasksActive,
      });
    case 'RESUME':
      return createSnapshot('online', {
        headline: 'Monitoring resumed',
        status: 'online',
        percent: snapshot.percent ?? 100,
        tasksActive: snapshot.tasksActive,
      });
    case 'SSE_ERROR':
      return createSnapshot(event.fatal ? 'offline' : 'degraded', {
        headline: event.fatal ? 'Connection lost' : 'Connection degraded',
        status: event.fatal ? 'offline' : 'error',
        percent: 0,
        tasksActive: 0,
      }, event.fatal);
    case 'RESET':
    default:
      return createSnapshot('offline');
  }
};

export const createBrainMachine = (): BrainMachineController => {
  let state = createSnapshot('offline');

  const update = (event: BrainMachineEvent) => {
    state = transition(state, event);
    machine.current = state;
    return state;
  };

  const machine: BrainMachineController = {
    current: state,
    snapshot: () => state,
    send: update,
    pause: () => update({ type: 'PAUSE' }),
    resume: () => update({ type: 'RESUME' }),
    shutdown: () => update({ type: 'RESET' }),
  };

  return machine;
};

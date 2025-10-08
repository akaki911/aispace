export type BrainMachineState = 'idle' | 'connecting' | 'ready' | 'paused' | 'error';

export type BrainMachineColor = 'slate' | 'yellow' | 'green' | 'purple' | 'red';

export interface BrainMachineSnapshot {
  value: BrainMachineState;
  color: BrainMachineColor;
  isOffline: boolean;
  isDegraded: boolean;
  isConnected: boolean;
}

export type BrainMachineEvent =
  | { type: 'SSE_OPEN' }
  | { type: 'SSE_MESSAGE' }
  | { type: 'SSE_ERROR'; fatal?: boolean }
  | { type: 'HEARTBEAT_TIMEOUT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export interface BrainMachineController {
  current: BrainMachineSnapshot;
  send: (event: BrainMachineEvent) => BrainMachineSnapshot;
}

const createSnapshot = (value: BrainMachineState, color: BrainMachineColor): BrainMachineSnapshot => ({
  value,
  color,
  isOffline: value === 'error',
  isDegraded: value === 'connecting' || value === 'paused',
  isConnected: value === 'ready' || value === 'paused',
});

const transition = (snapshot: BrainMachineSnapshot, event: BrainMachineEvent): BrainMachineSnapshot => {
  switch (event.type) {
    case 'SSE_OPEN':
      return createSnapshot('ready', 'green');
    case 'SSE_MESSAGE':
      if (snapshot.value === 'idle') {
        return createSnapshot('connecting', 'yellow');
      }
      if (snapshot.value === 'paused') {
        return snapshot;
      }
      return createSnapshot('ready', 'green');
    case 'HEARTBEAT_TIMEOUT':
      return createSnapshot('connecting', 'yellow');
    case 'SSE_ERROR':
      return event.fatal ? createSnapshot('error', 'red') : createSnapshot('connecting', 'purple');
    case 'PAUSE':
      return createSnapshot('paused', 'slate');
    case 'RESUME':
      return createSnapshot('connecting', 'yellow');
    default:
      return snapshot;
  }
};

export const createBrainMachine = (
  initial: BrainMachineSnapshot = createSnapshot('idle', 'slate'),
): BrainMachineController => {
  let current = initial;

  const send = (event: BrainMachineEvent) => {
    current = transition(current, event);
    return current;
  };

  return {
    get current() {
      return current;
    },
    send,
  } as BrainMachineController;
};

export type BrainMachineStateValue = 'idle' | 'connecting' | 'live' | 'degraded' | 'offline' | 'paused';

export type BrainMachineEvent =
  | { type: 'SSE_OPEN' }
  | { type: 'SSE_MESSAGE' }
  | { type: 'SSE_ERROR'; fatal?: boolean }
  | { type: 'HEARTBEAT_TIMEOUT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export interface BrainMachineSnapshot {
  value: BrainMachineStateValue;
  color: 'green' | 'yellow' | 'red' | 'purple' | 'slate';
  isConnected: boolean;
  isDegraded: boolean;
  isOffline: boolean;
}

const COLOR_MAP: Record<BrainMachineStateValue, BrainMachineSnapshot['color']> = {
  idle: 'slate',
  connecting: 'yellow',
  live: 'green',
  degraded: 'yellow',
  offline: 'red',
  paused: 'purple',
};

const CONNECTED_STATES: BrainMachineStateValue[] = ['live', 'degraded'];

const transition = (state: BrainMachineStateValue, event: BrainMachineEvent): BrainMachineStateValue => {
  if (event.type === 'PAUSE') {
    return 'paused';
  }

  if (state === 'paused' && event.type !== 'RESUME') {
    return 'paused';
  }

  switch (event.type) {
    case 'RESUME': {
      return state === 'paused' ? 'connecting' : state;
    }
    case 'SSE_OPEN': {
      return 'live';
    }
    case 'SSE_MESSAGE': {
      if (state === 'idle' || state === 'connecting' || state === 'offline') {
        return 'live';
      }
      return state;
    }
    case 'SSE_ERROR': {
      if (event.fatal) {
        return 'offline';
      }
      if (state === 'offline') {
        return 'offline';
      }
      if (state === 'idle') {
        return 'connecting';
      }
      if (state === 'connecting') {
        return 'degraded';
      }
      return state === 'degraded' ? 'offline' : 'degraded';
    }
    case 'HEARTBEAT_TIMEOUT': {
      if (state === 'live') {
        return 'degraded';
      }
      if (state === 'degraded') {
        return 'offline';
      }
      return state;
    }
    default: {
      return state;
    }
  }
};

const snapshot = (value: BrainMachineStateValue): BrainMachineSnapshot => ({
  value,
  color: COLOR_MAP[value],
  isConnected: CONNECTED_STATES.includes(value),
  isDegraded: value === 'degraded',
  isOffline: value === 'offline',
});

export class BrainMachine {
  private state: BrainMachineStateValue = 'idle';

  get current(): BrainMachineSnapshot {
    return snapshot(this.state);
  }

  send(event: BrainMachineEvent): BrainMachineSnapshot {
    this.state = transition(this.state, event);
    return this.current;
  }

  reset(): BrainMachineSnapshot {
    this.state = 'idle';
    return this.current;
  }
}

export const createBrainMachine = () => new BrainMachine();

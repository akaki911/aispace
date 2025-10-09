export type BrainMachineEvent =
  | { type: 'SSE_OPEN' }
  | { type: 'SSE_CLOSE' }
  | { type: 'SSE_ERROR'; fatal?: boolean }
  | { type: 'SSE_MESSAGE' }
  | { type: 'HEARTBEAT_TIMEOUT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export interface BrainMachineSnapshot {
  status: 'idle' | 'connected' | 'disconnected' | 'error' | 'paused';
  lastEvent: string;
  fatal?: boolean;
}

const transition = (snapshot: BrainMachineSnapshot, event: BrainMachineEvent): BrainMachineSnapshot => {
  switch (event.type) {
    case 'SSE_OPEN':
      return { status: 'connected', lastEvent: event.type };
    case 'SSE_CLOSE':
      return { status: 'disconnected', lastEvent: event.type };
    case 'SSE_ERROR':
      return { status: event.fatal ? 'error' : 'disconnected', lastEvent: event.type, fatal: event.fatal };
    case 'PAUSE':
      return { status: 'paused', lastEvent: event.type };
    case 'RESUME':
      return { status: 'connected', lastEvent: event.type };
    case 'HEARTBEAT_TIMEOUT':
      return { status: 'error', lastEvent: event.type };
    case 'SSE_MESSAGE':
    default:
      return { ...snapshot, lastEvent: event.type };
  }
};

export const createBrainMachine = () => {
  let current: BrainMachineSnapshot = { status: 'idle', lastEvent: 'INIT' };

  const send = (event: BrainMachineEvent): BrainMachineSnapshot => {
    current = transition(current, event);
    return current;
  };

  return {
    get current() {
      return current;
    },
    send,
  };
};

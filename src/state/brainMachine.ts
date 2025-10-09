export type BrainMachineEvent =
  | { type: 'SSE_OPEN' }
  | { type: 'SSE_CLOSE' }
  | { type: 'SSE_ERROR'; fatal?: boolean }
  | { type: 'SSE_MESSAGE' }
  | { type: 'HEARTBEAT_TIMEOUT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

type BrainMachineCoreSnapshot = {
  status: 'idle' | 'connected' | 'disconnected' | 'error' | 'paused';
  lastEvent: string;
  fatal?: boolean;
};

export type BrainMachineSnapshot = BrainMachineCoreSnapshot & {
  color: 'green' | 'yellow' | 'red' | 'purple' | 'slate';
  value: 'online' | 'offline' | 'error' | 'paused' | 'idle';
  isConnected: boolean;
  isOffline: boolean;
  isDegraded: boolean;
};

const enhance = (snapshot: BrainMachineCoreSnapshot): BrainMachineSnapshot => {
  const { status, fatal } = snapshot;

  const color: BrainMachineSnapshot['color'] = (() => {
    switch (status) {
      case 'connected':
        return 'green';
      case 'paused':
        return 'purple';
      case 'error':
        return 'red';
      case 'disconnected':
        return 'yellow';
      default:
        return 'slate';
    }
  })();

  const value: BrainMachineSnapshot['value'] = (() => {
    switch (status) {
      case 'connected':
        return 'online';
      case 'paused':
        return 'paused';
      case 'error':
        return fatal ? 'error' : 'offline';
      case 'disconnected':
        return 'offline';
      default:
        return 'idle';
    }
  })();

  const isOffline = status === 'disconnected' || status === 'error';
  const isConnected = status === 'connected';
  const isDegraded = status === 'paused' || status === 'disconnected' || status === 'error';

  return {
    ...snapshot,
    color,
    value,
    isConnected,
    isOffline,
    isDegraded,
  };
};

const transition = (snapshot: BrainMachineSnapshot, event: BrainMachineEvent): BrainMachineSnapshot => {
  switch (event.type) {
    case 'SSE_OPEN':
      return enhance({ status: 'connected', lastEvent: event.type });
    case 'SSE_CLOSE':
      return enhance({ status: 'disconnected', lastEvent: event.type });
    case 'SSE_ERROR':
      return enhance({ status: event.fatal ? 'error' : 'disconnected', lastEvent: event.type, fatal: event.fatal });
    case 'PAUSE':
      return enhance({ status: 'paused', lastEvent: event.type });
    case 'RESUME':
      return enhance({ status: 'connected', lastEvent: event.type });
    case 'HEARTBEAT_TIMEOUT':
      return enhance({ status: 'error', lastEvent: event.type });
    case 'SSE_MESSAGE':
    default:
      return enhance({ ...snapshot, lastEvent: event.type });
  }
};

export const createBrainMachine = () => {
  let current: BrainMachineSnapshot = enhance({ status: 'idle', lastEvent: 'INIT' });

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

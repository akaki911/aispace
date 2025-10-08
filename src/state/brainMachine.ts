export interface BrainMachineSnapshot {
  headline?: string;
  status?: string;
  percent?: number;
  tasksActive?: number;
}

export const createBrainMachine = () => ({
  snapshot: (): BrainMachineSnapshot => ({ status: 'offline' }),
  shutdown: () => undefined,
});

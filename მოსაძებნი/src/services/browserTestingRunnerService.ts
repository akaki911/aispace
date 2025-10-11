export interface RunnerStatus {
  lastRunAt: string | null;
  lastRunStatus: 'idle' | 'running' | 'failed' | 'succeeded';
  pendingJobs: number;
}

const statusStub: RunnerStatus = {
  lastRunAt: null,
  lastRunStatus: 'idle',
  pendingJobs: 0,
};

export const browserTestingRunnerService = {
  async getStatus(): Promise<RunnerStatus> {
    return Promise.resolve(statusStub);
  },
  async queueSmokeRun(): Promise<{ accepted: boolean }> {
    return Promise.resolve({ accepted: true });
  },
};

export default browserTestingRunnerService;

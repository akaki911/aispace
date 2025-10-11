const state = {
  lastRunAt: null,
  lastRunStatus: 'idle',
  pendingJobs: 0,
};

const getStatus = () => ({ ...state });

const queueRun = () => {
  state.pendingJobs += 1;
  return { accepted: true, pendingJobs: state.pendingJobs };
};

module.exports = {
  getStatus,
  queueRun,
};


export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown' | 'checking';
export type ServiceStatus = 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
export type VerificationStatus = 'pending' | 'running' | 'success' | 'failed' | 'warning';

export const getHealthStatus = (status: string): HealthStatus => {
  const normalizedStatus = status.toLowerCase();
  
  if (['healthy', 'ok', 'success', 'good'].includes(normalizedStatus)) {
    return 'healthy';
  }
  if (['warning', 'degraded', 'partial'].includes(normalizedStatus)) {
    return 'warning';
  }
  if (['error', 'failed', 'critical', 'down'].includes(normalizedStatus)) {
    return 'error';
  }
  if (['checking', 'loading', 'starting'].includes(normalizedStatus)) {
    return 'checking';
  }
  
  return 'unknown';
};

export const getOverallHealth = (statuses: HealthStatus[]): HealthStatus => {
  if (statuses.some(s => s === 'error')) return 'error';
  if (statuses.some(s => s === 'warning')) return 'warning';
  if (statuses.some(s => s === 'checking')) return 'checking';
  if (statuses.every(s => s === 'healthy')) return 'healthy';
  return 'unknown';
};

export const isHealthy = (status: string): boolean => {
  return getHealthStatus(status) === 'healthy';
};

export const isErrorState = (status: string): boolean => {
  return getHealthStatus(status) === 'error';
};

export const isWarningState = (status: string): boolean => {
  return getHealthStatus(status) === 'warning';
};

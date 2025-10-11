
export const getHealthColor = (health: 'OK' | 'WARN' | 'ERROR' | 'healthy' | 'warning' | 'error' | 'unknown' | 'checking'): string => {
  const normalizedHealth = health.toLowerCase();
  
  switch (normalizedHealth) {
    case 'ok':
    case 'healthy':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'warn':
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'checking':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-800 bg-red-100 border-red-300';
    case 'high':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'medium':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'info':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'success':
    case 'completed':
    case 'healthy':
    case 'running':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'warning':
    case 'degraded':
    case 'partial':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'error':
    case 'failed':
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'pending':
    case 'waiting':
    case 'loading':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'stopped':
    case 'disabled':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getRiskColor = (risk?: 'LOW' | 'MEDIUM' | 'HIGH'): string => {
  switch (risk) {
    case 'LOW':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'MEDIUM':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'HIGH':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return 'bg-green-500';
  if (percentage >= 70) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};


import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

interface StatusIconProps {
  status: string;
  size?: number;
  className?: string;
}

export const HealthStatusIcon: React.FC<StatusIconProps> = ({ status, size = 16, className = "" }) => {
  switch (status) {
    case 'healthy':
    case 'ok':
    case 'success':
      return <CheckCircle size={size} className={`text-green-500 ${className}`} />;
    case 'warning':
    case 'degraded':
      return <AlertTriangle size={size} className={`text-yellow-500 ${className}`} />;
    case 'error':
    case 'critical':
    case 'failed':
      return <XCircle size={size} className={`text-red-500 ${className}`} />;
    case 'loading':
    case 'checking':
    case 'running':
      return <RefreshCw size={size} className={`text-blue-500 animate-spin ${className}`} />;
    default:
      return <Clock size={size} className={`text-gray-400 ${className}`} />;
  }
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = "" }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
      case 'critical':
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'loading':
      case 'checking':
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)} ${className}`}>
      <HealthStatusIcon status={status} size={12} className="mr-1" />
      {label || status}
    </span>
  );
};

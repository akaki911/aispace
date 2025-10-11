
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Play,
  Square,
  Pause,
  Activity,
  Shield,
  Info,
  Zap
} from 'lucide-react';

export const getHealthIcon = (health: 'OK' | 'WARN' | 'ERROR' | 'healthy' | 'warning' | 'error' | 'unknown' | 'checking') => {
  const normalizedHealth = health.toLowerCase();
  
  switch (normalizedHealth) {
    case 'ok':
    case 'healthy':
      return CheckCircle;
    case 'warn':
    case 'warning':
      return AlertTriangle;
    case 'error':
      return XCircle;
    case 'checking':
      return RefreshCw;
    default:
      return Clock;
  }
};

export const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'success':
    case 'completed':
    case 'healthy':
      return CheckCircle;
    case 'warning':
    case 'degraded':
    case 'partial':
      return AlertTriangle;
    case 'error':
    case 'failed':
    case 'critical':
      return XCircle;
    case 'running':
    case 'active':
      return Activity;
    case 'pending':
    case 'waiting':
      return Clock;
    case 'loading':
    case 'checking':
      return RefreshCw;
    case 'stopped':
    case 'disabled':
      return Square;
    case 'paused':
      return Pause;
    case 'starting':
      return Play;
    default:
      return Info;
  }
};

export const getRiskIcon = (risk?: 'LOW' | 'MEDIUM' | 'HIGH') => {
  switch (risk) {
    case 'LOW':
      return Shield;
    case 'MEDIUM':
      return Info;
    case 'HIGH':
      return AlertTriangle;
    default:
      return Info;
  }
};

export const getSeverityIcon = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
      return XCircle;
    case 'medium':
      return AlertTriangle;
    case 'low':
      return Info;
    case 'info':
      return Info;
    default:
      return Clock;
  }
};

export const getServiceIcon = (service: string) => {
  switch (service.toLowerCase()) {
    case 'ai':
    case 'ai-service':
      return Zap;
    case 'backend':
    case 'api':
      return Activity;
    case 'frontend':
    case 'ui':
      return Play;
    default:
      return Activity;
  }
};

export interface ServiceError {
  message: string;
  timestamp?: string;
}

export interface Service {
  name?: string;
  status: 'healthy' | 'warning' | 'error' | 'running' | 'stopped' | 'starting' | 'stopping';
  cpu: number;
  memory: number;
  uptime?: string;
  port?: number;
  url?: string;
  pid?: number;
  errors: ServiceError[];
}

export interface ServiceMap {
  frontend: Service;
  backend: Service;
  ai: Service;
}

export interface SystemMetrics {
  windowMinutes: number;
  total: number;
  errors: number;
  invocationsPerMinute: number;
  errorRate: number;
  averageLatency: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  lastUpdated: string | null;
  services: ServiceMap;
}
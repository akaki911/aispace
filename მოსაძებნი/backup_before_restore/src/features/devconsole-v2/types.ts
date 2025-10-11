export interface Service {
  status: 'healthy' | 'warning' | 'error';
  cpu: number;
  memory: number;
}

export interface ServiceMap {
  frontend: Service;
  backend: Service;
  ai: Service;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkRequests: number;
  errorRate: number;
  responseTime: number;
  uptime: string;
  activeConnections: number;
  throughput: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  services: ServiceMap;
}
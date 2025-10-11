import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, Database, Network, Clock, Activity, Server } from 'lucide-react';

interface MetricData {
  value: number;
  trend: 'up' | 'down' | 'stable';
  history: number[];
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
  networkRequests: number;
  responseTime: number;
  throughput: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  activeConnections: number;
  errorRate: number;
  uptime: string;
  timestamp: Date;
}

interface MetricHistory {
  cpu: number[];
  memory: number[];
  requests: number[];
  responseTime: number[];
  throughput: number[];
}

export const LiveMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuUsage: 34.2,
    memoryUsage: 67.8,
    diskIO: 12.4,
    networkRequests: 127,
    responseTime: 145,
    throughput: 500,
    latency: { p50: 50, p95: 120, p99: 200 },
    activeConnections: 350,
    errorRate: 1.5,
    uptime: '2 days 4h 15m',
    timestamp: new Date()
  });

  const [metricHistory, setMetricHistory] = useState<MetricHistory>({
    cpu: Array(20).fill(34.2),
    memory: Array(20).fill(67.8),
    requests: Array(20).fill(127),
    responseTime: Array(20).fill(145),
    throughput: Array(20).fill(500),
  });

  const [isConnected, setIsConnected] = useState(true);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        const cpuUsage = Math.max(0, Math.min(100, prev.cpuUsage + (Math.random() - 0.5) * 8));
        const memoryUsage = Math.max(0, Math.min(100, prev.memoryUsage + (Math.random() - 0.5) * 3));
        const diskIO = Math.max(0, Math.min(100, prev.diskIO + (Math.random() - 0.5) * 5));
        const networkRequests = Math.max(0, prev.networkRequests + Math.floor((Math.random() - 0.5) * 20));
        const responseTime = Math.max(50, Math.min(500, prev.responseTime + (Math.random() - 0.5) * 30));
        const throughput = Math.max(100, Math.min(1000, prev.throughput + (Math.random() - 0.5) * 100));
        const errorRate = Math.max(0, Math.min(10, prev.errorRate + (Math.random() - 0.5) * 1));

        return {
          ...prev,
          cpuUsage,
          memoryUsage,
          diskIO,
          networkRequests,
          responseTime,
          throughput,
          latency: {
            p50: Math.max(20, prev.latency.p50 + (Math.random() - 0.5) * 10),
            p95: Math.max(50, prev.latency.p95 + (Math.random() - 0.5) * 20),
            p99: Math.max(100, prev.latency.p99 + (Math.random() - 0.5) * 30),
          },
          activeConnections: Math.max(100, Math.min(1000, prev.activeConnections + Math.floor((Math.random() - 0.5) * 50))),
          errorRate,
          uptime: prev.uptime, // Uptime doesn't change dynamically in this simulation
          timestamp: new Date(),
        };
      });
    }, 2000);

    // Simulate connection loss/recovery
    const connectionInterval = setInterval(() => {
      setIsConnected(Math.random() > 0.1); // 90% chance of being connected
    }, 15000);


    return () => {
      clearInterval(interval);
      clearInterval(connectionInterval);
    };
  }, []);

  // Update metric history for charts
  useEffect(() => {
    setMetricHistory(prev => ({
      cpu: [...prev.cpu.slice(-19), metrics.cpuUsage], // Keep last 20 points
      memory: [...prev.memory.slice(-19), metrics.memoryUsage],
      requests: [...prev.requests.slice(-19), metrics.networkRequests],
      responseTime: [...prev.responseTime.slice(-19), metrics.responseTime],
      throughput: [...prev.throughput.slice(-19), metrics.throughput]
    }));
  }, [metrics]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp size={12} className="text-green-500" />;
      case 'down': return <TrendingDown size={12} className="text-red-500" />;
      default: return <Minus size={12} className="text-gray-400" />;
    }
  };

  const renderMiniChart = (history: number[], color: string = 'blue') => (
    <div className="flex items-end space-x-px h-8 mt-1">
      {history.map((value, index) => {
        const max = Math.max(...history);
        const min = Math.min(...history);
        const range = max - min;
        const scaledValue = range === 0 ? 50 : ((value - min) / range) * 100; // Scale between 0 and 100
        return (
          <div
            key={index}
            className={`w-1 rounded-sm bg-${color}-400 transition-all duration-200`}
            style={{ height: `${Math.max(scaledValue, 2)}%` }}
          />
        );
      })}
    </div>
  );

  const renderLiveChart = (history: number[], color: string, label: string, unit: string) => (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {history[history.length - 1]?.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-20">
        <svg width="100%" height="100%" className="overflow-visible">
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={`rgb(59, 130, 246)`} stopOpacity="0.5"/>
              <stop offset="100%" stopColor={`rgb(59, 130, 246)`} stopOpacity="0.1"/>
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke={color === 'blue' ? 'rgb(59, 130, 246)' : 'rgb(34, 197, 94)'}
            strokeWidth="2"
            points={history.map((value, index) => {
              const x = (index / (history.length - 1)) * 100;
              const y = 100 - ((value / 100) * 80); // Scale to chart height
              return `${x},${y}`;
            }).join(' ')}
          />
          <polygon
            fill={`url(#gradient-${color})`}
            points={`0,100 ${history.map((value, index) => {
              const x = (index / (history.length - 1)) * 100;
              const y = 100 - ((value / 100) * 80);
              return `${x},${y}`;
            }).join(' ')} 100,100`}
          />
        </svg>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>60s ago</span>
        <span>now</span>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      <div className="p-3 border-b border-gray-300 dark:border-gray-600 flex justify-between items-center">
        <h3 className="text-sm font-semibold">
          DevConsole v2 - Live Metrics
        </h3>
        <div className="flex items-center space-x-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          {isConnected ? (
            <span className="text-green-600 font-medium">Live</span>
          ) : (
            <div className="flex items-center space-x-1">
              <span className="text-red-600">Offline</span>
              <button
                onClick={() => setIsConnected(true)}
                className="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                title="Reconnect to data stream"
              >
                🔄 Reconnect
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-3 space-y-4 overflow-y-auto">
        {/* Connection Status */}
        <div className={`p-2 rounded-lg text-center text-xs font-medium ${
          isConnected
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {isConnected ? (
            '🟢 Real-time Data Active'
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <span>🔴 Data Stream Offline</span>
              <button
                onClick={() => setIsConnected(true)}
                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition-colors"
                title="Attempt to reconnect"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                <Activity size={12} className="mr-1 text-blue-500" />
                CPU
              </span>
              <span className={`text-xs font-bold ${
                metrics.cpuUsage > 70 ? 'text-red-500' : 'text-green-500'
              }`}>
                {metrics.cpuUsage.toFixed(1)}%
              </span>
            </div>
            {renderMiniChart(metricHistory.cpu, 'purple')}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                <Server size={12} className="mr-1 text-green-500" />
                Memory
              </span>
              <span className={`text-xs font-bold ${
                metrics.memoryUsage > 80 ? 'text-red-500' : 'text-green-500'
              }`}>
                {metrics.memoryUsage.toFixed(1)}%
              </span>
            </div>
            {renderMiniChart(metricHistory.memory, 'blue')}
          </div>
        </div>

        {/* Network & Performance */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center">
            <Zap size={12} className="mr-1 text-yellow-500" />
            Network & Performance
          </h4>

          <div className="grid grid-cols-1 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Requests/min</span>
                <span className="text-xs font-bold text-green-600">{metrics.networkRequests}</span>
              </div>
              {renderMiniChart(metricHistory.requests, 'green')}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Response Time</span>
                <span className="text-xs font-bold text-yellow-600">{metrics.responseTime.toFixed(0)}ms</span>
              </div>
              {renderMiniChart(metricHistory.responseTime, 'yellow')}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Throughput</span>
                <span className="text-xs font-bold text-cyan-600">{metrics.throughput} KB/s</span>
              </div>
              {renderMiniChart(metricHistory.throughput, 'cyan')}
            </div>
          </div>
        </div>

        {/* Latency Stats */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Latency Distribution
          </h4>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between gap-2">
              <div className="flex-1 text-center min-w-0">
                <div 
                  className="font-mono text-green-400 mb-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ fontSize: 'clamp(12px, 2vw, 18px)' }}
                  title={`${metrics.latency.p50.toFixed(2)}ms`}
                >
                  {metrics.latency.p50.toFixed(2)}ms
                </div>
                <div className="text-xs text-gray-500">p50</div>
              </div>

              <div className="flex-1 text-center min-w-0">
                <div 
                  className="font-mono text-yellow-400 mb-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ fontSize: 'clamp(12px, 2vw, 18px)' }}
                  title={`${metrics.latency.p95.toFixed(2)}ms`}
                >
                  {metrics.latency.p95.toFixed(2)}ms
                </div>
                <div className="text-xs text-gray-500">p95</div>
              </div>

              <div className="flex-1 text-center min-w-0">
                <div 
                  className="font-mono text-red-400 mb-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ fontSize: 'clamp(12px, 2vw, 18px)' }}
                  title={`${metrics.latency.p99.toFixed(2)}ms`}
                >
                  {metrics.latency.p99.toFixed(2)}ms
                </div>
                <div className="text-xs text-gray-500">p99</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Charts */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center">
            📈 Live Performance (60s)
          </h4>

          <div className="space-y-3">
            {renderLiveChart(metricHistory.cpu, 'blue', 'CPU Usage', '%')}
            {renderLiveChart(metricHistory.memory, 'green', 'Memory Usage', '%')}
          </div>
        </div>

        {/* System Status */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            System Status
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Connections</span>
              <span className="font-medium text-blue-600">{metrics.activeConnections}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Error Rate</span>
              <span className={`font-medium ${
                metrics.errorRate > 2 ? 'text-red-600' : 'text-green-600'
              }`}>
                {metrics.errorRate.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Uptime</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{metrics.uptime}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
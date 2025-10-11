
import React, { useEffect, useRef } from 'react';
import { useDevConsoleStore } from './store';

export const MetricsPanel: React.FC = () => {
  const { 
    metrics, 
    metricsHistory, 
    theme, 
    sseStatus,
    setSseStatus,
    setMetrics,
    addMetricsHistory 
  } = useDevConsoleStore();

  const eventSourceRef = useRef<EventSource | null>(null);

  // Metrics SSE Connection
  useEffect(() => {
    const connectMetricsSSE = () => {
      setSseStatus('connecting');
      
      eventSourceRef.current = new EventSource('/api/dev/metrics/stream');

      eventSourceRef.current.onopen = () => {
        console.log('📊 Metrics SSE connected');
        setSseStatus('connected');
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const metricsData = JSON.parse(event.data);
          setMetrics(metricsData);
          addMetricsHistory(metricsData);
        } catch (err) {
          console.error('Failed to parse metrics:', err);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('Metrics SSE error:', error);
        setSseStatus('error');
        setTimeout(connectMetricsSSE, 3000);
      };
    };

    connectMetricsSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const ServiceCard: React.FC<{
    title: string;
    data: any;
    color: string;
  }> = ({ title, data, color }) => (
    <div className={`p-4 rounded-lg border ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-medium ${color}`}>{title}</h3>
        <div className={`w-3 h-3 rounded-full ${
          data?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
        }`} />
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        {data?.cpu !== undefined && (
          <div>
            <span className="text-gray-500">CPU:</span>
            <div className={`font-mono ${data.cpu > 70 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.round(data.cpu)}%
            </div>
          </div>
        )}
        
        {data?.memory !== undefined && (
          <div>
            <span className="text-gray-500">Memory:</span>
            <div className={`font-mono ${data.memory > 80 ? 'text-red-400' : 'text-blue-400'}`}>
              {Math.round(data.memory)}MB
            </div>
          </div>
        )}
        
        {data?.requests !== undefined && (
          <div>
            <span className="text-gray-500">Req/s:</span>
            <div className="font-mono text-purple-400">
              {data.requests}
            </div>
          </div>
        )}
        
        {data?.uptime !== undefined && (
          <div>
            <span className="text-gray-500">Uptime:</span>
            <div className="font-mono text-cyan-400">
              {Math.floor(data.uptime / 60)}m
            </div>
          </div>
        )}

        {data?.buildTime && (
          <div>
            <span className="text-gray-500">Build:</span>
            <div className="font-mono text-yellow-400">
              {data.buildTime}
            </div>
          </div>
        )}
      </div>
      
      {/* Mini Sparkline */}
      <div className="mt-3 h-8 bg-gray-700 rounded relative overflow-hidden">
        <div className="absolute inset-0 flex items-end space-x-1 px-1">
          {Array.from({ length: 20 }, (_, i) => {
            const height = Math.random() * 100;
            return (
              <div
                key={i}
                className={`w-1 ${color.replace('text-', 'bg-')} opacity-60`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-full p-6 overflow-y-auto ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">📊 სისტემის მეტრიკები</h2>
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            sseStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-gray-500">
            {sseStatus === 'connected' ? 'Real-time' : 'Disconnected'}
          </span>
        </div>
      </div>

      {!metrics ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-500">მონაცემები იტვირთება...</p>
        </div>
      ) : (
        <>
          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <ServiceCard
              title="🖥️ Backend Service"
              data={metrics.services.backend}
              color="text-purple-400"
            />
            
            <ServiceCard
              title="🤖 AI Service"
              data={metrics.services.ai}
              color="text-green-400"
            />
            
            <ServiceCard
              title="⚛️ Frontend"
              data={metrics.services.frontend}
              color="text-blue-400"
            />
          </div>

          {/* Latency Metrics */}
          <div className={`p-6 rounded-lg border ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <h3 className="text-lg font-medium mb-4 text-yellow-400">⚡ Response Latency</h3>
            
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-mono text-green-400 mb-1">
                  {Math.round(metrics.latency.p50)}ms
                </div>
                <div className="text-sm text-gray-500">p50 (median)</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-mono text-yellow-400 mb-1">
                  {Math.round(metrics.latency.p95)}ms
                </div>
                <div className="text-sm text-gray-500">p95</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-mono text-red-400 mb-1">
                  {Math.round(metrics.latency.p99)}ms
                </div>
                <div className="text-sm text-gray-500">p99</div>
              </div>
            </div>

            {/* Traffic Light Health */}
            <div className="flex justify-center mt-6">
              <div className={`px-4 py-2 rounded-full text-white font-medium ${
                metrics.latency.p95 < 100 ? 'bg-green-600' :
                metrics.latency.p95 < 500 ? 'bg-yellow-600' : 'bg-red-600'
              }`}>
                {metrics.latency.p95 < 100 ? '🟢 მშვენივრად' :
                 metrics.latency.p95 < 500 ? '🟡 საშუალო' : '🔴 ნელი'}
              </div>
            </div>
          </div>

          {/* History Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            📈 {metricsHistory.length} მეტრიკების ისტორია | 
            🔄 ბოლო განახლება: {new Date(metrics.ts).toLocaleTimeString('ka-GE')}
          </div>
        </>
      )}
    </div>
  );
};

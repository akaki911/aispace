
import React from 'react';
import { useDevConsoleStore } from './store';

export const StatusBar: React.FC = () => {
  const { sseStatus, metrics, theme } = useDevConsoleStore();

  const getStatusColor = () => {
    switch (sseStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className={`h-8 px-4 flex items-center justify-between text-xs border-b ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'
    }`}>
      <div className="flex items-center space-x-4">
        {/* Environment */}
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
          DEV
        </span>
        
        {/* Version */}
        <span className="text-gray-500">
          v2.0.0-sol201
        </span>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
          <span className={getStatusColor()}>
            {sseStatus.toUpperCase()}
          </span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Latency */}
        {metrics && (
          <div className="flex items-center space-x-2 text-gray-500">
            <span>p95: {Math.round(metrics.latency.p95)}ms</span>
            <span>p99: {Math.round(metrics.latency.p99)}ms</span>
          </div>
        )}
        
        {/* Issues (placeholder) */}
        <span className="text-orange-500">
          Issues: 0
        </span>
      </div>
    </div>
  );
};

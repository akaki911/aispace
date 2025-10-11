
import React, { useState, useEffect, useCallback } from 'react';
import { getBackendBaseURL } from '@/lib/env';
import { useAuth } from '../contexts/useAuth';
import { useDarkMode } from '../hooks/useDarkMode';

interface PerformanceMetrics {
  isHealthy: boolean;
  responseTime: number;
  memoryUsage: any;
  requestRate: number;
  timestamp: string;
}

interface CacheStats {
  responseCache: {
    keys: number;
    stats: any;
  };
  conversationCache: {
    keys: number;
    stats: any;
  };
}

interface DetailedStats {
  requests: {
    total: number;
    averageMessageLength: number;
    uniqueUsers: number;
  };
  responses: {
    total: number;
    averageResponseTime: number;
    averageResponseLength: number;
    modelUsage: Record<string, number>;
  };
  errors: {
    total: number;
    errorRate: number;
    errorTypes: Record<string, number>;
  };
  memory: {
    current: any;
    peak: number;
    average: number;
  };
  uptime: number;
}

const PerformanceDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const [realTimeMetrics, setRealTimeMetrics] = useState<PerformanceMetrics | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeframe, setTimeframe] = useState(3600000); // 1 hour
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Check authorization
  const isAuthorized = user?.personalId === '01019062020';

  const getApiEndpoint = useCallback(() => {
    const isProduction = import.meta.env.PROD || window.location.protocol === 'https:';
    const baseURL = isProduction ? window.location.origin : getBackendBaseURL() || 'http://127.0.0.1:5002';

    return `${baseURL}/api/performance`;
  }, []);

  // Fetch real-time metrics
  const fetchRealTimeMetrics = useCallback(async () => {
    if (!isAuthorized) return;

    try {
      const endpoint = `${getApiEndpoint()}/realtime`;
      const response = await fetch(endpoint, { credentials: 'include' });
      
      if (response.ok) {
        const data = await response.json();
        setRealTimeMetrics(data.metrics);
        setCacheStats(data.cache);
      }
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
    }
  }, [isAuthorized, getApiEndpoint]);

  // Fetch detailed statistics
  const fetchDetailedStats = useCallback(async () => {
    if (!isAuthorized) return;

    setIsLoading(true);
    try {
      const endpoint = `${getApiEndpoint()}/stats?timeframe=${timeframe}`;
      const response = await fetch(endpoint, { credentials: 'include' });
      
      if (response.ok) {
        const data = await response.json();
        setDetailedStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch detailed stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, getApiEndpoint, timeframe]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (!isAuthorized) return;

    try {
      const endpoint = `${getApiEndpoint()}/cache/clear`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ personalId: user?.personalId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('🗑️ Cache cleared successfully!');
          fetchRealTimeMetrics();
        }
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('❌ Failed to clear cache');
    }
  }, [isAuthorized, getApiEndpoint, user?.personalId, fetchRealTimeMetrics]);

  // Format memory usage
  const formatMemory = (bytes: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // Format uptime
  const formatUptime = (ms: number) => {
    if (!ms) return 'N/A';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !isAuthorized) return;

    const interval = setInterval(() => {
      fetchRealTimeMetrics();
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, isAuthorized, fetchRealTimeMetrics]);

  // Initial load
  useEffect(() => {
    if (isAuthorized) {
      fetchRealTimeMetrics();
      fetchDetailedStats();
    }
  }, [isAuthorized, fetchRealTimeMetrics, fetchDetailedStats]);

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">📊 AI Performance Dashboard</h2>
          <p className="text-sm opacity-70">Real-time monitoring of AI system performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Auto Refresh</span>
          </label>
          <button
            onClick={clearCache}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            🗑️ Clear Cache
          </button>
        </div>
      </div>

      {/* Real-time Metrics */}
      {realTimeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-70">System Health</p>
                <p className={`text-2xl font-bold ${
                  realTimeMetrics.isHealthy ? 'text-green-500' : 'text-red-500'
                }`}>
                  {realTimeMetrics.isHealthy ? '🟢 Healthy' : '🔴 Issues'}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div>
              <p className="text-sm opacity-70">Avg Response Time</p>
              <p className="text-2xl font-bold text-blue-500">
                {realTimeMetrics.responseTime ? `${realTimeMetrics.responseTime.toFixed(0)}ms` : 'N/A'}
              </p>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div>
              <p className="text-sm opacity-70">Memory Usage</p>
              <p className="text-2xl font-bold text-purple-500">
                {formatMemory(realTimeMetrics.memoryUsage?.heapUsed)}
              </p>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div>
              <p className="text-sm opacity-70">Request Rate</p>
              <p className="text-2xl font-bold text-yellow-500">
                {realTimeMetrics.requestRate ? `${realTimeMetrics.requestRate.toFixed(1)}/min` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cache Statistics */}
      {cacheStats && (
        <div className={`p-6 rounded-lg border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className="text-lg font-semibold mb-4">🧠 Cache Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm opacity-70">Response Cache</p>
              <p className="text-xl font-bold">{cacheStats.responseCache.keys} keys</p>
              <p className="text-sm">Hits: {cacheStats.responseCache.stats?.hits || 0}</p>
            </div>
            <div>
              <p className="text-sm opacity-70">Conversation Cache</p>
              <p className="text-xl font-bold">{cacheStats.conversationCache.keys} summaries</p>
              <p className="text-sm">Hits: {cacheStats.conversationCache.stats?.hits || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Statistics */}
      <div className={`p-6 rounded-lg border ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">📈 Detailed Statistics</h3>
          <div className="flex items-center space-x-2">
            <label className="text-sm">Timeframe:</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(parseInt(e.target.value))}
              className={`px-3 py-1 rounded border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value={300000}>5 minutes</option>
              <option value={900000}>15 minutes</option>
              <option value={3600000}>1 hour</option>
              <option value={86400000}>24 hours</option>
            </select>
            <button
              onClick={fetchDetailedStats}
              disabled={isLoading}
              className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>

        {detailedStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <h4 className="font-medium text-blue-500 mb-2">📨 Requests</h4>
              <p>Total: {detailedStats.requests.total}</p>
              <p>Unique Users: {detailedStats.requests.uniqueUsers}</p>
              <p>Avg Length: {detailedStats.requests.averageMessageLength?.toFixed(0)} chars</p>
            </div>

            <div>
              <h4 className="font-medium text-green-500 mb-2">📤 Responses</h4>
              <p>Total: {detailedStats.responses.total}</p>
              <p>Avg Time: {detailedStats.responses.averageResponseTime?.toFixed(0)}ms</p>
              <p>Avg Length: {detailedStats.responses.averageResponseLength?.toFixed(0)} chars</p>
            </div>

            <div>
              <h4 className="font-medium text-red-500 mb-2">❌ Errors</h4>
              <p>Total: {detailedStats.errors.total}</p>
              <p>Rate: {detailedStats.errors.errorRate?.toFixed(1)}%</p>
            </div>

            <div>
              <h4 className="font-medium text-purple-500 mb-2">💾 System</h4>
              <p>Memory: {formatMemory(detailedStats.memory.current?.heapUsed)}</p>
              <p>Peak: {formatMemory(detailedStats.memory.peak)}</p>
              <p>Uptime: {formatUptime(detailedStats.uptime)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Model Usage */}
      {detailedStats?.responses.modelUsage && (
        <div className={`p-6 rounded-lg border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className="text-lg font-semibold mb-4">🤖 Model Usage</h3>
          <div className="space-y-2">
            {Object.entries(detailedStats.responses.modelUsage).map(([model, count]) => (
              <div key={model} className="flex justify-between items-center">
                <span>{model}</span>
                <span className="font-bold">{count} requests</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;

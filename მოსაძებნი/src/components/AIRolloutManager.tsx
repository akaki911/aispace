
import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';

interface RolloutInstance {
  name: string;
  url: string;
  version: string;
  weight: number;
  requests: number;
  errors: number;
  errorRate: string;
  avgLatency: string;
}

interface RolloutMetrics {
  config: {
    strategy: string;
    percentage: number;
    userGroups: string[];
  };
  instances: RolloutInstance[];
  total: {
    requests: number;
    errors: number;
  };
}

interface HealthStatus {
  [key: string]: {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
    version: string;
  };
}

const AIRolloutManager: React.FC = () => {
  const [metrics, setMetrics] = useState<RolloutMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState('blue');
  const [percentage, setPercentage] = useState(5);

  // Load rollout status
  const loadRolloutStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/ai-rollout/status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.rollout);
        setHealth(data.health);
        setSelectedStrategy(data.rollout.config.strategy);
        setPercentage(data.rollout.config.percentage);
      } else {
        throw new Error('Failed to load rollout status');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  useEffect(() => {
    loadRolloutStatus();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadRolloutStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update rollout strategy
  const updateStrategy = async (strategy: string, customPercentage?: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/ai-rollout/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategy,
          percentage: customPercentage || percentage,
          userGroups: strategy === 'user-groups' ? ['SUPER_ADMIN'] : undefined
        })
      });

      if (response.ok) {
        await loadRolloutStatus();
        setError(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update strategy');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  // Gradual rollout steps
  const performGradualStep = async (step: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-rollout/gradual/${step}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        await loadRolloutStatus();
        setError(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform gradual step');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gradual step failed');
    } finally {
      setLoading(false);
    }
  };

  // Emergency rollback
  const performRollback = async () => {
    if (!confirm('ნამდვილად გსურთ Emergency Rollback? ყველა ტრაფიკი Blue (stable) instance-ზე გადაირთვება.')) {
      return;
    }

    setLoading(true);
    try {
      const reason = prompt('Rollback-ის მიზეზი (არასავალდებულო):') || 'Emergency rollback from DevConsole';
      
      const response = await fetch('/api/admin/ai-rollout/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        await loadRolloutStatus();
        setError(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform rollback');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  // Test specific instance
  const testInstance = async (instance: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-rollout/test/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: 'Test message from DevConsole' })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Test completed on ${instance}:\nLatency: ${data.latency}ms\nVersion: ${data.version}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Test failed');
      }
    } catch (error) {
      alert(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getInstanceStatusColor = (instance: RolloutInstance) => {
    const healthStatus = health[instance.name];
    const errorRate = parseFloat(instance.errorRate);
    
    if (healthStatus?.status === 'unhealthy') return 'border-red-500 bg-red-900/20';
    if (errorRate > 5) return 'border-yellow-500 bg-yellow-900/20';
    return 'border-green-500 bg-green-900/20';
  };

  const getStrategyBadgeColor = (strategy: string) => {
    switch (strategy) {
      case 'blue': return 'bg-blue-900 text-blue-300';
      case 'green': return 'bg-green-900 text-green-300';
      case 'canary': return 'bg-yellow-900 text-yellow-300';
      case 'gradual': return 'bg-purple-900 text-purple-300';
      default: return 'bg-gray-800 text-gray-300';
    }
  };

  if (!metrics) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">AI Rollout Manager</h3>
        </div>
        <div className="text-gray-400">Loading rollout status...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">AI Rollout Manager</h3>
          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStrategyBadgeColor(metrics.config.strategy)}`}>
            {metrics.config.strategy.toUpperCase()}
            {metrics.config.strategy === 'gradual' && ` ${metrics.config.percentage}%`}
          </span>
        </div>
        
        <button
          onClick={loadRolloutStatus}
          disabled={loading}
          className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-300 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Instance Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.instances.map((instance) => (
          <div key={instance.name} className={`border-2 rounded-lg p-4 ${getInstanceStatusColor(instance)}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white capitalize">{instance.name}</h4>
              <div className="flex items-center gap-2">
                {health[instance.name]?.status === 'healthy' ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <AlertTriangle size={16} className="text-red-400" />
                )}
                <button
                  onClick={() => testInstance(instance.name)}
                  disabled={loading}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Version:</span>
                <span className="text-white">{instance.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Requests:</span>
                <span className="text-white">{instance.requests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Error Rate:</span>
                <span className={`${parseFloat(instance.errorRate) > 5 ? 'text-red-400' : 'text-green-400'}`}>
                  {instance.errorRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Latency:</span>
                <span className="text-white">{instance.avgLatency}ms</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Control Panel */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
          <Activity size={16} />
          Rollout Controls
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="space-y-3">
            <h5 className="text-gray-300 font-medium">Quick Actions</h5>
            
            <div className="space-y-2">
              <button
                onClick={() => updateStrategy('blue')}
                disabled={loading}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Blue (Stable) - 100%
              </button>
              
              <button
                onClick={() => updateStrategy('green')}
                disabled={loading}
                className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Green (New) - 100%
              </button>
              
              <button
                onClick={() => updateStrategy('canary')}
                disabled={loading}
                className="w-full px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                Canary (Experimental)
              </button>
            </div>
          </div>

          {/* Gradual Rollout */}
          <div className="space-y-3">
            <h5 className="text-gray-300 font-medium flex items-center gap-2">
              <TrendingUp size={16} />
              Gradual Rollout (Green)
            </h5>
            
            <div className="space-y-2">
              <button
                onClick={() => performGradualStep(1)}
                disabled={loading}
                className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                Step 1: 5% → Green
              </button>
              
              <button
                onClick={() => performGradualStep(2)}
                disabled={loading}
                className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                Step 2: 25% → Green
              </button>
              
              <button
                onClick={() => performGradualStep(3)}
                disabled={loading}
                className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                Step 3: 100% → Green
              </button>
            </div>
          </div>
        </div>

        {/* Emergency Rollback */}
        <div className="mt-6 pt-4 border-t border-gray-600">
          <button
            onClick={performRollback}
            disabled={loading}
            className="w-full px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            Emergency Rollback to Blue
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">Traffic Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Total Requests</div>
            <div className="text-white font-medium">{metrics.total.requests.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-400">Total Errors</div>
            <div className="text-white font-medium">{metrics.total.errors}</div>
          </div>
          <div>
            <div className="text-gray-400">Overall Error Rate</div>
            <div className="text-white font-medium">
              {metrics.total.requests > 0 
                ? ((metrics.total.errors / metrics.total.requests) * 100).toFixed(2)
                : 0}%
            </div>
          </div>
          <div>
            <div className="text-gray-400">Strategy</div>
            <div className="text-white font-medium capitalize">{metrics.config.strategy}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIRolloutManager;

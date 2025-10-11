
import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Play, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Zap,
  TrendingUp,
  Shield,
  Activity
} from 'lucide-react';

interface CanaryState {
  id: string;
  proposalId: string;
  status: 'deploying' | 'smoke-testing' | 'ready-for-promotion' | 'promoted' | 'rolled-back' | 'failed';
  branch: string;
  startTime: string;
  timeRemaining: number;
  timeline: Array<{
    ts: number;
    type: string;
    message: string;
  }>;
  rollbackReason?: string;
  smokeResults?: {
    success: boolean;
    results: Array<{
      name: string;
      status: 'pass' | 'fail' | 'error';
      endpoint?: string;
      error?: string;
    }>;
    summary: string;
  };
}

interface CanaryDeploymentPanelProps {
  proposalId: string;
  onCanaryStart?: (canaryId: string) => void;
  onCanaryComplete?: (result: any) => void;
}

const CanaryDeploymentPanel: React.FC<CanaryDeploymentPanelProps> = ({ 
  proposalId, 
  onCanaryStart, 
  onCanaryComplete 
}) => {
  const [canaryState, setCanaryState] = useState<CanaryState | null>(null);
  const [activeCanaries, setActiveCanaries] = useState<CanaryState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Load active canaries on mount
  useEffect(() => {
    loadActiveCanaries();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Start polling when canary is active
  useEffect(() => {
    if (canaryState && ['deploying', 'smoke-testing'].includes(canaryState.status)) {
      const interval = setInterval(() => {
        refreshCanaryStatus(canaryState.id);
      }, 2000);
      setPollInterval(interval);
      
      return () => clearInterval(interval);
    } else if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [canaryState?.status]);

  const loadActiveCanaries = async () => {
    try {
      const response = await fetch('/api/admin/canary/list', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveCanaries(data.canaries || []);
        
        // Find canary for current proposal
        const currentCanary = data.canaries?.find((c: CanaryState) => 
          c.proposalId === proposalId && 
          !['promoted', 'rolled-back'].includes(c.status)
        );
        
        if (currentCanary) {
          setCanaryState(currentCanary);
        }
      }
    } catch (error) {
      console.error('Failed to load canaries:', error);
    }
  };

  const startCanaryDeploy = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/canary/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          proposalId,
          changes: [] // In real implementation, pass actual changes
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setCanaryState(await getCanaryStatus(result.canaryId));
        onCanaryStart?.(result.canaryId);
      } else {
        setError(result.error || 'Failed to start canary deployment');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start canary');
    } finally {
      setLoading(false);
    }
  };

  const promoteCanary = async () => {
    if (!canaryState) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/admin/canary/${canaryState.id}/promote`, {
        method: 'POST',
        credentials: 'include'
      });

      const result = await response.json();
      
      if (result.success) {
        setCanaryState(await getCanaryStatus(canaryState.id));
        onCanaryComplete?.(result);
      } else {
        setError(result.error || 'Failed to promote canary');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to promote canary');
    } finally {
      setLoading(false);
    }
  };

  const rollbackCanary = async (reason?: string) => {
    if (!canaryState) return;
    
    const userReason = reason || prompt('Rollback მიზეზი (არასავალდებულო):');
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/admin/canary/${canaryState.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: userReason })
      });

      const result = await response.json();
      
      if (result.success) {
        setCanaryState(await getCanaryStatus(canaryState.id));
        onCanaryComplete?.(result);
      } else {
        setError(result.error || 'Failed to rollback canary');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to rollback canary');
    } finally {
      setLoading(false);
    }
  };

  const getCanaryStatus = async (canaryId: string): Promise<CanaryState> => {
    const response = await fetch(`/api/admin/canary/${canaryId}/status`, {
      credentials: 'include'
    });
    const result = await response.json();
    return result.canary;
  };

  const refreshCanaryStatus = async (canaryId: string) => {
    try {
      const updatedCanary = await getCanaryStatus(canaryId);
      setCanaryState(updatedCanary);
      
      // Stop polling if completed
      if (['promoted', 'rolled-back', 'failed'].includes(updatedCanary.status)) {
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        onCanaryComplete?.(updatedCanary);
      }
    } catch (error) {
      console.error('Failed to refresh canary status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deploying': return 'text-blue-400 bg-blue-900';
      case 'smoke-testing': return 'text-yellow-400 bg-yellow-900';
      case 'ready-for-promotion': return 'text-green-400 bg-green-900';
      case 'promoted': return 'text-green-400 bg-green-900';
      case 'rolled-back': return 'text-red-400 bg-red-900';
      case 'failed': return 'text-red-400 bg-red-900';
      default: return 'text-gray-400 bg-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deploying': return <Activity size={16} className="animate-spin" />;
      case 'smoke-testing': return <Zap size={16} className="animate-pulse" />;
      case 'ready-for-promotion': return <TrendingUp size={16} />;
      case 'promoted': return <CheckCircle size={16} />;
      case 'rolled-back': return <RotateCcw size={16} />;
      case 'failed': return <AlertTriangle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts * 1000).toLocaleTimeString('ka-GE');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">
            Canary Deployment
          </h3>
        </div>
        
        {!canaryState && (
          <button
            onClick={startCanaryDeploy}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Play size={16} />
            Start Canary
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-300 text-sm mt-1">{error}</p>
        </div>
      )}

      {canaryState && (
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(canaryState.status)}
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(canaryState.status)}`}>
                  {canaryState.status.toUpperCase()}
                </span>
              </div>
              
              {canaryState.timeRemaining > 0 && (
                <div className="text-sm text-gray-400">
                  TTL: {formatTimeRemaining(canaryState.timeRemaining)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Canary ID:</span>
                <div className="text-white font-mono">{canaryState.id}</div>
              </div>
              <div>
                <span className="text-gray-400">Branch:</span>
                <div className="text-white">{canaryState.branch}</div>
              </div>
            </div>

            {canaryState.rollbackReason && (
              <div className="mt-3 p-2 bg-red-900/20 border border-red-700 rounded">
                <div className="text-red-400 text-sm font-medium">Rollback Reason:</div>
                <div className="text-red-300 text-sm">{canaryState.rollbackReason}</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {canaryState.status === 'ready-for-promotion' && (
            <div className="flex gap-3">
              <button
                onClick={promoteCanary}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <TrendingUp size={16} />
                Promote to Main
              </button>
              <button
                onClick={() => rollbackCanary()}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Rollback
              </button>
            </div>
          )}

          {['deploying', 'smoke-testing'].includes(canaryState.status) && (
            <button
              onClick={() => rollbackCanary()}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Emergency Rollback
            </button>
          )}

          {/* Smoke Test Results */}
          {canaryState.smokeResults && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Zap size={16} />
                Smoke Test Results
              </h4>
              
              <div className="mb-3">
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  canaryState.smokeResults.success 
                    ? 'bg-green-900 text-green-300' 
                    : 'bg-red-900 text-red-300'
                }`}>
                  {canaryState.smokeResults.summary}
                </span>
              </div>

              <div className="space-y-2">
                {canaryState.smokeResults.results.map((test, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        test.status === 'pass' ? 'bg-green-400' :
                        test.status === 'fail' ? 'bg-red-400' : 'bg-yellow-400'
                      }`} />
                      <span className="text-white">{test.name}</span>
                    </div>
                    <div className="text-sm">
                      {test.endpoint && (
                        <span className="text-gray-400 font-mono">{test.endpoint}</span>
                      )}
                      {test.error && (
                        <span className="text-red-400">{test.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Clock size={16} />
              Timeline ({canaryState.timeline.length})
            </h4>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {canaryState.timeline.map((event, index) => (
                <div key={index} className="flex items-start gap-3 py-2">
                  <div className="text-xs text-gray-400 min-w-[60px]">
                    {formatTimestamp(event.ts)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white capitalize">
                      {event.type.replace('-', ' ')}
                    </div>
                    <div className="text-sm text-gray-300">{event.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Canaries Summary */}
      {activeCanaries.length > 0 && !canaryState && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Active Canaries ({activeCanaries.length})</h4>
          <div className="space-y-2">
            {activeCanaries.slice(0, 3).map((canary) => (
              <div key={canary.id} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded">
                <div className="flex items-center gap-3">
                  {getStatusIcon(canary.status)}
                  <span className="text-white text-sm">
                    Proposal: {canary.proposalId.substring(0, 8)}...
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(canary.status)}`}>
                  {canary.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CanaryDeploymentPanel;

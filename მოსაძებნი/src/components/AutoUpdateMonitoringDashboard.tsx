import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Database, 
  Eye, 
  Server,
  RefreshCw,
  Clock,
  Zap,
  Users,
  Bug,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

interface AutoUpdateKPIs {
  aiHealth: 'OK' | 'WARN' | 'ERROR';
  backendHealth: 'OK' | 'WARN' | 'ERROR'; 
  frontendHealth: 'OK' | 'WARN' | 'ERROR';
  queueLength: number;
  p95ResponseTime: number;
  errorRate: number;
  lastRunAt: string;
  mode: 'auto' | 'manual' | 'paused';
}

interface AutoUpdateRun {
  id: string;
  startedAt: string;
  sources: string[];
  result: 'success' | 'failed' | 'running';
  cid: string;
}

interface LiveEvent {
  type: 'CheckStarted' | 'CheckPassed' | 'CheckFailed' | 'TestsRunning' | 'TestsPassed' | 'TestsFailed' | 'Risk' | 'ArtifactsReady' | 'ProposalsPushed';
  message: string;
  timestamp: string;
  cid: string;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

const AutoUpdateMonitoringDashboard: React.FC = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<AutoUpdateKPIs>({
    aiHealth: 'OK',
    backendHealth: 'OK', 
    frontendHealth: 'OK',
    queueLength: 0,
    p95ResponseTime: 0,
    errorRate: 0,
    lastRunAt: '',
    mode: 'auto'
  });
  const [aiWorkingState, setAiWorkingState] = useState<'idle' | 'working' | 'busy'>('idle');
  const [history, setHistory] = useState<AutoUpdateRun[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [isKPIsFetching, setIsKPIsFetching] = useState(false);
  const [isHistoryFetching, setIsHistoryFetching] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [backoffDelay, setBackoffDelay] = useState(1000);

  // Check if user has access (SUPER_ADMIN only)
  const hasAccess = user?.role === 'SUPER_ADMIN';

  const fetchKPIs = useCallback(async () => {
    if (isKPIsFetching) {
      return;
    }

    try {
      setIsKPIsFetching(true);
      const response = await fetch('/api/ai/autoimprove/monitor/status', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 429) {
        console.warn('🚫 Rate limited - will retry later');
        setConnectionStatus('disconnected');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setKpis(data.kpis || kpis);
        setConnectionStatus('connected');
        setRetryAttempts(0);
        setBackoffDelay(1000);
      }
    } catch (error) {
      console.error('Failed to fetch KPIs:', error);
      setConnectionStatus('disconnected');
    } finally {
      setIsKPIsFetching(false);
    }
  }, [isKPIsFetching]);

  const fetchHistory = useCallback(async () => {
    if (isHistoryFetching) {
      return;
    }

    try {
      setIsHistoryFetching(true);
      const response = await fetch('/api/ai/autoimprove/monitor/history?limit=20', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 429) {
        console.warn('🚫 Rate limited on history - will retry later');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsHistoryFetching(false);
    }
  }, [isHistoryFetching]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const isSSEConnecting = useRef(false);

  const setupSSE = useCallback(() => {
    if (!hasAccess || eventSourceRef.current || isSSEConnecting.current) {
      return;
    }

    isSSEConnecting.current = true;

    try {
      const eventSource = new EventSource('/api/ai/autoimprove/monitor/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        isSSEConnecting.current = false;
      };

      eventSource.onmessage = (event) => {
        try {
          const eventData: LiveEvent = JSON.parse(event.data);
          setLiveEvents(prev => [eventData, ...prev.slice(0, 49)]);
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus('disconnected');
        isSSEConnecting.current = false;

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // No automatic retry to prevent infinite loop
      };

    } catch (error) {
      console.error('Failed to setup SSE:', error);
      isSSEConnecting.current = false;
    }
  }, [hasAccess]);

  const cleanupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    isSSEConnecting.current = false;
  }, []);

  const handleControl = async (action: 'pause' | 'resume') => {
    try {
      const response = await fetch('/api/ai/autoimprove/monitor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        await fetchKPIs(); // Refresh KPIs
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    }
  };

  const handleRetry = async (runId: string) => {
    try {
      await fetch('/api/ai/autoimprove/monitor/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });

      await fetchHistory(); // Refresh history
    } catch (error) {
      console.error('Failed to retry run:', error);
    }
  };

  const handleRollback = async (runId: string) => {
    try {
      await fetch('/api/ai/autoimprove/monitor/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });

      await fetchHistory(); // Refresh history
    } catch (error) {
      console.error('Failed to rollback run:', error);
    }
  };

  const handleExport = async (format: 'csv' | 'json', runId?: string) => {
    try {
      const url = `/api/ai/autoimprove/monitor/export?format=${format}${runId ? `&runId=${runId}` : ''}`;
      const response = await fetch(url);

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `autoupdate-export-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  useEffect(() => {
    if (!hasAccess) return;

    let mounted = true;
    let pollingInterval: NodeJS.Timeout;

    const loadData = async () => {
      if (!mounted) return;

      setIsLoading(true);
      await Promise.all([fetchKPIs(), fetchHistory()]);

      if (mounted) {
        setIsLoading(false);
      }
    };

    // Fetch initial data
    // fetchData(); // This line seems to be a leftover from a previous implementation or a copy-paste error.
    // const interval = setInterval(fetchData, 10000); // Update every 10 seconds
    // return () => clearInterval(interval);
  }, []);

  // Listen for proposal creation events to update queue and AI status
  useEffect(() => {
    if (!hasAccess) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;
    let nextDelay = 2000;

    const scheduleNextPoll = (delay: number) => {
      if (cancelled) return;
      timeoutId = setTimeout(pollForProposalEvents, delay);
    };

    const pollForProposalEvents = async () => {
      if (cancelled) return;

      try {
        const response = await fetch('/api/file-monitor/events?since=' + (Date.now() - 30000)); // Last 30 seconds
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        const cycleEvents = data.events?.filter((e: any) => e.event === 'cycle:success') || [];
        const proposalEvents = data.events?.filter((e: any) => e.event === 'proposal:created') || [];

        if (cycleEvents.length > 0) {
          // AI is working
          setAiWorkingState('working');
          setKpis(prev => prev ? {
            ...prev,
            aiHealth: 'WARN' // Show as WARN when working
          } : prev);

          // Reset to idle after 3 seconds
          setTimeout(() => {
            setAiWorkingState('idle');
            setKpis(prev => prev ? {
              ...prev,
              aiHealth: 'OK'
            } : prev);
          }, 3000);
        }

        if (proposalEvents.length > 0) {
          // Increment queue length
          setKpis(prev => prev ? {
            ...prev,
            queueLength: prev.queueLength + proposalEvents.length
          } : prev);
        }

        consecutiveFailures = 0;
        nextDelay = 2000;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const looksLikeConnectionIssue =
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError');

        if (looksLikeConnectionIssue && consecutiveFailures > 0) {
          console.debug('[AutoUpdateMonitoringDashboard] Backend unreachable, retrying later.');
        } else {
          console.error('Failed to poll for proposal events:', error);
        }

        consecutiveFailures += 1;
        nextDelay = Math.min(nextDelay * 2, 60000); // Exponential backoff up to 60s
      } finally {
        scheduleNextPoll(nextDelay);
      }
    };

    scheduleNextPoll(nextDelay);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasAccess]);


  useEffect(() => {
    if (!hasAccess) return;

    let mounted = true;
    let pollingInterval: NodeJS.Timeout;

    const loadData = async () => {
      if (!mounted) return;

      setIsLoading(true);
      await Promise.all([fetchKPIs(), fetchHistory()]);

      if (mounted) {
        setIsLoading(false);
      }
    };

    // Initial load
    loadData();

    // Setup SSE once
    setupSSE();

    // Reduced polling to 60 seconds to prevent rate limiting
    pollingInterval = setInterval(() => {
      if (mounted && !isKPIsFetching && !isHistoryFetching) {
        fetchKPIs();
        fetchHistory();
      }
    }, 60000);

    return () => {
      mounted = false;
      cleanupSSE();
      clearInterval(pollingInterval);
    };
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">მხოლოდ SUPER_ADMIN-ს შეუძლია ავტო-განახლების მონიტორინგი</p>
        </div>
      </div>
    );
  }

  const getHealthColor = (health: 'OK' | 'WARN' | 'ERROR') => {
    switch (health) {
      case 'OK': return 'text-green-600 bg-green-50';
      case 'WARN': return 'text-yellow-600 bg-yellow-50';
      case 'ERROR': return 'text-red-600 bg-red-50';
    }
  };

  const getHealthIcon = (health: 'OK' | 'WARN' | 'ERROR') => {
    switch (health) {
      case 'OK': return <CheckCircle className="w-5 h-5" />;
      case 'WARN': return <AlertCircle className="w-5 h-5" />;
      case 'ERROR': return <XCircle className="w-5 h-5" />;
    }
  };

  const getRiskColor = (risk?: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'LOW': return 'text-green-600 bg-green-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'HIGH': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Header with Connection Status */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Activity className="w-6 h-6 mr-2 text-blue-500" />
            ავტო-განახლების მონიტორინგი
          </h2>
          <p className="text-gray-600">რეალურ დროში ავტო-განახლების ზედამხედველობა</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-700' 
              : connectionStatus === 'connecting'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus === 'connected' 
                ? 'bg-green-500 animate-pulse' 
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}></div>
            {connectionStatus === 'connected' ? 'დაკავშირებულია' : 
             connectionStatus === 'connecting' ? 'კავშირდება...' : 'კავშირის პრობლემა'}
          </div>
        </div>
      </div>

      {/* Top KPIs - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg border status-transition ${getHealthColor(kpis.aiHealth)} ${
          aiWorkingState === 'working' ? 'animate-pulseGlow' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center">
                AI Health
                {aiWorkingState === 'working' && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 animate-pulse">
                    მუშაობს
                  </span>
                )}
              </p>
              <p className="text-2xl font-bold status-transition">{kpis.aiHealth}</p>
            </div>
            <div className="relative">
              {getHealthIcon(kpis.aiHealth)}
              {aiWorkingState === 'working' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
              )}
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${getHealthColor(kpis.backendHealth)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">BE Health</p>
              <p className="text-2xl font-bold">{kpis.backendHealth}</p>
            </div>
            {getHealthIcon(kpis.backendHealth)}
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${getHealthColor(kpis.frontendHealth)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">FE Health</p>
              <p className="text-2xl font-bold">{kpis.frontendHealth}</p>
            </div>
            {getHealthIcon(kpis.frontendHealth)}
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Queue Length</p>
              <p className="text-2xl font-bold text-blue-600">{kpis.queueLength}</p>
            </div>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">P95 Response Time</p>
              <p className="text-xl font-bold text-gray-900">{kpis.p95ResponseTime}ms</p>
            </div>
            <Zap className="w-5 h-5 text-purple-500" />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Error Rate</p>
              <p className="text-xl font-bold text-gray-900">{kpis.errorRate}%</p>
            </div>
            <Bug className="w-5 h-5 text-red-500" />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Last Run</p>
              <p className="text-sm font-medium text-gray-900">
                {kpis.lastRunAt ? new Date(kpis.lastRunAt).toLocaleString('ka-GE') : 'Never'}
              </p>
            </div>
            <RefreshCw className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Mode: {kpis.mode}</span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleControl('pause')}
              disabled={kpis.mode === 'paused'}
              className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
            >
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </button>
            <button
              onClick={() => handleControl('resume')}
              disabled={kpis.mode === 'auto'}
              className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-1" />
              Resume
            </button>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
          >
            <Download className="w-4 h-4 mr-1" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Two-column layout: Live Feed + History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Feed */}
        <div className="bg-gray-50 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center">
              <Eye className="w-5 h-5 mr-2 text-green-500" />
              Live Feed
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto p-4">
            {liveEvents.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                არ არის ახალი ივენთები
              </div>
            ) : (
              <div className="space-y-2">
                {liveEvents.map((event, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 bg-white rounded border">
                    <div className={`px-2 py-1 rounded text-xs font-mono ${
                      event.risk ? getRiskColor(event.risk) : 'bg-blue-50 text-blue-700'
                    }`}>
                      {event.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{event.message}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleTimeString('ka-GE')}
                        </span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {event.cid}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Run History */}
        <div className="bg-gray-50 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center">
              <Database className="w-5 h-5 mr-2 text-blue-500" />
              Run History (Last 20)
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto p-4">
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                ისტორია ცარიელია
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-3 bg-white rounded border">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-mono ${
                          run.result === 'success' ? 'bg-green-50 text-green-700' :
                          run.result === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {run.result.toUpperCase()}
                        </span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{run.cid}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(run.startedAt).toLocaleString('ka-GE')}
                      </p>
                      <p className="text-xs text-gray-600">
                        Sources: {Array.isArray(run.sources) ? run.sources.join(', ') : String(run.sources || 'Unknown')}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      {run.result === 'failed' && (
                        <button
                          onClick={() => handleRetry(run.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Retry"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                      {run.result === 'success' && (
                        <button
                          onClick={() => handleRollback(run.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Rollback"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleExport('json', run.id)}
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                        title="Export"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-4">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">მონაცემების ჩატვირთვა...</p>
        </div>
      )}
    </div>
  );
};

export default AutoUpdateMonitoringDashboard;
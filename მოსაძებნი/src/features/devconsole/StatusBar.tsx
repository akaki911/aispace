
import React, { useMemo } from 'react';
import { useDevConsoleStore } from './store';
import { useAuth } from '@/contexts/useAuth';
import { useAIServiceState } from '@/hooks/useAIServiceState';

export const StatusBar: React.FC = () => {
  const { sseStatus: consoleStreamStatus, metrics, theme } = useDevConsoleStore();
  const { user: authUser, isAuthenticated } = useAuth();
  const {
    aiServiceHealth,
    availableModels,
    selectedModel,
    sseStatus: aiStreamStatus,
    connectionState,
    isOnline,
  } = useAIServiceState(isAuthenticated, authUser);

  const getConsoleStreamColor = () => {
    switch (consoleStreamStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const selectedModelLabel = useMemo(() => {
    if (!selectedModel) {
      return '—';
    }

    const matched = availableModels?.find((model) => model.id === selectedModel);
    return matched?.label ?? selectedModel;
  }, [availableModels, selectedModel]);

  const healthBadgeClass = useMemo(() => {
    if (!isOnline) {
      return 'bg-slate-500/10 text-slate-300 border border-slate-500/30';
    }

    if (aiServiceHealth?.ok && connectionState === 'ok') {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/30';
    }

    if (connectionState === 'offline') {
      return 'bg-rose-500/10 text-rose-400 border border-rose-400/30';
    }

    return 'bg-amber-500/10 text-amber-400 border border-amber-400/30';
  }, [aiServiceHealth?.ok, connectionState, isOnline]);

  const streamBadgeClass = useMemo(() => {
    switch (aiStreamStatus) {
      case 'open':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/30';
      case 'connecting':
        return 'bg-amber-500/10 text-amber-400 border border-amber-400/30';
      case 'error':
        return 'bg-rose-500/10 text-rose-400 border border-rose-400/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border border-slate-500/30';
    }
  }, [aiStreamStatus]);

  const streamLabel = useMemo(() => {
    switch (aiStreamStatus) {
      case 'open':
        return 'LIVE';
      case 'connecting':
        return 'CONNECTING';
      case 'error':
        return 'RETRYING';
      default:
        return 'IDLE';
    }
  }, [aiStreamStatus]);

  const aiStatusLabel = useMemo(() => {
    if (!isOnline) {
      return 'OFFLINE';
    }

    if (aiServiceHealth?.ok) {
      return 'HEALTHY';
    }

    if (typeof aiServiceHealth?.status === 'string' && aiServiceHealth.status.length > 0) {
      return aiServiceHealth.status.toUpperCase();
    }

    return connectionState === 'offline' ? 'OFFLINE' : 'ATTENTION';
  }, [aiServiceHealth?.ok, aiServiceHealth?.status, connectionState, isOnline]);

  return (
    <div className={`h-8 px-4 flex items-center justify-between text-xs border-b ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'
    }`}>
      <div className="flex items-center gap-3">
        {/* Environment */}
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
          DEV
        </span>

        {/* Version */}
        <span className="text-gray-500">
          v2.0.0-sol201
        </span>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${healthBadgeClass}`}>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            AI {aiStatusLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-300">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-indigo-300" />
            მოდელი {selectedModelLabel}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${streamBadgeClass}`}>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            სტრიმი {streamLabel}
          </span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getConsoleStreamColor().replace('text-', 'bg-')}`} />
          <span className={getConsoleStreamColor()}>
            {consoleStreamStatus.toUpperCase()}
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

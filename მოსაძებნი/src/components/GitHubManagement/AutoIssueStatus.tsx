
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Settings, Activity } from 'lucide-react';

interface AutoIssueStatusProps {
  showMessage: (type: 'success' | 'error', text: string) => void;
}

interface AutoIssueStats {
  enabled: boolean;
  threshold: number;
  activeErrors: number;
  trackedIssues: number;
  totalProcessedFeedback: number;
}

const AutoIssueStatus: React.FC<AutoIssueStatusProps> = ({ showMessage }) => {
  const [stats, setStats] = useState<AutoIssueStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/feedback/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Auto-issue stats loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoProcessing = async () => {
    try {
      const response = await fetch('/api/ai/feedback/auto-processing/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !stats?.enabled })
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', result.message);
        loadStats();
      } else {
        showMessage('error', 'Toggle ვერ მოხერხდა');
      }
    } catch (error) {
      showMessage('error', 'Toggle ვერ მოხერხდა');
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Shield size={18} />
          Auto-Issue Detection
        </h4>
        <button
          onClick={toggleAutoProcessing}
          className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
            stats.enabled 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Settings size={14} />
          {stats.enabled ? 'ჩართული' : 'გამორთული'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-blue-400" />
            <span className="text-xs text-gray-400">სტატუსი</span>
          </div>
          <div className="flex items-center gap-2">
            {stats.enabled ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : (
              <AlertTriangle size={16} className="text-gray-400" />
            )}
            <span className="text-sm font-medium">
              {stats.enabled ? 'აქტიური' : 'გამორთული'}
            </span>
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Error Threshold</div>
          <div className="text-lg font-bold text-yellow-400">{stats.threshold}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Active Errors</div>
          <div className="text-lg font-bold text-red-400">{stats.activeErrors}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Tracked Issues</div>
          <div className="text-lg font-bold text-green-400">{stats.trackedIssues}</div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <p>
          🤖 Auto-detection ქმნის GitHub Issues-ს {stats.threshold} შეცდომის შემდეგ და 
          ავტომატურად ხურავს issues-ს მათი გადაწყვეტის შემდეგ.
        </p>
      </div>
    </div>
  );
};

export default AutoIssueStatus;

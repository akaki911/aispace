
import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Activity,
  Server,
  Code,
  Globe,
  Hammer,
  Eye
} from 'lucide-react';

interface VerificationResult {
  status: 'pass' | 'fail' | 'pending';
  details: any;
  message: string;
}

interface VerificationStatus {
  status: 'running' | 'completed' | 'error';
  progress: number;
  totalChecks: number;
  completedChecks: number;
  results: {
    healthChecks: VerificationResult;
    smokeRoutes: VerificationResult;
    typeScriptCheck: VerificationResult;
    eslintCheck: VerificationResult;
    buildCheck: VerificationResult;
    frontendPing: VerificationResult;
  };
  overallStatus: 'running' | 'success' | 'failed' | 'error';
  startTime: number;
  duration: number;
  error?: string;
}

interface PostApplyVerificationProps {
  proposalId: string;
  onRollbackRequest: () => void;
  className?: string;
}

const PostApplyVerification: React.FC<PostApplyVerificationProps> = ({
  proposalId,
  onRollbackRequest,
  className = ''
}) => {
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startVerification = async () => {
    try {
      setIsStarting(true);
      const response = await fetch('/api/ai/autoimprove/post-apply/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationId(data.verificationId);
        console.log('✅ [POST-APPLY] Verification started:', data.verificationId);
      } else {
        throw new Error(`Failed to start verification: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ [POST-APPLY] Failed to start verification:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`შემოწმების დაწყების შეცდომა: ${message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const fetchStatus = async () => {
    if (!verificationId) return;

    try {
      const response = await fetch(`/api/ai/autoimprove/post-apply/status/${verificationId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      }
    } catch (error) {
      console.error('❌ [POST-APPLY] Failed to fetch status:', error);
    }
  };

  const refreshStatus = async () => {
    setIsRefreshing(true);
    await fetchStatus();
    setIsRefreshing(false);
  };

  // Auto-start verification when component mounts
  useEffect(() => {
    startVerification();
  }, [proposalId]);

  // Poll for status updates
  useEffect(() => {
    if (!verificationId || !status || status.status === 'completed' || status.status === 'error') {
      return;
    }

    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [verificationId, status?.status]);

  const getStatusIcon = (result: VerificationResult) => {
    switch (result.status) {
      case 'pass': return <CheckCircle size={20} className="text-green-500" />;
      case 'fail': return <XCircle size={20} className="text-red-500" />;
      case 'pending': return <Clock size={20} className="text-yellow-500" />;
    }
  };

  const getOverallStatusColor = () => {
    if (!status) return 'border-gray-300';
    switch (status.overallStatus) {
      case 'success': return 'border-green-500 bg-green-50';
      case 'failed': return 'border-red-500 bg-red-50';
      case 'error': return 'border-red-500 bg-red-50';
      case 'running': return 'border-blue-500 bg-blue-50';
    }
  };

  const getOverallStatusIcon = () => {
    if (!status) return <Clock size={32} className="text-gray-400" />;
    switch (status.overallStatus) {
      case 'success': return <CheckCircle size={32} className="text-green-500" />;
      case 'failed': return <XCircle size={32} className="text-red-500" />;
      case 'error': return <AlertTriangle size={32} className="text-red-500" />;
      case 'running': return <RefreshCw size={32} className="text-blue-500 animate-spin" />;
    }
  };

  const checks = [
    { key: 'healthChecks', label: 'Health Checks', icon: Activity, description: 'Backend & AI Service' },
    { key: 'smokeRoutes', label: 'Smoke Routes', icon: Eye, description: 'Key API endpoints' },
    { key: 'typeScriptCheck', label: 'TypeScript', icon: Code, description: 'Type checking' },
    { key: 'eslintCheck', label: 'ESLint', icon: Code, description: 'Code linting' },
    { key: 'buildCheck', label: 'Build', icon: Hammer, description: 'Production build' },
    { key: 'frontendPing', label: 'Frontend', icon: Globe, description: 'Vite dev server' }
  ];

  return (
    <div className={`bg-white rounded-lg border-2 ${getOverallStatusColor()} p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {getOverallStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold">Apply-ის შემდეგ შემოწმება</h3>
            <p className="text-sm text-gray-600">
              {status ? (
                status.status === 'running' ? `მიმდინარეობს... ${status.progress}%` :
                status.overallStatus === 'success' ? '✅ ყველაფერი მუშაობს' :
                status.overallStatus === 'failed' ? '❌ პრობლემები ნაპოვნია' :
                '❌ შემოწმება ვერ დასრულდა'
              ) : '⏳ იწყება...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshStatus}
            disabled={isRefreshing || !verificationId}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            განახლება
          </button>

          {status?.overallStatus === 'failed' && (
            <button
              onClick={onRollbackRequest}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
            >
              <AlertTriangle size={16} />
              Rollback Now
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {status && status.status === 'running' && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>პროგრესი</span>
            <span>{status.completedChecks}/{status.totalChecks}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Checks Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {checks.map(check => {
          const result = status?.results[check.key as keyof typeof status.results];
          const IconComponent = check.icon;

          return (
            <div key={check.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <IconComponent size={20} className="text-gray-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{check.label}</div>
                <div className="text-xs text-gray-500">{check.description}</div>
              </div>
              <div className="flex-shrink-0">
                {result ? getStatusIcon(result) : <Clock size={20} className="text-gray-400" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details */}
      {status && status.status === 'completed' && (
        <div className="border-t pt-4">
          <div className="text-sm text-gray-600">
            შემოწმება დასრულდა {Math.round(status.duration / 1000)} წამში
          </div>
          
          {/* Failed checks details */}
          {status.overallStatus === 'failed' && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-red-700 mb-2">წარუმატებელი შემოწმებები:</h4>
              <div className="space-y-2">
                {Object.entries(status.results).map(([key, result]) => {
                  if (result.status !== 'fail') return null;
                  const check = checks.find(c => c.key === key);
                  return (
                    <div key={key} className="text-xs bg-red-50 p-2 rounded border border-red-200">
                      <div className="font-medium text-red-800">{check?.label}</div>
                      <div className="text-red-600">{result.message}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {status?.status === 'error' && (
        <div className="border-t pt-4">
          <div className="text-sm text-red-600">
            შეცდომა: {status.error}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostApplyVerification;

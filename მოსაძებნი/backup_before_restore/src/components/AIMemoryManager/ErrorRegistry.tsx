import React from 'react';
import { 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Eye, 
  EyeOff 
} from 'lucide-react';

interface ErrorLog {
  id: string;
  error: string;
  file: string;
  line?: number;
  timestamp: Date;
  resolved: boolean;
  solution?: string;
  stackTrace?: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface ErrorRegistryProps {
  errorLogs: ErrorLog[];
  searchTerm: string;
  selectedSeverity: string;
  onUpdateError: (id: string, updates: Partial<ErrorLog>) => void;
  onDeleteError: (id: string) => void;
  onClearDuplicates: () => void;
  onPurgeLogs: () => void;
}

export const ErrorRegistry: React.FC<ErrorRegistryProps> = ({
  errorLogs,
  searchTerm,
  selectedSeverity,
  onUpdateError,
  onDeleteError,
  onClearDuplicates,
  onPurgeLogs
}) => {
  const filteredErrors = errorLogs.filter(error => {
    const matchesSearch = error.error.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         error.file.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || error.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'border-green-500';
      case 'medium': return 'border-yellow-500';
      case 'high': return 'border-orange-500';
      case 'critical': return 'border-red-500';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">შეცდომების რეესტრი</h3>
        <div className="flex gap-2">
          <button
            onClick={onClearDuplicates}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-sm transition-colors"
          >
            დუბლიკატების გაწმენდა
          </button>
          <button
            onClick={onPurgeLogs}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors"
          >
            ყველას წაშლა
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredErrors.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            შეცდომები ვერ მოიძებნა
          </div>
        ) : (
          filteredErrors.map((error) => (
            <div
              key={error.id}
              className={`bg-gray-700 rounded-lg p-4 border-l-4 ${getSeverityColor(error.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityIcon(error.severity)}
                    <span className="text-sm text-gray-300 capitalize">
                      {error.severity}
                    </span>
                    <span className="text-sm text-gray-400">
                      {error.file}
                      {error.line && `:${error.line}`}
                    </span>
                    <span className="text-xs text-gray-500">
                      {error.timestamp.toLocaleString()}
                    </span>
                  </div>
                  
                  <p className="text-white text-sm mb-2 font-mono bg-gray-800 p-2 rounded">
                    {error.error}
                  </p>

                  {error.solution && (
                    <div className="bg-green-900/20 border border-green-500/20 rounded p-2 mb-2">
                      <p className="text-green-400 text-xs">
                        <strong>გადაწყვეტა:</strong> {error.solution}
                      </p>
                    </div>
                  )}

                  {error.stackTrace && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
                        Stack Trace
                      </summary>
                      <pre className="text-xs text-gray-300 bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
                        {error.stackTrace}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => onUpdateError(error.id, { resolved: !error.resolved })}
                    className={`p-1 rounded transition-colors ${
                      error.resolved
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                    }`}
                    title={error.resolved ? 'მონიშვნა როგორც გადაუწყვეტელი' : 'მონიშვნა როგორც გადაწყვეტილი'}
                  >
                    {error.resolved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => onDeleteError(error.id)}
                    className="p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                    title="შეცდომის წაშლა"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredErrors.length > 0 && (
        <div className="mt-4 text-sm text-gray-400">
          ნაჩვენებია {filteredErrors.length} შეცდომა {errorLogs.length}-დან
        </div>
      )}
    </div>
  );
};
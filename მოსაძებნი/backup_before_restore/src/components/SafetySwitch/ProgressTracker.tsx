/**
 * Phase 3: Safety Switch - Progress Tracker Component
 * 
 * Displays execution progress and results for confirmed actions,
 * providing real-time feedback to users about development operations.
 */

import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Terminal, FileText, Package } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { PendingAction, ActionResult, ActionSeverity } from './types';

interface ProgressTrackerProps {
  executingActions: PendingAction[];
  completedActions: PendingAction[];
  actionResults: Record<string, ActionResult>;
  onClearCompleted: () => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  executingActions,
  completedActions,
  actionResults,
  onClearCompleted
}) => {
  const { isDarkMode } = useTheme();

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'writeFile': return <FileText className="w-4 h-4" />;
      case 'installPackage': return <Package className="w-4 h-4" />;
      case 'executeShellCommand': return <Terminal className="w-4 h-4" />;
      default: return <Terminal className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string, hasResult: boolean, result?: ActionResult) => {
    switch (status) {
      case 'executing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed':
        return result?.success ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        );
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: ActionSeverity) => {
    switch (severity) {
      case 'low': return 'border-green-200 bg-green-50 dark:bg-green-900/20';
      case 'medium': return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20';
      case 'high': return 'border-orange-200 bg-orange-50 dark:bg-orange-900/20';
      case 'critical': return 'border-red-200 bg-red-50 dark:bg-red-900/20';
      default: return 'border-gray-200 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatOutput = (output?: ActionResult['output']) => {
    if (!output) return null;
    
    const parts: string[] = [];
    if (output.stdout) parts.push(`Output: ${output.stdout.slice(0, 200)}${output.stdout.length > 200 ? '...' : ''}`);
    if (output.stderr) parts.push(`Errors: ${output.stderr.slice(0, 200)}${output.stderr.length > 200 ? '...' : ''}`);
    if (output.filePath) parts.push(`File: ${output.filePath}`);
    if (output.packageName) parts.push(`Package: ${output.packageName}`);
    
    return parts.join('\n');
  };

  const allActions = [...executingActions, ...completedActions.slice(-5)]; // Show last 5 completed

  if (allActions.length === 0) {
    return null;
  }

  const baseClasses = isDarkMode 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200';

  return (
    <div className={`rounded-lg border p-4 ${baseClasses}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium flex items-center space-x-2">
          <Terminal className="w-4 h-4" />
          <span>🔄 Action Progress Tracker</span>
        </h3>
        
        {completedActions.length > 0 && (
          <button
            onClick={onClearCompleted}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Clear Completed
          </button>
        )}
      </div>

      <div className="space-y-3">
        {allActions.map((action) => {
          const result = actionResults[action.id];
          const isExecuting = action.status === 'executing';
          const isCompleted = action.status === 'completed';
          const hasFailed = action.status === 'failed' || (result && !result.success);

          return (
            <div
              key={action.id}
              className={`p-3 rounded-lg border transition-all ${getSeverityColor(action.severity)} ${
                isExecuting ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}
            >
              {/* Action Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getActionIcon(action.type)}
                  <span className="text-sm font-medium">{action.title}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    action.severity === 'critical' ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    action.severity === 'high' ? 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                    action.severity === 'medium' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {action.severity}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getStatusIcon(action.status, !!result, result)}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(result?.duration)}
                  </span>
                </div>
              </div>

              {/* Action Description */}
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {action.description}
              </p>

              {/* Progress/Status */}
              {isExecuting && (
                <div className="mb-2">
                  <div className="flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Executing action...</span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full animate-pulse w-3/4"></div>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="mt-2 text-xs">
                  {result.success ? (
                    <div className="text-green-700 dark:text-green-300">
                      ✅ {result.result || 'Action completed successfully'}
                    </div>
                  ) : (
                    <div className="text-red-700 dark:text-red-300">
                      ❌ {result.error || 'Action failed'}
                    </div>
                  )}
                  
                  {/* Output Details */}
                  {result.output && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                        View Output Details
                      </summary>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                        {formatOutput(result.output)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Warning for failed actions */}
              {hasFailed && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                  <div className="flex items-center space-x-1 text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Action failed. Check logs for details.</span>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Started: {new Date(action.timestamp).toLocaleTimeString()}
                {result && result.duration && (
                  <span> • Duration: {formatDuration(result.duration)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      {(executingActions.length > 0 || completedActions.length > 0) && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>
              📊 Total: {completedActions.length + executingActions.length} actions
            </span>
            <div className="flex items-center space-x-4">
              {executingActions.length > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  🔄 {executingActions.length} executing
                </span>
              )}
              {completedActions.length > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✅ {completedActions.filter(a => actionResults[a.id]?.success).length} completed
                </span>
              )}
              {completedActions.some(a => !actionResults[a.id]?.success) && (
                <span className="text-red-600 dark:text-red-400">
                  ❌ {completedActions.filter(a => !actionResults[a.id]?.success).length} failed
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;
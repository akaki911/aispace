/**
 * Phase 3: Safety Switch - Action Preview Modal
 * 
 * Core modal component that displays action details and requires explicit
 * user confirmation before any development action executes.
 */

import React, { useState } from 'react';
import { X, AlertTriangle, Shield, Clock, CheckCircle, XCircle, Eye, Terminal, FileText, Package } from 'lucide-react';
import { useTheme } from '../../contexts/useTheme';
import { 
  PendingAction, 
  ActionConfirmationCallbacks, 
  ActionSeverity,
  ActionParameter
} from './types';

interface ActionPreviewModalProps {
  action: PendingAction;
  isOpen: boolean;
  onClose: () => void;
  callbacks: ActionConfirmationCallbacks;
  isExecuting: boolean;
}

const ActionPreviewModal: React.FC<ActionPreviewModalProps> = ({
  action,
  isOpen,
  onClose,
  callbacks,
  isExecuting
}) => {
  const { isDarkMode } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  
  if (!isOpen) return null;

  const getSeverityColor = (severity: ActionSeverity) => {
    switch (severity) {
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'writeFile': return <FileText className="w-5 h-5" />;
      case 'installPackage': return <Package className="w-5 h-5" />;
      case 'executeShellCommand': return <Terminal className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const formatParameterValue = (param: ActionParameter) => {
    if (param.sensitive) {
      return '••••••••';
    }
    if (typeof param.value === 'object') {
      return JSON.stringify(param.value, null, 2);
    }
    return String(param.value);
  };

  const isHighRiskAction = action.severity === 'high' || action.severity === 'critical';
  const requiresConfirmText = isHighRiskAction;
  const expectedConfirmText = isHighRiskAction ? 'CONFIRM' : '';
  const canConfirm = !requiresConfirmText || confirmText === expectedConfirmText;

  const handleConfirm = async () => {
    if (canConfirm) {
      await callbacks.onConfirm(action.id);
    }
  };

  const handleCancel = async () => {
    await callbacks.onCancel(action.id);
    onClose();
  };

  const baseClasses = isDarkMode 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200';
    
  const overlayClasses = isDarkMode ? 'bg-black bg-opacity-50' : 'bg-gray-500 bg-opacity-75';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClasses}`}>
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-hidden rounded-lg border shadow-xl ${baseClasses}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getSeverityColor(action.severity)}`}>
              {getActionIcon(action.type)}
            </div>
            <div>
              <h2 className="text-xl font-semibold">🔒 Action Confirmation Required</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review and confirm this development action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Action Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">{action.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{action.description}</p>
            
            {/* Severity Badge */}
            <div className="flex items-center space-x-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(action.severity)}`}>
                {action.severity.toUpperCase()} RISK
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Action ID: {action.id.slice(0, 8)}...
              </span>
            </div>
          </div>

          {/* Impact Information */}
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">📊 Impact Analysis</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{action.impact.description}</p>
            <div className="flex items-center space-x-4 text-xs text-blue-600 dark:text-blue-400">
              <span>Affects: {action.impact.affects.join(', ')}</span>
              <span>Reversible: {action.impact.reversible ? '✅ Yes' : '❌ No'}</span>
            </div>
          </div>

          {/* Security Warnings */}
          {action.securityWarnings.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                ⚠️ Security Warnings
              </h4>
              <div className="space-y-2">
                {action.securityWarnings.map((warning, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border ${
                      warning.level === 'critical' 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <p className={`text-sm font-medium ${
                      warning.level === 'critical' 
                        ? 'text-red-800 dark:text-red-200' 
                        : 'text-yellow-800 dark:text-yellow-200'
                    }`}>
                      {warning.message}
                    </p>
                    {warning.recommendation && (
                      <p className={`text-xs mt-1 ${
                        warning.level === 'critical' 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        💡 {warning.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Parameters */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                🔧 Action Parameters
              </h4>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <Eye className="w-3 h-3" />
                <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
              </button>
            </div>
            
            {showDetails && (
              <div className="space-y-2">
                {action.parameters.map((param, index) => (
                  <div key={index} className="p-3 rounded border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {param.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {param.type} {param.sensitive && '🔒'}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                      {formatParameterValue(param)}
                    </pre>
                    {param.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {param.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High Risk Confirmation */}
          {requiresConfirmText && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                🚨 High Risk Action - Additional Confirmation Required
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                This action has {action.severity} risk level. Type <code className="bg-red-100 dark:bg-red-900 px-1 rounded">CONFIRM</code> to proceed:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type CONFIRM to proceed"
                className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-800 border-red-300 dark:border-red-700"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Requested: {new Date(action.timestamp).toLocaleTimeString()}</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              disabled={isExecuting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Cancel
            </button>
            
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || isExecuting}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                canConfirm && !isExecuting
                  ? 'text-white bg-green-600 hover:bg-green-700'
                  : 'text-gray-400 bg-gray-200 dark:bg-gray-700'
              }`}
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Confirm & Execute
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionPreviewModal;
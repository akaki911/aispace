/**
 * Phase 3: Safety Switch - Main Component
 * 
 * Orchestrates the complete Safety Switch system, managing action confirmations,
 * progress tracking, and security controls. This is the primary interface that
 * ensures no development actions execute without explicit user consent.
 */

import React, { useCallback, useEffect } from 'react';
import { Shield, ShieldOff, AlertTriangle, Settings } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafetySwitch } from '../../hooks/useSafetySwitch';
import ActionPreviewModal from './ActionPreviewModal';
import ProgressTracker from './ProgressTracker';
import { PendingAction, ActionConfirmationCallbacks } from './types';

interface SafetySwitchProps {
  isVisible: boolean;
  onActionExecute: (action: PendingAction) => Promise<any>;
  className?: string;
}

const SafetySwitch: React.FC<SafetySwitchProps> = ({
  isVisible,
  onActionExecute,
  className = ''
}) => {
  const { isDarkMode } = useTheme();
  
  const handleActionConfirmed = useCallback(async (action: PendingAction) => {
    console.log('🚀 [SAFETY SWITCH] Executing confirmed action:', action.id);
    
    try {
      const result = await onActionExecute(action);
      
      completeAction(action.id, {
        success: true,
        result: result?.result || 'Action completed successfully',
        duration: result?.duration,
        output: result?.output
      });
      
    } catch (error) {
      console.error('❌ [SAFETY SWITCH] Action execution failed:', error);
      
      completeAction(action.id, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        duration: 0
      });
    }
  }, [onActionExecute]);

  const {
    state,
    confirmAction,
    cancelAction,
    clearCompleted,
    setShowModal,
    toggleSafetySwitch,
    getActionResults
  } = useSafetySwitch(handleActionConfirmed);

  const {
    pendingActions,
    executingActions,
    completedActions,
    isEnabled,
    showModal,
    currentActionId
  } = state;

  // Get current action for modal
  const currentAction = pendingActions.find(action => action.id === currentActionId);
  const actionResults = getActionResults();

  // Safety Switch callbacks for modal
  const modalCallbacks: ActionConfirmationCallbacks = {
    onConfirm: confirmAction,
    onCancel: cancelAction,
    onViewDetails: (actionId: string) => {
      console.log('👁️ [SAFETY SWITCH] Viewing action details:', actionId);
      // Could open a detailed view or logs
    }
  };

  // Global safety switch control
  const renderSafetyControl = () => (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      isDarkMode 
        ? 'bg-gray-900 border-gray-700 text-white' 
        : 'bg-white border-gray-200 text-gray-900'
    }`}>
      <div className="flex items-center space-x-3">
        <div className={`p-1 rounded ${isEnabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {isEnabled ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
        </div>
        <div>
          <h4 className="text-sm font-medium">
            🔒 Safety Switch
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isEnabled 
              ? 'All actions require confirmation' 
              : 'Actions execute without confirmation (DANGEROUS)'
            }
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {pendingActions.length > 0 && (
          <div className="flex items-center space-x-1 text-xs text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{pendingActions.length} pending</span>
          </div>
        )}
        
        <button
          onClick={toggleSafetySwitch}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            isEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isEnabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>
    </div>
  );

  // Statistics summary
  const renderStats = () => {
    const totalActions = executingActions.length + completedActions.length;
    const successfulActions = completedActions.filter(a => actionResults[a.id]?.success).length;
    const failedActions = completedActions.filter(a => actionResults[a.id] && !actionResults[a.id].success).length;

    if (totalActions === 0 && pendingActions.length === 0) {
      return null;
    }

    return (
      <div className={`p-3 rounded-lg border text-xs ${
        isDarkMode 
          ? 'bg-gray-900 border-gray-700 text-gray-300' 
          : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">📊 Action Statistics</span>
          <div className="flex items-center space-x-3">
            {pendingActions.length > 0 && (
              <span className="text-orange-600 dark:text-orange-400">
                ⏳ {pendingActions.length} pending
              </span>
            )}
            {executingActions.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                🔄 {executingActions.length} executing
              </span>
            )}
            {successfulActions > 0 && (
              <span className="text-green-600 dark:text-green-400">
                ✅ {successfulActions} completed
              </span>
            )}
            {failedActions > 0 && (
              <span className="text-red-600 dark:text-red-400">
                ❌ {failedActions} failed
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Safety Switch Control */}
      {renderSafetyControl()}
      
      {/* Statistics */}
      {renderStats()}
      
      {/* Progress Tracker */}
      {(executingActions.length > 0 || completedActions.length > 0) && (
        <ProgressTracker
          executingActions={executingActions}
          completedActions={completedActions}
          actionResults={actionResults}
          onClearCompleted={clearCompleted}
        />
      )}

      {/* Action Confirmation Modal */}
      {showModal && currentAction && isEnabled && (
        <ActionPreviewModal
          action={currentAction}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          callbacks={modalCallbacks}
          isExecuting={executingActions.some(a => a.id === currentAction.id)}
        />
      )}

      {/* Warning when safety switch is disabled */}
      {!isEnabled && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center space-x-2 text-red-800 dark:text-red-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              ⚠️ Safety Switch Disabled
            </span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            Actions will execute immediately without confirmation. This is dangerous and not recommended.
            Click "DISABLED" above to re-enable safety confirmations.
          </p>
        </div>
      )}
    </div>
  );
};

export default SafetySwitch;

// Export the hook and component together for easy import
export { useSafetySwitch } from '../../hooks/useSafetySwitch';
export type { PendingAction, ActionResult } from './types';
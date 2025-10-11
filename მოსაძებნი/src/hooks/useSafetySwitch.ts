/**
 * Phase 3: Safety Switch - Custom Hook for State Management
 * 
 * Manages the complete state of the Safety Switch system including
 * pending actions, execution status, and user confirmations.
 */

import { useState, useCallback, useRef } from 'react';
import { 
  PendingAction, 
  ActionResult, 
  SafetySwitchState,
  ActionType,
  ActionParameter,
  determineActionSeverity,
  getActionImpact,
  getSecurityWarnings
} from '../components/SafetySwitch/types';

interface SafetySwitchHook {
  state: SafetySwitchState;
  addPendingAction: (toolCall: any) => string;
  confirmAction: (actionId: string) => Promise<void>;
  cancelAction: (actionId: string) => Promise<void>;
  startExecution: (actionId: string) => void;
  completeAction: (actionId: string, result: ActionResult) => void;
  clearCompleted: () => void;
  setShowModal: (show: boolean) => void;
  setCurrentAction: (actionId: string | null) => void;
  toggleSafetySwitch: () => void;
  getActionResults: () => Record<string, ActionResult>;
}

export const useSafetySwitch = (
  onActionConfirmed?: (action: PendingAction) => Promise<void>
): SafetySwitchHook => {
  const [state, setState] = useState<SafetySwitchState>({
    pendingActions: [],
    executingActions: [],
    completedActions: [],
    isEnabled: true, // Safety switch enabled by default
    showModal: false,
    currentActionId: null
  });

  const actionResults = useRef<Record<string, ActionResult>>({});
  const pendingConfirmations = useRef<Record<string, {
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
  }>>({});

  // Convert tool call JSON to PendingAction
  const createPendingAction = useCallback((toolCall: any): PendingAction => {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract parameters from tool call
    const parameters: ActionParameter[] = Object.entries(toolCall.parameters || {}).map(([key, value]) => ({
      name: key,
      value,
      type: typeof value,
      description: getParameterDescription(key, toolCall.tool_name),
      sensitive: isSensitiveParameter(key, value)
    }));

    const severity = determineActionSeverity(toolCall.tool_name as ActionType, parameters);
    const impact = getActionImpact(toolCall.tool_name as ActionType, parameters);
    const securityWarnings = getSecurityWarnings(toolCall.tool_name as ActionType, parameters);

    return {
      id: actionId,
      type: toolCall.tool_name as ActionType,
      title: getActionTitle(toolCall.tool_name, parameters),
      description: getActionDescription(toolCall.tool_name, parameters),
      parameters,
      impact,
      securityWarnings,
      severity,
      status: 'pending',
      timestamp: new Date().toISOString(),
      requestId: toolCall.requestId,
      originalToolCall: toolCall
    };
  }, []);

  // Add a new pending action from a tool call
  const addPendingAction = useCallback((toolCall: any): string => {
    const action = createPendingAction(toolCall);
    
    setState(prev => ({
      ...prev,
      pendingActions: [...prev.pendingActions, action],
      showModal: true,
      currentActionId: action.id
    }));

    console.log('🔒 [SAFETY SWITCH] New action pending confirmation:', {
      id: action.id,
      type: action.type,
      severity: action.severity,
      parametersCount: action.parameters.length
    });

    return action.id;
  }, [createPendingAction]);

  // Confirm an action and start execution
  const confirmAction = useCallback(async (actionId: string): Promise<void> => {
    const action = state.pendingActions.find(a => a.id === actionId);
    if (!action) {
      console.error('❌ [SAFETY SWITCH] Action not found for confirmation:', actionId);
      return;
    }

    console.log('✅ [SAFETY SWITCH] User confirmed action:', {
      id: action.id,
      type: action.type,
      severity: action.severity
    });

    // Move from pending to executing
    setState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
      executingActions: [...prev.executingActions, { ...action, status: 'executing' }],
      showModal: false,
      currentActionId: null
    }));

    // Resolve any pending confirmation promise
    if (pendingConfirmations.current[actionId]) {
      pendingConfirmations.current[actionId].resolve(true);
      delete pendingConfirmations.current[actionId];
    }

    // Call the external confirmation callback
    if (onActionConfirmed) {
      try {
        await onActionConfirmed(action);
      } catch (error) {
        console.error('❌ [SAFETY SWITCH] Error in action confirmed callback:', error);
        completeAction(actionId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error in confirmation callback'
        });
      }
    }
  }, [state.pendingActions, onActionConfirmed]);

  // Cancel an action
  const cancelAction = useCallback(async (actionId: string): Promise<void> => {
    const action = state.pendingActions.find(a => a.id === actionId);
    if (!action) {
      console.error('❌ [SAFETY SWITCH] Action not found for cancellation:', actionId);
      return;
    }

    console.log('❌ [SAFETY SWITCH] User cancelled action:', {
      id: action.id,
      type: action.type,
      severity: action.severity
    });

    // Remove from pending actions
    setState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
      completedActions: [...prev.completedActions, { ...action, status: 'cancelled' }],
      showModal: false,
      currentActionId: null
    }));

    // Record cancellation result
    actionResults.current[actionId] = {
      success: false,
      error: 'Action cancelled by user'
    };

    // Reject any pending confirmation promise
    if (pendingConfirmations.current[actionId]) {
      pendingConfirmations.current[actionId].reject(new Error('Action cancelled by user'));
      delete pendingConfirmations.current[actionId];
    }
  }, [state.pendingActions]);

  // Start execution (used internally)
  const startExecution = useCallback((actionId: string) => {
    setState(prev => {
      const action = prev.pendingActions.find(a => a.id === actionId);
      if (!action) return prev;

      return {
        ...prev,
        pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
        executingActions: [...prev.executingActions, { ...action, status: 'executing' }]
      };
    });
  }, []);

  // Complete an action with results
  const completeAction = useCallback((actionId: string, result: ActionResult) => {
    console.log('🏁 [SAFETY SWITCH] Action completed:', {
      id: actionId,
      success: result.success,
      duration: result.duration
    });

    actionResults.current[actionId] = result;

    setState(prev => {
      const executingAction = prev.executingActions.find(a => a.id === actionId);
      if (!executingAction) {
        console.warn('⚠️ [SAFETY SWITCH] Completed action not found in executing actions:', actionId);
        return prev;
      }

      return {
        ...prev,
        executingActions: prev.executingActions.filter(a => a.id !== actionId),
        completedActions: [...prev.completedActions, { 
          ...executingAction, 
          status: result.success ? 'completed' : 'failed' 
        }]
      };
    });
  }, []);

  // Clear completed actions
  const clearCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      completedActions: []
    }));

    // Clear results for completed actions
    const completedIds = state.completedActions.map(a => a.id);
    completedIds.forEach(id => {
      delete actionResults.current[id];
    });

    console.log('🧹 [SAFETY SWITCH] Cleared completed actions');
  }, [state.completedActions]);

  // Modal control
  const setShowModal = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showModal: show }));
  }, []);

  const setCurrentAction = useCallback((actionId: string | null) => {
    setState(prev => ({ ...prev, currentActionId: actionId }));
  }, []);

  // Toggle safety switch on/off
  const toggleSafetySwitch = useCallback(() => {
    setState(prev => ({
      ...prev,
      isEnabled: !prev.isEnabled
    }));

    console.log('🔄 [SAFETY SWITCH] Safety switch toggled:', !state.isEnabled ? 'ENABLED' : 'DISABLED');
  }, [state.isEnabled]);

  const getActionResults = useCallback(() => {
    return { ...actionResults.current };
  }, []);

  return {
    state,
    addPendingAction,
    confirmAction,
    cancelAction,
    startExecution,
    completeAction,
    clearCompleted,
    setShowModal,
    setCurrentAction,
    toggleSafetySwitch,
    getActionResults
  };
};

// Helper functions for action creation
function getParameterDescription(paramName: string, toolName: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    writeFile: {
      filePath: 'Path where the file will be created or overwritten',
      content: 'Content that will be written to the file',
      options: 'Additional options for file writing'
    },
    installPackage: {
      packageName: 'Name of the npm package to install',
      options: 'Additional options for package installation'
    },
    executeShellCommand: {
      command: 'Shell command to execute',
      args: 'Arguments to pass to the command',
      options: 'Additional options for command execution'
    }
  };

  return descriptions[toolName]?.[paramName] || 'Parameter for the action';
}

function isSensitiveParameter(paramName: string, value: any): boolean {
  const sensitiveNames = ['password', 'token', 'key', 'secret', 'auth'];
  const paramLower = paramName.toLowerCase();
  
  if (sensitiveNames.some(name => paramLower.includes(name))) {
    return true;
  }

  if (typeof value === 'string') {
    const valueLower = value.toLowerCase();
    return sensitiveNames.some(name => valueLower.includes(name));
  }

  return false;
}

function getActionTitle(toolName: string, parameters: ActionParameter[]): string {
  switch (toolName) {
    case 'writeFile':
      const filePath = parameters.find(p => p.name === 'filePath')?.value as string;
      return `Write File: ${filePath ? filePath.split('/').pop() : 'Unknown'}`;
    
    case 'installPackage':
      const packageName = parameters.find(p => p.name === 'packageName')?.value as string;
      return `Install Package: ${packageName || 'Unknown'}`;
    
    case 'executeShellCommand':
      const command = parameters.find(p => p.name === 'command')?.value as string;
      return `Execute Command: ${command || 'Unknown'}`;
    
    default:
      return `${toolName}: Action`;
  }
}

function getActionDescription(toolName: string, parameters: ActionParameter[]): string {
  switch (toolName) {
    case 'writeFile':
      const filePath = parameters.find(p => p.name === 'filePath')?.value as string;
      const content = parameters.find(p => p.name === 'content')?.value as string;
      const contentLength = content ? content.length : 0;
      return `Create or overwrite file at ${filePath} with ${contentLength} characters of content`;
    
    case 'installPackage':
      const packageName = parameters.find(p => p.name === 'packageName')?.value as string;
      return `Install npm package '${packageName}' and update project dependencies`;
    
    case 'executeShellCommand':
      const command = parameters.find(p => p.name === 'command')?.value as string;
      const args = parameters.find(p => p.name === 'args')?.value as string[];
      const fullCommand = `${command} ${args?.join(' ') || ''}`.trim();
      return `Execute shell command: ${fullCommand}`;
    
    default:
      return `Perform ${toolName} action with the specified parameters`;
  }
}
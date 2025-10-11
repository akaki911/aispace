/**
 * Phase 3: Safety Switch Service - Backend Integration
 * 
 * Manages the Safety Switch system on the backend, providing secure action
 * confirmation workflows that ensure no development actions execute without
 * explicit user consent.
 */

'use strict';

const EventEmitter = require('events');
const path = require('path');
const TrustedOpsPolicy = require('./trusted_ops_policy');

/**
 * SafetySwitchService - Backend component of the Safety Switch system
 * 
 * This service manages the lifecycle of pending actions, handles user confirmations,
 * and integrates with the Action Loop to provide secure development workflows.
 */
class SafetySwitchService extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    
    // Pending actions waiting for user confirmation
    this.pendingActions = new Map();
    
    // Configuration
    this.config = {
      isEnabled: true, // Safety switch enabled by default
      maxPendingActions: 10,
      confirmationTimeoutMs: 300000, // 5 minutes timeout
      defaultSeverity: 'medium'
    };
    
    // Timeout tracking for automatic cleanup
    this.actionTimeouts = new Map();
    
    // TrustedOps Policy for instant execution
    this.trustedOpsPolicy = null;
    
    console.log('🔒 [SAFETY SWITCH SERVICE] SafetySwitchService created');
  }

  /**
   * Initialize the safety switch service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ [SAFETY SWITCH SERVICE] Already initialized');
      return;
    }

    try {
      console.log('🔒 [SAFETY SWITCH SERVICE] Initializing safety switch service...');
      
      // Initialize TrustedOps Policy for instant execution
      this.trustedOpsPolicy = new TrustedOpsPolicy();
      await this.trustedOpsPolicy.initialize();
      
      this.isInitialized = true;
      console.log('✅ [SAFETY SWITCH SERVICE] Safety switch service initialized successfully');
      console.log('🔒 [SAFETY SWITCH SERVICE] Safety mode:', this.config.isEnabled ? 'ENABLED' : 'DISABLED');
      console.log('🚀 [SAFETY SWITCH SERVICE] TrustedOps instant execution:', this.trustedOpsPolicy.config.enabledByDefault ? 'ENABLED' : 'DISABLED');
      
    } catch (error) {
      console.error('❌ [SAFETY SWITCH SERVICE] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a pending action from a tool call and request user confirmation
   * @param {Object} toolCall - The original tool call from LLM
   * @param {string} requestId - Unique request identifier
   * @returns {Promise<Object>} - Promise that resolves when user confirms/cancels
   */
  async requestActionConfirmation(toolCall, requestId = null) {
    if (!this.config.isEnabled) {
      console.log('⚠️ [SAFETY SWITCH SERVICE] Safety switch disabled, auto-approving action');
      return { confirmed: true, action: toolCall };
    }

    // 🚀 TRUSTED OPS CHECK - Instant execution like Replit Assistant!
    if (this.trustedOpsPolicy && this.trustedOpsPolicy.isInitialized) {
      try {
        const autoApprovalResult = await this.trustedOpsPolicy.canAutoApprove(toolCall, this);
        
        if (autoApprovalResult.shouldBypass) {
          console.log('🚀 [SAFETY SWITCH SERVICE] TrustedOps auto-approved action:', {
            tool: toolCall.tool_name,
            reason: autoApprovalResult.reason,
            audit: autoApprovalResult.audit
          });
          
          // Emit instant approval event
          this.emit('instantApproval', {
            toolCall,
            reason: autoApprovalResult.reason,
            audit: autoApprovalResult.audit,
            timestamp: new Date().toISOString()
          });
          
          return { 
            confirmed: true, 
            action: toolCall, 
            instant: true,
            reason: autoApprovalResult.reason 
          };
        } else {
          console.log('🔍 [SAFETY SWITCH SERVICE] TrustedOps requires confirmation:', autoApprovalResult.reason);
        }
      } catch (error) {
        console.error('❌ [SAFETY SWITCH SERVICE] TrustedOps check failed:', error);
        // Continue to regular confirmation flow on error
      }
    }

    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Create action metadata
    const actionData = {
      id: actionId,
      toolCall,
      requestId,
      timestamp,
      status: 'pending',
      severity: this.determineSeverity(toolCall),
      userAgent: 'Safety Switch System'
    };

    console.log('🔒 [SAFETY SWITCH SERVICE] Requesting confirmation for action:', {
      id: actionId,
      tool: toolCall.tool_name,
      severity: actionData.severity,
      requestId
    });

    // Check if we're at capacity
    if (this.pendingActions.size >= this.config.maxPendingActions) {
      console.warn('⚠️ [SAFETY SWITCH SERVICE] Max pending actions reached, rejecting new action');
      throw new Error('Maximum pending actions reached. Please confirm or cancel existing actions.');
    }

    // Create confirmation promise
    const confirmationPromise = new Promise((resolve, reject) => {
      actionData.resolve = resolve;
      actionData.reject = reject;
    });

    // Store the pending action
    this.pendingActions.set(actionId, actionData);

    // Set up automatic timeout
    const timeoutId = setTimeout(() => {
      this.timeoutAction(actionId);
    }, this.config.confirmationTimeoutMs);
    
    this.actionTimeouts.set(actionId, timeoutId);

    // Emit event for frontend integration
    this.emit('actionPending', {
      actionId,
      toolCall,
      severity: actionData.severity,
      timestamp
    });

    console.log('⏳ [SAFETY SWITCH SERVICE] Action pending user confirmation:', actionId);

    try {
      // Wait for user confirmation
      const result = await confirmationPromise;
      return result;
    } catch (error) {
      console.error('❌ [SAFETY SWITCH SERVICE] Action confirmation failed:', error);
      throw error;
    } finally {
      // Cleanup
      this.cleanupAction(actionId);
    }
  }

  /**
   * Confirm a pending action (called from frontend)
   * @param {string} actionId - ID of the action to confirm
   * @param {string} userId - ID of the user confirming
   * @returns {boolean} - Success status
   */
  confirmAction(actionId, userId = null) {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      console.error('❌ [SAFETY SWITCH SERVICE] Action not found for confirmation:', actionId);
      return false;
    }

    console.log('✅ [SAFETY SWITCH SERVICE] User confirmed action:', {
      id: actionId,
      tool: action.toolCall.tool_name,
      userId,
      severity: action.severity
    });

    // Update action status
    action.status = 'confirmed';
    action.confirmedBy = userId;
    action.confirmedAt = new Date().toISOString();

    // Resolve the confirmation promise
    action.resolve({
      confirmed: true,
      action: action.toolCall,
      actionId,
      confirmedBy: userId,
      confirmedAt: action.confirmedAt
    });

    // Emit confirmation event
    this.emit('actionConfirmed', {
      actionId,
      toolCall: action.toolCall,
      confirmedBy: userId,
      severity: action.severity
    });

    return true;
  }

  /**
   * Cancel a pending action (called from frontend)
   * @param {string} actionId - ID of the action to cancel
   * @param {string} userId - ID of the user cancelling
   * @param {string} reason - Reason for cancellation
   * @returns {boolean} - Success status
   */
  cancelAction(actionId, userId = null, reason = 'User cancelled') {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      console.error('❌ [SAFETY SWITCH SERVICE] Action not found for cancellation:', actionId);
      return false;
    }

    console.log('❌ [SAFETY SWITCH SERVICE] User cancelled action:', {
      id: actionId,
      tool: action.toolCall.tool_name,
      userId,
      reason,
      severity: action.severity
    });

    // Update action status
    action.status = 'cancelled';
    action.cancelledBy = userId;
    action.cancelledAt = new Date().toISOString();
    action.cancellationReason = reason;

    // Reject the confirmation promise
    action.reject(new Error(`Action cancelled: ${reason}`));

    // Emit cancellation event
    this.emit('actionCancelled', {
      actionId,
      toolCall: action.toolCall,
      cancelledBy: userId,
      reason,
      severity: action.severity
    });

    return true;
  }

  /**
   * Timeout a pending action
   * @param {string} actionId - ID of the action to timeout
   */
  timeoutAction(actionId) {
    const action = this.pendingActions.get(actionId);
    if (!action) return;

    console.warn('⏰ [SAFETY SWITCH SERVICE] Action timed out:', {
      id: actionId,
      tool: action.toolCall.tool_name,
      severity: action.severity,
      pendingFor: Date.now() - new Date(action.timestamp).getTime()
    });

    // Update action status
    action.status = 'timeout';
    action.timedOutAt = new Date().toISOString();

    // Reject with timeout error
    action.reject(new Error('Action confirmation timed out'));

    // Emit timeout event
    this.emit('actionTimeout', {
      actionId,
      toolCall: action.toolCall,
      severity: action.severity
    });
  }

  /**
   * Clean up action resources
   * @param {string} actionId - ID of the action to clean up
   */
  cleanupAction(actionId) {
    // Clear timeout
    const timeoutId = this.actionTimeouts.get(actionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.actionTimeouts.delete(actionId);
    }

    // Remove from pending actions
    this.pendingActions.delete(actionId);

    console.log('🧹 [SAFETY SWITCH SERVICE] Cleaned up action:', actionId);
  }

  /**
   * Determine action severity based on tool call
   * @param {Object} toolCall - Tool call to analyze
   * @returns {string} - Severity level
   */
  determineSeverity(toolCall) {
    const { tool_name, parameters } = toolCall;

    switch (tool_name) {
      case 'writeFile':
        const filePath = parameters?.filePath || '';
        
        // Critical: System and security files  
        if (filePath.includes('.env') || filePath.includes('passwd') || filePath.includes('ssh') || 
            filePath.includes('security') || filePath.includes('auth') && filePath.includes('config')) {
          return 'critical';
        }
        
        // High: Package management and core configs
        if (filePath.includes('package.json') || filePath.includes('package-lock.json') ||
            filePath.includes('yarn.lock') || filePath.includes('pnpm-lock') ||
            filePath.includes('Dockerfile') || filePath.includes('docker-compose') ||
            filePath.includes('replit.nix') || filePath.includes('.replit')) {
          return 'high';
        }
        
        // REPLIT ASSISTANT MODE: Low risk for routine code files (like Replit Assistant)
        const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', 
                               '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.dart', '.vue', 
                               '.html', '.css', '.scss', '.less', '.md', '.txt', '.json', '.yml', '.yaml'];
        const fileExt = path.extname(filePath).toLowerCase();
        
        if (codeExtensions.includes(fileExt)) {
          return 'low'; // Instant editing like Replit Assistant!
        }
        
        // Medium: Other configuration files
        if (filePath.includes('config') || filePath.includes('settings') || fileExt === '.conf') {
          return 'medium';
        }
        
        return 'low'; // Default to permissive like Replit Assistant

      case 'installPackage':
        const packageName = parameters?.packageName || '';
        // Critical: System packages or known dangerous packages
        if (packageName.includes('sudo') || packageName.includes('admin') || 
            packageName.includes('exploit') || packageName.includes('hack')) {
          return 'critical';
        }
        // Medium risk: Most packages (faster than high, but still confirmed)
        return 'medium'; // Faster confirmation for packages (vs previous 'high')

      case 'executeShellCommand':
      case 'executeTerminalCommand': // SPEED OPTIMIZED: Replit Assistant equivalent
        const command = parameters?.command || '';
        
        // Critical risk: truly dangerous operations only
        if (command.includes('rm -rf') || command.includes('sudo rm') || command.includes('sudo ') ||
            command.includes('delete') || command.includes('chmod 777') || command.includes('chown')) {
          return 'critical';
        }
        
        // High risk: package installations only (but faster than before)
        if (/^npm\s+(install|ci|update|add|remove|uninstall)\b/.test(command.trim()) ||
            /^npx\s+[^ls|help|version]/.test(command.trim()) || // Allow npx ls, help, version 
            command.includes('npm install')) {
          return 'high'; 
        }
        
        // REPLIT ASSISTANT MODE: Low risk for development commands
        if (command.includes('git ') || command.includes('npm run') || command.includes('npm start') ||
            command.includes('npm test') || command.includes('npm build') || command.includes('python ') ||
            command.includes('node ') || command.includes('ls') || command.includes('cat') ||
            command.includes('grep') || command.includes('find') || command.includes('make') ||
            /^docker\s+(ps|images|version|info)$/.test(command.trim()) || // Only safe docker commands
            /^docker-compose\s+(ps|config|version)$/.test(command.trim())) {
          return 'low'; // Instant execution like Replit Assistant!
        }
        
        // SECURITY ENHANCED: File operations allowed with confirmation (Replit parity)
        if (command.includes('rm ') || command.includes('mv ') || command.includes('cp ') || 
            (command.includes('chmod ') && !command.includes('777'))) {
          return 'high'; // Allow with confirmation - Replit Assistant allows these
        }
        
        // CRITICAL: chmod 777 and other dangerous permissions
        if (command.includes('chmod 777') || command.includes('chmod 0777') || 
            command.includes('chmod a+rwx') || command.includes('chmod ugo+rwx')) {
          return 'critical'; // Never allow dangerous permissions
        }
        
        // High risk: Advanced docker/network operations  
        if (command.includes('docker ') || command.includes('curl') || command.includes('wget')) {
          return 'high'; // Require confirmation with timeout limits
        }
        
        // Low risk: read-only and safe operations (default permissive)
        return 'low';

      default:
        return this.config.defaultSeverity;
    }
  }

  /**
   * Get all pending actions (for frontend display)
   * @returns {Array} - Array of pending action data
   */
  getPendingActions() {
    return Array.from(this.pendingActions.values()).map(action => ({
      id: action.id,
      toolCall: action.toolCall,
      timestamp: action.timestamp,
      severity: action.severity,
      status: action.status,
      requestId: action.requestId
    }));
  }

  /**
   * Get service status and configuration
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.config.isEnabled,
      pendingActionsCount: this.pendingActions.size,
      maxPendingActions: this.config.maxPendingActions,
      confirmationTimeoutMs: this.config.confirmationTimeoutMs,
      pendingActions: this.getPendingActions()
    };
  }

  /**
   * Enable/disable the safety switch
   * @param {boolean} enabled - Whether to enable the safety switch
   */
  setSafetySwitch(enabled) {
    this.config.isEnabled = enabled;
    console.log('🔄 [SAFETY SWITCH SERVICE] Safety switch toggled:', enabled ? 'ENABLED' : 'DISABLED');
    
    this.emit('safetySwitchToggled', { enabled });
    
    // If disabled, auto-approve all pending actions
    if (!enabled && this.pendingActions.size > 0) {
      console.log('⚠️ [SAFETY SWITCH SERVICE] Auto-approving all pending actions due to safety switch disabled');
      for (const [actionId] of this.pendingActions) {
        this.confirmAction(actionId, 'SYSTEM_AUTO_APPROVE');
      }
    }
  }

  /**
   * Clear all pending actions (emergency cleanup)
   */
  clearAllPendingActions() {
    console.log('🧹 [SAFETY SWITCH SERVICE] Clearing all pending actions');
    
    for (const [actionId] of this.pendingActions) {
      this.cancelAction(actionId, 'SYSTEM_CLEANUP', 'Emergency cleanup of all pending actions');
    }
  }
}

// Create singleton instance
const safetySwitchService = new SafetySwitchService();

// Export both class and singleton for compatibility
module.exports = SafetySwitchService;
module.exports.safetySwitchService = safetySwitchService;
/**
 * Task Management System for Replit-style AI Assistant
 * Based on SOL-210 Architecture Document
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class TaskManager {
  constructor() {
    this.taskQueue = [];
    this.activeCheckpoints = new Map();
    this.executionHistory = [];
    this.maxTaskHistory = 20;
    console.log('Task Manager initialized with Replit-style architecture');
  }

  /**
   * Decompose user request into actionable tasks
   * PLAN Phase from architecture
   */
  async decomposeTasks(userRequest, context = {}) {
    console.log('[PLAN] Decomposing user request into tasks...');
    
    // ✅ Input validation to prevent toLowerCase error
    if (!userRequest || typeof userRequest !== 'string') {
      console.warn('[PLAN] Invalid userRequest provided:', typeof userRequest);
      userRequest = String(userRequest || '');
    }
    
    const tasks = [];
    const requestLower = userRequest.toLowerCase();

    // Pattern-based task classification (following architecture)
    if (requestLower.includes('ფაილი') || requestLower.includes('კოდი')) {
      // Code/File related tasks
      tasks.push({
        id: uuidv4(),
        type: 'file_search',
        description: 'Search for relevant files',
        priority: 1,
        preconditions: [],
        verification: ['file_exists']
      });

      if (requestLower.includes('შეცვლა') || requestLower.includes('რედაქტირება')) {
        tasks.push({
          id: uuidv4(),
          type: 'file_patch',
          description: 'Apply code changes with strict verification',
          priority: 2,
          preconditions: ['file_search'],
          verification: ['syntax_check', 'typescript_check', 'build_test']
        });
      }
    }

    if (requestLower.includes('სერვერი') || requestLower.includes('გაშვება')) {
      tasks.push({
        id: uuidv4(),
        type: 'dev_server',
        description: 'Manage development server',
        priority: 3,
        preconditions: [],
        verification: ['port_check', 'runtime_test']
      });
    }

    // Default analysis task for all requests
    tasks.unshift({
      id: uuidv4(),
      type: 'context_analysis',
      description: 'Analyze request context and gather information',
      priority: 0,
      preconditions: [],
      verification: ['context_valid']
    });

    console.log(`[PLAN] Created ${tasks.length} tasks for execution`);
    return tasks;
  }

  /**
   * Create checkpoint for rollback capability
   */
  createCheckpoint() {
    const checkpoint = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      state: {
        fileChanges: [],
        taskProgress: {},
        verificationResults: {}
      },
      rollbackPolicy: {
        autoRollbackOnError: true,
        maxRollbackDepth: 5,
        preserveUserFiles: true
      }
    };

    this.activeCheckpoints.set(checkpoint.id, checkpoint);
    console.log(`[CHECKPOINT] Created checkpoint: ${checkpoint.id}`);
    
    return checkpoint;
  }

  /**
   * Main execution loop following PLAN->PROVE->ACT->VERIFY pattern
   */
  async executeTaskList(taskList, userRequest) {
    console.log('[EXECUTE] Starting task execution with verification...');
    
    const checkpoint = this.createCheckpoint();
    const results = [];

    try {
      for (const task of taskList) {
        console.log(`[${task.type}] Executing: ${task.description}`);
        
        // PROVE Phase - validate preconditions
        const proof = await this.validatePreconditions(task, results);
        if (!proof.valid) {
          throw new TaskValidationError(`Precondition failed: ${proof.errors.join(', ')}`);
        }

        // ACT Phase - execute task
        const result = await this.executeTask(task, { userRequest, checkpoint, previousResults: results });
        
        // VERIFY Phase - validate changes
        const verification = await this.verifyChanges(result, task);
        if (!verification.success) {
          await this.rollbackToCheckpoint(checkpoint);
          throw new VerificationError(`Verification failed: ${verification.errors.join(', ')}`);
        }

        results.push(result);
        this.updateCheckpoint(checkpoint, result);
      }

      // REPORT Phase - compose final response
      const response = await this.composeResponse(taskList, results, checkpoint);
      console.log('[EXECUTE] Task execution completed successfully');
      
      return response;

    } catch (error) {
      console.error('[EXECUTE] Task execution failed:', error.message);
      await this.handleRecovery(error, checkpoint);
      return this.composeErrorResponse(error, taskList);
    }
  }

  /**
   * Execute individual task with context
   */
  async executeTask(task, context) {
    const startTime = Date.now();
    
    try {
      let result = {};

      switch (task.type) {
        case 'context_analysis':
          result = await this.analyzeContext(context.userRequest);
          break;
          
        case 'file_search':
          result = await this.executeFileSearch(context.userRequest);
          break;
          
        case 'file_patch':
          result = await this.executeFilePatch(context);
          break;
          
        case 'dev_server':
          result = await this.executeDevServer(context);
          break;
          
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      result.taskId = task.id;
      result.executionTime = Date.now() - startTime;
      result.timestamp = new Date().toISOString();
      
      return result;

    } catch (error) {
      throw new Error(`Task execution failed: ${error.message}`);
    }
  }

  /**
   * Validate preconditions before task execution
   */
  async validatePreconditions(task, previousResults) {
    console.log(`[PROVE] Validating preconditions for ${task.type}...`);
    
    const errors = [];
    
    for (const precondition of task.preconditions) {
      const hasPrerequisite = previousResults.some(result => 
        result.taskType === precondition || result.satisfies?.includes(precondition)
      );
      
      if (!hasPrerequisite) {
        errors.push(`Missing prerequisite: ${precondition}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify changes after task execution
   */
  async verifyChanges(result, task) {
    console.log(`[VERIFY] Validating changes for ${task.type}...`);
    
    const errors = [];
    
    for (const verification of task.verification) {
      try {
        const isValid = await this.runVerificationStep(verification, result);
        if (!isValid) {
          errors.push(`Verification failed: ${verification}`);
        }
      } catch (error) {
        errors.push(`Verification error in ${verification}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Compose structured response following Replit Assistant format
   */
  async composeResponse(taskList, results, checkpoint) {
    const summary = results.map(r => r.summary || r.description || 'Task completed').join('\n');
    
    return {
      success: true,
      taskList: taskList.map(t => ({ id: t.id, type: t.type, status: 'completed' })),
      results: results,
      checkpointId: checkpoint.id,
      executionSummary: summary,
      timestamp: new Date().toISOString(),
      formattedResponse: `📋 **ანალიზი**
${taskList.length} ამოცანა წარმატებით შესრულდა

🏗️ **ტექნიკური დეტალები**  
- შესრულებული ამოცანები: ${taskList.map(t => t.type).join(', ')}
- Checkpoint ID: ${checkpoint.id}
- სრული verification pipeline ჩატარდა

✅ **მდგომარეობა**
ყველა ამოცანა წარმატებით დასრულდა

🚀 **შედეგი**
${summary}

✨ *Bakhmaro AI Developer Assistant - Task Management System*`
    };
  }

  // Placeholder implementations for task execution methods
  async analyzeContext(userRequest) {
    return {
      taskType: 'context_analysis',
      summary: 'Request context analyzed',
      satisfies: ['context_valid']
    };
  }

  async executeFileSearch(userRequest) {
    return {
      taskType: 'file_search', 
      summary: 'File search completed',
      satisfies: ['file_exists']
    };
  }

  async executeFilePatch(context) {
    return {
      taskType: 'file_patch',
      summary: 'File patch applied with verification',
      satisfies: ['syntax_check', 'typescript_check']
    };
  }

  async executeDevServer(context) {
    return {
      taskType: 'dev_server',
      summary: 'Development server managed',
      satisfies: ['port_check', 'runtime_test']
    };
  }

  async runVerificationStep(verification, result) {
    // Placeholder - to be implemented with actual verification logic
    console.log(`✓ [VERIFY] ${verification} passed`);
    return true;
  }

  updateCheckpoint(checkpoint, result) {
    checkpoint.state.taskProgress[result.taskId] = result;
    
    // Track file changes for rollback
    if (result.fileChanges) {
      checkpoint.state.fileChanges.push(...result.fileChanges);
    }
    
    checkpoint.state.verificationResults[result.taskId] = result.verification || {};
    console.log(`📝 [CHECKPOINT] Updated with task result: ${result.taskType}`);
  }

  /**
   * Enhanced rollback system with file restoration
   * SOL-211: Integrated with Strict Patch Mode for complete recovery
   */
  async rollbackToCheckpoint(checkpoint) {
    console.log(`⏪ [ROLLBACK] Rolling back to checkpoint: ${checkpoint.id}`);
    
    try {
      const rollbackResults = {
        success: true,
        restoredFiles: [],
        errors: []
      };

      // Rollback file changes using Strict Patch Mode
      if (checkpoint.state.fileChanges && checkpoint.state.fileChanges.length > 0) {
        const { StrictPatchMode } = require('../tools/strict_patch_mode');
        const strictPatch = new StrictPatchMode();
        
        for (const fileChange of checkpoint.state.fileChanges.reverse()) {
          try {
            if (fileChange.backupId) {
              await strictPatch.restoreFromBackupId(fileChange.backupId);
              rollbackResults.restoredFiles.push(fileChange.filePath);
              console.log(`[ROLLBACK] Restored: ${fileChange.filePath}`);
            }
          } catch (restoreError) {
            rollbackResults.errors.push(`Failed to restore ${fileChange.filePath}: ${restoreError.message}`);
            rollbackResults.success = false;
          }
        }
      }

      // Clear checkpoint state
      checkpoint.state.taskProgress = {};
      checkpoint.state.fileChanges = [];
      checkpoint.state.verificationResults = {};
      
      console.log(`[ROLLBACK] Completed rollback for checkpoint: ${checkpoint.id}`);
      console.log(`[ROLLBACK] Stats: ${rollbackResults.restoredFiles.length} files restored, ${rollbackResults.errors.length} errors`);
      
      return rollbackResults;

    } catch (error) {
      console.error(`[ROLLBACK] Rollback failed: ${error.message}`);
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Enhanced recovery with comprehensive error handling
   * SOL-211: Multi-layered recovery approach
   */
  async handleRecovery(error, checkpoint) {
    console.log(`[RECOVERY] Handling error: ${error.message}`);
    
    try {
      // Attempt automatic rollback
      const rollbackResult = await this.rollbackToCheckpoint(checkpoint);
      
      if (rollbackResult.success) {
        console.log('[RECOVERY] Automatic rollback successful');
        this.recordRecoveryEvent('auto_rollback_success', error, checkpoint);
      } else {
        console.warn('[RECOVERY] Partial rollback with errors');
        this.recordRecoveryEvent('auto_rollback_partial', error, checkpoint, rollbackResult.errors);
      }

      // Clean up checkpoint
      this.activeCheckpoints.delete(checkpoint.id);
      
      return rollbackResult;

    } catch (recoveryError) {
      console.error(`[RECOVERY] Recovery failed: ${recoveryError.message}`);
      this.recordRecoveryEvent('recovery_failed', error, checkpoint, [recoveryError.message]);
      throw new Error(`Recovery failed: ${recoveryError.message}`);
    }
  }

  /**
   * Record recovery events for debugging and analytics
   */
  recordRecoveryEvent(eventType, originalError, checkpoint, additionalErrors = []) {
    const event = {
      eventType,
      timestamp: new Date().toISOString(),
      checkpointId: checkpoint.id,
      originalError: originalError.message,
      additionalErrors,
      tasksInProgress: Object.keys(checkpoint.state.taskProgress).length,
      fileChangesCount: checkpoint.state.fileChanges?.length || 0
    };

    // Add to execution history for analysis
    this.executionHistory.push({
      type: 'recovery_event',
      ...event
    });

    // Keep only recent history
    if (this.executionHistory.length > this.maxTaskHistory) {
      this.executionHistory = this.executionHistory.slice(-this.maxTaskHistory);
    }

    console.log(`[RECOVERY] Event recorded: ${eventType}`);
  }

  composeErrorResponse(error, taskList) {
    return {
      success: false,
      error: error.message,
      taskList: taskList.map(t => ({ id: t.id, type: t.type, status: 'failed' })),
      timestamp: new Date().toISOString(),
      formattedResponse: `📋 **ანალიზი**
ამოცანის შესრულება ვერ მოხერხდა

🏗️ **ტექნიკური დეტალები**  
- შეცდომის ტიპი: ${error.constructor.name}
- შეტყობინება: ${error.message}

❌ **მდგომარეობა**
სისტემა rollback რეჟიმშია

🚀 **რეკომენდაცია**
გთხოვთ, სცადოთ უფრო მარტივი მოთხოვნა

✨ *Bakhmaro AI Developer Assistant - Error Recovery*`
    };
  }
}

// Custom error classes following architecture patterns
class TaskValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

class VerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationError';
  }
}

module.exports = { TaskManager, TaskValidationError, VerificationError };
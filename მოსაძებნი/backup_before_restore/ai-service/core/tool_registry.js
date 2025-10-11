/**
 * Tool Registry for Replit-style AI Assistant
 * Based on SOL-210 Architecture Document
 * 
 * Centralizes all tools and provides standardized interface
 */

const { TaskManager } = require('./task_manager');
const { StrictPatchMode } = require('../tools/strict_patch_mode');
const { TypeScriptValidator } = require('../diagnostics/typescript_validator');
const { EnhancedFileOperations } = require('../tools/enhanced_file_operations');
const { webSearch, webGet } = require('../tools/web_access');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.taskManager = new TaskManager();
    this.strictPatch = new StrictPatchMode();
    this.tsValidator = new TypeScriptValidator();
    this.fileOps = new EnhancedFileOperations();
    this.webSearch = webSearch;
    this.webGet = webGet;
    
    this.initializeTools();
    console.log('Tool Registry initialized with Replit-style architecture');
  }

  /**
   * Initialize all available tools following SOL-210 specification
   */
  initializeTools() {
    // File System Operations
    this.registerTool('file_search', {
      description: 'Search for files with advanced filtering',
      inputs: ['query', 'options'],
      outputs: ['file_matches'],
      sideEffects: false,
      handler: this.fileOps.searchFiles.bind(this.fileOps),
      failureModes: ['no_matches', 'permission_denied'],
      timeout: 5000
    });

    this.registerTool('file_read', {
      description: 'Read file content safely',
      inputs: ['file_path'],
      outputs: ['file_content'],
      sideEffects: false,
      handler: this.fileOps.safeReadFile.bind(this.fileOps),
      failureModes: ['file_not_found', 'binary_file', 'permission_denied'],
      timeout: 3000
    });

    this.registerTool('file_write', {
      description: 'Write file with backup and verification',
      inputs: ['path', 'content', 'options'],
      outputs: ['success_status'],
      sideEffects: true,
      handler: this.fileOps.safeWriteFile.bind(this.fileOps),
      failureModes: ['write_permission', 'disk_space', 'invalid_path'],
      timeout: 5000
    });

    this.registerTool('strict_patch', {
      description: 'Apply surgical code changes with verification',
      inputs: ['file_path', 'old_str', 'new_str', 'options'],
      outputs: ['patch_result'],
      sideEffects: true,
      handler: this.strictPatch.applyStrictPatch.bind(this.strictPatch),
      failureModes: ['string_not_found', 'ambiguous_match', 'verification_failed'],
      timeout: 10000
    });

    // Diagnostics & Validation
    this.registerTool('typescript_diagnostics', {
      description: 'Get TypeScript errors and warnings',
      inputs: ['file_path'],
      outputs: ['errors', 'warnings'],
      sideEffects: false,
      handler: this.tsValidator.getDiagnostics.bind(this.tsValidator),
      failureModes: ['ts_unavailable', 'parse_error'],
      timeout: 8000
    });

    this.registerTool('project_validation', {
      description: 'Validate entire TypeScript project',
      inputs: ['project_path'],
      outputs: ['validation_summary'],
      sideEffects: false,
      handler: this.tsValidator.validateProject.bind(this.tsValidator),
      failureModes: ['no_tsconfig', 'compilation_errors'],
      timeout: 30000
    });

    // Task Management
    this.registerTool('task_decomposition', {
      description: 'Break down user request into tasks',
      inputs: ['user_request', 'context'],
      outputs: ['task_list'],
      sideEffects: false,
      handler: this.taskManager.decomposeTasks.bind(this.taskManager),
      failureModes: ['invalid_request', 'context_missing'],
      timeout: 3000
    });

    this.registerTool('task_execution', {
      description: 'Execute task list with verification',
      inputs: ['task_list', 'user_request'],
      outputs: ['execution_result'],
      sideEffects: true,
      handler: this.taskManager.executeTaskList.bind(this.taskManager),
      failureModes: ['task_failed', 'verification_failed', 'rollback_failed'],
      timeout: 60000
    });

    // Utility Tools
    this.registerTool('file_info', {
      description: 'Get detailed file information',
      inputs: ['file_path'],
      outputs: ['file_metadata'],
      sideEffects: false,
      handler: this.fileOps.getFileInfo.bind(this.fileOps),
      failureModes: ['file_not_found', 'permission_denied'],
      timeout: 2000
    });

    // SOL-212 Web Access Tools
    this.registerTool('web_search', {
      description: 'Search the internet safely',
      inputs: ['query', 'options'],
      outputs: ['search_results'],
      sideEffects: false,
      handler: this.webSearch.bind(this),
      failureModes: ['invalid_query', 'network_error', 'unsafe_url'],
      timeout: 10000
    });

    this.registerTool('web_get', {
      description: 'Fetch and analyze web page',
      inputs: ['url'],
      outputs: ['page_content'],
      sideEffects: false,
      handler: this.webGet.bind(this),
      failureModes: ['invalid_url', 'fetch_error', 'unsafe_content'],
      timeout: 12000
    });

    this.registerTool('directory_list', {
      description: 'List directory contents with filtering',
      inputs: ['dir_path', 'options'],
      outputs: ['directory_items'],
      sideEffects: false,
      handler: this.fileOps.listDirectory.bind(this.fileOps),
      failureModes: ['directory_not_found', 'permission_denied'],
      timeout: 5000
    });

    console.log(`[REGISTRY] Registered ${this.tools.size} tools`);
  }

  /**
   * Register a tool with metadata
   */
  registerTool(name, config) {
    const tool = {
      name,
      ...config,
      registeredAt: new Date().toISOString(),
      callCount: 0,
      lastCalled: null,
      errors: 0
    };

    this.tools.set(name, tool);
  }

  /**
   * Execute tool with enhanced security and error handling
   * SOL-211: Added input sanitization, logging redaction, and cancellation
   */
  async executeTool(toolName, inputs, options = {}) {
    // Fast rejection for unknown tools
    const tool = this.tools.get(toolName);
    if (!tool) {
      console.warn(`[TOOL_SECURITY] Rejected unknown tool: ${toolName}`);
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Sanitize inputs for logging (redact file contents)
    const sanitizedInputs = this.sanitizeInputsForLogging(inputs);
    console.log(`[TOOL] Executing: ${toolName} with inputs:`, sanitizedInputs);
    
    const startTime = Date.now();
    const executionId = Date.now().toString(36);
    let cancelled = false;

    try {
      // Update statistics
      tool.callCount++;
      tool.lastCalled = new Date().toISOString();

      // Create cancellation mechanism
      const abortController = new AbortController();
      const timeoutMs = Math.min(options.timeout || tool.timeout, 30000); // Max 30s

      // Set up cancellation timeout
      const timeoutHandle = setTimeout(() => {
        cancelled = true;
        abortController.abort();
        console.warn(`⏰ [TOOL_SECURITY] Tool ${toolName} cancelled due to timeout: ${timeoutMs}ms`);
      }, timeoutMs);

      try {
        // Execute with enhanced error handling and cancellation
        const result = await this.executeWithTimeoutAndCancellation(
          tool.handler, 
          inputs, 
          abortController.signal,
          timeoutMs
        );

        clearTimeout(timeoutHandle);
        
        if (cancelled) {
          throw new Error(`Tool execution cancelled after ${timeoutMs}ms`);
        }

        const executionTime = Date.now() - startTime;
        
        // Redact sensitive data from result logging
        const sanitizedResult = this.sanitizeResultForLogging(result);
        console.log(`[TOOL] ${toolName} completed in ${executionTime}ms:`, sanitizedResult);

        return {
          success: true,
          result,
          tool: toolName,
          executionId,
          executionTime,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        clearTimeout(timeoutHandle);
        throw error;
      }

    } catch (error) {
      tool.errors++;
      const executionTime = Date.now() - startTime;
      
      // Log error without sensitive details
      console.error(`[TOOL] ${toolName} failed: ${error.message} (${executionTime}ms)`);

      return {
        success: false,
        error: error.message,
        tool: toolName,
        executionId,
        executionTime,
        timestamp: new Date().toISOString(),
        failureMode: this.classifyError(error, tool.failureModes),
        cancelled
      };
    }
  }

  /**
   * Execute function with timeout and cancellation support
   * SOL-211: Enhanced with AbortController support
   */
  async executeWithTimeoutAndCancellation(handler, inputs, abortSignal, timeoutMs) {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (abortSignal.aborted) {
        reject(new Error('Operation was cancelled before execution'));
        return;
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Set up abort handler
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error('Tool execution was cancelled'));
      };
      
      abortSignal.addEventListener('abort', abortHandler);

      // Execute handler with error wrapping
      Promise.resolve(handler(inputs))
        .then(result => {
          clearTimeout(timeout);
          abortSignal.removeEventListener('abort', abortHandler);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          abortSignal.removeEventListener('abort', abortHandler);
          reject(error);
        });
    });
  }

  /**
   * Sanitize inputs for secure logging (redact file contents)
   * SOL-211: Prevent sensitive data leaks in logs
   */
  sanitizeInputsForLogging(inputs) {
    if (!inputs || typeof inputs !== 'object') {
      return inputs;
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string') {
        // Redact potentially sensitive content
        if (key.toLowerCase().includes('content') || key.toLowerCase().includes('data')) {
          sanitized[key] = `[REDACTED: ${value.length} chars]`;
        } else if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
          sanitized[key] = value; // Paths are OK to log
        } else if (value.length > 200) {
          sanitized[key] = `[LARGE_STRING: ${value.length} chars]`;
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'object') {
        sanitized[key] = '[OBJECT]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize results for secure logging
   * SOL-211: Redact file contents and sensitive metadata
   */
  sanitizeResultForLogging(result) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    const sanitized = { ...result };

    // Redact common sensitive fields
    if (sanitized.content && typeof sanitized.content === 'string') {
      sanitized.content = `[CONTENT: ${sanitized.content.length} chars]`;
    }
    
    if (sanitized.fileContent && typeof sanitized.fileContent === 'string') {
      sanitized.fileContent = `[FILE_CONTENT: ${sanitized.fileContent.length} chars]`;
    }

    // Keep metadata that's safe to log
    const safeFields = ['success', 'filePath', 'size', 'executionTime', 'timestamp', 'tool', 'executionId'];
    const logSafe = {};
    
    for (const field of safeFields) {
      if (sanitized.hasOwnProperty(field)) {
        logSafe[field] = sanitized[field];
      }
    }

    // Add summary info
    if (sanitized.results && Array.isArray(sanitized.results)) {
      logSafe.resultsCount = sanitized.results.length;
    }

    return logSafe;
  }

  /**
   * Classify error based on tool's failure modes
   */
  classifyError(error, failureModes) {
    const errorMessage = error.message.toLowerCase();
    
    for (const mode of failureModes) {
      if (errorMessage.includes(mode.replace('_', ' '))) {
        return mode;
      }
    }

    return 'unknown_error';
  }

  /**
   * Process user request using Replit-style workflow
   */
  async processRequest(userRequest, context = {}) {
    console.log(`[PROCESS] Starting Replit-style request processing...`);
    
    try {
      // Step 1: Decompose request into tasks
      const taskResult = await this.executeTool('task_decomposition', {
        userRequest,
        context
      });

      if (!taskResult.success) {
        throw new Error(`Task decomposition failed: ${taskResult.error}`);
      }

      const taskList = taskResult.result;
      console.log(`[PROCESS] Created ${taskList.length} tasks`);

      // Step 2: Execute task list with verification
      const executionResult = await this.executeTool('task_execution', {
        taskList,
        userRequest
      });

      if (!executionResult.success) {
        throw new Error(`Task execution failed: ${executionResult.error}`);
      }

      // Step 3: Return structured response
      const response = executionResult.result;
      
      console.log(`[PROCESS] Request processing completed successfully`);
      
      return {
        success: true,
        userRequest,
        taskList,
        response: response.formattedResponse,
        executionSummary: response.executionSummary,
        timestamp: new Date().toISOString(),
        toolsUsed: [taskResult.tool, executionResult.tool]
      };

    } catch (error) {
      console.error(`[PROCESS] Request processing failed: ${error.message}`);
      
      return {
        success: false,
        userRequest,
        error: error.message,
        timestamp: new Date().toISOString(),
        response: this.generateErrorResponse(error, userRequest)
      };
    }
  }

  /**
   * Generate error response in Replit style
   */
  generateErrorResponse(error, userRequest) {
    return `📋 **ანალიზი**
მოთხოვნის დამუშავება ვერ მოხერხდა

🏗️ **ტექნიკური დეტალები**  
- შეცდომის ტიპი: ${error.constructor.name}
- შეტყობინება: ${error.message}
- Tool Registry: Active

❌ **მდგომარეობა**
სისტემა recovery რეჟიმშია

🚀 **რეკომენდაცია**
გთხოვთ, სცადოთ უფრო მარტივი მოთხოვნა ან დეტალურად აღწეროთ საჭირო ოპერაცია

✨ *Bakhmaro AI Developer Assistant - Error Recovery Mode*`;
  }

  /**
   * Get tool statistics
   */
  getToolStatistics() {
    const stats = {
      totalTools: this.tools.size,
      toolList: [],
      totalCalls: 0,
      totalErrors: 0
    };

    for (const [name, tool] of this.tools) {
      stats.toolList.push({
        name,
        description: tool.description,
        callCount: tool.callCount,
        errors: tool.errors,
        lastCalled: tool.lastCalled,
        successRate: tool.callCount > 0 ? ((tool.callCount - tool.errors) / tool.callCount * 100).toFixed(1) + '%' : 'N/A'
      });

      stats.totalCalls += tool.callCount;
      stats.totalErrors += tool.errors;
    }

    stats.overallSuccessRate = stats.totalCalls > 0 ? 
      ((stats.totalCalls - stats.totalErrors) / stats.totalCalls * 100).toFixed(1) + '%' : 'N/A';

    return stats;
  }

  /**
   * Get available tools list
   */
  getAvailableTools() {
    const tools = [];
    
    for (const [name, tool] of this.tools) {
      tools.push({
        name,
        description: tool.description,
        inputs: tool.inputs,
        outputs: tool.outputs,
        sideEffects: tool.sideEffects,
        timeout: tool.timeout
      });
    }

    return tools;
  }

  /**
   * Health check for all tools
   */
  async performHealthCheck() {
    console.log('🏥 [HEALTH] Performing tool registry health check...');
    
    const results = {
      healthy: true,
      timestamp: new Date().toISOString(),
      tools: []
    };

    // Test core tools with minimal operations
    const testCases = [
      { tool: 'file_info', inputs: { filePath: __filename } },
      { tool: 'directory_list', inputs: { dirPath: __dirname, options: { maxDepth: 1 } } }
    ];

    for (const testCase of testCases) {
      try {
        const result = await this.executeTool(testCase.tool, testCase.inputs, { timeout: 2000 });
        results.tools.push({
          name: testCase.tool,
          status: result.success ? 'healthy' : 'error',
          message: result.success ? 'OK' : result.error
        });
        
        if (!result.success) {
          results.healthy = false;
        }
      } catch (error) {
        results.tools.push({
          name: testCase.tool,
          status: 'error',
          message: error.message
        });
        results.healthy = false;
      }
    }

    console.log(`🏥 [HEALTH] Registry health: ${results.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    return results;
  }

  /**
   * Get cache statistics
   * SOL-211: Added missing method for health endpoint
   */
  getCacheStats() {
    return {
      toolCount: this.tools.size,
      registeredTools: Array.from(this.tools.keys()),
      totalExecutions: Array.from(this.tools.values()).reduce((sum, tool) => sum + tool.callCount, 0),
      totalErrors: Array.from(this.tools.values()).reduce((sum, tool) => sum + tool.errors, 0),
      cacheHits: 0, // Placeholder for future cache implementation
      cacheMisses: 0
    };
  }
}

module.exports = { ToolRegistry };
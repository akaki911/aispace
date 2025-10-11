'use strict';

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { terminalService } = require('./terminal_service');
const EventEmitter = require('events');

/**
 * ActionExecutorService - Secure Tool Execution Engine for Agent Mode
 * 
 * Phase 1: "The Toolbox" - Building the ActionExecutorService
 * Based on specifications from პრობლემის მოგვარება.txt
 * 
 * Security is the highest priority. This service validates all inputs 
 * and never executes arbitrary, unsanitized code.
 */

class ActionExecutorService extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    
    // Security: Define safe project boundaries per document ROOT framework
    this.PROJECT_ROOT = process.cwd();
    this.SAFE_WRITE_ROOTS = [this.PROJECT_ROOT];
    
    // Document specs: timeouts and quotas per tool
    this.TIMEOUTS = {
      writeFile: 10000,      // 10 seconds
      installPackage: 60000, // 1 minute  
      executeShellCommand: 30000 // 30 seconds
    };
    
    this.OUTPUT_LIMITS = {
      maxStdoutBytes: 10000,  // 10KB max stdout
      maxStderrBytes: 5000    // 5KB max stderr 
    };
    
    // Allowlist of safe shell commands per document specs
    this.ALLOWED_COMMANDS = new Set([
      'ls', 'pwd', 'echo', 'wc', 'head', 'tail', // Basic safe commands  
      'git', 'npm', 'cat', 'node' // Per document: git status|log|diff, npm test, etc.
    ]);
    
    // Blocked dangerous commands per security specifications
    this.BLOCKED_COMMANDS = new Set([
      'rm', 'mv', 'sudo', 'chmod', 'chown',
      'curl', 'wget', 'ssh', 'scp', 'rsync', 
      'dd', 'fdisk', 'mount', 'umount',
      'kill', 'killall', 'pkill', 'systemctl',
      'python', 'python3', 'pip', 'docker', 
      'vi', 'vim', 'nano', 'emacs', 'find', 'grep'
    ]);
    
    // Execution tracking for audit trail
    this.executionHistory = [];
    this.maxHistoryEntries = 100;
    
    console.log('🔧 [ACTION EXECUTOR] ActionExecutorService created');
    console.log('📋 [ACTION EXECUTOR] Configured limits:', {
      timeouts: this.TIMEOUTS,
      outputLimits: this.OUTPUT_LIMITS,
      allowedCommands: this.ALLOWED_COMMANDS.size,
      blockedCommands: this.BLOCKED_COMMANDS.size
    });
  }

  /**
   * Initialize the action executor service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ [ACTION EXECUTOR] Already initialized');
      return;
    }

    try {
      console.log('🔧 [ACTION EXECUTOR] Initializing action executor service...');
      
      // Validate project root
      const projectStats = await fs.stat(this.PROJECT_ROOT);
      if (!projectStats.isDirectory()) {
        throw new Error(`Project root is not a directory: ${this.PROJECT_ROOT}`);
      }
      
      this.isInitialized = true;
      console.log('✅ [ACTION EXECUTOR] Action executor service initialized successfully');
      console.log(`🔒 [ACTION EXECUTOR] Project root: ${this.PROJECT_ROOT}`);
      console.log(`🔒 [ACTION EXECUTOR] Safe commands: ${Array.from(this.ALLOWED_COMMANDS).join(', ')}`);
      
    } catch (error) {
      console.error('❌ [ACTION EXECUTOR] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Security validation: Check if a file path is safe to write to
   * @param {string} filePath - File path to validate
   * @returns {string} - Resolved safe path
   * @throws {Error} - If path is unsafe
   */
  validateSafePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }

    // Resolve the full path
    let resolvedPath = path.resolve(this.PROJECT_ROOT, filePath);
    
    try {
      // Critical security fix: Resolve symlinks to prevent symlink traversal attacks
      const fs = require('fs');
      resolvedPath = fs.realpathSync(path.dirname(resolvedPath));
      resolvedPath = path.join(resolvedPath, path.basename(filePath));
    } catch (error) {
      // If path doesn't exist, validate the directory part
      try {
        const dirPath = path.dirname(resolvedPath);
        const realDirPath = fs.realpathSync(dirPath);
        resolvedPath = path.join(realDirPath, path.basename(filePath));
      } catch (dirError) {
        // If directory doesn't exist, that's fine - we'll create it
        // But make sure we're still within boundaries after resolution
      }
    }
    
    // Check if path is within safe boundaries (after symlink resolution)
    const isWithinSafeRoot = this.SAFE_WRITE_ROOTS.some(safeRoot => 
      resolvedPath.startsWith(path.resolve(safeRoot))
    );
    
    if (!isWithinSafeRoot) {
      throw new Error(`Path outside safe boundaries after symlink resolution: ${resolvedPath}`);
    }
    
    // Block access to critical system directories and files
    const unsafePaths = [
      '/etc', '/usr', '/bin', '/sbin', '/sys', '/proc',
      'node_modules', '.git', '.env', '.replit'
    ];
    
    for (const unsafePath of unsafePaths) {
      if (resolvedPath.includes(unsafePath)) {
        throw new Error(`Access to unsafe path blocked: ${resolvedPath}`);
      }
    }
    
    return resolvedPath;
  }

  /**
   * Security validation: Sanitize package name for npm install
   * @param {string} packageName - Package name to validate
   * @returns {string} - Sanitized package name
   * @throws {Error} - If package name is unsafe
   */
  validatePackageName(packageName) {
    if (!packageName || typeof packageName !== 'string') {
      throw new Error('Invalid package name provided');
    }

    // Remove any dangerous characters
    const sanitized = packageName.trim();
    
    // Block command injection attempts
    const dangerousChars = [';', '|', '&', '>', '<', '`', '$', '(', ')', '{', '}'];
    for (const char of dangerousChars) {
      if (sanitized.includes(char)) {
        throw new Error(`Package name contains dangerous character: ${char}`);
      }
    }
    
    // Validate package name format (basic npm package name rules)
    const packageNameRegex = /^[@a-z0-9\-_\.\/]+$/i;
    if (!packageNameRegex.test(sanitized)) {
      throw new Error(`Invalid package name format: ${sanitized}`);
    }
    
    return sanitized;
  }

  /**
   * Security validation: Validate shell command and arguments
   * @param {string} command - Command to validate
   * @param {Array} args - Command arguments
   * @returns {Object} - Validated command and args
   * @throws {Error} - If command is unsafe
   */
  validateShellCommand(command, args = []) {
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command provided');
    }

    const baseCommand = command.trim().toLowerCase();
    
    // Check if command is explicitly blocked
    if (this.BLOCKED_COMMANDS.has(baseCommand)) {
      throw new Error(`Command is blocked for security: ${baseCommand}`);
    }
    
    // Check if command is in allowlist
    if (!this.ALLOWED_COMMANDS.has(baseCommand)) {
      throw new Error(`Command not in allowlist: ${baseCommand}`);
    }
    
    // Validate arguments
    const sanitizedArgs = [];
    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new Error(`Invalid argument type: ${typeof arg}`);
      }
      
      const trimmedArg = arg.trim();
      
      // Block absolute paths and path traversal
      if (trimmedArg.startsWith('/') || trimmedArg.includes('..')) {
        throw new Error(`Absolute paths and path traversal blocked: ${trimmedArg}`);
      }
      
      // Block command injection in arguments
      const dangerousChars = [';', '|', '&', '>', '<', '`', '$', '(', ')', '{', '}'];
      for (const char of dangerousChars) {
        if (trimmedArg.includes(char)) {
          throw new Error(`Argument contains dangerous character: ${char}`);
        }
      }
      
      // Block access to sensitive files
      if (trimmedArg.includes('.env') || trimmedArg.includes('passwd') || trimmedArg.includes('.ssh')) {
        throw new Error(`Access to sensitive files blocked: ${trimmedArg}`);
      }
      
      sanitizedArgs.push(trimmedArg);
    }
    
    return { command: baseCommand, args: sanitizedArgs };
  }

  /**
   * Log action execution for audit trail
   * @param {string} action - Action type
   * @param {Object} params - Action parameters
   * @param {boolean} success - Whether action succeeded
   * @param {string} result - Action result
   * @param {number} durationMs - Execution duration
   */
  logExecution(action, params, success, result, durationMs) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      params,
      success,
      result: success ? result : `ERROR: ${result}`,
      durationMs,
      requestId: params.requestId || 'unknown'
    };
    
    this.executionHistory.unshift(logEntry);
    if (this.executionHistory.length > this.maxHistoryEntries) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistoryEntries);
    }
    
    console.log(`📋 [ACTION EXECUTOR] ${success ? '✅' : '❌'} ${action}:`, {
      params: params,
      duration: `${durationMs}ms`,
      success
    });
  }

  /**
   * Tool 1: Write File - Securely create or overwrite a file
   * @param {string} filePath - Path where to write the file
   * @param {string} content - Content to write
   * @param {Object} options - Additional options (requestId, etc.)
   * @returns {Promise<Object>} - Execution result
   */
  async writeFile(filePath, content, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`📝 [ACTION EXECUTOR] writeFile: ${filePath}`);
      
      // Security validation
      const safePath = this.validateSafePath(filePath);
      
      if (typeof content !== 'string') {
        throw new Error('Content must be a string');
      }
      
      // Ensure directory exists
      const dirname = path.dirname(safePath);
      await fs.mkdir(dirname, { recursive: true });
      
      // Write the file
      await fs.writeFile(safePath, content, 'utf8');
      
      const duration = Date.now() - startTime;
      const result = `File written successfully: ${safePath} (${content.length} chars)`;
      
      this.logExecution('writeFile', { filePath, contentLength: content.length, ...options }, true, result, duration);
      
      return {
        success: true,
        result,
        filePath: safePath,
        contentLength: content.length,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logExecution('writeFile', { filePath, ...options }, false, error.message, duration);
      
      return {
        success: false,
        error: error.message,
        filePath,
        duration
      };
    }
  }

  /**
   * Tool 2: Install Package - Execute npm install securely using spawn
   * @param {string} packageName - Package to install
   * @param {Object} options - Additional options (requestId, etc.)
   * @returns {Promise<Object>} - Execution result
   */
  async installPackage(packageName, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`📦 [ACTION EXECUTOR] installPackage: ${packageName}`);
      
      // Security validation
      const sanitizedPackage = this.validatePackageName(packageName);
      
      // Execute npm install using spawn (safer than exec) per document specs
      const result = await this.executeCommand('npm', ['install', sanitizedPackage], {
        cwd: this.PROJECT_ROOT,
        timeout: this.TIMEOUTS.installPackage,
        ...options
      });
      
      const duration = Date.now() - startTime;
      this.logExecution('installPackage', { packageName: sanitizedPackage, ...options }, true, result.stdout, duration);
      
      return {
        success: true,
        result: `Package installed successfully: ${sanitizedPackage}`,
        packageName: sanitizedPackage,
        stdout: result.stdout,
        stderr: result.stderr,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logExecution('installPackage', { packageName, ...options }, false, error.message, duration);
      
      return {
        success: false,
        error: error.message,
        packageName,
        duration
      };
    }
  }

  /**
   * Part 3: Execute terminal command using TerminalService  
   * Enhanced secure execution with real-time streaming
   * @param {string} command - Full command string to execute
   * @param {Object} options - Additional options (timeout, etc.)
   * @returns {Promise<Object>} - Execution result
   */
  async executeTerminalCommand(command, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`⚡ [ACTION EXECUTOR] executeTerminalCommand: ${command}`);
      
      // Use TerminalService for secure execution with real-time streaming
      const result = await terminalService.executeCommand(command, {
        timeout: options.timeout || 30000,
        workingDirectory: options.cwd || this.PROJECT_ROOT,
        idempotencyKey: options.idempotencyKey
      });
      
      const duration = Date.now() - startTime;
      this.logExecution('executeTerminalCommand', { command, ...options }, true, result.stdout, duration);
      
      return {
        success: result.success,
        result: result.success ? 
          `Terminal command executed successfully: ${command}` : 
          `Terminal command failed: ${command}`,
        command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        timedOut: result.timedOut
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logExecution('executeTerminalCommand', { command, ...options }, false, error.message, duration);
      
      return {
        success: false,
        error: error.message,
        command,
        duration
      };
    }
  }

  /**
   * Legacy: Execute Shell Command - Execute allowlisted commands securely
   * @deprecated Use executeTerminalCommand for Part 3 compliance
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Additional options (cwd, timeout, requestId, etc.)
   * @returns {Promise<Object>} - Execution result
   */
  async executeShellCommand(command, args = [], options = {}) {
    console.warn('⚠️ [ACTION EXECUTOR] executeShellCommand is deprecated, use executeTerminalCommand');
    
    // Convert old format to new format
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    return this.executeTerminalCommand(fullCommand, options);
  }

  /**
   * Low-level command execution helper
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 30000;
      const cwd = options.cwd || this.PROJECT_ROOT;
      
      const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' }
      });
      
      let stdout = '';
      let stderr = '';
      let timeoutId;
      
      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      }
      
      // Collect output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // Limit output size to prevent memory issues
        if (stdout.length > 10000) {
          stdout = stdout.slice(0, 10000) + '\n... (output truncated)';
        }
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 5000) {
          stderr = stderr.slice(0, 5000) + '\n... (error output truncated)';
        }
      });
      
      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({
            exitCode: code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
        }
      });
      
      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Get execution history for audit purposes
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} - Recent execution history
   */
  getExecutionHistory(limit = 20) {
    return this.executionHistory.slice(0, limit);
  }

  /**
   * Get service status and statistics
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      projectRoot: this.PROJECT_ROOT,
      allowedCommands: Array.from(this.ALLOWED_COMMANDS),
      blockedCommands: Array.from(this.BLOCKED_COMMANDS),
      executionCount: this.executionHistory.length,
      recentExecutions: this.executionHistory.slice(0, 5).map(entry => ({
        timestamp: entry.timestamp,
        action: entry.action,
        success: entry.success,
        duration: entry.durationMs
      }))
    };
  }
}

// Create singleton instance
const actionExecutorService = new ActionExecutorService();

module.exports = {
  actionExecutorService
};
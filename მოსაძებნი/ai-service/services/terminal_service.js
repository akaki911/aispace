/**
 * Part 3: Terminal Control Service - "Agency"
 * Based on პრობლემის მოგვარება.txt specifications
 * 
 * Gives Gurulo the ability to execute shell commands safely
 * with robust error handling and security controls
 */

const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Multi-Session Terminal Service for secure command execution
 * Supports multiple isolated terminal sessions with state persistence
 * Uses child_process.spawn for non-blocking, real-time streaming
 */
class TerminalService extends EventEmitter {
  constructor() {
    super();
    
    // Multi-session state management
    this.sessions = new Map(); // sessionId -> session data
    this.activeProcesses = new Map(); // sessionId -> active child process
    this.sessionTimeouts = new Map(); // sessionId -> timeout handler
    this.maxSessions = 10; // Maximum concurrent sessions
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes idle timeout
    
    // ENHANCED: Replit Assistant equivalent command set (closing 70% gap)
    this.allowedCommands = [
      // === BASIC SYSTEM COMMANDS (like Replit Assistant) ===
      'ls', 'cat', 'echo', 'pwd', 'whoami', 'which', 'head', 'tail', 'grep',
      'find', 'wc', 'sort', 'uniq', 'du', 'df', 'free', 'uname', 'lscpu',
      'ps', 'top', 'tree', 'file', 'stat', 'date', 'uptime', 'env', 'printenv',
      
      // === LANGUAGE INTERPRETERS & COMPILERS ===
      'node', 'python', 'python3', 'java', 'javac', 'gcc', 'g++', 'clang', 'clang++',
      'rustc', 'go', 'php', 'ruby', 'perl', 'lua', 'bash', 'sh', 'zsh',
      
      // === PACKAGE MANAGERS (Replit Assistant can use these) ===
      'npm', 'pip', 'pip3', 'composer', 'gem', 'cargo', 'yarn', 'pnpm',
      
      // === BUILD & DEVELOPMENT TOOLS ===
      'make', 'cmake', 'mvn', 'gradle', 'ant', 'sbt', 'lein', 'mix',
      'git', 'svn', 'hg', 'bzr',
      
      // === CONTAINER & DEPLOYMENT (removed base docker - only specific commands allowed) ===
      // REMOVED: 'docker', 'docker-compose' - too dangerous as base commands
      
      // === FILE OPERATIONS (SAFE) ===
      'mkdir', 'touch', 'ln', 'diff', 'patch', 'tar', 'zip', 'unzip', 'gzip', 'gunzip',
      
      // === TEXT PROCESSING ===
      'sed', 'awk', 'cut', 'tr', 'column', 'expand', 'unexpand', 'fmt', 'fold',
      
      // === DEVELOPMENT UTILITIES ===
      'jq', 'yq', 'xmllint', 'tidy', 'prettier', 'eslint', 'tsc',
      // REMOVED: 'curl', 'wget' - too dangerous as base commands, will be handled specially
      
      // === MONITORING & DEBUGGING ===
      'lsof', 'netstat', 'ss', 'ping', 'traceroute',
      'htop', 'iotop', 'iftop', 'nload', 'dstat'
      // REMOVED: strace, ltrace, nmap, kubectl, helm (security risk in shared environment)
      
      // Total: ~80 commands (vs original 16) - matching Replit Assistant capabilities!
    ];
    
    // DANGEROUS COMMANDS that require safety switch confirmation  
    this.dangerousCommands = [
      'rm', 'mv', 'cp', 'chmod' // File operations that can cause data loss
    ];
    
    // SECURITY BLOCKED: Truly dangerous commands (never allow)
    this.blockedCommands = [
      // === CRITICAL SYSTEM ADMIN (never allow) ===
      'sudo', 'su', 'passwd', 'adduser', 'deluser', 'usermod',
      'systemctl', 'service', 'crontab', 'iptables', 'ufw', 'firewalld',
      
      // === SYSTEM DESTRUCTIVE (never allow) ===
      'dd', 'fdisk', 'mkfs', 'mount', 'umount', 'fsck', 'parted',
      'reboot', 'shutdown', 'halt', 'poweroff',
      
      // === NETWORK SECURITY RISKS (never allow in shared environment) ===
      'nc', 'netcat', 'telnet', 'ftp', 'sftp', 'scp', 'rsync', 'ssh',
      'nmap', 'strace', 'ltrace', 'kubectl', 'helm', // High security risk
      
      // === PRIVILEGE ESCALATION (never allow) ===
      'doas', 'pbexec', 'runuser'
    ];
    
    // Timeout settings
    this.defaultTimeout = 30000; // 30 seconds
    this.maxTimeout = 120000; // 2 minutes max
    
    console.log('🔧 [TERMINAL SERVICE] Multi-session terminal service initialized with event broadcasting');
    console.log(`🔒 [TERMINAL SERVICE] Allowed commands: ${this.allowedCommands.length}`);
    console.log(`⚠️ [TERMINAL SERVICE] Dangerous commands (require safety): ${this.dangerousCommands.length}`);
    console.log(`🚫 [TERMINAL SERVICE] Blocked commands: ${this.blockedCommands.length}`);
    console.log(`📊 [TERMINAL SERVICE] Max sessions: ${this.maxSessions}`);
  }
  
  /**
   * Create a new terminal session
   * @param {string} sessionId - Unique session identifier 
   * @param {string} userId - User ID for ownership
   * @param {string} name - Human-readable session name
   * @param {Object} options - Session configuration
   * @returns {Object} - Session details
   */
  createSession(sessionId, userId, name = 'Terminal', options = {}) {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum sessions (${this.maxSessions}) reached`);
    }
    
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }
    
    const session = {
      id: sessionId,
      userId,
      name,
      workingDirectory: options.workingDirectory || process.cwd(),
      environment: { ...process.env, ...options.environment },
      history: [],
      status: 'idle', // idle, running, error
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      output: [], // Store recent output for reconnection
      maxOutputLines: 1000
    };
    
    this.sessions.set(sessionId, session);
    this.resetSessionTimeout(sessionId);
    
    console.log(`🟢 [TERMINAL SERVICE] Session created: ${sessionId} for user ${userId}`);
    return session;
  }
  
  /**
   * Get session details
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} - Session details or null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * List all sessions for a user
   * @param {string} userId - User ID
   * @returns {Array} - Array of session summaries
   */
  getUserSessions(userId) {
    const userSessions = [];
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        userSessions.push({
          id: sessionId,
          name: session.name,
          status: session.status,
          workingDirectory: session.workingDirectory,
          created: session.created,
          lastActivity: session.lastActivity
        });
      }
    }
    return userSessions;
  }
  
  /**
   * Update session activity timestamp and reset timeout
   * @param {string} sessionId - Session identifier
   */
  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date().toISOString();
      this.resetSessionTimeout(sessionId);
    }
  }
  
  /**
   * Reset session timeout handler
   * @param {string} sessionId - Session identifier
   */
  resetSessionTimeout(sessionId) {
    // Clear existing timeout
    if (this.sessionTimeouts.has(sessionId)) {
      clearTimeout(this.sessionTimeouts.get(sessionId));
    }
    
    // Set new timeout
    const timeoutHandler = setTimeout(() => {
      console.log(`⏰ [TERMINAL SERVICE] Session timeout: ${sessionId}`);
      this.destroySession(sessionId);
    }, this.sessionTimeout);
    
    this.sessionTimeouts.set(sessionId, timeoutHandler);
  }
  
  /**
   * Destroy a terminal session and cleanup resources
   * @param {string} sessionId - Session identifier
   * @returns {boolean} - Success status
   */
  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Kill any active process
    if (this.activeProcesses.has(sessionId)) {
      const process = this.activeProcesses.get(sessionId);
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
    }
    
    // Clear timeout
    if (this.sessionTimeouts.has(sessionId)) {
      clearTimeout(this.sessionTimeouts.get(sessionId));
      this.sessionTimeouts.delete(sessionId);
    }
    
    // Remove session
    this.sessions.delete(sessionId);
    
    console.log(`🔴 [TERMINAL SERVICE] Session destroyed: ${sessionId}`);
    return true;
  }
  
  /**
   * Add output to session history and broadcast to listeners
   * @param {string} sessionId - Session identifier
   * @param {string} type - Output type (stdout, stderr, info)
   * @param {string} content - Output content
   */
  addSessionOutput(sessionId, type, content) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const outputEntry = {
      type,
      content,
      timestamp: new Date().toISOString()
    };
    
    session.output.push(outputEntry);
    
    // Trim output history if too long
    if (session.output.length > session.maxOutputLines) {
      session.output = session.output.slice(-session.maxOutputLines);
    }
    
    // Broadcast output event to all session listeners
    this.emit('session_output', {
      sessionId,
      type: 'output',
      outputType: type,
      data: content,
      timestamp: outputEntry.timestamp
    });
    
    this.updateSessionActivity(sessionId);
  }
  
  /**
   * Broadcast command lifecycle events to session listeners
   * @param {string} sessionId - Session identifier
   * @param {string} eventType - Event type (command_start, command_complete, command_error)
   * @param {Object} data - Event data
   */
  broadcastSessionEvent(sessionId, eventType, data = {}) {
    this.emit('session_output', {
      sessionId,
      type: eventType,
      ...data,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Validate if a command is safe to execute
   * @param {string} command - Command to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result with status and requirements
   */
  validateCommand(command, options = {}) {
    if (!command || typeof command !== 'string') {
      return { allowed: false, error: 'Invalid command format' };
    }
    
    const trimmedCommand = command.trim();
    const baseCommand = trimmedCommand.split(' ')[0];
    const { safetyConfirmed = false } = options;
    
    // Block npx entirely (remote package execution)
    if (/^npx\s+/.test(trimmedCommand)) {
      console.warn(`🚫 [TERMINAL SERVICE] npx blocked - remote package execution not allowed: ${trimmedCommand}`);
      return { allowed: false, error: 'npx commands are blocked for security' };
    }
    
    // Check if explicitly blocked
    if (this.blockedCommands.includes(baseCommand)) {
      console.warn(`🚫 [TERMINAL SERVICE] Blocked command attempted: ${baseCommand}`);
      return { allowed: false, error: `Command '${baseCommand}' is blocked for security` };
    }
    
    // Check if dangerous and requires safety confirmation
    if (this.dangerousCommands.includes(baseCommand)) {
      if (!safetyConfirmed) {
        console.warn(`⚠️ [TERMINAL SERVICE] Dangerous command requires safety confirmation: ${baseCommand}`);
        return { 
          allowed: false, 
          requiresSafety: true,
          error: `Command '${baseCommand}' requires safety confirmation due to potential data loss risk`,
          safetyLevel: 'high'
        };
      }
      console.log(`✅ [TERMINAL SERVICE] Dangerous command approved with safety confirmation: ${baseCommand}`);
    }
    
    // Allow npm install with safety warning (Replit Assistant parity)
    if (/^npm\s+(install|exec|ci|update|add|remove|uninstall|link|init|audit\s+fix)\b/.test(trimmedCommand)) {
      console.log(`⚠️ [TERMINAL SERVICE] npm ${trimmedCommand.split(' ')[1]} executing: ${trimmedCommand}`);
    }
    
    // Check if in allowlist
    if (!this.allowedCommands.includes(baseCommand)) {
      console.warn(`⚠️ [TERMINAL SERVICE] Command not in allowlist: ${baseCommand}`);
      return { allowed: false, error: `Command '${baseCommand}' is not in the allowed commands list` };
    }
    
    return { allowed: true };
  }
  
  /**
   * Legacy method for backward compatibility
   * @param {string} command - Command to validate
   * @returns {boolean} - True if command is safe
   */
  isCommandAllowed(command) {
    const result = this.validateCommand(command);
    return result.allowed;
  }
  
  /**
   * Execute a shell command in a specific session with real-time output streaming
   * @param {string} sessionId - Session identifier
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @param {Function} onOutput - Real-time output callback
   * @returns {Promise<Object>} - Execution result with stdout, stderr, exitCode
   */
  async executeCommandInSession(sessionId, command, options = {}, onOutput = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // Update session status
    session.status = 'running';
    this.updateSessionActivity(sessionId);
    
    // Add command to history
    session.history.push({
      command,
      timestamp: new Date().toISOString()
    });
    
    // Add command to output
    this.addSessionOutput(sessionId, 'command', `$ ${command}`);
    
    // Broadcast command start event
    this.broadcastSessionEvent(sessionId, 'command_start', { command });
    
    try {
      const result = await this.executeCommand(command, {
        ...options,
        workingDirectory: session.workingDirectory,
        sessionId,
        onOutput: (type, data) => {
          this.addSessionOutput(sessionId, type, data);
          if (onOutput) onOutput(type, data);
        }
      });
      
      session.status = 'idle';
      this.updateSessionActivity(sessionId);
      
      // Broadcast command completion event
      this.broadcastSessionEvent(sessionId, 'command_complete', { result });
      
      return result;
    } catch (error) {
      session.status = 'error';
      this.addSessionOutput(sessionId, 'error', error.message);
      this.updateSessionActivity(sessionId);
      
      // Broadcast command error event
      this.broadcastSessionEvent(sessionId, 'command_error', { error: error.message });
      
      throw error;
    }
  }
  
  /**
   * Execute a shell command with real-time output streaming (original method)
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result with stdout, stderr, exitCode
   */
  async executeCommand(command, options = {}) {
    const {
      timeout = this.defaultTimeout,
      workingDirectory = process.cwd(),
      idempotencyKey = null,
      sessionId = null,
      onOutput = null
    } = options;
    
    console.log(`⚡ [TERMINAL SERVICE] Executing command: ${command}`);
    console.log(`📁 [TERMINAL SERVICE] Working directory: ${workingDirectory}`);
    
    // Validate command safety
    const validation = this.validateCommand(command, options);
    if (!validation.allowed) {
      throw new Error(validation.error || `Command not allowed: ${command.split(' ')[0]}`);
    }
    
    // Validate timeout
    const actualTimeout = Math.min(timeout, this.maxTimeout);
    
    return new Promise((resolve, reject) => {
      const args = command.trim().split(' ');
      const cmd = args.shift();
      
      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;
      
      const startTime = Date.now();
      
      // Spawn the process
      const childProcess = spawn(cmd, args, {
        cwd: workingDirectory,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Track process for session cleanup if sessionId provided
      if (sessionId) {
        this.activeProcesses.set(sessionId, childProcess);
      }
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        hasTimedOut = true;
        childProcess.kill('SIGTERM');
        console.warn(`⏰ [TERMINAL SERVICE] Command timed out after ${actualTimeout}ms: ${command}`);
      }, actualTimeout);
      
      // Collect stdout
      childProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log(`📤 [TERMINAL SERVICE] stdout: ${chunk.trim()}`);
        
        // Call onOutput callback for real-time streaming
        if (onOutput) {
          onOutput('stdout', chunk);
        }
      });
      
      // Collect stderr
      childProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.warn(`📥 [TERMINAL SERVICE] stderr: ${chunk.trim()}`);
        
        // Call onOutput callback for real-time streaming
        if (onOutput) {
          onOutput('stderr', chunk);
        }
      });
      
      // Handle process completion
      childProcess.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        
        // Remove from active processes if sessionId provided
        if (sessionId) {
          this.activeProcesses.delete(sessionId);
        }
        
        const duration = Date.now() - startTime;
        
        console.log(`✅ [TERMINAL SERVICE] Command completed: ${command}`);
        console.log(`⏱️ [TERMINAL SERVICE] Duration: ${duration}ms, Exit code: ${exitCode}`);
        
        const result = {
          command,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
          timedOut: hasTimedOut,
          success: exitCode === 0 && !hasTimedOut,
          idempotencyKey,
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
      
      // Handle process errors
      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        
        // Remove from active processes if sessionId provided
        if (sessionId) {
          this.activeProcesses.delete(sessionId);
        }
        
        console.error(`❌ [TERMINAL SERVICE] Process error: ${error.message}`);
        reject(new Error(`Process execution failed: ${error.message}`));
      });
    });
  }
  
  /**
   * Get list of allowed commands
   * @returns {Array<string>} - Array of allowed commands
   */
  getAllowedCommands() {
    return [...this.allowedCommands];
  }
  
  /**
   * Get list of dangerous commands
   * @returns {Array<string>} - Array of dangerous commands
   */
  getDangerousCommands() {
    return [...this.dangerousCommands];
  }
  
  /**
   * Get list of blocked commands
   * @returns {Array<string>} - Array of blocked commands
   */
  getBlockedCommands() {
    return [...this.blockedCommands];
  }
  
  /**
   * Get service status
   * @returns {Object} - Service status information
   */
  getStatus() {
    return {
      isInitialized: true,
      allowedCommands: this.allowedCommands.length,
      blockedCommands: this.blockedCommands.length,
      defaultTimeout: this.defaultTimeout,
      maxTimeout: this.maxTimeout
    };
  }
}

// Create singleton instance
const terminalService = new TerminalService();

module.exports = {
  terminalService,
  TerminalService
};
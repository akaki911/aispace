'use strict';

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * ReplitMonitorService - Real-time Console & Error Monitoring ("Ears" for Gurulo)
 * 
 * This service gives Gurulo the ability to "hear" what's happening in the Replit console,
 * monitoring logs and errors in real-time without requiring user copy-paste.
 * 
 * Based on specifications from პრობლემის მოგვარება.txt - Phase 2
 */
class ReplitMonitorService extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.isMonitoring = false;
    this.recentLogs = []; // Array of recent log entries
    this.recentErrors = []; // Array of recent error entries
    this.maxLogEntries = 20;
    this.maxErrorEntries = 15;
    
    // Potential log file locations in Replit environment
    this.logPaths = [
      '/tmp/logs',
      '/var/log',
      '/home/runner/.replit/logs',
      '/tmp',
      process.cwd() + '/logs'
    ];
    
    // Keywords to identify important log entries
    this.errorKeywords = [
      'error', 'Error', 'ERROR',
      'exception', 'Exception', 'EXCEPTION',
      'failed', 'Failed', 'FAILED',
      'warning', 'Warning', 'WARNING',
      'fatal', 'Fatal', 'FATAL',
      'critical', 'Critical', 'CRITICAL',
      'TypeError', 'ReferenceError', 'SyntaxError',
      'Cannot read properties', 'undefined is not',
      'Permission denied', 'ENOENT', 'EACCES'
    ];
    
    this.logKeywords = [
      'started', 'Starting', 'STARTED',
      'ready', 'Ready', 'READY',
      'listening', 'Listening', 'LISTENING',
      'connected', 'Connected', 'CONNECTED',
      'success', 'Success', 'SUCCESS',
      'completed', 'Completed', 'COMPLETED'
    ];
    
    this.tailProcess = null;
    this.currentLogFile = null;
    
    console.log('👂 [CONSOLE MONITOR] ReplitMonitorService created');
  }

  /**
   * Initialize the console monitoring service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ [CONSOLE MONITOR] Already initialized');
      return;
    }

    try {
      console.log('👂 [CONSOLE MONITOR] Initializing console monitoring...');
      
      // Find available log sources
      await this.findLogSources();
      
      // Start monitoring the most appropriate log source
      await this.startMonitoring();
      
      this.isInitialized = true;
      console.log('✅ [CONSOLE MONITOR] Console monitoring initialized successfully');
      
    } catch (error) {
      console.error('❌ [CONSOLE MONITOR] Initialization failed:', error);
      // Don't throw - console monitoring is optional
      console.log('⚠️ [CONSOLE MONITOR] Running in fallback mode without log monitoring');
    }
  }

  /**
   * Find available log sources in the Replit environment
   */
  async findLogSources() {
    console.log('🔍 [CONSOLE MONITOR] Searching for log sources...');
    
    // Check for existing log directories
    for (const logPath of this.logPaths) {
      try {
        const stats = await fs.stat(logPath);
        if (stats.isDirectory()) {
          console.log(`📁 [CONSOLE MONITOR] Found log directory: ${logPath}`);
          
          // List files in the log directory
          const files = await fs.readdir(logPath);
          console.log(`📁 [CONSOLE MONITOR] Log files in ${logPath}:`, files.slice(0, 5));
        }
      } catch (error) {
        // Directory doesn't exist or can't access
      }
    }
    
    // Check if we can access system logs
    try {
      const journalctlProcess = spawn('journalctl', ['--version'], { stdio: 'pipe' });
      journalctlProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ [CONSOLE MONITOR] journalctl available for system logs');
        }
      });
    } catch (error) {
      console.log('⚠️ [CONSOLE MONITOR] journalctl not available');
    }
  }

  /**
   * Start monitoring console output
   */
  async startMonitoring() {
    console.log('👂 [CONSOLE MONITOR] Starting console monitoring...');
    
    // Strategy 1: Monitor our own process stdout/stderr
    this.monitorProcessOutput();
    
    // Strategy 2: Try to tail system logs if available
    this.monitorSystemLogs();
    
    // Strategy 3: Monitor common log locations
    this.monitorFileBasedLogs();
    
    this.isMonitoring = true;
    console.log('✅ [CONSOLE MONITOR] Console monitoring active');
  }

  /**
   * Monitor current process output (capture console.log, console.error, etc.)
   */
  monitorProcessOutput() {
    console.log('👂 [CONSOLE MONITOR] Setting up process output monitoring...');
    
    // Skip console interception to avoid recursive loops
    // Instead, capture only uncaught exceptions and rejections
    
    // Capture uncaught exceptions with proper error handling
    process.on('uncaughtException', (error) => {
      try {
        this.processLogEntry('error', `Uncaught Exception: ${error.message}\n${error.stack}`);
      } catch (logError) {
        // Prevent infinite loops if processLogEntry fails
        console.error('Failed to log uncaught exception:', logError);
      }
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      try {
        this.processLogEntry('error', `Unhandled Promise Rejection: ${reason}`);
      } catch (logError) {
        // Prevent infinite loops if processLogEntry fails
        console.error('Failed to log unhandled rejection:', logError);
      }
    });
  }

  /**
   * Monitor system logs using journalctl (if available)
   */
  monitorSystemLogs() {
    try {
      console.log('👂 [CONSOLE MONITOR] Attempting to monitor system logs...');
      
      // Try to tail recent system logs
      const journalProcess = spawn('journalctl', [
        '-f',           // Follow
        '--since=1m',   // Last minute
        '--no-pager',   // No pagination
        '-u', 'replit*' // Replit services
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      
      journalProcess.stdout.on('data', (data) => {
        const logLine = data.toString().trim();
        if (logLine) {
          this.processLogEntry('system', logLine);
        }
      });
      
      journalProcess.stderr.on('data', (data) => {
        // Ignore stderr from journalctl for now
      });
      
      journalProcess.on('error', (error) => {
        console.log('⚠️ [CONSOLE MONITOR] System log monitoring not available:', error.message);
        // Don't propagate the error to avoid crashing the service
      });
      
    } catch (error) {
      console.log('⚠️ [CONSOLE MONITOR] Cannot monitor system logs:', error.message);
    }
  }

  /**
   * Monitor file-based logs (search for log files and tail them)
   */
  async monitorFileBasedLogs() {
    // Look for recent log files in common locations
    for (const logPath of this.logPaths) {
      try {
        const stats = await fs.stat(logPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(logPath);
          
          // Find the most recent log file
          for (const file of files) {
            if (file.endsWith('.log') || file.includes('replit') || file.includes('console')) {
              const fullPath = path.join(logPath, file);
              await this.tailLogFile(fullPath);
              break; // Only monitor one file to avoid noise
            }
          }
        }
      } catch (error) {
        // Can't access this path
      }
    }
  }

  /**
   * Tail a specific log file
   */
  async tailLogFile(filePath) {
    try {
      console.log(`👂 [CONSOLE MONITOR] Attempting to tail log file: ${filePath}`);
      
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return;
      }
      
      // Use tail command to follow the file
      const tailProcess = spawn('tail', ['-f', '-n', '10', filePath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      tailProcess.stdout.on('data', (data) => {
        const logLines = data.toString().split('\n').filter(line => line.trim());
        logLines.forEach(line => {
          this.processLogEntry('file', line, filePath);
        });
      });
      
      tailProcess.on('error', (error) => {
        console.log(`⚠️ [CONSOLE MONITOR] Could not tail ${filePath}:`, error.message);
      });
      
      this.tailProcess = tailProcess;
      this.currentLogFile = filePath;
      
    } catch (error) {
      console.log(`⚠️ [CONSOLE MONITOR] Could not access log file ${filePath}:`, error.message);
    }
  }

  /**
   * Process and categorize log entries
   */
  processLogEntry(source, message, filePath = null) {
    if (!message || message.trim().length === 0) {
      return;
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      source: source,
      message: message.trim(),
      filePath: filePath,
      level: this.determineLogLevel(message)
    };
    
    // Add to recent logs
    this.recentLogs.unshift(logEntry);
    if (this.recentLogs.length > this.maxLogEntries) {
      this.recentLogs = this.recentLogs.slice(0, this.maxLogEntries);
    }
    
    // Add to errors if it's an error-level entry
    if (logEntry.level === 'error' || logEntry.level === 'warning') {
      this.recentErrors.unshift(logEntry);
      if (this.recentErrors.length > this.maxErrorEntries) {
        this.recentErrors = this.recentErrors.slice(0, this.maxErrorEntries);
      }
      
      // Emit error event for real-time handling but with error handling
      try {
        this.emit('error', logEntry);
      } catch (emitError) {
        // Don't let event emission errors crash the service
        console.error('Error emitting log event:', emitError.message);
      }
    }
    
    // Emit log event for all entries but with error handling
    try {
      this.emit('log', logEntry);
    } catch (emitError) {
      // Don't let event emission errors crash the service
      console.error('Error emitting log event:', emitError.message);
    }
  }

  /**
   * Determine log level based on message content
   */
  determineLogLevel(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const keyword of this.errorKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        if (keyword.toLowerCase().includes('warning') || keyword.toLowerCase().includes('warn')) {
          return 'warning';
        }
        return 'error';
      }
    }
    
    for (const keyword of this.logKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return 'info';
      }
    }
    
    return 'debug';
  }

  /**
   * Get recent log entries
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Recent log entries
   */
  getRecentLogs(limit = 10) {
    return this.recentLogs.slice(0, limit);
  }

  /**
   * Get recent error entries
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Recent error entries
   */
  getRecentErrors(limit = 5) {
    return this.recentErrors.slice(0, limit);
  }

  /**
   * Get logs from the last N minutes
   * @param {number} minutes - Number of minutes to look back
   * @returns {Array} Recent logs within timeframe
   */
  getLogsFromLastMinutes(minutes = 5) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.recentLogs.filter(log => new Date(log.timestamp) > cutoff);
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Monitoring statistics
   */
  getMonitoringStats() {
    return {
      isInitialized: this.isInitialized,
      isMonitoring: this.isMonitoring,
      currentLogFile: this.currentLogFile,
      totalLogs: this.recentLogs.length,
      totalErrors: this.recentErrors.length,
      lastLogTime: this.recentLogs.length > 0 ? this.recentLogs[0].timestamp : null,
      lastErrorTime: this.recentErrors.length > 0 ? this.recentErrors[0].timestamp : null
    };
  }

  /**
   * Search logs by pattern
   * @param {string} pattern - Search pattern
   * @param {string} level - Log level filter (optional)
   * @returns {Array} Matching log entries
   */
  searchLogs(pattern, level = null) {
    const regex = new RegExp(pattern, 'i');
    return this.recentLogs.filter(log => {
      const matchesPattern = regex.test(log.message);
      const matchesLevel = level ? log.level === level : true;
      return matchesPattern && matchesLevel;
    });
  }

  /**
   * Stop monitoring and cleanup
   */
  async stop() {
    if (this.tailProcess) {
      this.tailProcess.kill('SIGTERM');
      this.tailProcess = null;
    }
    
    this.isMonitoring = false;
    this.isInitialized = false;
    console.log('🛑 [CONSOLE MONITOR] Console monitoring stopped');
  }

  /**
   * Get service status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isMonitoring: this.isMonitoring,
      currentLogFile: this.currentLogFile,
      recentLogsCount: this.recentLogs.length,
      recentErrorsCount: this.recentErrors.length,
      hasActiveTail: this.tailProcess !== null
    };
  }
}

// Create singleton instance
const replitMonitorService = new ReplitMonitorService();

module.exports = {
  replitMonitorService
};
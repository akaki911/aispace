/**
 * TrustedOps Policy Service - Smart SafetySwitch Bypass
 * 
 * Provides intelligent auto-approval for trusted operations while maintaining
 * security for critical actions. Achieves Replit Assistant-level instant execution.
 * 
 * Author: Gurulo AI Assistant
 * Created: Sept 11, 2025 - PROJECT SUPREMACY Phase 1
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * TrustedOps Policy Service
 * Determines when SafetySwitch can be safely bypassed
 */
class TrustedOpsPolicy extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    
    // Policy configuration
    this.config = {
      enabledByDefault: true, // Enable instant execution like Replit Assistant
      maxDiffSize: 10000, // Max characters in a single change (10KB)
      maxFileSize: 100000, // Max file size to auto-approve (100KB)
      auditAll: true, // Audit all bypassed actions
      rollbackEnabled: true // Enable rollback for bypassed actions
    };
    
    // Audit log for bypassed actions
    this.auditLog = [];
    this.maxAuditSize = 1000;
    
    // Rollback snapshots for bypassed file operations
    this.snapshots = new Map();
    this.maxSnapshots = 100;
    
    console.log('🛡️ [TRUSTED OPS POLICY] TrustedOpsPolicy created');
  }
  
  /**
   * Initialize the trusted ops policy service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ [TRUSTED OPS POLICY] Already initialized');
      return;
    }
    
    try {
      console.log('🛡️ [TRUSTED OPS POLICY] Initializing trusted ops policy...');
      
      this.isInitialized = true;
      console.log('✅ [TRUSTED OPS POLICY] Policy initialized successfully');
      console.log('🚀 [TRUSTED OPS POLICY] Instant execution mode:', this.config.enabledByDefault ? 'ENABLED' : 'DISABLED');
      
    } catch (error) {
      console.error('❌ [TRUSTED OPS POLICY] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Determines if an action can be auto-approved (bypass SafetySwitch)
   * @param {Object} toolCall - The tool call to evaluate
   * @param {Object} safetySwitchService - Reference to SafetySwitchService for severity
   * @returns {Promise<Object>} - { shouldBypass, reason, audit }
   */
  async canAutoApprove(toolCall, safetySwitchService) {
    if (!this.config.enabledByDefault) {
      return { 
        shouldBypass: false, 
        reason: 'TrustedOps policy disabled',
        audit: { bypassed: false, reason: 'policy_disabled' }
      };
    }
    
    try {
      // Get severity from existing SafetySwitch logic
      const severity = safetySwitchService.determineSeverity(toolCall);
      
      console.log('🔍 [TRUSTED OPS POLICY] Evaluating action:', {
        tool: toolCall.tool_name,
        severity: severity,
        parameters: Object.keys(toolCall.parameters || {})
      });
      
      // INSTANT APPROVAL: Low-risk operations (like Replit Assistant)
      // SECURITY: Only allow specific safe operations, not all low-risk
      if (severity === 'low' && this.isExplicitlyAllowedOperation(toolCall)) {
        const additionalChecks = await this.performAdditionalChecks(toolCall);
        
        if (additionalChecks.passed) {
          await this.auditBypassedAction(toolCall, severity, 'trusted_operation');
          await this.createRollbackSnapshot(toolCall);
          
          return {
            shouldBypass: true,
            reason: `Trusted ${toolCall.tool_name} operation - instant execution like Replit Assistant`,
            audit: { bypassed: true, reason: 'explicit_allowlist_trusted', severity: severity }
          };
        } else {
          return {
            shouldBypass: false,
            reason: `Security checks failed: ${additionalChecks.reason}`,
            audit: { bypassed: false, reason: 'security_check_failed', details: additionalChecks }
          };
        }
      }
      
      // CONDITIONAL APPROVAL: Medium-risk ONLY for writeFile with size limits and security checks
      const { tool_name } = toolCall;
      if (severity === 'medium' && tool_name === 'writeFile') {
        const sizeCheck = await this.checkContentSize(toolCall);
        const additionalChecks = await this.performAdditionalChecks(toolCall);
        
        if (sizeCheck.withinLimits && additionalChecks.passed) {
          await this.auditBypassedAction(toolCall, severity, 'medium_risk_writeFile_approved');
          await this.createRollbackSnapshot(toolCall);
          
          return {
            shouldBypass: true,
            reason: `Medium-risk writeFile within size limits and security checks passed (${sizeCheck.size} chars)`,
            audit: { bypassed: true, reason: 'medium_writeFile_approved', size: sizeCheck.size }
          };
        } else {
          return {
            shouldBypass: false,
            reason: `Medium-risk writeFile failed checks: size=${sizeCheck.withinLimits}, security=${additionalChecks.passed}`,
            audit: { bypassed: false, reason: 'medium_writeFile_failed_checks' }
          };
        }
      }
      
      // SECURITY: All other medium-risk operations (installPackage, etc.) require confirmation
      if (severity === 'medium' && tool_name !== 'writeFile') {
        return {
          shouldBypass: false,
          reason: `Medium-risk ${tool_name} requires user confirmation for security`,
          audit: { bypassed: false, reason: 'medium_non_writeFile_blocked', tool: tool_name }
        };
      }
      
      // REQUIRE CONFIRMATION: High and Critical operations
      return {
        shouldBypass: false,
        reason: `${severity} risk operation requires user confirmation`,
        audit: { bypassed: false, reason: 'high_risk_confirmation_required', severity: severity }
      };
      
    } catch (error) {
      console.error('❌ [TRUSTED OPS POLICY] Auto-approval check failed:', error);
      return {
        shouldBypass: false,
        reason: `Policy evaluation error: ${error.message}`,
        audit: { bypassed: false, reason: 'evaluation_error', error: error.message }
      };
    }
  }
  
  /**
   * Validate file path is within workspace boundaries (SECURITY CRITICAL)
   * @param {string} filePath - File path to validate
   * @returns {Promise<Object>} - { valid, reason }
   */
  async validateWorkspacePath(filePath) {
    try {
      // Get workspace root
      const workspaceRoot = path.resolve(process.cwd());
      
      // Resolve and normalize the target path
      const resolvedPath = path.resolve(workspaceRoot, filePath);
      
      // SECURITY: Use realpath to resolve symlinks and prevent symlink escapes
      let realResolvedPath;
      try {
        realResolvedPath = await fs.promises.realpath(resolvedPath);
      } catch (error) {
        // If realpath fails (file doesn't exist), use the resolved path
        realResolvedPath = resolvedPath;
      }
      
      const normalizedPath = path.normalize(realResolvedPath);
      
      // Check if path stays within workspace (using realpath to prevent symlink escapes)
      if (!normalizedPath.startsWith(workspaceRoot + path.sep) && normalizedPath !== workspaceRoot) {
        return {
          valid: false,
          reason: `Path traversal detected: ${filePath} resolves outside workspace (real: ${normalizedPath})`
        };
      }
      
      // Check for protected directories
      const relativePath = path.relative(workspaceRoot, normalizedPath);
      const protectedDirs = [
        'node_modules', '.git', '.env', '.replit', '.config', 
        'functions/node_modules', 'backend/node_modules', '.vite', 'dist'
      ];
      
      for (const protectedDir of protectedDirs) {
        if (relativePath.startsWith(protectedDir + path.sep) || relativePath === protectedDir) {
          return {
            valid: false,
            reason: `Access denied to protected directory: ${protectedDir}`
          };
        }
      }
      
      // Check for protected files
      const fileName = path.basename(filePath);
      const protectedFiles = [
        '.env', '.env.local', '.env.production', 'package.json', 'package-lock.json',
        'yarn.lock', 'pnpm-lock.yaml', '.gitignore', '.replit', 'replit.nix',
        'firebase-admin-key.json', 'vite.config.ts', 'tsconfig.json'
      ];
      
      if (protectedFiles.includes(fileName)) {
        return {
          valid: false,
          reason: `Access denied to protected file: ${fileName}`
        };
      }
      
      return { valid: true, reason: 'Path validation passed' };
      
    } catch (error) {
      return {
        valid: false,
        reason: `Path validation error: ${error.message}`
      };
    }
  }
  
  /**
   * Perform additional security checks for low-risk operations
   * @param {Object} toolCall - Tool call to validate
   * @returns {Promise<Object>} - { passed, reason }
   */
  async performAdditionalChecks(toolCall) {
    const { tool_name, parameters } = toolCall;
    
    try {
      // File operation specific checks
      if (tool_name === 'writeFile') {
        const filePath = parameters?.filePath || '';
        const content = parameters?.content || '';
        
        // SECURITY: Validate path boundaries (CRITICAL)
        const pathValidation = await this.validateWorkspacePath(filePath);
        if (!pathValidation.valid) {
          return { 
            passed: false, 
            reason: `Security violation: ${pathValidation.reason}` 
          };
        }
        
        // Check file size
        if (content.length > this.config.maxFileSize) {
          return { 
            passed: false, 
            reason: `File content too large (${content.length} > ${this.config.maxFileSize})` 
          };
        }
        
        // Check for suspicious patterns
        const suspiciousPatterns = [
          /eval\s*\(/i,
          /exec\s*\(/i,
          /system\s*\(/i,
          /require\s*\(\s*['"]child_process['"]/i,
          /import.*child_process/i,
          /fs\.unlink/i,
          /fs\.rm/i,
          /rm\s+-rf/i
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(content)) {
            return { 
              passed: false, 
              reason: `Suspicious pattern detected: ${pattern.source}` 
            };
          }
        }
      }
      
      // Package installation checks
      if (tool_name === 'installPackage') {
        const packageName = parameters?.packageName || '';
        
        // Check for suspicious package names
        const suspiciousPackages = [
          'exploit', 'hack', 'malware', 'backdoor', 'trojan',
          'keylogger', 'rootkit', 'virus', 'worm'
        ];
        
        for (const suspicious of suspiciousPackages) {
          if (packageName.toLowerCase().includes(suspicious)) {
            return { 
              passed: false, 
              reason: `Suspicious package name: ${packageName}` 
            };
          }
        }
      }
      
      return { passed: true, reason: 'All additional checks passed' };
      
    } catch (error) {
      return { 
        passed: false, 
        reason: `Security check error: ${error.message}` 
      };
    }
  }
  
  /**
   * Check if operation is explicitly allowed for auto-approval
   * @param {Object} toolCall - Tool call to check
   * @returns {boolean} - Whether operation is explicitly allowed
   */
  isExplicitlyAllowedOperation(toolCall) {
    const { tool_name, parameters } = toolCall;
    
    // Only allow writeFile for specific safe file types and locations
    if (tool_name === 'writeFile') {
      const filePath = parameters?.filePath || '';
      const fileExt = path.extname(filePath).toLowerCase();
      
      // Explicit safe extensions for instant approval
      const safeCodeExtensions = [
        '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', 
        '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.dart', '.vue', 
        '.html', '.css', '.scss', '.less', '.md', '.txt'
      ];
      
      // SECURITY: Exclude .json from auto-approval (too risky)
      // .json files can contain configs, package.json, etc.
      return safeCodeExtensions.includes(fileExt);
    }
    
    // Be conservative - only allow specific operations
    // Do NOT auto-approve: installPackage, executeShellCommand, etc.
    return false;
  }
  
  /**
   * Check content size for operations
   * @param {Object} toolCall - Tool call to check
   * @returns {Promise<Object>} - { withinLimits, size }
   */
  async checkContentSize(toolCall) {
    const { tool_name, parameters } = toolCall;
    
    if (tool_name === 'writeFile') {
      const content = parameters?.content || '';
      const size = content.length;
      
      return {
        withinLimits: size <= this.config.maxDiffSize,
        size: size
      };
    }
    
    return { withinLimits: true, size: 0 };
  }
  
  /**
   * Audit a bypassed action for security tracking
   * @param {Object} toolCall - The bypassed tool call
   * @param {string} severity - Action severity
   * @param {string} reason - Bypass reason
   */
  async auditBypassedAction(toolCall, severity, reason) {
    if (!this.config.auditAll) return;
    
    const auditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tool: toolCall.tool_name,
      severity: severity,
      reason: reason,
      parameters: this.sanitizeParametersForAudit(toolCall.parameters),
      success: true // Will be updated if rollback occurs
    };
    
    // Add to audit log with size limit
    this.auditLog.push(auditEntry);
    if (this.auditLog.length > this.maxAuditSize) {
      this.auditLog.shift(); // Remove oldest entry
    }
    
    console.log('📊 [TRUSTED OPS POLICY] Action bypassed and audited:', {
      id: auditEntry.id,
      tool: toolCall.tool_name,
      severity: severity,
      reason: reason
    });
    
    // Emit audit event
    this.emit('actionBypassed', auditEntry);
  }
  
  /**
   * Create rollback snapshot for file operations
   * @param {Object} toolCall - Tool call to snapshot
   */
  async createRollbackSnapshot(toolCall) {
    if (!this.config.rollbackEnabled) return;
    
    const { tool_name, parameters } = toolCall;
    
    if (tool_name === 'writeFile') {
      const filePath = parameters?.filePath;
      if (!filePath) return;
      
      try {
        const fs = require('fs').promises;
        const fullPath = path.resolve(process.cwd(), filePath);
        
        // Try to read existing file for snapshot
        let originalContent = null;
        try {
          originalContent = await fs.readFile(fullPath, 'utf8');
        } catch (err) {
          // File doesn't exist, snapshot will be null (indicating creation)
          originalContent = null;
        }
        
        const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const snapshot = {
          id: snapshotId,
          timestamp: new Date().toISOString(),
          filePath: filePath,
          originalContent: originalContent,
          operation: tool_name,
          canRollback: true
        };
        
        // Store snapshot with size limit
        this.snapshots.set(snapshotId, snapshot);
        if (this.snapshots.size > this.maxSnapshots) {
          const oldestKey = this.snapshots.keys().next().value;
          this.snapshots.delete(oldestKey);
        }
        
        console.log('📸 [TRUSTED OPS POLICY] Created rollback snapshot:', {
          id: snapshotId,
          filePath: filePath,
          hasOriginalContent: originalContent !== null
        });
        
      } catch (error) {
        console.error('❌ [TRUSTED OPS POLICY] Failed to create snapshot:', error);
      }
    }
  }
  
  /**
   * Sanitize parameters for audit logging (remove sensitive data)
   * @param {Object} parameters - Raw parameters
   * @returns {Object} - Sanitized parameters
   */
  sanitizeParametersForAudit(parameters) {
    if (!parameters) return {};
    
    const sanitized = { ...parameters };
    
    // Remove sensitive content patterns
    if (sanitized.content) {
      if (sanitized.content.includes('password') || 
          sanitized.content.includes('secret') || 
          sanitized.content.includes('token')) {
        sanitized.content = '[SENSITIVE_CONTENT_REMOVED]';
      } else if (sanitized.content.length > 500) {
        sanitized.content = sanitized.content.substring(0, 500) + '...[TRUNCATED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Get audit log for security review
   * @param {number} limit - Maximum entries to return
   * @returns {Array} - Recent audit entries
   */
  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit);
  }
  
  /**
   * Get available rollback snapshots
   * @returns {Array} - Available snapshots
   */
  getAvailableSnapshots() {
    return Array.from(this.snapshots.values()).map(snapshot => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      filePath: snapshot.filePath,
      operation: snapshot.operation,
      canRollback: snapshot.canRollback
    }));
  }
  
  /**
   * Rollback an operation using snapshot
   * @param {string} snapshotId - Snapshot ID to rollback
   * @returns {Promise<Object>} - Rollback result
   */
  async rollbackOperation(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    if (!snapshot.canRollback) {
      throw new Error(`Snapshot cannot be rolled back: ${snapshotId}`);
    }
    
    try {
      const fs = require('fs').promises;
      const fullPath = path.resolve(process.cwd(), snapshot.filePath);
      
      if (snapshot.originalContent === null) {
        // File was created, delete it
        await fs.unlink(fullPath);
        console.log('🔄 [TRUSTED OPS POLICY] Rolled back file creation:', snapshot.filePath);
      } else {
        // File was modified, restore original content
        await fs.writeFile(fullPath, snapshot.originalContent, 'utf8');
        console.log('🔄 [TRUSTED OPS POLICY] Rolled back file modification:', snapshot.filePath);
      }
      
      // Mark snapshot as used
      snapshot.canRollback = false;
      
      return {
        success: true,
        message: `Successfully rolled back ${snapshot.operation} on ${snapshot.filePath}`,
        snapshotId: snapshotId,
        filePath: snapshot.filePath
      };
      
    } catch (error) {
      console.error('❌ [TRUSTED OPS POLICY] Rollback failed:', error);
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }
  
  /**
   * Get policy statistics
   * @returns {Object} - Policy stats
   */
  getStats() {
    const recentAudits = this.auditLog.slice(-100);
    const bypassedCount = recentAudits.length;
    const snapshotCount = this.snapshots.size;
    
    return {
      isEnabled: this.config.enabledByDefault,
      totalBypassed: bypassedCount,
      recentBypassed: recentAudits.length,
      availableSnapshots: snapshotCount,
      maxDiffSize: this.config.maxDiffSize,
      auditingEnabled: this.config.auditAll,
      rollbackEnabled: this.config.rollbackEnabled
    };
  }
}

module.exports = TrustedOpsPolicy;
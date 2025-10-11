
/**
 * SOL-242: AI Guard Service
 * Enforces file protection rules during Auto-Apply operations
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class AIGuardService {
  constructor() {
    this.config = null;
    this.initialized = false;
    this.auditLog = [];
    
    console.log('🛡️ [AI GUARD] Service initialized');
  }

  /**
   * Initialize guard service by loading .ai-guard.yml
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const configPath = path.resolve(process.cwd(), '.ai-guard.yml');
      
      if (!fs.existsSync(configPath)) {
        console.warn('⚠️ [AI GUARD] No .ai-guard.yml found, using default rules');
        this.config = this.getDefaultConfig();
      } else {
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.load(configContent);
        console.log('✅ [AI GUARD] Configuration loaded from .ai-guard.yml');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ [AI GUARD] Failed to load configuration:', error);
      this.config = this.getDefaultConfig();
      this.initialized = true;
    }
  }

  /**
   * Get default guard configuration
   */
  getDefaultConfig() {
    return {
      neverTouch: [
        'secrets/**',
        '.env*',
        'db/migrations/**',
        'firebase-admin-key.json',
        '.replit',
        'replit.nix',
        'package.json'
      ],
      manualReview: [
        'config/**',
        'infrastructure/**',
        'backend/middleware/**'
      ],
      allowAuto: [
        'src/components/**',
        'src/pages/**',
        'styles/**'
      ],
      enforcement: {
        enabled: true,
        blockOnViolation: true,
        auditLog: true,
        uiAlerts: true
      }
    };
  }

  /**
   * Check if a file path matches any pattern in a list
   */
  matchesPattern(filePath, patterns) {
    if (!patterns || !Array.isArray(patterns)) return false;

    return patterns.some(pattern => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(filePath);
    });
  }

  /**
   * Validate file operation against guard rules
   */
  async validateFileOperation(filePath, operation = 'modify') {
    await this.initialize();

    if (!this.config.enforcement.enabled) {
      return { allowed: true, level: 'disabled' };
    }

    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check NEVER TOUCH patterns (highest priority)
    if (this.matchesPattern(normalizedPath, this.config.neverTouch)) {
      const violation = {
        timestamp: new Date().toISOString(),
        filePath: normalizedPath,
        operation: operation,
        level: 'neverTouch',
        blocked: true,
        reason: 'File matches neverTouch pattern'
      };

      if (this.config.enforcement.auditLog) {
        this.auditLog.push(violation);
        console.log('🚫 [AI GUARD] BLOCKED - Never Touch:', normalizedPath);
      }

      return {
        allowed: false,
        level: 'neverTouch',
        violation: violation,
        message: `File "${filePath}" is protected and cannot be modified by Auto-Apply`,
        uiAlert: {
          type: 'error',
          title: '🛡️ AI Guard Protection',
          message: `Access denied to protected file: ${filePath}`,
          details: 'This file is configured to never be touched by Auto-Apply'
        }
      };
    }

    // Check MANUAL REVIEW patterns
    if (this.matchesPattern(normalizedPath, this.config.manualReview)) {
      const violation = {
        timestamp: new Date().toISOString(),
        filePath: normalizedPath,
        operation: operation,
        level: 'manualReview',
        blocked: true,
        reason: 'File requires manual review'
      };

      if (this.config.enforcement.auditLog) {
        this.auditLog.push(violation);
        console.log('⚠️ [AI GUARD] MANUAL REVIEW REQUIRED:', normalizedPath);
      }

      return {
        allowed: false,
        level: 'manualReview',
        violation: violation,
        message: `File "${filePath}" requires manual review before apply`,
        uiAlert: {
          type: 'warning',
          title: '⚠️ Manual Review Required',
          message: `File requires manual approval: ${filePath}`,
          details: 'This file is configured for manual review before Auto-Apply'
        }
      };
    }

    // Check ALLOW AUTO patterns
    if (this.matchesPattern(normalizedPath, this.config.allowAuto)) {
      console.log('✅ [AI GUARD] AUTO ALLOWED:', normalizedPath);
      return {
        allowed: true,
        level: 'allowAuto',
        message: `File "${filePath}" is approved for Auto-Apply`
      };
    }

    // Default: require manual review for unspecified files
    const violation = {
      timestamp: new Date().toISOString(),
      filePath: normalizedPath,
      operation: operation,
      level: 'unknown',
      blocked: true,
      reason: 'File not in allowAuto list - manual review required'
    };

    if (this.config.enforcement.auditLog) {
      this.auditLog.push(violation);
      console.log('⚠️ [AI GUARD] DEFAULT BLOCK (not in allowAuto):', normalizedPath);
    }

    return {
      allowed: false,
      level: 'unknown',
      violation: violation,
      message: `File "${filePath}" is not in the allowAuto list and requires manual review`,
      uiAlert: {
        type: 'warning',
        title: '🔒 File Not Approved',
        message: `File not in allowAuto list: ${filePath}`,
        details: 'Only explicitly allowed files can be auto-applied'
      }
    };
  }

  /**
   * Validate multiple file operations
   */
  async validateBatch(fileOperations) {
    const results = [];
    let hasViolations = false;

    for (const operation of fileOperations) {
      const result = await this.validateFileOperation(operation.filePath, operation.operation);
      results.push({
        ...operation,
        validation: result
      });

      if (!result.allowed) {
        hasViolations = true;
      }
    }

    return {
      results: results,
      hasViolations: hasViolations,
      summary: {
        total: fileOperations.length,
        allowed: results.filter(r => r.validation.allowed).length,
        blocked: results.filter(r => !r.validation.allowed).length
      }
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get guard statistics
   */
  getStats() {
    const recentViolations = this.auditLog.slice(-50);
    
    return {
      totalViolations: this.auditLog.length,
      recentViolations: recentViolations.length,
      byLevel: {
        neverTouch: recentViolations.filter(v => v.level === 'neverTouch').length,
        manualReview: recentViolations.filter(v => v.level === 'manualReview').length,
        unknown: recentViolations.filter(v => v.level === 'unknown').length
      },
      configuration: {
        enabled: this.config?.enforcement?.enabled || false,
        neverTouchPatterns: this.config?.neverTouch?.length || 0,
        manualReviewPatterns: this.config?.manualReview?.length || 0,
        allowAutoPatterns: this.config?.allowAuto?.length || 0
      }
    };
  }

  /**
   * Get configuration for debugging
   */
  getConfig() {
    return this.config;
  }
}

module.exports = AIGuardService;

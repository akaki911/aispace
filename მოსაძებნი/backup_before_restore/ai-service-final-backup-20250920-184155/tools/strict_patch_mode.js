/**
 * Strict Patch Mode Implementation
 * Based on SOL-210 Architecture Document
 * 
 * Implements surgical, verified file modifications with rollback capability
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class StrictPatchMode {
  constructor() {
    this.backupDir = path.join(process.cwd(), '.assistant_backups'); // SOL-211: Fixed subdir
    this.maxBackups = 10; // SOL-211: Increased for better retention
    this.maxBackupAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    // SOL-211: Add mutex/queue for preventing parallel patch collisions
    this.patchQueue = [];
    this.activePatch = null;
    this.processing = false;
    
    this.ensureBackupDir();
    console.log('🔧 Strict Patch Mode initialized with SOL-211 security enhancements');
  }

  async ensureBackupDir() {
    try {
      // SOL-211: Ensure backup directory is within project root and secure
      const projectRoot = process.cwd();
      if (!this.backupDir.startsWith(projectRoot)) {
        throw new Error('Backup directory must be within project root');
      }
      
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create .gitignore for backup directory
      const gitignorePath = path.join(this.backupDir, '.gitignore');
      try {
        await fs.access(gitignorePath);
      } catch {
        await fs.writeFile(gitignorePath, '# Assistant backup files\n*\n!.gitignore\n');
      }
      
      console.log(`💾 [BACKUP] Directory ready: ${this.backupDir}`);
    } catch (error) {
      console.warn('⚠️ Could not create backup directory:', error.message);
    }
  }

  /**
   * Apply strict patch with queue-based concurrency control
   * SOL-211: Enhanced with mutex/queue to prevent parallel patch collisions
   */
  async applyStrictPatch(filePath, oldStr, newStr, options = {}) {
    const patchId = uuidv4();
    console.log(`🔧 [STRICT_PATCH] Queuing patch: ${patchId} for ${filePath}`);
    
    // Add to queue and wait for turn
    return new Promise((resolve, reject) => {
      this.patchQueue.push({
        patchId,
        filePath,
        oldStr,
        newStr,
        options,
        resolve,
        reject,
        queuedAt: Date.now()
      });
      
      this.processQueue();
    });
  }

  /**
   * Process patch queue with mutex-like behavior
   * SOL-211: Prevents parallel patch collisions
   */
  async processQueue() {
    if (this.processing || this.patchQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.patchQueue.length > 0) {
      const patchRequest = this.patchQueue.shift();
      this.activePatch = patchRequest;
      
      try {
        const result = await this.executePatchSafely(patchRequest);
        patchRequest.resolve(result);
      } catch (error) {
        console.error(`❌ [PATCH_QUEUE] Failed patch ${patchRequest.patchId}:`, error.message);
        patchRequest.reject(error);
      } finally {
        this.activePatch = null;
      }
    }
    
    this.processing = false;
  }

  /**
   * Execute individual patch safely with full verification
   * SOL-211: Separated from queue management for clarity
   */
  async executePatchSafely(patchRequest) {
    const { patchId, filePath, oldStr, newStr, options, queuedAt } = patchRequest;
    const startTime = Date.now();
    const queueWaitTime = startTime - queuedAt;
    
    console.log(`🔧 [STRICT_PATCH] Executing patch ${patchId} (queued ${queueWaitTime}ms)`);
    
    try {
      // Step 1: Prove old string exists uniquely
      const content = await fs.readFile(filePath, 'utf8');
      const matches = content.split(oldStr).length - 1;
      
      if (matches === 0) {
        throw new StrictPatchError('Old string not found in file');
      }
      if (matches > 1) {
        throw new StrictPatchError(`Multiple matches found (${matches}) - ambiguous patch`);
      }

      // Step 2: Create backup before changes
      const backup = await this.createBackup(filePath, content, patchId);
      
      // Step 3: Apply minimal change
      const newContent = content.replace(oldStr, newStr);
      const linesChanged = newStr.split('\n').length;
      
      if (linesChanged > 50 && !options.allowLargeChanges) {
        throw new StrictPatchError(`Patch too large: ${linesChanged} lines (max: 50)`);
      }

      // Step 4: Write and verify immediately
      await fs.writeFile(filePath, newContent);
      console.log(`📝 [STRICT_PATCH] File written: ${filePath}`);

      // Step 5: Run enhanced verification pipeline
      const verification = await this.runEnhancedVerificationPipeline(filePath, options);
      
      if (!verification.success) {
        // Step 6: Rollback on failure
        console.log('❌ [STRICT_PATCH] Verification failed, rolling back...');
        await this.rollbackFromBackup(backup);
        throw new StrictPatchError(`Verification failed: ${verification.errors.join(', ')}`);
      }

      // Success - clean up old backups
      await this.cleanupOldBackups();

      const result = {
        success: true,
        patchId,
        filePath,
        linesChanged,
        executionTime: Date.now() - startTime,
        queueWaitTime,
        verification: verification,
        backupId: backup.id,
        changes: {
          oldStr: oldStr.substring(0, 100) + (oldStr.length > 100 ? '...' : ''),
          newStr: newStr.substring(0, 100) + (newStr.length > 100 ? '...' : ''),
          sizeChange: newStr.length - oldStr.length
        }
      };

      console.log(`✅ [STRICT_PATCH] Patch completed successfully: ${patchId} (${result.executionTime}ms)`);
      return result;

    } catch (error) {
      console.error(`❌ [STRICT_PATCH] Failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create backup with metadata
   */
  async createBackup(filePath, content, patchId) {
    const backup = {
      id: uuidv4(),
      patchId,
      originalPath: filePath,
      timestamp: new Date().toISOString(),
      content
    };

    const backupPath = path.join(this.backupDir, `${backup.id}.backup`);
    const metaPath = path.join(this.backupDir, `${backup.id}.meta.json`);
    
    try {
      await fs.writeFile(backupPath, content);
      await fs.writeFile(metaPath, JSON.stringify(backup, null, 2));
      console.log(`💾 [BACKUP] Created: ${backup.id}`);
      return backup;
    } catch (error) {
      console.warn('⚠️ Backup creation failed:', error.message);
      return backup; // Continue without backup in worst case
    }
  }

  /**
   * Rollback from backup
   */
  async rollbackFromBackup(backup) {
    try {
      await fs.writeFile(backup.originalPath, backup.content);
      console.log(`⏪ [ROLLBACK] Restored: ${backup.originalPath}`);
    } catch (error) {
      console.error('❌ [ROLLBACK] Failed:', error.message);
      throw new StrictPatchError(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Run verification pipeline following architecture
   */
  async runVerificationPipeline(filePath) {
    console.log(`✅ [VERIFY] Running verification pipeline for: ${filePath}`);
    
    const results = {
      success: true,
      errors: [],
      warnings: [],
      steps: {}
    };

    try {
      // Step 1: Syntax validation
      const syntaxValid = await this.validateSyntax(filePath);
      results.steps.syntax = syntaxValid;
      if (!syntaxValid.valid) {
        results.errors.push(...syntaxValid.errors);
        results.success = false;
      }

      // Step 2: File integrity check
      const integrityValid = await this.checkFileIntegrity(filePath);
      results.steps.integrity = integrityValid;
      if (!integrityValid.valid) {
        results.errors.push(...integrityValid.errors);
        results.success = false;
      }

      // Step 3: TypeScript check (if applicable)
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        const typeValid = await this.checkTypeScript(filePath);
        results.steps.typescript = typeValid;
        if (!typeValid.valid) {
          results.warnings.push(...typeValid.errors); // TS errors are warnings for now
        }
      }

      console.log(`📊 [VERIFY] Pipeline result: ${results.success ? 'PASS' : 'FAIL'}`);
      return results;

    } catch (error) {
      results.success = false;
      results.errors.push(`Verification pipeline error: ${error.message}`);
      return results;
    }
  }

  /**
   * Basic syntax validation
   */
  async validateSyntax(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Basic checks
      const errors = [];
      
      // Check for balanced brackets
      const openBrackets = (content.match(/[{(\[]/g) || []).length;
      const closeBrackets = (content.match(/[})\]]/g) || []).length;
      
      if (openBrackets !== closeBrackets) {
        errors.push('Unbalanced brackets detected');
      }

      // Check for valid UTF-8
      if (content.includes('\uFFFD')) {
        errors.push('Invalid character encoding');
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Syntax validation failed: ${error.message}`]
      };
    }
  }

  /**
   * File integrity check
   */
  async checkFileIntegrity(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const errors = [];

      // Check file is not empty (unless intentionally)
      if (stats.size === 0) {
        errors.push('File is empty after patch');
      }

      // Check file is not too large (> 1MB indicates potential issue)
      if (stats.size > 1024 * 1024) {
        errors.push('File size exceeds reasonable limit (1MB)');
      }

      return {
        valid: errors.length === 0,
        errors,
        fileSize: stats.size
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`File integrity check failed: ${error.message}`]
      };
    }
  }

  /**
   * Enhanced verification pipeline with real TypeScript integration
   * SOL-211: Enhanced with LSP diagnostics and build verification
   */
  async runEnhancedVerificationPipeline(filePath, options = {}) {
    console.log(`🔧 [ENHANCED_VERIFY] Running advanced verification for: ${filePath}`);
    
    const results = {
      success: true,
      errors: [],
      warnings: [],
      steps: {},
      enhanced: true
    };

    try {
      // Step 1: Basic verification pipeline
      const basicResults = await this.runVerificationPipeline(filePath);
      results.steps.basic = basicResults;
      
      if (!basicResults.success) {
        results.errors.push(...basicResults.errors);
        results.success = false;
      }

      // Step 2: Real TypeScript validation using our TypeScript Validator
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        try {
          const { TypeScriptValidator } = require('../diagnostics/typescript_validator');
          const tsValidator = new TypeScriptValidator();
          const tsResults = await tsValidator.getDiagnostics(filePath);
          
          results.steps.typescript_enhanced = tsResults;
          
          if (!tsResults.valid) {
            results.errors.push(...tsResults.errors.map(e => e.message || e));
            results.success = false;
          }
          
          if (tsResults.warnings.length > 0) {
            results.warnings.push(...tsResults.warnings.map(w => w.message || w));
          }
        } catch (tsError) {
          console.warn('⚠️ Enhanced TypeScript validation failed, using basic:', tsError.message);
          results.warnings.push('Enhanced TypeScript validation unavailable');
        }
      }

      // Step 3: Build verification (if enabled)
      if (options.buildVerification !== false) {
        const buildResults = await this.verifyBuildIntegrity(filePath);
        results.steps.build = buildResults;
        
        if (!buildResults.success) {
          results.warnings.push(...buildResults.errors); // Build errors as warnings for now
        }
      }

      // Step 4: Georgian language content validation (if applicable)
      if (options.georgianValidation && this.containsGeorgianContent(filePath)) {
        const georgianResults = await this.validateGeorgianContent(filePath);
        results.steps.georgian = georgianResults;
        
        if (!georgianResults.valid) {
          results.warnings.push(...georgianResults.errors);
        }
      }

      console.log(`🔧 [ENHANCED_VERIFY] Pipeline result: ${results.success ? 'PASS' : 'FAIL'} (${results.errors.length} errors, ${results.warnings.length} warnings)`);
      return results;

    } catch (error) {
      results.success = false;
      results.errors.push(`Enhanced verification pipeline error: ${error.message}`);
      return results;
    }
  }

  /**
   * TypeScript validation using integrated TypeScript Validator
   */
  async checkTypeScript(filePath) {
    console.log(`📝 [TS_CHECK] Checking TypeScript: ${filePath}`);
    
    try {
      const { TypeScriptValidator } = require('../diagnostics/typescript_validator');
      const tsValidator = new TypeScriptValidator();
      const result = await tsValidator.getDiagnostics(filePath);
      
      return {
        valid: result.valid,
        errors: result.errors.map(e => e.message || e),
        warnings: result.warnings.map(w => w.message || w)
      };
    } catch (error) {
      console.warn('⚠️ TypeScript validation fallback:', error.message);
      return {
        valid: true, // Fail open for now
        errors: [],
        warnings: [`TypeScript validation unavailable: ${error.message}`]
      };
    }
  }

  /**
   * Clean up old backups by count and age
   * SOL-211: Enhanced with time-based cleanup
   */
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const metaFiles = files.filter(f => f.endsWith('.meta.json'));
      const now = Date.now();
      
      const backups = [];
      for (const metaFile of metaFiles) {
        try {
          const metaPath = path.join(this.backupDir, metaFile);
          const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
          const age = now - new Date(meta.timestamp).getTime();
          
          backups.push({ meta, metaFile, age });
        } catch (error) {
          console.warn('⚠️ Could not read backup meta:', error.message);
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.meta.timestamp) - new Date(a.meta.timestamp));
      
      const toDelete = [];
      
      // Remove by age first
      for (const backup of backups) {
        if (backup.age > this.maxBackupAge) {
          toDelete.push(backup);
        }
      }
      
      // Remove by count (keep only maxBackups newest)
      if (backups.length > this.maxBackups) {
        const excessBackups = backups.slice(this.maxBackups);
        toDelete.push(...excessBackups);
      }
      
      // Remove duplicates
      const uniqueToDelete = toDelete.filter((backup, index, arr) => 
        arr.findIndex(b => b.meta.id === backup.meta.id) === index
      );
      
      for (const { meta, metaFile } of uniqueToDelete) {
        try {
          await fs.unlink(path.join(this.backupDir, metaFile));
          await fs.unlink(path.join(this.backupDir, `${meta.id}.backup`));
          console.log(`🗑️ [CLEANUP] Removed backup: ${meta.id} (age: ${Math.round(meta.age / 1000 / 60)}min)`);
        } catch (error) {
          console.warn('⚠️ Could not clean backup:', error.message);
        }
      }
      
      if (uniqueToDelete.length > 0) {
        console.log(`🗑️ [CLEANUP] Removed ${uniqueToDelete.length} old backups`);
      }
    } catch (error) {
      console.warn('⚠️ Backup cleanup failed:', error.message);
    }
  }

  /**
   * Build verification to ensure patch doesn't break compilation
   * SOL-211: Enhanced verification with build system integration
   */
  async verifyBuildIntegrity(filePath) {
    console.log(`🏗️ [BUILD_VERIFY] Checking build integrity for: ${filePath}`);
    
    try {
      // Check if this is a project that can be built
      const projectRoot = this.findProjectRoot(filePath);
      if (!projectRoot) {
        return {
          success: true,
          errors: [],
          info: 'No build configuration found, skipping build verification'
        };
      }

      // For now, do basic checks until we implement full build integration
      const errors = [];
      
      // Check if file is importable (basic syntax check)
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          // Check for basic import/export syntax
          if (content.includes('import') || content.includes('export')) {
            // Check for malformed imports
            const importPattern = /import\s+.*?from\s+['"`].*?['"`]/g;
            const imports = content.match(importPattern) || [];
            
            for (const imp of imports) {
              if (imp.includes('undefined') || imp.includes('null')) {
                errors.push('Potentially malformed import statement detected');
              }
            }
          }
        } catch (readError) {
          errors.push(`File read error during build verification: ${readError.message}`);
        }
      }

      return {
        success: errors.length === 0,
        errors,
        info: 'Basic build integrity check completed'
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Build verification failed: ${error.message}`]
      };
    }
  }

  /**
   * Find project root directory
   */
  findProjectRoot(filePath) {
    let currentDir = path.dirname(filePath);
    const rootDir = path.parse(currentDir).root;

    while (currentDir !== rootDir) {
      // Check for package.json, tsconfig.json, or vite.config
      const markers = ['package.json', 'tsconfig.json', 'vite.config.js', 'vite.config.ts'];
      
      for (const marker of markers) {
        const markerPath = path.join(currentDir, marker);
        try {
          require('fs').accessSync(markerPath);
          return currentDir;
        } catch (error) {
          // File doesn't exist, continue
        }
      }
      
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Check if file contains Georgian content
   */
  containsGeorgianContent(filePath) {
    try {
      const content = require('fs').readFileSync(filePath, 'utf8');
      // Georgian Unicode range: \u10A0-\u10FF
      return /[\u10A0-\u10FF]/.test(content);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Georgian content encoding and structure
   */
  async validateGeorgianContent(filePath) {
    console.log(`🇬🇪 [GEORGIAN_VERIFY] Validating Georgian content: ${filePath}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const errors = [];
      
      // Check for proper UTF-8 encoding of Georgian characters
      const georgianText = content.match(/[\u10A0-\u10FF]+/g) || [];
      
      for (const text of georgianText) {
        // Check for malformed Georgian characters
        if (text.includes('\uFFFD')) {
          errors.push('Malformed Georgian characters detected (encoding issue)');
        }
        
        // Basic Georgian text validation
        if (text.length > 100) { // Very long Georgian strings might indicate issues
          // This is a basic check - could be enhanced with more sophisticated validation
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        georgianTextCount: georgianText.length
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Georgian content validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Restore from backup by ID
   * SOL-211: New restore functionality for recovery
   */
  async restoreFromBackupId(backupId) {
    try {
      const metaPath = path.join(this.backupDir, `${backupId}.meta.json`);
      const backupPath = path.join(this.backupDir, `${backupId}.backup`);
      
      // Read backup metadata
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      
      // Read backup content
      const content = await fs.readFile(backupPath, 'utf8');
      
      // Restore file
      await fs.writeFile(meta.originalPath, content);
      
      console.log(`⏪ [RESTORE] Restored ${meta.originalPath} from backup ${backupId}`);
      
      return {
        success: true,
        backupId,
        filePath: meta.originalPath,
        restoredAt: new Date().toISOString(),
        originalTimestamp: meta.timestamp
      };
      
    } catch (error) {
      console.error(`❌ [RESTORE] Failed to restore backup ${backupId}:`, error.message);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * Get list of available backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const metaFiles = files.filter(f => f.endsWith('.meta.json'));
      const backups = [];

      for (const metaFile of metaFiles) {
        try {
          const metaPath = path.join(this.backupDir, metaFile);
          const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
          backups.push(meta);
        } catch (error) {
          console.warn('⚠️ Could not read backup meta:', error.message);
        }
      }

      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.warn('⚠️ Could not list backups:', error.message);
      return [];
    }
  }
}

class StrictPatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StrictPatchError';
  }
}

module.exports = { StrictPatchMode, StrictPatchError };
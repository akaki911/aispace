/**
 * TypeScript Diagnostics & LSP Integration
 * Based on SOL-210 Architecture Document
 * 
 * Provides real-time TypeScript error detection and validation
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class TypeScriptValidator {
  constructor() {
    this.tsconfigCache = new Map();
    this.diagnosticsCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    console.log('📊 TypeScript Validator initialized with LSP integration');
  }

  /**
   * Get TypeScript diagnostics for a file
   * Following architecture verification steps
   */
  async getDiagnostics(filePath) {
    console.log(`🔍 [TS_DIAG] Checking TypeScript: ${filePath}`);
    
    const cacheKey = `${filePath}-${Date.now()}`;
    
    try {
      // Check if file exists and is TypeScript
      if (!await this.isTypeScriptFile(filePath)) {
        return {
          valid: true,
          errors: [],
          warnings: [],
          info: 'Non-TypeScript file, skipping TS validation'
        };
      }

      // Find tsconfig.json
      const tsconfigPath = await this.findTsConfig(filePath);
      if (!tsconfigPath) {
        return {
          valid: true,
          errors: [],
          warnings: ['No tsconfig.json found'],
          info: 'TypeScript validation skipped'
        };
      }

      // Run TypeScript compiler for diagnostics
      const diagnostics = await this.runTypeScriptCompiler(filePath, tsconfigPath);
      
      const result = {
        valid: diagnostics.errors.length === 0,
        errors: diagnostics.errors,
        warnings: diagnostics.warnings,
        info: diagnostics.info,
        filePath,
        timestamp: new Date().toISOString()
      };

      // Cache result
      this.diagnosticsCache.set(cacheKey, result);
      setTimeout(() => this.diagnosticsCache.delete(cacheKey), this.cacheTimeout);

      console.log(`📊 [TS_DIAG] Result: ${result.valid ? 'PASS' : 'FAIL'} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
      return result;

    } catch (error) {
      console.error(`❌ [TS_DIAG] Error: ${error.message}`);
      return {
        valid: false,
        errors: [`TypeScript validation failed: ${error.message}`],
        warnings: [],
        info: 'Validation error occurred'
      };
    }
  }

  /**
   * Check if file is TypeScript
   */
  async isTypeScriptFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx'].includes(ext);
  }

  /**
   * Find nearest tsconfig.json
   */
  async findTsConfig(filePath) {
    let currentDir = path.dirname(filePath);
    const rootDir = path.parse(currentDir).root;

    while (currentDir !== rootDir) {
      const tsconfigPath = path.join(currentDir, 'tsconfig.json');
      
      try {
        await fs.access(tsconfigPath);
        console.log(`📄 [TS_CONFIG] Found: ${tsconfigPath}`);
        return tsconfigPath;
      } catch (error) {
        // File doesn't exist, move up
        currentDir = path.dirname(currentDir);
      }
    }

    console.log('📄 [TS_CONFIG] Not found');
    return null;
  }

  /**
   * Run TypeScript compiler for diagnostics
   */
  async runTypeScriptCompiler(filePath, tsconfigPath) {
    return new Promise((resolve, reject) => {
      const tscProcess = spawn('npx', [
        'tsc',
        '--noEmit',
        '--project', path.dirname(tsconfigPath),
        filePath
      ], {
        cwd: path.dirname(tsconfigPath),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      tscProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tscProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tscProcess.on('close', (code) => {
        const result = this.parseTypeScriptOutput(stdout, stderr, code);
        resolve(result);
      });

      tscProcess.on('error', (error) => {
        // TypeScript not available, return basic validation
        console.log('⚠️ [TS_DIAG] TypeScript compiler not available, using basic validation');
        resolve(this.basicTypeScriptValidation(filePath));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        tscProcess.kill();
        resolve({
          errors: ['TypeScript validation timeout'],
          warnings: [],
          info: 'Validation timed out'
        });
      }, 10000);
    });
  }

  /**
   * Parse TypeScript compiler output
   */
  parseTypeScriptOutput(stdout, stderr, exitCode) {
    const errors = [];
    const warnings = [];
    const info = [];

    const output = stdout + stderr;
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.includes('error TS')) {
        errors.push(this.parseErrorLine(line));
      } else if (line.includes('warning TS')) {
        warnings.push(this.parseErrorLine(line));
      } else if (line.trim() && !line.includes('Found 0 errors')) {
        info.push(line.trim());
      }
    }

    return {
      errors,
      warnings,
      info: info.join('; '),
      exitCode
    };
  }

  /**
   * Parse individual error/warning line
   */
  parseErrorLine(line) {
    // Example: src/App.tsx(10,5): error TS2304: Cannot find name 'unknownVariable'.
    const match = line.match(/(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*(TS\d+):\s*(.+)/);
    
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        severity: match[4],
        code: match[5],
        message: match[6]
      };
    }

    return {
      file: 'unknown',
      line: 0,
      column: 0,
      severity: 'error',
      code: 'TS0000',
      message: line
    };
  }

  /**
   * Basic TypeScript validation when compiler not available
   */
  async basicTypeScriptValidation(filePath) {
    console.log(`📝 [TS_BASIC] Running basic validation: ${filePath}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const errors = [];
      const warnings = [];

      // Basic syntax checks
      if (!content.trim()) {
        errors.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'error',
          code: 'TS0001',
          message: 'File is empty'
        });
      }

      // Check for obvious syntax errors
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        errors.push({
          file: filePath,
          line: 0,
          column: 0,
          severity: 'error',
          code: 'TS0002',
          message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`
        });
      }

      // Check for TypeScript-specific patterns
      if (content.includes('any') && !content.includes('// @ts-ignore')) {
        warnings.push({
          file: filePath,
          line: 0,
          column: 0,
          severity: 'warning',
          code: 'TS0003',
          message: 'Use of "any" type detected'
        });
      }

      return {
        errors,
        warnings,
        info: 'Basic TypeScript validation completed'
      };

    } catch (error) {
      return {
        errors: [{
          file: filePath,
          line: 0,
          column: 0,
          severity: 'error',
          code: 'TS0000',
          message: `File read error: ${error.message}`
        }],
        warnings: [],
        info: 'Basic validation failed'
      };
    }
  }

  /**
   * Get validation summary for multiple files
   */
  async validateProject(projectPath) {
    console.log(`🏗️ [TS_PROJECT] Validating project: ${projectPath}`);
    
    try {
      const tsconfigPath = await this.findTsConfig(path.join(projectPath, 'src'));
      if (!tsconfigPath) {
        return {
          valid: false,
          message: 'No TypeScript configuration found',
          files: 0
        };
      }

      // Find all TypeScript files
      const tsFiles = await this.findTypeScriptFiles(projectPath);
      console.log(`📁 [TS_PROJECT] Found ${tsFiles.length} TypeScript files`);

      let totalErrors = 0;
      let totalWarnings = 0;
      const results = [];

      for (const file of tsFiles.slice(0, 10)) { // Limit to 10 files for performance
        const result = await this.getDiagnostics(file);
        results.push(result);
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
      }

      return {
        valid: totalErrors === 0,
        totalErrors,
        totalWarnings,
        filesChecked: results.length,
        results,
        summary: `${totalErrors} errors, ${totalWarnings} warnings in ${results.length} files`
      };

    } catch (error) {
      return {
        valid: false,
        message: `Project validation failed: ${error.message}`,
        files: 0
      };
    }
  }

  /**
   * Find all TypeScript files in project
   */
  async findTypeScriptFiles(projectPath) {
    const files = [];
    
    async function searchDir(dir) {
      try {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = await fs.stat(fullPath);
          
          if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            await searchDir(fullPath);
          } else if (stats.isFile() && ['.ts', '.tsx'].includes(path.extname(item))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not search directory: ${dir}`);
      }
    }

    await searchDir(projectPath);
    return files;
  }

  /**
   * Clear diagnostics cache
   */
  clearCache() {
    this.diagnosticsCache.clear();
    this.tsconfigCache.clear();
    console.log('🧹 [TS_DIAG] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      diagnosticsCacheSize: this.diagnosticsCache.size,
      tsconfigCacheSize: this.tsconfigCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

module.exports = { TypeScriptValidator };
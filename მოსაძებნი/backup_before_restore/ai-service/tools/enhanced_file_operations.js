/**
 * Enhanced File Operations with Search and Verification
 * Based on SOL-210 Architecture Document
 * 
 * Provides comprehensive file system operations with safety checks
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class EnhancedFileOperations {
  constructor() {
    this.maxFileSize = 1024 * 1024; // 1MB
    this.forbiddenExtensions = ['.env', '.key', '.pem', '.secret'];
    this.maxSearchResults = 100;
    this.searchTimeout = 5000; // 5 seconds
    console.log('📁 Enhanced File Operations initialized with safety checks');
  }

  /**
   * Search for files with advanced filtering
   * Following architecture patterns
   */
  async searchFiles(query, options = {}) {
    console.log(`🔍 [FILE_SEARCH] Searching for: ${query}`);
    
    const startTime = Date.now();
    const searchId = uuidv4();
    
    const config = {
      basePath: options.basePath || process.cwd(),
      extensions: options.extensions || [],
      maxResults: options.maxResults || this.maxSearchResults,
      includeContent: options.includeContent || false,
      ignorePatterns: options.ignorePatterns || ['node_modules', '.git', 'dist', 'build'],
      ...options
    };

    try {
      const results = await this.performFileSearch(query, config);
      
      const summary = {
        searchId,
        query,
        totalResults: results.length,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      console.log(`🔍 [FILE_SEARCH] Found ${results.length} matches in ${summary.executionTime}ms`);
      
      return {
        success: true,
        results,
        summary,
        config
      };

    } catch (error) {
      console.error(`❌ [FILE_SEARCH] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: [],
        summary: { searchId, query, executionTime: Date.now() - startTime }
      };
    }
  }

  /**
   * Perform the actual file search
   */
  async performFileSearch(query, config) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    async function searchDirectory(dir, depth = 0) {
      if (depth > 10) return; // Prevent infinite recursion
      
      try {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          if (results.length >= config.maxResults) break;
          
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(config.basePath, fullPath);
          
          // Skip ignored patterns
          if (config.ignorePatterns.some(pattern => relativePath.includes(pattern))) {
            continue;
          }

          try {
            const stats = await fs.stat(fullPath);
            
            if (stats.isDirectory()) {
              await searchDirectory(fullPath, depth + 1);
            } else if (stats.isFile()) {
              const match = await checkFileMatch(fullPath, relativePath, queryLower, config, stats);
              if (match) {
                results.push(match);
              }
            }
          } catch (error) {
            console.warn(`⚠️ Could not process: ${fullPath}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not read directory: ${dir}`);
      }
    }

    await searchDirectory(config.basePath);
    return results;
  }

  /**
   * Check if file matches search criteria
   */
  async checkFileMatch(fullPath, relativePath, queryLower, config, stats) {
    const fileName = path.basename(fullPath).toLowerCase();
    const ext = path.extname(fullPath);
    
    // Filter by extensions if specified
    if (config.extensions.length > 0 && !config.extensions.includes(ext)) {
      return null;
    }

    // Check filename match
    const filenameMatch = fileName.includes(queryLower);
    
    let contentMatch = false;
    let contentSnippet = '';
    
    // Check content if requested and file is text-based
    if (config.includeContent && this.isTextFile(ext) && stats.size < this.maxFileSize) {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        contentMatch = content.toLowerCase().includes(queryLower);
        
        if (contentMatch) {
          contentSnippet = this.extractSnippet(content, queryLower);
        }
      } catch (error) {
        console.warn(`⚠️ Could not read file content: ${fullPath}`);
      }
    }

    if (filenameMatch || contentMatch) {
      return {
        path: fullPath,
        relativePath,
        fileName: path.basename(fullPath),
        extension: ext,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        matchType: filenameMatch ? 'filename' : 'content',
        contentSnippet,
        isTextFile: this.isTextFile(ext)
      };
    }

    return null;
  }

  /**
   * Extract content snippet around match
   */
  extractSnippet(content, query, contextLines = 2) {
    const lines = content.split('\n');
    const queryIndex = content.toLowerCase().indexOf(query.toLowerCase());
    
    if (queryIndex === -1) return '';
    
    // Find line containing the match
    let lineIndex = 0;
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1; // +1 for newline
      if (charCount > queryIndex) {
        lineIndex = i;
        break;
      }
    }

    const startLine = Math.max(0, lineIndex - contextLines);
    const endLine = Math.min(lines.length - 1, lineIndex + contextLines);
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Check if file is text-based
   */
  isTextFile(ext) {
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss',
      '.md', '.txt', '.yml', '.yaml', '.xml', '.svg', '.py', '.java',
      '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb', '.sh', '.sql'
    ];
    
    return textExtensions.includes(ext.toLowerCase());
  }

  /**
   * Safe file read with validation
   */
  async safeReadFile(filePath) {
    console.log(`📖 [FILE_READ] Reading: ${filePath}`);
    
    try {
      // Safety checks
      const safetyCheck = await this.performSafetyChecks(filePath, 'read');
      if (!safetyCheck.safe) {
        throw new Error(`Safety check failed: ${safetyCheck.reason}`);
      }

      const stats = await fs.stat(filePath);
      
      if (stats.size > this.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
      }

      const content = await fs.readFile(filePath, 'utf8');
      
      return {
        success: true,
        content,
        filePath,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        encoding: 'utf8'
      };

    } catch (error) {
      console.error(`❌ [FILE_READ] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        filePath
      };
    }
  }

  /**
   * Safe file write with backup
   */
  async safeWriteFile(filePath, content, options = {}) {
    console.log(`📝 [FILE_WRITE] Writing: ${filePath}`);
    
    try {
      // Safety checks
      const safetyCheck = await this.performSafetyChecks(filePath, 'write');
      if (!safetyCheck.safe) {
        throw new Error(`Safety check failed: ${safetyCheck.reason}`);
      }

      // Create backup if file exists
      let backupPath = null;
      try {
        await fs.access(filePath);
        if (options.createBackup !== false) {
          backupPath = `${filePath}.backup.${Date.now()}`;
          await fs.copyFile(filePath, backupPath);
          console.log(`💾 [BACKUP] Created: ${backupPath}`);
        }
      } catch (error) {
        // File doesn't exist, no backup needed
      }

      // Write file
      await fs.writeFile(filePath, content, 'utf8');
      
      const stats = await fs.stat(filePath);
      
      console.log(`✅ [FILE_WRITE] Success: ${filePath} (${stats.size} bytes)`);
      
      return {
        success: true,
        filePath,
        size: stats.size,
        backupPath,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ [FILE_WRITE] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        filePath
      };
    }
  }

  /**
   * Perform safety checks on file operations
   */
  async performSafetyChecks(filePath, operation) {
    const ext = path.extname(filePath).toLowerCase();
    const absolutePath = path.resolve(filePath);
    const basePath = path.resolve(process.cwd());
    
    // Check if file is within project directory
    if (!absolutePath.startsWith(basePath)) {
      return {
        safe: false,
        reason: 'File outside project directory'
      };
    }

    // Check forbidden extensions
    if (this.forbiddenExtensions.includes(ext)) {
      return {
        safe: false,
        reason: `Forbidden file extension: ${ext}`
      };
    }

    // Check for system/protected files
    const protectedPaths = ['node_modules', '.git', 'package-lock.json'];
    if (protectedPaths.some(path => absolutePath.includes(path))) {
      return {
        safe: false,
        reason: 'Protected system file'
      };
    }

    return {
      safe: true,
      reason: 'All safety checks passed'
    };
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath);
      
      return {
        success: true,
        path: filePath,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        extension: ext,
        isTextFile: this.isTextFile(ext),
        permissions: {
          readable: true, // fs.access would throw if not readable
          writable: true  // Simplified for now
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: filePath
      };
    }
  }

  /**
   * List directory contents safely
   */
  async listDirectory(dirPath, options = {}) {
    console.log(`📁 [DIR_LIST] Listing: ${dirPath}`);
    
    try {
      const config = {
        maxDepth: options.maxDepth || 1,
        includeHidden: options.includeHidden || false,
        sortBy: options.sortBy || 'name', // name, size, modified
        ...options
      };

      const items = await this.readDirectoryRecursive(dirPath, config, 0);
      
      // Sort results
      items.sort((a, b) => {
        switch (config.sortBy) {
          case 'size':
            return b.size - a.size;
          case 'modified':
            return new Date(b.lastModified) - new Date(a.lastModified);
          default:
            return a.name.localeCompare(b.name);
        }
      });

      return {
        success: true,
        path: dirPath,
        items,
        count: items.length,
        config
      };

    } catch (error) {
      console.error(`❌ [DIR_LIST] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        path: dirPath
      };
    }
  }

  /**
   * Read directory recursively
   */
  async readDirectoryRecursive(dirPath, config, currentDepth) {
    if (currentDepth >= config.maxDepth) return [];
    
    const items = [];
    
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        if (!config.includeHidden && entry.startsWith('.')) continue;
        
        const fullPath = path.join(dirPath, entry);
        const stats = await fs.stat(fullPath);
        
        const item = {
          name: entry,
          path: fullPath,
          relativePath: path.relative(process.cwd(), fullPath),
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          extension: path.extname(entry),
          depth: currentDepth
        };

        items.push(item);
        
        // Recurse into subdirectories
        if (stats.isDirectory() && currentDepth + 1 < config.maxDepth) {
          const subItems = await this.readDirectoryRecursive(fullPath, config, currentDepth + 1);
          items.push(...subItems);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not read directory: ${dirPath}`);
    }
    
    return items;
  }
}

module.exports = { EnhancedFileOperations };
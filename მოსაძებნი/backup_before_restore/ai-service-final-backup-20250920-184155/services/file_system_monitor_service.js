'use strict';

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;

/**
 * FileSystemMonitorService - Real-time File System Awareness ("Eyes" for Gurulo)
 * 
 * This service gives Gurulo the ability to "see" the file system in real-time,
 * monitoring file creations, modifications, and deletions as they happen.
 * 
 * Based on specifications from პრობლემის მოგვარება.txt - Phase 1
 */
class FileSystemMonitorService {
  constructor() {
    this.isInitialized = false;
    this.watcher = null;
    this.projectTree = new Map(); // Map<filePath, fileInfo>
    this.recentChanges = []; // Array of recent file changes (last 10)
    this.maxRecentChanges = 10;
    this.projectRoot = process.cwd();
    
    // Directories and files to ignore
    this.ignoredPaths = [
      'node_modules/**',
      '.git/**',
      '.replit/**',
      'build/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      '.nyc_output/**',
      'tmp/**',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '.env',
      '.env.local',
      '.env.development.local',
      '.env.test.local',
      '.env.production.local'
    ];
    
    console.log('👁️ [FILE MONITOR] FileSystemMonitorService created');
  }

  /**
   * Initialize the file system monitor
   * Starts chokidar watcher and performs initial scan
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ [FILE MONITOR] Already initialized');
      return;
    }

    try {
      console.log('👁️ [FILE MONITOR] Initializing file system monitoring...');
      console.log(`👁️ [FILE MONITOR] Project root: ${this.projectRoot}`);

      // Perform initial scan
      await this.performInitialScan();

      // Initialize chokidar watcher
      this.watcher = chokidar.watch('.', {
        ignored: this.ignoredPaths,
        persistent: true,
        ignoreInitial: true, // We already did initial scan
        followSymlinks: false,
        depth: 10, // Limit recursion depth
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log(`✅ [FILE MONITOR] Initialized successfully. Monitoring ${this.projectTree.size} files`);
      
    } catch (error) {
      console.error('❌ [FILE MONITOR] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform initial scan of the project directory
   */
  async performInitialScan() {
    console.log('📊 [FILE MONITOR] Performing initial project scan...');
    
    try {
      await this.scanDirectory('.');
      console.log(`📊 [FILE MONITOR] Initial scan complete: ${this.projectTree.size} files found`);
    } catch (error) {
      console.error('❌ [FILE MONITOR] Initial scan failed:', error);
      throw error;
    }
  }

  /**
   * Recursively scan directory and build project tree
   */
  async scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.projectRoot, path.resolve(fullPath));
        
        // Skip ignored paths
        if (this.shouldIgnorePath(relativePath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (entry.isFile()) {
          await this.addFileToTree(relativePath);
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
        console.warn(`⚠️ [FILE MONITOR] Could not scan directory ${dirPath}:`, error.message);
      }
    }
  }

  /**
   * Check if path should be ignored
   */
  shouldIgnorePath(filePath) {
    // Convert Windows paths to Unix style for consistent matching
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    return this.ignoredPaths.some(pattern => {
      if (pattern.includes('**')) {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return regex.test(normalizedPath);
      } else if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '[^/]*'));
        return regex.test(normalizedPath);
      } else {
        return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
      }
    });
  }

  /**
   * Add file to project tree with metadata
   */
  async addFileToTree(filePath) {
    try {
      const fullPath = path.resolve(filePath);
      const stats = await fs.stat(fullPath);
      
      const fileInfo = {
        path: filePath,
        fullPath: fullPath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime || stats.mtime,
        extension: path.extname(filePath),
        isDirectory: stats.isDirectory()
      };
      
      this.projectTree.set(filePath, fileInfo);
    } catch (error) {
      // File might have been deleted between scan and stat
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ [FILE MONITOR] Could not stat file ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Setup chokidar event listeners
   */
  setupEventListeners() {
    this.watcher
      .on('add', (filePath) => {
        this.handleFileEvent('add', filePath);
      })
      .on('change', (filePath) => {
        this.handleFileEvent('change', filePath);
      })
      .on('unlink', (filePath) => {
        this.handleFileEvent('unlink', filePath);
      })
      .on('addDir', (dirPath) => {
        console.log(`📁 [FILE MONITOR] Directory created: ${dirPath}`);
      })
      .on('unlinkDir', (dirPath) => {
        console.log(`📁 [FILE MONITOR] Directory removed: ${dirPath}`);
      })
      .on('error', (error) => {
        console.error('❌ [FILE MONITOR] Watcher error:', error);
      });
  }

  /**
   * Handle file system events
   */
  async handleFileEvent(event, filePath) {
    const normalizedPath = path.normalize(filePath);
    
    console.log(`👁️ [FILE MONITOR] ${event.toUpperCase()}: ${normalizedPath}`);
    
    // Update project tree
    if (event === 'add' || event === 'change') {
      await this.addFileToTree(normalizedPath);
    } else if (event === 'unlink') {
      this.projectTree.delete(normalizedPath);
    }
    
    // Add to recent changes
    const changeEvent = {
      event: event,
      path: normalizedPath,
      timestamp: new Date().toISOString(),
      fullPath: path.resolve(normalizedPath)
    };
    
    this.recentChanges.unshift(changeEvent);
    
    // Maintain max recent changes limit
    if (this.recentChanges.length > this.maxRecentChanges) {
      this.recentChanges = this.recentChanges.slice(0, this.maxRecentChanges);
    }
  }

  /**
   * Get complete project tree
   * @returns {Array} Array of file information objects
   */
  getProjectTree() {
    return Array.from(this.projectTree.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Get recent file changes
   * @param {number} limit - Maximum number of changes to return (default: 5)
   * @returns {Array} Array of recent change events
   */
  getRecentChanges(limit = 5) {
    return this.recentChanges.slice(0, limit);
  }

  /**
   * Get project statistics
   * @returns {Object} Project statistics
   */
  getProjectStats() {
    const files = Array.from(this.projectTree.values());
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // Group by extension
    const extensionCounts = {};
    files.forEach(file => {
      const ext = file.extension || 'no extension';
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    });
    
    return {
      totalFiles,
      totalSize,
      extensionCounts,
      recentChangesCount: this.recentChanges.length,
      lastModified: this.recentChanges.length > 0 ? this.recentChanges[0].timestamp : null
    };
  }

  /**
   * Search files by pattern
   * @param {string} pattern - Search pattern (can include wildcards)
   * @returns {Array} Matching files
   */
  searchFiles(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return this.getProjectTree().filter(file => regex.test(file.path));
  }

  /**
   * Get files modified in the last N minutes
   * @param {number} minutes - Number of minutes to look back
   * @returns {Array} Recently modified files
   */
  getRecentlyModifiedFiles(minutes = 5) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.getProjectTree().filter(file => file.modified > cutoff);
  }

  /**
   * Stop monitoring and cleanup
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isInitialized = false;
    console.log('🛑 [FILE MONITOR] File system monitoring stopped');
  }

  /**
   * Get monitor status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isWatching: this.watcher !== null,
      projectRoot: this.projectRoot,
      filesCount: this.projectTree.size,
      recentChangesCount: this.recentChanges.length
    };
  }
}

// Create singleton instance
const fileSystemMonitorService = new FileSystemMonitorService();

module.exports = {
  fileSystemMonitorService
};
/**
 * Project Intelligence Service
 * პროექტის დაზვერვის სერვისი
 * 
 * Part of PROJECT "PHOENIX" - Real-time Code Intelligence System
 * Based on specifications from პრობლემის მოგვარება.txt
 * 
 * This service provides dynamic, real-time project scanning and file relevance analysis
 * to replace Gurulo's static knowledge base with live codebase understanding.
 */

const fs = require('fs').promises;
const path = require('path');

class ProjectIntelligenceService {
  constructor() {
    // Enhanced ignore patterns for comprehensive scanning
    this.ignoredDirs = new Set([
      'node_modules', '.git', '.replit', 'build', 'dist', '.next', 
      'coverage', '.nyc_output', '.vscode', '.idea', '__pycache__',
      'attached_assets', '.env.local', 'logs', 'tmp'
    ]);
    
    // Extended code extensions for Georgian development environment
    // SECURITY: .env and other sensitive files EXCLUDED from scanning
    this.codeExts = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.html', '.css', 
      '.scss', '.py', '.sh', '.yml', '.yaml', '.txt', '.sql',
      '.php', '.rb', '.go', '.rust', '.java', '.c', '.cpp', '.h'
    ]);
    
    // SECURITY: Sensitive file patterns to exclude (secrets protection)
    this.deniedFiles = new Set([
      '.env', '.env.local', '.env.production', '.env.development',
      '.env.staging', '.env.test', '.secret', '.key', '.pem', '.p12',
      '.pfx', 'secrets.txt', 'password.txt', 'config.secret'
    ]);
    
    // Cache for performance optimization
    this.fileCache = new Map();
    this.lastScanTime = 0;
    this.cacheValidTime = 30000; // 30 seconds cache validity
    
    console.log('🚀 [PROJECT INTELLIGENCE] ProjectIntelligenceService initialized');
  }

  /**
   * Get all project files with caching and performance optimization
   * @returns {Promise<Array>} Array of relative file paths
   */
  async getAllProjectFiles() {
    const now = Date.now();
    
    // Return cached results if still valid
    if (this.fileCache.has('allFiles') && (now - this.lastScanTime) < this.cacheValidTime) {
      console.log('📋 [PROJECT INTELLIGENCE] Using cached file list');
      return this.fileCache.get('allFiles');
    }

    console.log('🔍 [PROJECT INTELLIGENCE] Scanning project files...');
    const allFiles = [];
    const projectRoot = process.cwd();

    const scanDirectory = async (currentPath, depth = 0) => {
      // Prevent excessive recursion
      if (depth > 10) return;
      
      try {
        const items = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item.name);
          
          if (item.isDirectory()) {
            // Skip ignored directories
            if (!this.ignoredDirs.has(item.name) && !item.name.startsWith('.')) {
              await scanDirectory(itemPath, depth + 1);
            }
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            const fileName = item.name.toLowerCase();
            
            // SECURITY: Skip sensitive files (secrets protection)
            if (this.deniedFiles.has(fileName) || 
                fileName.startsWith('.env') || 
                fileName.includes('secret') || 
                fileName.includes('password') ||
                fileName.includes('key.') ||
                fileName.endsWith('.key') ||
                fileName.endsWith('.pem')) {
              continue; // Skip sensitive files
            }
            
            // Include relevant file extensions (safe files only)
            if (this.codeExts.has(ext) || 
                (item.name.includes('config') && !fileName.includes('secret'))) {
              const relativePath = path.relative(projectRoot, itemPath);
              allFiles.push(relativePath.replace(/\\/g, '/')); // Normalize path separators
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ [PROJECT INTELLIGENCE] Error scanning directory ${currentPath}:`, error.message);
      }
    };

    await scanDirectory(projectRoot);
    
    // Cache the results
    this.fileCache.set('allFiles', allFiles);
    this.lastScanTime = now;
    
    console.log(`📂 [PROJECT INTELLIGENCE] Found ${allFiles.length} project files`);
    return allFiles;
  }

  /**
   * Find relevant project files based on query with enhanced scoring algorithm
   * @param {string} query - Search query (Georgian or English)
   * @param {Array} allFiles - Array of all project files
   * @param {number} maxFiles - Maximum number of files to return
   * @returns {Promise<Array>} Array of relevant file paths sorted by relevance
   */
  async findRelevantProjectFiles(query, allFiles, maxFiles = 10) {
    if (!query || !allFiles || allFiles.length === 0) {
      return [];
    }

    console.log(`🎯 [PROJECT INTELLIGENCE] Analyzing relevance for query: "${query}"`);
    
    const fileScores = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

    for (const filePath of allFiles) {
      let score = 0;
      const fileName = path.basename(filePath).toLowerCase();
      const dirName = path.dirname(filePath).toLowerCase();
      const fileExt = path.extname(filePath).toLowerCase();

      // Direct filename matches (highest priority)
      if (queryLower.includes(fileName.replace(fileExt, ''))) {
        score += 25;
      }

      // Component and service detection
      if (queryLower.includes('component') && (fileName.endsWith('.jsx') || fileName.endsWith('.tsx'))) {
        score += 15;
      }
      
      if (queryLower.includes('service') && fileName.includes('service')) {
        score += 12;
      }

      // Georgian language specific terms
      if (queryLower.includes('ქართული') || queryLower.includes('georgian')) {
        if (fileName.includes('georgian') || fileName.includes('validator') || fileName.includes('formatter')) {
          score += 20;
        }
      }

      // API and routing detection
      if ((queryLower.includes('api') || queryLower.includes('endpoint')) && 
          (filePath.includes('routes') || filePath.includes('api') || fileName.includes('controller'))) {
        score += 18;
      }

      // Frontend component detection
      if ((queryLower.includes('ui') || queryLower.includes('frontend') || queryLower.includes('component')) &&
          (filePath.includes('src/components') || filePath.includes('src/features'))) {
        score += 16;
      }

      // Database and backend detection
      if ((queryLower.includes('database') || queryLower.includes('db') || queryLower.includes('backend')) &&
          (filePath.includes('backend') || filePath.includes('services') || fileName.includes('db'))) {
        score += 14;
      }

      // Configuration files
      if ((queryLower.includes('config') || queryLower.includes('setup')) &&
          (fileName.includes('config') || fileName.includes('env') || fileExt === '.json')) {
        score += 10;
      }

      // Word-by-word matching
      queryWords.forEach(word => {
        // Exact word matches in path
        if (filePath.toLowerCase().includes(word)) {
          score += 3;
        }
        
        // Partial matches
        if (fileName.includes(word)) {
          score += 2;
        }
        
        if (dirName.includes(word)) {
          score += 1;
        }
      });

      // Boost important file types
      if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) {
        score += 2;
      }

      // Add files with any score to results
      if (score > 0) {
        fileScores.push({ 
          filePath, 
          score,
          fileName: path.basename(filePath),
          directory: path.dirname(filePath)
        });
      }
    }

    // Sort by score (descending) and return top results
    const sortedFiles = fileScores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(f => f.filePath);

    console.log(`📋 [PROJECT INTELLIGENCE] Found ${sortedFiles.length} relevant files:`, 
      sortedFiles.slice(0, 5).map(f => path.basename(f))
    );

    return sortedFiles;
  }

  /**
   * Analyze project structure and return insights
   * @returns {Promise<Object>} Project structure analysis
   */
  async analyzeProjectStructure() {
    const allFiles = await this.getAllProjectFiles();
    
    const analysis = {
      totalFiles: allFiles.length,
      fileTypes: {},
      directories: new Set(),
      largestFiles: [],
      recentFiles: [],
      structure: {
        frontend: [],
        backend: [],
        services: [],
        components: [],
        config: []
      }
    };

    // Analyze each file
    for (const filePath of allFiles) {
      const ext = path.extname(filePath).toLowerCase();
      const dir = path.dirname(filePath);
      
      // Count file types
      analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
      analysis.directories.add(dir);

      // Categorize files
      if (filePath.includes('src/components') || filePath.includes('components')) {
        analysis.structure.components.push(filePath);
      } else if (filePath.includes('backend') || filePath.includes('server')) {
        analysis.structure.backend.push(filePath);
      } else if (filePath.includes('services')) {
        analysis.structure.services.push(filePath);
      } else if (filePath.includes('src') || ['.jsx', '.tsx'].includes(ext)) {
        analysis.structure.frontend.push(filePath);
      } else if (filePath.includes('config') || ext === '.json' || ext === '.env') {
        analysis.structure.config.push(filePath);
      }
    }

    analysis.directories = analysis.directories.size;
    
    console.log('📊 [PROJECT INTELLIGENCE] Project structure analyzed:', {
      totalFiles: analysis.totalFiles,
      directories: analysis.directories,
      topFileTypes: Object.entries(analysis.fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    });

    return analysis;
  }

  /**
   * Clear cache to force fresh scan
   */
  clearCache() {
    this.fileCache.clear();
    this.lastScanTime = 0;
    console.log('🧹 [PROJECT INTELLIGENCE] Cache cleared');
  }

  /**
   * Get service statistics
   * @returns {Object} Service performance and usage statistics
   */
  getStats() {
    return {
      cacheSize: this.fileCache.size,
      lastScanTime: this.lastScanTime,
      cacheValidTime: this.cacheValidTime,
      ignoredDirs: Array.from(this.ignoredDirs),
      supportedExtensions: Array.from(this.codeExts),
      isInitialized: true,
      service: 'project_intelligence_service',
      version: '1.0.0'
    };
  }
}

// Export singleton instance
module.exports = new ProjectIntelligenceService();
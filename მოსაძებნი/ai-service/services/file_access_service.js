/**
 * Enhanced File Access Service for AI Assistant
 * გაუმჯობესებული ფაილზე წვდომის სერვისი AI ასისტენტისთვის
 * Provides comprehensive file operations for the AI system
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Protected files that AI cannot modify
const PROTECTED_FILES = [
  '.env',
  '.env.local', 
  '.env.production',
  'firebase-admin-key.json',
  'package.json',
  'package-lock.json',
  '.gitignore',
  '.replit',
  'replit.nix',
  'vite.config.mts'
];

// Protected directories
const PROTECTED_DIRS = [
  'node_modules',
  '.git',
  '.config',
  'functions/node_modules',
  'backend/node_modules',
  '.vite',
  'dist'
];

// File operation cache
const fileCache = new Map();
const CACHE_TTL = 60000; // 1 minute

// Georgian search term expansions
const GEORGIAN_SEARCH_EXPANSIONS = {
  'კალენდარი': ['calendar', 'date', 'datepicker', 'events', 'Calendar.tsx', 'useCalendar', 'CalendarService'],
  'ჯავშანი': ['booking', 'reservation', 'ჯავშნის', 'BookingModal', 'BookingService', 'BookingForm'],
  'მომხმარებელი': ['user', 'customer', 'მომხმარებლის', 'კლიენტი', 'UserService', 'UserDashboard'],
  'სასტუმრო': ['hotel', 'accommodation', 'სასტუმროს', 'HotelCard', 'HotelForm', 'HotelPage'],
  'კოტეჯი': ['cottage', 'cabin', 'კოტეჯის', 'CottageForm', 'CottagePage', 'CottageCard'],
  'ფასი': ['price', 'cost', 'pricing', 'ფასების', 'PricingManager', 'PriceTag', 'priceOverride'],
  'ძებნა': ['search', 'find', 'filter', 'ძიება', 'SearchInput', 'searchInFiles'],
  'ავტორიზაცია': ['auth', 'authentication', 'login', 'AuthContext', 'ProtectedRoute'],
  'ადმინისტრატორი': ['admin', 'administrator', 'ადმინი', 'AdminDashboard', 'AdminLayout'],
  'მესიჯინგი': ['messaging', 'message', 'შეტყობინება', 'MessagingSystem', 'notificationService'],
  'ტრანსპორტი': ['vehicle', 'transport', 'VehicleCard', 'VehicleForm', 'VehiclePage'],
  'ცხენები': ['horse', 'horses', 'HorseCard', 'HorseForm'],
  'სნოუმობილები': ['snowmobile', 'SnowmobileCard', 'SnowmobileForm'],
  'დაშბორდი': ['dashboard', 'MainDashboard', 'AdminDashboard', 'UserDashboard'],
  'კომპონენტი': ['component', 'Component.tsx', 'components'],
  'სერვისი': ['service', 'Service.ts', 'services']
};

// Custom error classes
class FileNotFoundError extends Error {
  constructor(path) {
    super(`ფაილი არ მოიძებნა: ${path}`);
    this.name = 'FileNotFoundError';
    this.code = 'ENOENT';
  }
}

class PermissionDeniedError extends Error {
  constructor(path) {
    super(`წვდომა უარყოფილია: ${path}`);
    this.name = 'PermissionDeniedError';
    this.code = 'EACCES';
  }
}

class InvalidPathError extends Error {
  constructor(path) {
    super(`არასწორი გზა: ${path}`);
    this.name = 'InvalidPathError';
    this.code = 'EINVAL';
  }
}

class FileAccessService {
  /**
   * Reads a file from the given path and returns the content as string
   * @param {string} filePath - Relative path to the file from project root
   * @param {string} encoding - File encoding (default: utf8)
   * @returns {Promise<string>} - File content as string
   */
  static async readFileContent(filePath, encoding = 'utf8') {
    try {
      // Check cache first
      const cacheKey = `read:${filePath}:${encoding}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`📦 Cache hit for file: ${filePath}`);
        return cached;
      }

      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);

      console.log(`📖 Reading file: ${absolutePath}`);

      const content = await fs.readFile(absolutePath, encoding);

      // Cache the result
      this.setCache(cacheKey, content);

      console.log(`✅ Successfully read file: ${filePath} (${content.length} chars)`);
      return content;
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error(`❌ Failed to read file '${filePath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Read binary file as Buffer
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<Buffer>} - File content as Buffer
   */
  static async readBinaryFile(filePath) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);

      console.log(`📖 Reading binary file: ${absolutePath}`);
      const buffer = await fs.readFile(absolutePath);

      console.log(`✅ Successfully read binary file: ${filePath} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error(`❌ Failed to read binary file '${filePath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Write binary file from Buffer
   * @param {string} filePath - Relative path to the file
   * @param {Buffer} data - Binary data to write
   * @returns {Promise<void>}
   */
  static async writeBinaryFile(filePath, data) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);
      this.checkProtectedFile(filePath);

      console.log(`📝 Writing binary file: ${absolutePath} (${data.length} bytes)`);
      await fs.writeFile(absolutePath, data);

      // Clear related cache
      this.clearCacheForFile(filePath);

      console.log(`✅ Successfully wrote binary file: ${filePath}`);
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error(`❌ Failed to write binary file '${filePath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Create a new file with content
   * @param {string} filePath - Relative path to the file
   * @param {string} content - Content to write
   * @param {string} encoding - File encoding (default: utf8)
   * @returns {Promise<void>}
   */
  static async createFile(filePath, content = '', encoding = 'utf8') {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);
      this.checkProtectedFile(filePath);

      // Check if file already exists
      try {
        await fs.access(absolutePath);
        throw new Error(`ფაილი უკვე არსებობს: ${filePath}`);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }

      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      console.log(`🆕 Creating file: ${absolutePath}`);
      await fs.writeFile(absolutePath, content, encoding);

      // Clear cache
      this.clearCacheForFile(filePath);

      console.log(`✅ Successfully created file: ${filePath}`);
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error(`❌ Failed to create file '${filePath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Delete a file
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<void>}
   */
  static async deleteFile(filePath) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);
      this.checkProtectedFile(filePath);

      console.log(`🗑️ Deleting file: ${absolutePath}`);

      // Create backup before deletion
      try {
        await this.createBackup(absolutePath);
      } catch (backupError) {
        console.warn(`⚠️ Could not create backup before deletion: ${backupError.message}`);
      }

      await fs.unlink(absolutePath);

      // Clear cache
      this.clearCacheForFile(filePath);

      console.log(`✅ Successfully deleted file: ${filePath}`);
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error(`❌ Failed to delete file '${filePath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Create a directory
   * @param {string} dirPath - Relative path to the directory
   * @returns {Promise<void>}
   */
  static async createDirectory(dirPath) {
    try {
      const absolutePath = path.join(process.cwd(), dirPath);
      this.validatePath(absolutePath);

      console.log(`📁 Creating directory: ${absolutePath}`);
      await fs.mkdir(absolutePath, { recursive: true });

      console.log(`✅ Successfully created directory: ${dirPath}`);
    } catch (error) {
      const enhancedError = this.enhanceError(error, dirPath);
      console.error(`❌ Failed to create directory '${dirPath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * List directory contents
   * @param {string} dirPath - Relative path to the directory
   * @param {boolean} includeStats - Include file statistics
   * @returns {Promise<Array>} - Array of directory contents
   */
  static async listDirectory(dirPath = '.', includeStats = false) {
    try {
      const absolutePath = path.join(process.cwd(), dirPath);
      this.validatePath(absolutePath);

      console.log(`📋 Listing directory: ${absolutePath}`);

      const items = await fs.readdir(absolutePath, { withFileTypes: true });
      const results = [];

      for (const item of items) {
        const itemPath = path.join(absolutePath, item.name);
        const result = {
          name: item.name,
          isDirectory: item.isDirectory(),
          isFile: item.isFile(),
          path: path.relative(process.cwd(), itemPath)
        };

        if (includeStats) {
          try {
            const stats = await fs.stat(itemPath);
            result.size = stats.size;
            result.created = stats.birthtime;
            result.modified = stats.mtime;
            result.mode = stats.mode;
          } catch (statsError) {
            console.warn(`⚠️ Could not get stats for ${item.name}: ${statsError.message}`);
          }
        }

        results.push(result);
      }

      console.log(`✅ Listed ${results.length} items in directory: ${dirPath}`);
      return results;
    } catch (error) {
      const enhancedError = this.enhanceError(error, dirPath);
      console.error(`❌ Failed to list directory '${dirPath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Get file statistics
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<Object>} - File statistics
   */
  static async getFileStats(filePath) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);

      const stats = await fs.stat(absolutePath);

      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        mode: stats.mode.toString(8),
        permissions: {
          readable: !!(stats.mode & parseInt('444', 8)),
          writable: !!(stats.mode & parseInt('222', 8)),
          executable: !!(stats.mode & parseInt('111', 8))
        }
      };
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      throw enhancedError;
    }
  }

  /**
   * Check if file or directory exists
   * @param {string} filePath - Relative path to check
   * @returns {Promise<boolean>} - True if exists
   */
  static async exists(filePath) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Overwrites the file at the given path with new content
   * @param {string} filePath - Relative path to the file from project root
   * @param {string} newContent - New content to write to the file
   * @param {string} encoding - File encoding (default: utf8)
   * @returns {Promise<void>}
   */
  static async replaceFileContent(filePath, newContent, encoding = 'utf8') {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);
      this.checkProtectedFile(filePath);

      console.log(`📝 Writing to file: ${absolutePath} (${newContent.length} chars)`);

      await fs.writeFile(absolutePath, newContent, encoding);

      // Clear cache
      this.clearCacheForFile(filePath);

      console.log(`✅ Successfully wrote to file: ${filePath}`);
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error(`❌ Failed to write file '${filePath}':`, enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Search for text in files with enhanced relevance scoring
   */
  static async searchInFiles(searchText, extensions = ['.tsx', '.ts', '.js', '.jsx'], maxDepth = 10) {
    const results = [];
    const expandedSearchTerms = this.expandSearchTerms(searchText);

    try {
      const searchInDirectory = async (dirPath, currentDepth = 0) => {
        if (currentDepth > maxDepth) return;

        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);
          const relativePath = path.relative(process.cwd(), fullPath);

          // Skip protected directories
          if (item.isDirectory()) {
            const shouldSkip = PROTECTED_DIRS.some(protectedDir => 
              relativePath.includes(protectedDir) || item.name.startsWith('.')
            );

            if (!shouldSkip) {
              await searchInDirectory(fullPath, currentDepth + 1);
            }
          } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const lines = content.split('\n');
              const fileName = item.name.toLowerCase();

              lines.forEach((line, index) => {
                const lineContent = line.trim();
                const searchTerms = expandedSearchTerms.filter(term => 
                  lineContent.toLowerCase().includes(term.toLowerCase())
                );

                if (searchTerms.length > 0) {
                  // Enhanced relevance scoring
                  let relevanceScore = searchTerms.length;

                  // +5 if term is in filename
                  if (expandedSearchTerms.some(term => fileName.includes(term.toLowerCase()))) {
                    relevanceScore += 5;
                  }

                  // +2 if match is in first 5 lines
                  if (index < 5) {
                    relevanceScore += 2;
                  }

                  // +1 for each additional match in the same line
                  const additionalMatches = searchTerms.length - 1;
                  relevanceScore += additionalMatches;

                  results.push({
                    file: relativePath.replace(/\\/g, '/'),
                    line: index + 1,
                    content: lineContent,
                    relevanceScore: relevanceScore,
                    matchedTerms: searchTerms,
                    fileName: item.name,
                    directory: path.dirname(relativePath)
                  });
                }
              });
            } catch (readError) {
              // Skip files that can't be read
              console.log(`⚠️ Could not read file: ${relativePath}`);
            }
          }
        }
      };

      // Search priority directories
      const searchDirectories = [
        { path: path.join(process.cwd(), 'src'), priority: 1 },
        { path: path.join(process.cwd(), 'ai-service'), priority: 2 },
        { path: path.join(process.cwd(), 'backend'), priority: 3 },
        { path: process.cwd(), priority: 4 }
      ];

      for (const { path: searchPath, priority } of searchDirectories) {
        try {
          const stats = await fs.stat(searchPath);
          if (stats.isDirectory()) {
            await searchInDirectory(searchPath);
            console.log(`🔍 Searched in directory: ${searchPath} (priority: ${priority})`);
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.log(`⚠️ Could not access directory ${searchPath}:`, error.message);
          }
        }
      }

      // Sort results by relevance score (highest first)
      const sortedResults = results.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort by file type priority
        const getFileTypePriority = (fileName) => {
          if (fileName.endsWith('.tsx')) return 1;
          if (fileName.endsWith('.ts')) return 2;
          if (fileName.endsWith('.jsx')) return 3;
          if (fileName.endsWith('.js')) return 4;
          return 5;
        };
        return getFileTypePriority(a.fileName) - getFileTypePriority(b.fileName);
      });

      // Return top 20 most relevant results
      const topResults = sortedResults.slice(0, 20);

      console.log(`🎯 Found ${results.length} total matches, returning top ${topResults.length} by relevance`);
      return topResults;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Replace text in file
   */
  static async replaceTextInFile(filePath, oldText, newText) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      this.validatePath(absolutePath);
      this.checkProtectedFile(filePath);

      const content = await fs.readFile(absolutePath, 'utf8');
      const updatedContent = content.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newText);

      if (content !== updatedContent) {
        await fs.writeFile(absolutePath, updatedContent, 'utf8');

        // Clear cache
        this.clearCacheForFile(filePath);

        console.log(`✅ Replaced text in file: ${filePath}`);
        return { success: true, changes: 1 };
      }

      return { success: true, changes: 0 };
    } catch (error) {
      const enhancedError = this.enhanceError(error, filePath);
      console.error('Replace error:', enhancedError.message);
      return { success: false, error: enhancedError.message };
    }
  }

  /**
   * Get file content (alias for readFileContent)
   */
  static async getFileContent(filePath, encoding = 'utf8') {
    return await this.readFileContent(filePath, encoding);
  }

  /**
   * Write file content (alias for replaceFileContent)
   */
  static async writeFileContent(filePath, content, encoding = 'utf8') {
    return await this.replaceFileContent(filePath, content, encoding);
  }

  /**
   * Get project structure with enhanced metadata
   */
  static async getProjectStructure(includeFiles = true) {
    const structure = {};

    try {
      const getStructure = async (dirPath, relativePath = '') => {
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true });

          for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            const relPath = path.join(relativePath, item.name).replace(/\\/g, '/');

            // Skip protected directories
            if (item.isDirectory() && !item.name.startsWith('.') && !PROTECTED_DIRS.some(dir => relPath.includes(dir))) {
              structure[relPath] = { 
                type: 'directory',
                name: item.name,
                path: relPath
              };
              await getStructure(fullPath, relPath);
            } else if (item.isFile() && includeFiles) {
              try {
                const stats = await fs.stat(fullPath);
                structure[relPath] = { 
                  type: 'file',
                  name: item.name,
                  path: relPath,
                  size: stats.size,
                  modified: stats.mtime,
                  extension: path.extname(item.name),
                  isText: this.isTextFile(item.name)
                };
              } catch (statsError) {
                // Skip files we can't access
                console.warn(`⚠️ Could not access file stats: ${relPath}`);
              }
            }
          }
        } catch (dirError) {
          console.warn(`⚠️ Could not read directory: ${relativePath}`);
        }
      };

      await getStructure(process.cwd());

      console.log(`📊 Project structure: ${Object.keys(structure).length} items`);
      return structure;

    } catch (error) {
      console.error('Error getting project structure:', error);
      return {};
    }
  }

  /**
   * Get complete file tree structure for AI analysis
   * Returns organized tree with categorized files
   */
  async getCompleteFileTree(maxDepth = 5) {
    try {
      console.log('🌳 Building complete file tree structure...');

      const projectRoot = process.cwd();
      const rootNode = await this.buildDirectoryTree(projectRoot, '', 0, maxDepth);

      // Ensure we have a proper structure
      if (!rootNode) {
        throw new Error('Failed to build root directory tree');
      }

      // Filter and organize children
      if (rootNode.children) {
        rootNode.children = rootNode.children.filter(child => 
          !this.isSkippedPath(child.name)
        );
      }

      console.log(`✅ File tree built with ${rootNode.children?.length || 0} root items`);
      return rootNode;

    } catch (error) {
      console.error('❌ Error in getCompleteFileTree:', error);
      throw error;
    }
  }

  /**
   * Build directory tree recursively
   */
  async buildDirectoryTree(fullPath, relativePath, currentDepth, maxDepth) {
    try {
      const stats = await fs.stat(fullPath);
      const name = path.basename(fullPath) || 'workspace';

      const node = {
        name: name,
        type: stats.isDirectory() ? 'folder' : 'file',
        path: relativePath,
        size: stats.isFile() ? stats.size : undefined,
        lastModified: stats.mtime.toISOString(),
        extension: stats.isFile() ? path.extname(name) : undefined
      };

      // If it's a directory and we haven't reached max depth
      if (stats.isDirectory() && currentDepth < maxDepth) {
        try {
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          const children = [];

          for (const entry of entries) {
            // Skip hidden files and protected directories
            if (entry.name.startsWith('.') && !this.isImportantFile(entry.name)) {
              continue;
            }

            if (this.isSkippedPath(entry.name)) {
              continue;
            }

            const entryFullPath = path.join(fullPath, entry.name);
            const entryRelativePath = relativePath 
              ? path.join(relativePath, entry.name).replace(/\\/g, '/') 
              : entry.name;

            try {
              const childNode = await this.buildDirectoryTree(
                entryFullPath, 
                entryRelativePath, 
                currentDepth + 1, 
                maxDepth
              );

              if (childNode) {
                children.push(childNode);
              }
            } catch (childError) {
              console.warn(`⚠️ Could not process ${entryRelativePath}:`, childError.message);
            }
          }

          // Sort children: directories first, then files, both alphabetically
          children.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          node.children = children;
        } catch (readError) {
          console.warn(`⚠️ Could not read directory ${relativePath}:`, readError.message);
          node.children = [];
        }
      }

      return node;
    } catch (error) {
      console.warn(`⚠️ Could not stat ${relativePath}:`, error.message);
      return null;
    }
  }

  /**
   * Check if a file is important hidden file
   */
  isImportantFile(filename) {
    const importantFiles = ['.env', '.env.example', '.gitignore', '.replit'];
    return importantFiles.includes(filename);
  }

  // ================== UTILITY METHODS ==================

  /**
   * Enhanced path validation with symlink detection
   */
  static validatePath(absolutePath) {
    const projectRoot = path.resolve('.');
    const resolvedPath = path.resolve(absolutePath);

    // Check if path is within project
    if (!resolvedPath.startsWith(projectRoot)) {
      throw new InvalidPathError(`Path outside project root: ${absolutePath}`);
    }

    // Check for directory traversal
    if (absolutePath.includes('..')) {
      throw new InvalidPathError(`Directory traversal detected: ${absolutePath}`);
    }

    // Check for symlinks (basic detection)
    try {
      const lstat = fsSync.lstatSync(absolutePath);
      if (lstat.isSymbolicLink()) {
        const realPath = fsSync.realpathSync(absolutePath);
        if (!realPath.startsWith(projectRoot)) {
          throw new InvalidPathError(`Symlink points outside project: ${absolutePath}`);
        }
      }
    } catch (error) {
      // File doesn't exist yet, which is fine for creation operations
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ Could not check symlink for ${absolutePath}: ${error.message}`);
      }
    }
  }

  /**
   * Check if file is protected from AI modification
   */
  static checkProtectedFile(filePath) {
    if (this.isProtectedFile(filePath)) {
      throw new PermissionDeniedError(`Protected file cannot be modified: ${filePath}`);
    }
  }

  /**
   * Check if file is protected
   */
  static isProtectedFile(filePath) {
    const fileName = path.basename(filePath);
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check protected files
    if (PROTECTED_FILES.includes(fileName)) {
      return true;
    }

    // Check protected directories
    for (const protectedDir of PROTECTED_DIRS) {
      if (normalizedPath.includes(protectedDir)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Enhanced error handling
   */
  static enhanceError(error, filePath) {
    const timestamp = new Date().toISOString();

    // Log the error for auditing
    console.error(`[${timestamp}] File operation error:`, {
      path: filePath,
      error: error.message,
      code: error.code,
      stack: error.stack
    });

    switch (error.code) {
      case 'ENOENT':
        return new FileNotFoundError(filePath);
      case 'EACCES':
      case 'EPERM':
        return new PermissionDeniedError(filePath);
      case 'EINVAL':
        return new InvalidPathError(filePath);
      default:
        return error;
    }
  }

  /**
   * Create backup before modifying file
   */
  static async createBackup(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
      const backupPath = `${filePath}.backup.${timestamp}.${hash}`;

      await fs.writeFile(backupPath, content);
      console.log(`📦 Created backup: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('❌ Backup creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Cache management
   */
  static getFromCache(key) {
    const cached = fileCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    fileCache.delete(key);
    return null;
  }

  static setCache(key, data) {
    fileCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  static clearCacheForFile(filePath) {
    for (const [key] of fileCache) {
      if (key.includes(filePath)) {
        fileCache.delete(key);
      }
    }
  }

  static clearAllCache() {
    fileCache.clear();
    console.log('🧹 Cleared all file cache');
  }

  /**
   * Check if file is text-based
   */
  static isTextFile(fileName) {
    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', 
      '.css', '.scss', '.html', '.xml', '.yml', '.yaml',
      '.env', '.gitignore', '.md', '.rst'
    ];

    const ext = path.extname(fileName).toLowerCase();
    return textExtensions.includes(ext) || !ext;
  }

  /**
   * Expand Georgian search terms
   */
  static expandSearchTerms(searchTerm) {
    const terms = [searchTerm.toLowerCase()];

    // Add Georgian expansions
    Object.entries(GEORGIAN_SEARCH_EXPANSIONS).forEach(([georgian, expansions]) => {
      if (searchTerm.toLowerCase().includes(georgian)) {
        terms.push(...expansions);
      }
    });

    return [...new Set(terms)];
  }

    /**
   * Check if path should be skipped
   */
  static isSkippedPath(name) {
    const skippedPaths = [...PROTECTED_DIRS, 'temp', 'tmp'];
    return skippedPaths.includes(name) || name.startsWith('.');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of fileCache) {
      if (now - value.timestamp < CACHE_TTL) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      total: fileCache.size,
      valid: validEntries,
      expired: expiredEntries,
      ttl: CACHE_TTL
    };
  }

  /**
   * Cleanup expired cache entries
   */
  static cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of fileCache) {
      if (now - value.timestamp >= CACHE_TTL) {
        fileCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }

    return cleaned;
  }
}

// Export error classes for external use
module.exports = {
  FileAccessService,
  FileNotFoundError,
  PermissionDeniedError,
  InvalidPathError
};

// Set up periodic cache cleanup
setInterval(() => {
  FileAccessService.cleanupCache();
}, CACHE_TTL);
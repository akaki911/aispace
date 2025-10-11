const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Advanced Search Service with fuzzy matching, content search, and caching
 * Supports Georgian text and high-performance search across large codebases
 */
class AdvancedSearchService {
  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new Map();
    this.fileIndex = new Map();
    this.indexLastUpdated = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    this.MAX_CACHE_SIZE = 1000;
    this.allowedExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html', '.md', 
      '.txt', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php',
      '.rb', '.go', '.rs', '.swift', '.kt', '.dart', '.vue', '.yml', '.yaml'
    ];
    this.excludedPaths = [
      'node_modules', '.git', '.vite', 'dist', 'build', '.cache',
      'coverage', '.nyc_output', 'logs', '.vscode', 'groq_response_errors'
    ];
  }

  /**
   * Advanced fuzzy search algorithm with scoring
   * Supports Unicode/Georgian text
   */
  fuzzyMatch(query, text, options = {}) {
    const {
      threshold = 0.4,
      caseSensitive = false,
      includeScore = true,
      includeMatches = true
    } = options;

    if (!query || !text) return { isMatch: false, score: 0 };

    const normalizedQuery = caseSensitive ? query : query.toLowerCase();
    const normalizedText = caseSensitive ? text : text.toLowerCase();

    // Exact match gets highest score
    if (normalizedText === normalizedQuery) {
      return { isMatch: true, score: 1.0, matches: [{ indices: [0, text.length] }] };
    }

    // Substring match gets high score
    if (normalizedText.includes(normalizedQuery)) {
      const startIndex = normalizedText.indexOf(normalizedQuery);
      return {
        isMatch: true,
        score: 0.9,
        matches: [{ indices: [startIndex, startIndex + normalizedQuery.length] }]
      };
    }

    // Fuzzy matching using edit distance
    const score = this.calculateFuzzyScore(normalizedQuery, normalizedText);
    const isMatch = score >= threshold;

    return {
      isMatch,
      score,
      matches: isMatch ? this.findFuzzyMatches(normalizedQuery, normalizedText) : []
    };
  }

  /**
   * Calculate fuzzy score using Levenshtein distance
   */
  calculateFuzzyScore(query, text) {
    const queryLen = query.length;
    const textLen = text.length;

    if (queryLen === 0) return textLen === 0 ? 1 : 0;
    if (textLen === 0) return 0;

    // Dynamic programming matrix for edit distance
    const matrix = Array(queryLen + 1).fill().map(() => Array(textLen + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= queryLen; i++) matrix[i][0] = i;
    for (let j = 0; j <= textLen; j++) matrix[0][j] = j;

    // Calculate edit distance
    for (let i = 1; i <= queryLen; i++) {
      for (let j = 1; j <= textLen; j++) {
        const cost = query[i - 1] === text[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const editDistance = matrix[queryLen][textLen];
    const maxLength = Math.max(queryLen, textLen);
    return 1 - (editDistance / maxLength);
  }

  /**
   * Find fuzzy match positions for highlighting
   */
  findFuzzyMatches(query, text) {
    const matches = [];
    let queryIndex = 0;
    let startIndex = -1;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        if (startIndex === -1) startIndex = i;
        queryIndex++;
        
        if (queryIndex === query.length) {
          matches.push({ indices: [startIndex, i + 1] });
          queryIndex = 0;
          startIndex = -1;
        }
      }
    }

    return matches;
  }

  /**
   * Build file index for fast searching
   */
  async buildFileIndex() {
    const startTime = Date.now();
    console.log('🔍 Building file index...');
    
    this.fileIndex.clear();
    const files = await this.walkDirectory(this.projectRoot);
    
    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(this.projectRoot, filePath);
        const fileName = path.basename(filePath);
        const extension = path.extname(filePath);
        
        this.fileIndex.set(relativePath, {
          path: relativePath,
          fullPath: filePath,
          name: fileName,
          extension,
          size: stats.size,
          lastModified: stats.mtime,
          category: this.categorizeFile(fileName, extension),
          searchTokens: this.generateSearchTokens(fileName, relativePath)
        });
      } catch (error) {
        console.warn(`⚠️ Failed to index file: ${filePath}`, error.message);
      }
    }

    this.indexLastUpdated = Date.now();
    console.log(`✅ File index built: ${this.fileIndex.size} files in ${Date.now() - startTime}ms`);
  }

  /**
   * Walk directory recursively with better error handling
   */
  async walkDirectory(dir, depth = 0) {
    const files = [];
    const maxDepth = 10; // Prevent infinite recursion

    if (depth > maxDepth) return files;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (this.excludedPaths.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath, depth + 1);
          files.push(...subFiles);
        } else if (entry.isFile() && this.isAllowedFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Cannot read directory: ${dir}`, error.message);
    }

    return files;
  }

  /**
   * Check if file extension is allowed
   */
  isAllowedFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return this.allowedExtensions.includes(ext) || fileName.startsWith('.') && fileName !== '.gitignore';
  }

  /**
   * Categorize files for better organization
   */
  categorizeFile(fileName, extension) {
    const name = fileName.toLowerCase();
    const ext = extension.toLowerCase();

    // Source code files
    if (['.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'].includes(ext)) {
      return 'source';
    }

    // Config files
    if (['.json', '.yml', '.yaml', '.env'].includes(ext) || 
        name.includes('config') || name.includes('setting')) {
      return 'config';
    }

    // Documentation
    if (['.md', '.txt'].includes(ext) || name.includes('readme') || name.includes('doc')) {
      return 'docs';
    }

    // Styles
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      return 'styles';
    }

    // Assets
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext)) {
      return 'assets';
    }

    return 'other';
  }

  /**
   * Generate search tokens for a file
   */
  generateSearchTokens(fileName, filePath) {
    const tokens = new Set();
    
    // Add filename without extension
    const nameWithoutExt = path.parse(fileName).name;
    tokens.add(nameWithoutExt.toLowerCase());
    
    // Add path segments
    const pathSegments = filePath.split(path.sep);
    pathSegments.forEach(segment => {
      if (segment) tokens.add(segment.toLowerCase());
    });
    
    // Add camelCase splits
    const camelSplit = nameWithoutExt.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    camelSplit.split(' ').forEach(token => {
      if (token) tokens.add(token);
    });
    
    // Add kebab-case and snake_case splits
    const kebabSnakeSplit = nameWithoutExt.replace(/[-_]/g, ' ').toLowerCase();
    kebabSnakeSplit.split(' ').forEach(token => {
      if (token) tokens.add(token);
    });
    
    return Array.from(tokens);
  }

  /**
   * Search files by name with fuzzy matching
   */
  async searchByName(query, options = {}) {
    const {
      limit = 50,
      fuzzy = true,
      threshold = 0.3,
      sortBy = 'relevance' // relevance, name, size, date
    } = options;

    await this.ensureIndexExists();

    const results = [];
    const normalizedQuery = query.toLowerCase();

    for (const [path, fileInfo] of this.fileIndex) {
      let score = 0;
      let matches = [];

      // Exact filename match
      if (fileInfo.name.toLowerCase() === normalizedQuery) {
        score = 1.0;
        matches = [{ indices: [0, fileInfo.name.length] }];
      }
      // Substring match in filename
      else if (fileInfo.name.toLowerCase().includes(normalizedQuery)) {
        score = 0.8;
        const startIndex = fileInfo.name.toLowerCase().indexOf(normalizedQuery);
        matches = [{ indices: [startIndex, startIndex + normalizedQuery.length] }];
      }
      // Token match
      else if (fileInfo.searchTokens.some(token => token.includes(normalizedQuery))) {
        score = 0.6;
      }
      // Fuzzy match
      else if (fuzzy) {
        const fuzzyResult = this.fuzzyMatch(normalizedQuery, fileInfo.name, { threshold });
        if (fuzzyResult.isMatch) {
          score = fuzzyResult.score * 0.5;
          matches = fuzzyResult.matches;
        }
      }

      if (score > 0) {
        results.push({
          ...fileInfo,
          score,
          matches,
          type: 'file'
        });
      }
    }

    // Sort results
    this.sortResults(results, sortBy);

    return results.slice(0, limit);
  }

  /**
   * Search within file contents
   */
  async searchInContent(query, options = {}) {
    const {
      limit = 50,
      maxFileSize = 1024 * 1024, // 1MB
      contextLines = 2,
      caseSensitive = false,
      regex = false
    } = options;

    await this.ensureIndexExists();

    const results = [];
    const searchPattern = regex ? new RegExp(query, caseSensitive ? 'g' : 'gi') : null;
    const normalizedQuery = caseSensitive ? query : query.toLowerCase();

    for (const [path, fileInfo] of this.fileIndex) {
      // Skip large files
      if (fileInfo.size > maxFileSize) continue;

      // Skip non-text files
      if (!this.isTextFile(fileInfo.extension)) continue;

      try {
        const content = await fs.readFile(fileInfo.fullPath, 'utf8');
        const lines = content.split('\n');
        const matches = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const normalizedLine = caseSensitive ? line : line.toLowerCase();
          
          let found = false;
          let matchInfo = null;

          if (regex && searchPattern) {
            const regexMatches = [...line.matchAll(searchPattern)];
            if (regexMatches.length > 0) {
              found = true;
              matchInfo = regexMatches.map(match => ({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
              }));
            }
          } else if (normalizedLine.includes(normalizedQuery)) {
            found = true;
            const startIndex = normalizedLine.indexOf(normalizedQuery);
            matchInfo = [{
              start: startIndex,
              end: startIndex + normalizedQuery.length,
              text: line.substring(startIndex, startIndex + normalizedQuery.length)
            }];
          }

          if (found) {
            // Get context lines
            const contextStart = Math.max(0, i - contextLines);
            const contextEnd = Math.min(lines.length, i + contextLines + 1);
            const context = lines.slice(contextStart, contextEnd);

            matches.push({
              lineNumber: i + 1,
              line: line.trim(),
              matches: matchInfo,
              context,
              contextStart: contextStart + 1
            });

            if (matches.length >= 10) break; // Limit matches per file
          }
        }

        if (matches.length > 0) {
          results.push({
            ...fileInfo,
            contentMatches: matches,
            totalMatches: matches.length,
            score: matches.length / Math.max(1, lines.length / 100), // Score based on match density
            type: 'content'
          });
        }
      } catch (error) {
        console.warn(`⚠️ Failed to search in file: ${fileInfo.path}`, error.message);
      }
    }

    // Sort by relevance (total matches and score)
    results.sort((a, b) => (b.totalMatches * b.score) - (a.totalMatches * a.score));

    return results.slice(0, limit);
  }

  /**
   * Check if file is text-based
   */
  isTextFile(extension) {
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html', '.md', '.txt',
      '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs',
      '.swift', '.kt', '.dart', '.vue', '.yml', '.yaml', '.xml', '.svg'
    ];
    return textExtensions.includes(extension.toLowerCase());
  }

  /**
   * Filter files by criteria
   */
  async filterFiles(filters = {}) {
    const {
      extensions = [],
      categories = [],
      minSize = 0,
      maxSize = Infinity,
      modifiedAfter = null,
      modifiedBefore = null,
      limit = 100
    } = filters;

    await this.ensureIndexExists();

    const results = [];

    for (const [path, fileInfo] of this.fileIndex) {
      // Extension filter
      if (extensions.length > 0 && !extensions.includes(fileInfo.extension)) continue;

      // Category filter
      if (categories.length > 0 && !categories.includes(fileInfo.category)) continue;

      // Size filter
      if (fileInfo.size < minSize || fileInfo.size > maxSize) continue;

      // Date filter
      if (modifiedAfter && fileInfo.lastModified < modifiedAfter) continue;
      if (modifiedBefore && fileInfo.lastModified > modifiedBefore) continue;

      results.push({
        ...fileInfo,
        type: 'filter'
      });
    }

    return results.slice(0, limit);
  }

  /**
   * Sort search results
   */
  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'size':
        results.sort((a, b) => b.size - a.size);
        break;
      case 'date':
        results.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        break;
      case 'relevance':
      default:
        results.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
    }
  }

  /**
   * Ensure file index exists and is up to date
   */
  async ensureIndexExists() {
    const shouldRebuild = !this.indexLastUpdated || 
                         (Date.now() - this.indexLastUpdated > this.CACHE_TTL) ||
                         this.fileIndex.size === 0;

    if (shouldRebuild) {
      await this.buildFileIndex();
    }
  }

  /**
   * Get recent files based on access patterns
   */
  async getRecentFiles(limit = 20) {
    await this.ensureIndexExists();

    const files = Array.from(this.fileIndex.values())
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .slice(0, limit)
      .map(file => ({ ...file, type: 'recent' }));

    return files;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.fileIndex.clear();
    this.indexLastUpdated = null;
    console.log('🧹 Search cache cleared');
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      indexedFiles: this.fileIndex.size,
      cacheSize: this.cache.size,
      lastIndexUpdate: this.indexLastUpdated,
      categories: this.getCategoryStats()
    };
  }

  /**
   * Get category statistics
   */
  getCategoryStats() {
    const stats = {};
    for (const fileInfo of this.fileIndex.values()) {
      stats[fileInfo.category] = (stats[fileInfo.category] || 0) + 1;
    }
    return stats;
  }
}

module.exports = new AdvancedSearchService();
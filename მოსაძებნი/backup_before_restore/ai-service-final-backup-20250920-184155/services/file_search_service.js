const fs = require('fs').promises;
const path = require('path');

class FileSearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Search for files containing query text
   */
  async searchFiles(query, limit = 50) {
    try {
      console.log(`🔍 [File Search] Searching for: "${query}" (limit: ${limit})`);

      const searchResults = [];
      const projectRoot = process.cwd();

      // Define allowed extensions
      const allowedExtensions = ['.js', '.ts', '.tsx', '.jsx', '.json', '.md'];

      // Define directories to search
      const searchDirs = ['src', 'ai-service', 'backend'];

      for (const dir of searchDirs) {
        const dirPath = path.join(projectRoot, dir);
        try {
          await this.searchInDirectory(dirPath, query, searchResults, allowedExtensions);
        } catch (error) {
          console.warn(`⚠️ Could not search in ${dir}:`, error.message);
        }
      }

      // Sort by relevance and limit results
      const sortedResults = searchResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      console.log(`✅ [File Search] Found ${sortedResults.length} matches for "${query}"`);

      return this.formatSearchResults(sortedResults);

    } catch (error) {
      console.error('❌ [File Search] Search failed:', error);
      throw error;
    }
  }

  /**
   * Search in a specific directory recursively
   */
  async searchInDirectory(dirPath, query, results, allowedExtensions, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          await this.searchInDirectory(fullPath, query, results, allowedExtensions, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (allowedExtensions.includes(ext)) {
            await this.searchInFile(fullPath, relativePath, query, results);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not read directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Search within a single file
   */
  async searchInFile(filePath, relativePath, query, results) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const queryLower = query.toLowerCase();

      lines.forEach((line, index) => {
        const lineLower = line.toLowerCase();
        if (lineLower.includes(queryLower)) {
          // Calculate relevance score
          let relevance = 1;

          // Higher relevance for exact matches
          if (line.includes(query)) relevance += 2;

          // Higher relevance for matches in file names
          if (path.basename(relativePath).toLowerCase().includes(queryLower)) {
            relevance += 3;
          }

          // Higher relevance for matches near the top of the file
          if (index < 10) relevance += 1;

          results.push({
            file: relativePath,
            lineNumber: index + 1,
            content: line.trim(),
            relevance,
            fileName: path.basename(relativePath)
          });
        }
      });
    } catch (error) {
      console.warn(`⚠️ Could not read file ${relativePath}:`, error.message);
    }
  }

  /**
   * Format search results for API response
   */
  formatSearchResults(results) {
    const groupedByFile = {};

    results.forEach(result => {
      if (!groupedByFile[result.file]) {
        groupedByFile[result.file] = {
          file: result.file,
          lines: []
        };
      }

      groupedByFile[result.file].lines.push({
        lineNumber: result.lineNumber,
        content: result.content
      });
    });

    return Object.values(groupedByFile);
  }

  /**
   * Get files by category
   */
  async getFilesByCategory(category, limit = 20) {
    try {
      console.log(`📂 [File Search] Getting files by category: ${category}`);

      const projectRoot = process.cwd();
      const results = [];

      switch (category.toLowerCase()) {
        case 'components':
          await this.searchByPattern(path.join(projectRoot, 'src/components'), /\.(tsx|jsx)$/, results, limit);
          break;
        case 'services':
          await this.searchByPattern(path.join(projectRoot, 'src/services'), /\.(ts|js)$/, results, limit);
          await this.searchByPattern(path.join(projectRoot, 'ai-service/services'), /\.(ts|js)$/, results, limit);
          break;
        case 'routes':
          await this.searchByPattern(path.join(projectRoot, 'ai-service/routes'), /\.(js)$/, results, limit);
          await this.searchByPattern(path.join(projectRoot, 'backend/routes'), /\.(js)$/, results, limit);
          break;
        case 'config':
          await this.searchByPattern(projectRoot, /\.(json|js|ts)$/, results, limit, 1);
          break;
        default:
          throw new Error(`Unknown category: ${category}`);
      }

      console.log(`✅ [File Search] Found ${results.length} files in category: ${category}`);
      return results.slice(0, limit);

    } catch (error) {
      console.error('❌ [File Search] Category search failed:', error);
      throw error;
    }
  }

  /**
   * Search files by pattern
   */
  async searchByPattern(dirPath, pattern, results, limit, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth || results.length >= limit) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= limit) break;

        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        if (entry.isDirectory()) {
          await this.searchByPattern(fullPath, pattern, results, limit, maxDepth, currentDepth + 1);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          const stats = await fs.stat(fullPath);
          results.push({
            file: relativePath,
            name: entry.name,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            extension: path.extname(entry.name)
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not search pattern in ${dirPath}:`, error.message);
    }
  }
}

module.exports = { FileSearchService };
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * SOL-212 Gurulo File System Reader
 * UTF-8 file reading with Georgian filename support
 */

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FORBIDDEN_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.env/,
  /\.\./,
  /attached_assets\/.*\.txt$/ // Exclude attached assets
];

/**
 * Search for files by Unicode name (supports Georgian)
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Ranked matches (shortest path wins)
 */
async function searchByName(query) {
  const matches = [];
  
  try {
    const searchRecursive = async (dir, relativePath = '') => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        // Skip forbidden paths
        if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(relPath))) {
          continue;
        }
        
        if (entry.isFile()) {
          // Check if filename contains query (case-insensitive Unicode)
          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            const stats = await fs.promises.stat(fullPath);
            matches.push({
              path: fullPath,
              rel: relPath,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
              score: entry.name.length // Shorter names score better
            });
          }
        } else if (entry.isDirectory() && relPath.length < 200) {
          // Recurse into subdirectories (with depth limit)
          await searchRecursive(fullPath, relPath);
        }
      }
    };
    
    await searchRecursive(PROJECT_ROOT);
    
    // Sort by score (shorter paths first) and relevance
    matches.sort((a, b) => {
      const aExact = a.rel.toLowerCase() === query.toLowerCase();
      const bExact = b.rel.toLowerCase() === query.toLowerCase();
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return a.score - b.score;
    });
    
    return matches.slice(0, 10); // Top 10 matches
    
  } catch (error) {
    console.error('🚨 [FS Reader] Search error:', error.message);
    return [];
  }
}

/**
 * Read file with UTF-8 encoding and return metadata
 * @param {string} filePath - File path to read
 * @param {boolean} includeContent - Whether to include content
 * @returns {Promise<Object>} - File metadata and optionally content
 */
async function readFileUtf8(filePath, includeContent = false) {
  try {
    // Normalize and validate path
    const normalizedPath = path.resolve(filePath);
    
    // Security check: must be under project root
    if (!normalizedPath.startsWith(PROJECT_ROOT)) {
      throw new Error('Path traversal not allowed');
    }
    
    // Check forbidden patterns
    const relativePath = path.relative(PROJECT_ROOT, normalizedPath);
    if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(relativePath))) {
      throw new Error('Access to this path is forbidden');
    }
    
    // Check if file exists
    const stats = await fs.promises.stat(normalizedPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }
    
    // Read file content with UTF-8
    const content = await fs.promises.readFile(normalizedPath, 'utf8');
    
    // Calculate metadata
    const lines = content.split('\n').length;
    const sha1 = crypto.createHash('sha1').update(content).digest('hex');
    
    const result = {
      success: true,
      meta: {
        path: normalizedPath,
        relativePath,
        bytes: Buffer.byteLength(content, 'utf8'),
        lines,
        sha1: sha1.substring(0, 16), // Short hash
        mtime: stats.mtime.toISOString(),
        encoding: 'utf8'
      }
    };
    
    // Include content only if explicitly requested
    if (includeContent) {
      result.content = content;
    }
    
    console.log(`📖 [FS Reader] Read ${relativePath} (${result.meta.bytes} bytes, ${lines} lines)`);
    return result;
    
  } catch (error) {
    console.error('🚨 [FS Reader] Read error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  searchByName,
  readFileUtf8,
  PROJECT_ROOT
};
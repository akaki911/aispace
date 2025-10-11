const fs = require('fs').promises;
const path = require('path');

async function getProjectStructure() {
  try {
    // For Node.js 18.17.0+, use recursive readdir
    let allFiles;
    try {
      allFiles = await fs.readdir(process.cwd(), { recursive: true });
    } catch (error) {
      // Fallback for older Node.js versions - walk directories manually
      allFiles = await walkDirectory(process.cwd());
    }

    // Filter out ignored directories and return only files (not directories)
    const ignored = ['node_modules', '.git', '.replit', 'build', 'dist', '.assistant_backups'];
    return allFiles.filter(file => {
      // Skip if starts with ignored folder
      if (ignored.some(folder => file.startsWith(folder))) return false;
      // Skip directories - we only want files
      try {
        const fullPath = path.resolve(process.cwd(), file);
        const stat = require('fs').statSync(fullPath);
        return stat.isFile();
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('Error getting project structure:', error);
    return [];
  }
}

// Fallback function for manual directory walking
async function walkDirectory(dir, relativePath = '') {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Recursively walk subdirectories
        const subFiles = await walkDirectory(fullPath, relPath);
        files.push(...subFiles);
      } else {
        // Add file to list
        files.push(relPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return files;
}

/**
 * Read file content with size and encoding options
 * @param {string} filePath - Relative path to file
 * @param {Object} options - Reading options
 * @returns {Promise<string>} File content
 */
async function readFileContent(filePath, options = {}) {
  const { maxBytes = 8000, encoding = 'utf8' } = options;

  try {
    const absolutePath = path.resolve(process.cwd(), filePath);

    // Security check - ensure file is within project directory
    if (!absolutePath.startsWith(process.cwd())) {
      throw new Error('File access outside project directory not allowed');
    }

    const stats = await fs.stat(absolutePath);
    if (stats.size > maxBytes) {
      // Read only the first portion of large files
      const buffer = Buffer.alloc(maxBytes);
      const fd = await fs.open(absolutePath, 'r');
      await fd.read(buffer, 0, maxBytes, 0);
      await fd.close();
      return buffer.toString(encoding);
    } else {
      return await fs.readFile(absolutePath, encoding);
    }
  } catch (error) {
    console.warn(`⚠️ [FILE SYSTEM] Could not read file ${filePath}:`, error.message);
    return null;
  }
}

module.exports = {
  getProjectStructure,
  readFileContent
};
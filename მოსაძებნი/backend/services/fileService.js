const fs = require('fs').promises;
const path = require('path');

class FileService {
  constructor() {
    this.projectRoot = process.cwd();
    this.allowedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html', '.md', '.txt', '.py', '.java', '.cpp', '.c'];
    this.protectedFiles = ['.env', 'package-lock.json', 'node_modules'];
  }

  async readFile(filePath) {
    try {
      const absolutePath = path.join(this.projectRoot, filePath);
      await this.validatePath(absolutePath);

      const content = await fs.readFile(absolutePath, 'utf8');
      const stats = await fs.stat(absolutePath);

      return {
        success: true,
        content,
        size: stats.size,
        lastModified: stats.mtime,
        extension: path.extname(filePath)
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read ${filePath}: ${error.message}`
      };
    }
  }

  async writeFile(filePath, content) {
    try {
      const absolutePath = path.join(this.projectRoot, filePath);
      await this.validatePath(absolutePath);

      // Create directory if it doesn't exist
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      // Backup original file if it exists
      try {
        await fs.access(absolutePath);
        const backupPath = `${absolutePath}.backup_${Date.now()}`;
        await fs.copyFile(absolutePath, backupPath);
      } catch (e) {
        // File doesn't exist, no backup needed
      }

      await fs.writeFile(absolutePath, content, 'utf8');

      return {
        success: true,
        message: `Successfully updated ${filePath}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write ${filePath}: ${error.message}`
      };
    }
  }

  async listFiles(dirPath = '') {
    try {
      const absolutePath = path.join(this.projectRoot, dirPath);
      const items = await fs.readdir(absolutePath, { withFileTypes: true });

      const files = [];
      const directories = [];

      for (const item of items) {
        if (item.name.startsWith('.') && item.name !== '.replit') continue;
        if (item.name === 'node_modules') continue;

        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          directories.push({
            name: item.name,
            path: itemPath,
            type: 'directory'
          });
        } else {
          files.push({
            name: item.name,
            path: itemPath,
            type: 'file',
            extension: path.extname(item.name)
          });
        }
      }

      return {
        success: true,
        files: [...directories, ...files]
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error.message}`
      };
    }
  }

  async detectFileType(content, fileName) {
    const ext = path.extname(fileName).toLowerCase();

    // Component detection
    if ((ext === '.tsx' || ext === '.jsx') && content.includes('export default')) {
      if (content.includes('useState') || content.includes('useEffect')) {
        return 'React Component';
      }
      return 'React Component (Class)';
    }

    // Service/Utility detection
    if (ext === '.ts' || ext === '.js') {
      if (content.includes('export') && content.includes('function')) {
        return 'Service/Utility';
      }
      if (content.includes('express') || content.includes('router')) {
        return 'Backend Route/Controller';
      }
    }

    // Configuration detection
    if (fileName.includes('config') || ext === '.json') {
      return 'Configuration';
    }

    return 'Code File';
  }

  async validatePath(absolutePath) {
    const normalizedPath = path.normalize(absolutePath);
    if (!normalizedPath.startsWith(this.projectRoot)) {
      throw new Error('Access denied: Path outside project directory');
    }

    const relativePath = path.relative(this.projectRoot, normalizedPath);
    for (const protectedFile of this.protectedFiles) {
      if (relativePath.includes(protectedFile)) {
        throw new Error(`Access denied: ${protectedFile} is protected`);
      }
    }
  }

  // AI-specific functions for code analysis
  async getProjectStructure() {
    const structure = {};

    const scanDirectory = async (dir, depth = 0) => {
      if (depth > 3) return; // Limit depth

      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;

        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(this.projectRoot, fullPath);

        if (item.isDirectory()) {
          structure[relativePath] = { type: 'directory', children: {} };
          await scanDirectory(fullPath, depth + 1);
        } else {
          const ext = path.extname(item.name);
          if (['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.md'].includes(ext)) {
            structure[relativePath] = { 
              type: 'file', 
              extension: ext,
              size: (await fs.stat(fullPath)).size 
            };
          }
        }
      }
    };

    await scanDirectory(this.projectRoot);
    return structure;
  }

  async getFileContext(filePath, maxSize = 50000) {
    try {
      const absolutePath = path.join(this.projectRoot, filePath);
      await this.validatePath(absolutePath);

      const stats = await fs.stat(absolutePath);
      if (stats.size > maxSize) {
        // For large files, return summary
        const content = await fs.readFile(absolutePath, 'utf8');
        return {
          path: filePath,
          type: await this.detectFileType(content, filePath),
          size: stats.size,
          summary: content.substring(0, 1000) + '...[truncated]',
          lineCount: content.split('\n').length
        };
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      return {
        path: filePath,
        type: await this.detectFileType(content, filePath),
        size: stats.size,
        content: content,
        lineCount: content.split('\n').length
      };
    } catch (error) {
      return {
        path: filePath,
        error: error.message
      };
    }
  }

  async searchInFiles(searchTerm, fileExtensions = ['.js', '.jsx', '.ts', '.tsx']) {
    const results = [];
    const searchTerms = this.expandSearchTerms(searchTerm);

    const searchInDirectory = async (dir) => {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;

        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          await searchInDirectory(fullPath);
        } else if (fileExtensions.includes(path.extname(item.name))) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');
            let relevanceScore = 0;

            // Check filename relevance
            if (searchTerms.some(term => item.name.toLowerCase().includes(term.toLowerCase()))) {
              relevanceScore += 10;
            }

            lines.forEach((line, index) => {
              const matches = searchTerms.filter(term => 
                line.toLowerCase().includes(term.toLowerCase())
              );

              if (matches.length > 0) {
                relevanceScore += matches.length;
                results.push({
                  file: path.relative(this.projectRoot, fullPath),
                  line: index + 1,
                  content: line.trim(),
                  context: lines.slice(Math.max(0, index - 2), index + 3),
                  relevanceScore: relevanceScore,
                  matchedTerms: matches
                });
              }
            });
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    };

    await searchInDirectory(this.projectRoot);
    
    // Sort by relevance score and deduplicate
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .filter((result, index, arr) => 
        index === arr.findIndex(r => r.file === result.file)
      );
  }

  expandSearchTerms(term) {
    const georgianTermMap = {
      'ფასები': ['price', 'pricing', 'cost'],
      'ბრონირება': ['booking', 'reservation'],
      'კოტეჯი': ['cottage'],
      'სასტუმრო': ['hotel'],
      'მომხმარებელი': ['user', 'customer'],
      'ადმინი': ['admin'],
      'ავტომობილი': ['vehicle', 'car'],
      'კალენდარი': ['calendar'],
      'გადახდა': ['payment'],
      'ფორმა': ['form', 'modal']
    };

    let expandedTerms = [term];

    // Add English equivalents for Georgian terms
    Object.keys(georgianTermMap).forEach(georgian => {
      if (term.toLowerCase().includes(georgian.toLowerCase())) {
        expandedTerms.push(...georgianTermMap[georgian]);
      }
    });

    // Add filename patterns
    if (term.includes('ფასები') || term.includes('price')) {
      expandedTerms.push('pricing', 'vehiclePricing', 'seasonalPricing');
    }
    if (term.includes('ბრონირება') || term.includes('booking')) {
      expandedTerms.push('BookingForm', 'BookingModal', 'bookingService');
    }

    return [...new Set(expandedTerms)];
  }

  suggestLocation(content, fileName) {
    const ext = path.extname(fileName).toLowerCase();

    // React components
    if ((ext === '.tsx' || ext === '.jsx') && content.includes('export default')) {
      return 'src/components/';
    }

    // Services
    if ((ext === '.ts' || ext === '.js') && content.includes('Service')) {
      return 'src/services/';
    }

    // Backend routes
    if (content.includes('router') || content.includes('express')) {
      return 'backend/routes/';
    }

    // Types
    if (ext === '.ts' && content.includes('interface') && !content.includes('export default')) {
      return 'src/types/';
    }

    // Utils
    if (content.includes('export') && content.includes('function') && !content.includes('Component')) {
      return 'src/utils/';
    }

    return 'src/';
  }
}

module.exports = new FileService();
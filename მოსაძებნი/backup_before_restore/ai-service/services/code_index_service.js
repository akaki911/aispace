const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CodeIndexService {
  constructor() {
    this.codeIndex = new Map();
    this.indexPath = path.join(__dirname, '../code_index.json');
    this.loadIndex();
  }

  async loadIndex() {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(indexData);
      this.codeIndex = new Map(Object.entries(parsed));
      console.log(`📚 Code index loaded: ${this.codeIndex.size} files indexed`);
    } catch (error) {
      console.log('📚 Creating new code index...');
      await this.buildIndex();
    }
  }

  async buildIndex() {
    console.log('🔍 Building comprehensive code index...');

    const startTime = Date.now();
    const projectRoot = path.join(__dirname, '../../');

    const indexData = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        projectRoot,
        totalFiles: 0
      },
      files: {},
      dependencies: {},
      components: {},
      services: {},
      types: {},
      apis: {}
    };

    // Index different types of files
    await this.indexDirectory(projectRoot, indexData);

    // Save index
    await fs.writeFile(this.indexPath, JSON.stringify(indexData, null, 2));

    const duration = Date.now() - startTime;
    console.log(`✅ Code index built in ${duration}ms: ${indexData.metadata.totalFiles} files`);

    // Convert to Map for fast access
    this.codeIndex = new Map(Object.entries(indexData.files));
  }

  async indexDirectory(dirPath, indexData, relativePath = '') {
    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const relativeItemPath = path.join(relativePath, item);

        // Skip node_modules, .git, and other unwanted directories
        if (this.shouldSkipPath(item)) continue;

        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await this.indexDirectory(itemPath, indexData, relativeItemPath);
        } else if (this.shouldIndexFile(item)) {
          await this.indexFile(itemPath, relativeItemPath, indexData);
        }
      }
    } catch (error) {
      console.error(`❌ Error indexing directory ${dirPath}:`, error);
    }
  }

  async indexFile(filePath, relativePath, indexData) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const hash = crypto.createHash('md5').update(content).digest('hex');

      const fileInfo = {
        path: relativePath,
        type: this.getFileType(relativePath),
        size: content.length,
        lines: content.split('\n').length,
        hash,
        lastModified: (await fs.stat(filePath)).mtime.toISOString(),
        exports: this.extractExports(content, relativePath),
        imports: this.extractImports(content, relativePath),
        functions: this.extractFunctions(content, relativePath),
        classes: this.extractClasses(content, relativePath),
        apis: this.extractAPIs(content, relativePath),
        components: this.extractComponents(content, relativePath)
      };

      indexData.files[relativePath] = fileInfo;
      indexData.metadata.totalFiles++;

      // Categorize for quick access
      this.categorizeFile(fileInfo, indexData);

    } catch (error) {
      console.error(`❌ Error indexing file ${filePath}:`, error);
    }
  }

  shouldSkipPath(itemName) {
    const skipPatterns = [
      'node_modules', '.git', '.replit', 'dist', 'build',
      '.env', '.cache', 'coverage', '.vite'
    ];
    return skipPatterns.some(pattern => itemName.includes(pattern));
  }

  shouldIndexFile(fileName) {
    const extensions = ['.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.css', '.html'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  getFileType(filePath) {
    const ext = path.extname(filePath);
    const typeMap = {
      '.ts': 'typescript',
      '.tsx': 'react',
      '.js': 'javascript',
      '.jsx': 'react',
      '.json': 'config',
      '.md': 'documentation',
      '.css': 'styles',
      '.html': 'template'
    };
    return typeMap[ext] || 'unknown';
  }

  extractExports(content, filePath) {
    const exports = [];

    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push({ name: match[1], type: 'named' });
    }

    // Default exports
    const defaultExportRegex = /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    while ((match = defaultExportRegex.exec(content)) !== null) {
      exports.push({ name: match[1], type: 'default' });
    }

    return exports;
  }

  extractImports(content, filePath) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  extractFunctions(content, filePath) {
    const functions = [];
    const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{))/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2]);
    }
    return functions;
  }

  extractClasses(content, filePath) {
    const classes = [];
    const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    return classes;
  }

  extractAPIs(content, filePath) {
    const apis = [];

    // Express routes
    const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      apis.push({ method: match[1].toUpperCase(), path: match[2] });
    }

    return apis;
  }

  extractComponents(content, filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return [];

    const components = [];
    const componentRegex = /(?:function\s+([A-Z][a-zA-Z0-9_$]*)|const\s+([A-Z][a-zA-Z0-9_$]*)\s*=)/g;
    let match;
    while ((match = componentRegex.exec(content)) !== null) {
      components.push(match[1] || match[2]);
    }
    return components;
  }

  categorizeFile(fileInfo, indexData) {
    // Categorize by type for quick access
    if (fileInfo.components.length > 0) {
      fileInfo.components.forEach(comp => {
        indexData.components[comp] = fileInfo.path;
      });
    }

    if (fileInfo.path.includes('service')) {
      indexData.services[path.basename(fileInfo.path, path.extname(fileInfo.path))] = fileInfo.path;
    }

    if (fileInfo.apis.length > 0) {
      fileInfo.apis.forEach(api => {
        indexData.apis[`${api.method} ${api.path}`] = fileInfo.path;
      });
    }
  }

  // Fast search methods
  async searchInIndex(query, type = 'all') {
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [filePath, fileInfo] of this.codeIndex) {
      let relevance = 0;

      // Search in file path
      if (filePath.toLowerCase().includes(searchTerm)) {
        relevance += 10;
      }

      // Search in functions, classes, components
      ['functions', 'classes', 'components'].forEach(category => {
        if (fileInfo[category]) {
          fileInfo[category].forEach(item => {
            if (item.toLowerCase().includes(searchTerm)) {
              relevance += 5;
            }
          });
        }
      });

      if (relevance > 0) {
        results.push({ ...fileInfo, relevance });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  async getFileInfo(filePath) {
    return this.codeIndex.get(filePath);
  }

  async updateFileIndex(filePath) {
    // Update single file in index
    const fullPath = path.join(__dirname, '../../', filePath);
    try {
      const indexData = { files: {}, metadata: { totalFiles: 0 } };
      await this.indexFile(fullPath, filePath, indexData);

      if (indexData.files[filePath]) {
        this.codeIndex.set(filePath, indexData.files[filePath]);
        await this.saveIndex();
      }
    } catch (error) {
      console.error(`❌ Error updating file index for ${filePath}:`, error);
    }
  }

  async saveIndex() {
    const indexObject = Object.fromEntries(this.codeIndex);
    await fs.writeFile(this.indexPath, JSON.stringify(indexObject, null, 2));
  }

  // Get indexed project structure  
  getProjectStructure() {
    return this.index;
  }

  // Find relevant files for RAG queries
  async findRelevantFiles(query, limit = 10) {
    try {
      const expandedTerms = FileAccessService.expandSearchTerms(query);
      const relevantFiles = [];

      // Search in index
      for (const [filePath, fileData] of Object.entries(this.index.files)) {
        let relevanceScore = 0;

        // Check file name relevance
        expandedTerms.forEach(term => {
          if (filePath.toLowerCase().includes(term)) {
            relevanceScore += 3;
          }
        });

        // Check content relevance
        if (fileData.functions) {
          fileData.functions.forEach(func => {
            expandedTerms.forEach(term => {
              if (func.name.toLowerCase().includes(term) || 
                  func.description?.toLowerCase().includes(term)) {
                relevanceScore += 2;
              }
            });
          });
        }

        if (relevanceScore > 0) {
          relevantFiles.push({
            path: filePath,
            score: relevanceScore,
            type: fileData.type,
            functions: fileData.functions || [],
            lastModified: fileData.lastModified
          });
        }
      }

      // Sort by relevance and limit results
      return relevantFiles
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('❌ RAG file search error:', error.message);
      return [];
    }
  }

  // Get file content for RAG context
  async getFileContentForRAG(filePath, maxSize = 50000) {
    try {
      if (!FileAccessService.isSafePath(filePath) || 
          FileAccessService.isProtectedFile(filePath)) {
        return null;
      }

      const content = await FileAccessService.readFile(filePath);

      // Truncate if too large
      if (content.length > maxSize) {
        return content.substring(0, maxSize) + '\n... [truncated]';
      }

      return content;
    } catch (error) {
      console.error(`❌ Error reading file for RAG: ${filePath}`, error.message);
      return null;
    }
  }
}

module.exports = new CodeIndexService();
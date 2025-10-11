const fs = require('fs/promises');
const path = require('path');

const MAX_DEPTH = 6;
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'build',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
  '.output',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.yaml',
  '.yml',
  '.env',
  '.config',
]);

const SCAN_TARGETS = [
  { root: 'src', module: 'frontend' },
  { root: 'backend', module: 'backend' },
  { root: 'ai-service', module: 'ai-service' },
];

const CONFIG_FILE_GLOBS = [
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json',
  'package.json',
  'vite.config.mts',
  'tsconfig.json',
];

const PROCESS_ENV_REGEX = /process(?:\?\.|\.)env(?:\?\.|\.)?([A-Z0-9_.:-]{2,128})/g;
const PROCESS_ENV_BRACKET_REGEX = /process(?:\?\.|\.)env\[['"]([A-Z0-9_.:-]{2,128})['"]\]/g;
const IMPORT_META_REGEX = /import\.meta(?:\?\.|\.)env(?:\?\.|\.)?(VITE_[A-Z0-9_.:-]{1,124})/g;
const SECRETS_PLACEHOLDER_REGEX = /\{\{\s*secrets\.([A-Z0-9_.:-]{2,128})\s*\}\}/g;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class SecretsScanner {
  constructor() {
    this.repoRoot = path.join(__dirname, '..', '..');
  }

  async collectFiles(targetRoot, depth = 0) {
    const resolvedRoot = path.join(this.repoRoot, targetRoot);
    const results = [];

    try {
      await fs.access(resolvedRoot);
    } catch (error) {
      return results;
    }

    const traverse = async (currentPath, currentDepth) => {
      if (currentDepth > MAX_DEPTH) {
        return;
      }

      let entries;
      try {
        entries = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (error) {
        return;
      }

      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await traverse(entryPath, currentDepth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!SUPPORTED_EXTENSIONS.has(ext) && currentDepth > 0) {
            continue;
          }
          results.push(entryPath);
        }
      }
    };

    await traverse(resolvedRoot, 0);
    return results;
  }

  async collectConfigFiles() {
    const files = [];
    for (const fileName of CONFIG_FILE_GLOBS) {
      const filePath = path.join(this.repoRoot, fileName);
      try {
        await fs.access(filePath);
        files.push(filePath);
      } catch (error) {
        // ignore missing files
      }
    }
    return files;
  }

  async readFileSafe(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length > 2 * 1024 * 1024) {
        return null;
      }
      return buffer.toString('utf8');
    } catch (error) {
      return null;
    }
  }

  extractKeys(content) {
    if (!content) return [];
    const keys = new Map();

    const capture = (regex) => {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        if (!keys.has(key)) {
          keys.set(key, []);
        }
        const line = content.substring(0, match.index).split(/\r?\n/).length;
        keys.get(key).push(line);
      }
    };

    capture(PROCESS_ENV_REGEX);
    capture(PROCESS_ENV_BRACKET_REGEX);
    capture(IMPORT_META_REGEX);
    capture(SECRETS_PLACEHOLDER_REGEX);

    return Array.from(keys.entries()).map(([key, lines]) => ({ key, lines }));
  }

  determineModule(relativePath) {
    if (relativePath.startsWith('src/')) return 'frontend';
    if (relativePath.startsWith('backend/')) return 'backend';
    if (relativePath.startsWith('ai-service/')) return 'ai-service';
    return 'config';
  }

  async indexRepository() {
    const usages = new Map();

    const recordUsage = (key, relativePath) => {
      if (!usages.has(key)) {
        usages.set(key, { locations: new Set(), modules: new Set() });
      }
      const entry = usages.get(key);
      entry.locations.add(relativePath);
      entry.modules.add(this.determineModule(relativePath));
    };

    const processFile = async (filePath) => {
      const content = await this.readFileSafe(filePath);
      if (!content) return;
      const { repoRoot } = this;
      const relativePath = path.relative(repoRoot, filePath);
      const entries = this.extractKeys(content);
      for (const { key } of entries) {
        recordUsage(key, relativePath);
      }
    };

    for (const target of SCAN_TARGETS) {
      const files = await this.collectFiles(target.root);
      for (const file of files) {
        await processFile(file);
      }
    }

    const configFiles = await this.collectConfigFiles();
    for (const file of configFiles) {
      await processFile(file);
    }

    return usages;
  }

  async getUsageIndex() {
    const catalogue = await this.indexRepository();
    const output = new Map();
    for (const [key, value] of catalogue.entries()) {
      output.set(key, {
        foundIn: Array.from(value.locations).sort(),
        modules: Array.from(value.modules),
      });
    }
    return output;
  }

  async scanForMissing(knownKeys = new Set()) {
    const usages = await this.getUsageIndex();

    const missing = [];
    for (const [key, info] of usages.entries()) {
      if (!knownKeys.has(key)) {
        missing.push({
          key,
          foundIn: info.foundIn,
          suggestion: {
            scope: 'app',
            visibility: 'hidden',
          },
        });
      }
    }

    missing.sort((a, b) => a.key.localeCompare(b.key));
    return { missing };
  }

  async findKeyUsages(targetKey) {
    const regex = new RegExp(`(process\\.env\\.|import\\.meta\\.env\\.)${escapeRegex(targetKey)}`, 'g');
    const placeholderRegex = new RegExp(`secrets\\.${escapeRegex(targetKey)}`, 'g');
    const occurrences = {
      frontend: [],
      backend: [],
      'ai-service': [],
    };

    const inspectFile = async (filePath) => {
      const content = await this.readFileSafe(filePath);
      if (!content) return;
      const relativePath = path.relative(this.repoRoot, filePath);
      const moduleName = this.determineModule(relativePath);
      if (!occurrences[moduleName]) {
        return;
      }

      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (regex.test(line) || placeholderRegex.test(line) || line.includes(targetKey)) {
          occurrences[moduleName].push({
            file: relativePath,
            line: index + 1,
            context: line.trim().slice(0, 200),
          });
        }
        regex.lastIndex = 0;
        placeholderRegex.lastIndex = 0;
      });
    };

    for (const target of SCAN_TARGETS) {
      const files = await this.collectFiles(target.root);
      for (const file of files) {
        await inspectFile(file);
      }
    }

    const configFiles = await this.collectConfigFiles();
    for (const file of configFiles) {
      await inspectFile(file);
    }

    Object.keys(occurrences).forEach((moduleKey) => {
      occurrences[moduleKey].sort((a, b) => {
        if (a.file === b.file) {
          return a.line - b.line;
        }
        return a.file.localeCompare(b.file);
      });
    });

    return occurrences;
  }
}

module.exports = new SecretsScanner();

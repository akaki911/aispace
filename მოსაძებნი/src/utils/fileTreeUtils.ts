import { FileNode, FileCategory } from '../types/fileTree';

// Georgian text detection utility
export const isGeorgianText = (text: string): boolean => {
  const georgianPattern = /[\u10A0-\u10FF]/;
  return georgianPattern.test(text);
};

// Simplified Georgian filename handling for better compatibility
export const encodeForHeader = (text: string): string => {
  try {
    // For Georgian text, use simpler approach - just URL encode
    if (isGeorgianText(text)) {
      console.log('📁 Encoding Georgian filename:', text);
      // Use standard URL encoding for Georgian text
      return encodeURIComponent(text);
    }

    // For other text, use standard URL encoding
    return encodeURIComponent(text);
  } catch (e) {
    console.warn('Failed to encode text for header:', e);
    // Fallback: use the text as-is
    return text;
  }
};

// UTF-8 safe text decoding
export const decodeUTF8 = (text: string): string => {
  try {
    if (isGeorgianText(text)) {
      return text; // Already properly decoded
    }
    return decodeURIComponent(escape(text));
  } catch (e) {
    return text;
  }
};

// Enhanced file categorization
export const categorizeFile = (fileName: string, isDirectory: boolean = false): FileCategory => {
  const fullName = fileName.toLowerCase();

  if (isDirectory) {
    const sourceDirectories = new Set([
      'src', 'ai', 'ai-service', 'backend', 'frontend', 'functions',
      'middleware', 'routes', 'scripts', 'docs', 'public', 'attached_assets',
      'logs', 'memory_data', 'memory_facts', 'groq_response_errors', 'components'
    ]);
    return sourceDirectories.has(fullName) ? 'source' : 'other';
  }

  // Packager files
  const packagerFiles = new Set([
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.upm'
  ]);
  if (packagerFiles.has(fullName) || fullName === 'node_modules') {
    return 'packager';
  }

  // Config files
  const configFiles = new Set([
    '.replit', '.gitignore', 'firebase.json', 'firestore.indexes.json',
    'firestore.rules', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json',
    'vite.config.mts', 'tailwind.config.js', 'postcss.config.cjs', 'eslint.config.mjs',
    'index.html'
  ]);
  if (configFiles.has(fullName)) {
    return 'config';
  }

  // System files
  const systemFiles = new Set([
    '.env', '.env.example', 'readme.md', 'required_secrets.md',
    'replit_secrets_setup.md'
  ]);
  if (systemFiles.has(fullName) || fullName.includes('.env')) {
    return 'system';
  }

  return 'other';
};

// Validate and transform node structure with enhanced categorization
export const validateAndTransformNode = (node: any): FileNode | null => {
  if (!node || typeof node !== 'object') {
    return null;
  }

  if (!node.name || typeof node.name !== 'string') {
    return null;
  }

  if (!node.path || typeof node.path !== 'string') {
    return null;
  }

  if (!node.type || (node.type !== 'file' && node.type !== 'directory')) {
    return null;
  }

  const isHidden = node.name.startsWith('.') || node.name.startsWith('_') ||
                   node.name === 'node_modules' || node.name === '.git';

  const systemFiles = ['.env', '.env.example', '.gitignore', '.replit', 'REQUIRED_SECRETS.md'];
  const isSystemFile = systemFiles.includes(node.name) || node.name.includes('.env');

  const category = categorizeFile(node.name, node.type === 'directory');

  const validatedNode: FileNode = {
    name: node.name,
    path: node.path,
    type: node.type,
    size: typeof node.size === 'number' ? node.size : undefined,
    lastModified: typeof node.lastModified === 'string' ? node.lastModified : undefined,
    isSystemFile,
    isHidden,
    category
  };

  if (node.type === 'directory' && Array.isArray(node.children)) {
    const validChildren = node.children
      .map(validateAndTransformNode)
      .filter((child: FileNode | null): child is FileNode => child !== null);
    validatedNode.children = validChildren;
  }

  return validatedNode;
};

// Enhanced language detection for Monaco Editor
export const getMonacoLanguage = (fileName: string): string => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const fullName = fileName.toLowerCase();

  if (fullName.includes('dockerfile')) return 'dockerfile';
  if (fullName === '.gitignore') return 'ignore';
  if (fullName.includes('.env')) return 'shell';

  const languageMap: Record<string, string> = {
    'tsx': 'typescript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'js': 'javascript',
    'json': 'json',
    'md': 'markdown',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'py': 'python',
    'yml': 'yaml',
    'yaml': 'yaml',
    'php': 'php',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'dart': 'dart'
  };

  return languageMap[ext] || 'plaintext';
};

// Enhanced file sorting with improved categories
export const sortAndGroupNodes = (nodes: FileNode[]): FileNode[] => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  return safeNodes
    .filter(node => node && typeof node === 'object' && node.name && node.path && node.type)
    .sort((a, b) => {
      // First sort by type: directories before files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      // Then by category priority
      const categoryPriority = {
        'source': 1,
        'config': 2,
        'packager': 3,
        'other': 4,
        'system': 5
      };

      const categoryA = categoryPriority[a.category || 'other'];
      const categoryB = categoryPriority[b.category || 'other'];

      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }

      // Finally by name (case-insensitive)
      return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    });
};

// Storage keys for localStorage
export const STORAGE_KEYS = {
  EXPANDED_FOLDERS: 'fileTree-expanded',
  OPEN_TABS: 'fileTree-tabs',
  ACTIVE_TAB: 'fileTree-activeTab'
};
// Safe file system utilities for self-improvement system
// Includes security allowlist but not enforced yet

import * as fs from 'fs';
import * as path from 'path';

// Safety allowlist - approved project directories for modifications
export const SAFE_PROJECT_ROOTS: string[] = [
  'ai-service/',
  'backend/',
  'src/',
  'services/',
  'components/',
  'utils/',
  'routes/',
  'middleware/',
  'lib/',
  'types/',
  'hooks/'
];

/**
 * Safe file reading utility
 * TODO: Implement path validation against allowlist
 */
export async function safeReadFile(filePath: string): Promise<string> {
  try {
    // TODO: Validate path against SAFE_PROJECT_ROOTS
    const normalizedPath = path.normalize(filePath);
    const content = await fs.promises.readFile(normalizedPath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Safe file writing utility  
 * TODO: Implement path validation and backup creation
 */
export async function safeWriteFile(filePath: string, content: string): Promise<void> {
  try {
    // TODO: Validate path against SAFE_PROJECT_ROOTS
    // TODO: Create backup before writing
    const normalizedPath = path.normalize(filePath);
    await fs.promises.writeFile(normalizedPath, content, 'utf-8');
    console.log(`File written safely: ${normalizedPath}`);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Check if file path is within approved project directories
 * Currently returns true - validation to be implemented
 */
export function isPathSafe(filePath: string): boolean {
  // TODO: Implement actual path validation
  const normalizedPath = path.normalize(filePath);

  // For now, allow all paths (stub implementation)
  // Future: Check if path starts with any SAFE_PROJECT_ROOTS
  console.log(`Path safety check: ${normalizedPath} - ALLOWED (stub)`);
  return true;
}

/**
 * Create backup of file before modification
 * Stub implementation - no actual backup yet
 */
export async function createBackup(filePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;

  console.log(`Backup would be created: ${filePath} -> ${backupPath}`);
  // TODO: Implement actual backup creation

  return backupPath;
}

/**
 * Recursively scan directory for files matching patterns
 * Safe directory traversal utility
 */
export async function safeScanDirectory(
  directory: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await safeScanDirectory(fullPath, extensions);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${directory}:`, error);
  }

  return files;
}

/**
 * Validate file extension for code files
 */
export function isCodeFile(filePath: string): boolean {
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.rs'];
  const ext = path.extname(filePath).toLowerCase();
  return codeExtensions.includes(ext);
}

/**
 * Get relative path from project root
 */
export function getRelativePath(fullPath: string): string {
  const projectRoot = process.cwd();
  return path.relative(projectRoot, fullPath);
}

export function isPathAllowed(filePath: string, allowlist?: string[]): boolean {
  // Use provided allowlist or default security rules
  if (allowlist && allowlist.length > 0) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return allowlist.some(allowed => {
      const normalizedAllowed = allowed.replace(/\\/g, '/');
      return normalizedPath.startsWith(normalizedAllowed) ||
             normalizedPath.includes(normalizedAllowed) ||
             minimatch(normalizedPath, normalizedAllowed);
    });
  }

  // Default security check - prevent access to sensitive files
  const deniedPaths = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'node_modules/',
    '.git/',
    'package-lock.json',
    'yarn.lock',
    'build/',
    'dist/',
    '.next/',
    'coverage/',
    '.nyc_output/',
    'secret',
    'secrets/',
    'private/',
    'temp/',
    'tmp/',
    '*.key',
    '*.pem',
    '*.p12',
    '*.pfx'
  ];

  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

  return !deniedPaths.some(denied => {
    const normalizedDenied = denied.toLowerCase();
    if (normalizedDenied.includes('*')) {
      return minimatch(normalizedPath, normalizedDenied);
    }
    return normalizedPath.includes(normalizedDenied);
  });
}

export function getFileAllowlist(): Set<string> {
  // Define allowed directories/files for AI modifications
  const allowlist = [
    'src/**/*',
    'components/**/*',
    'pages/**/*',
    'utils/**/*',
    'lib/**/*',
    'hooks/**/*',
    'services/**/*',
    'types/**/*',
    'styles/**/*',
    'ai-service/**/*',
    'backend/routes/**/*',
    'backend/services/**/*',
    'backend/utils/**/*',
    'backend/middleware/**/*',
    '*.md',
    '*.txt',
    '*.json',
    '*.js',
    '*.ts',
    '*.tsx',
    '*.jsx',
    '*.css',
    '*.scss',
    '*.less'
  ];

  return new Set(allowlist);
}

// Simple minimatch implementation for basic glob pattern matching
function minimatch(str: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(str);
}
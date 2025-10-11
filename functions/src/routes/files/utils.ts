import type { Response } from 'express';
import { promises as fs } from 'fs';
import { openSync, readSync, closeSync, constants as fsConstants } from 'fs';
import { join, normalize, relative, resolve, sep, extname, posix as posixPath } from 'path';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  children?: FileTreeNode[];
}

export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const resolveAllowedPersonalId = (): string | undefined => {
  const candidates = ['ADMIN_ALLOWED_PERSONAL_ID', 'VITE_ALLOWED_PERSONAL_ID', 'ALLOWED_PERSONAL_ID'];

  for (const key of candidates) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const allowedPersonalId = resolveAllowedPersonalId();

const PRIVILEGED_ROLES = new Set([
  'DEVELOPER',
  'SUPER_ADMIN',
  'SUPERADMIN',
]);

export const PROJECT_ROOT = (() => {
  if (process.env.CODE_ROOT) {
    return resolve(process.env.CODE_ROOT);
  }
  if (process.env.AISPACE_PROJECT_ROOT) {
    return resolve(process.env.AISPACE_PROJECT_ROOT);
  }
  // When compiled, this file lives under functions/lib/routes/files.
  // Walk up to repository root.
  return resolve(__dirname, '../../../..');
})();

const PROTECTED_DIRECTORIES = new Set(
  [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.cache',
    'coverage',
    '.nyc_output',
    'logs',
    '.vscode',
    '.replit',
    '.config',
    'attached_assets',
    'memory_data',
    'memory_facts',
    '.assistant_backups',
    'groq_response_errors',
  ].map((entry) => entry.toLowerCase()),
);

const PROTECTED_FILES = new Set(
  [
    'firebase-adminsdk.json',
  ].map((entry) => entry.toLowerCase()),
);

const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /firebase-adminsdk\.json$/i,
  /private-key/i,
  /password\.txt$/i,
];

const SKIP_ENTRIES = new Set(
  [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.cache',
    'coverage',
    '.nyc_output',
    'logs',
    '.vscode',
    '.replit',
    '.config',
    'attached_assets',
    'memory_data',
    'memory_facts',
    '.assistant_backups',
    'groq_response_errors',
    'package-lock.json',
  ].map((entry) => entry.toLowerCase()),
);

export const ALLOWED_TEXT_EXTENSIONS = new Set(
  [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.json',
    '.md',
    '.txt',
    '.css',
    '.html',
    '.xml',
    '.yml',
    '.yaml',
    '.sql',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.h',
    '.cs',
    '.php',
    '.rb',
    '.go',
    '.rs',
    '.swift',
    '.kt',
    '.dart',
    '.sh',
  ].map((ext) => ext.toLowerCase()),
);

const MAX_PATH_LENGTH = 4096; // POSIX upper-bound.

const sanitizeName = (name: string): string => {
  return name.replace(/[\x00-\x1f\x7f]/g, '').trim();
};

const toUnixPath = (input: string): string => input.split(/\\+/g).join('/');

export const ensureDeveloperAccess = (res: Response): void => {
  const locals = res.locals as { auth?: { roles?: unknown; personalId?: unknown } };
  const auth = locals.auth;

  if (!auth) {
    throw new HttpError(401, 'unauthenticated');
  }

  if (allowedPersonalId) {
    const personalId = typeof auth.personalId === 'string' ? auth.personalId.trim() : undefined;
    if (personalId && personalId !== allowedPersonalId) {
      throw new HttpError(403, 'forbidden');
    }
  }

  const roles = Array.isArray(auth.roles)
    ? auth.roles.map((role) => String(role).toUpperCase())
    : typeof auth.roles === 'string'
      ? [String(auth.roles).toUpperCase()]
      : [];

  if (!roles.some((role) => PRIVILEGED_ROLES.has(role))) {
    throw new HttpError(403, 'forbidden');
  }
};

export const normaliseRequestedPath = (rawInput: string): string => {
  const cleaned = rawInput
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  if (cleaned.includes('~')) {
    throw new HttpError(400, 'invalid_path');
  }

  const normalisedRaw = normalize(cleaned).replace(/^([/\\])+/, '').replace(/^(\.\/)+/, '');
  const normalised = toUnixPath(normalisedRaw);

  if (!normalised || normalised === '.' || normalised === './') {
    return '';
  }

  if (
    normalised.startsWith('..') ||
    normalised.includes('/../') ||
    normalised.endsWith('/..')
  ) {
    throw new HttpError(400, 'invalid_path');
  }

  if (normalised.length > MAX_PATH_LENGTH) {
    throw new HttpError(400, 'path_too_long');
  }

  return normalised;
};

const assertWithinProjectRoot = (absolutePath: string) => {
  const relativePath = relative(PROJECT_ROOT, absolutePath);
  if (
    relativePath.startsWith('..') ||
    relativePath.includes(`..${sep}`) ||
    relativePath.includes(`${sep}..`)
  ) {
    throw new HttpError(400, 'access_denied');
  }
  if (!absolutePath.startsWith(PROJECT_ROOT)) {
    throw new HttpError(400, 'access_denied');
  }
};

const assertNotProtected = (relativePath: string) => {
  if (!relativePath) {
    return;
  }
  const segments = relativePath.split('/').filter(Boolean).map((segment) => segment.toLowerCase());
  if (segments.some((segment) => PROTECTED_DIRECTORIES.has(segment))) {
    throw new HttpError(403, 'access_denied');
  }

  const fileName = segments[segments.length - 1];
  if (fileName && PROTECTED_FILES.has(fileName)) {
    throw new HttpError(403, 'access_denied');
  }

  if (fileName) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(fileName)) {
        throw new HttpError(403, 'access_denied');
      }
    }
  }
};

export const resolveProjectPath = (requestedPath: string): { absolute: string; relative: string } => {
  const normalised = normaliseRequestedPath(requestedPath);
  const absolute = resolve(PROJECT_ROOT, normalised || '.');

  assertWithinProjectRoot(absolute);
  assertNotProtected(normalised);

  return { absolute, relative: normalised };
};

export const shouldSkipEntry = (entryName: string): boolean => {
  return SKIP_ENTRIES.has(entryName.toLowerCase());
};

export const formatRelativePath = (basePath: string, entryName: string): string => {
  const safeName = sanitizeName(entryName);
  if (!basePath) {
    return safeName;
  }
  return posixPath.join(basePath, safeName);
};

export const buildFileTree = async (directory: string, basePath = ''): Promise<FileTreeNode[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    const absoluteChild = join(directory, entry.name);
    const relativePath = formatRelativePath(basePath, entry.name);

    try {
      const stats = await fs.stat(absoluteChild);
      if (stats.isDirectory()) {
        assertNotProtected(relativePath);
        const children = await buildFileTree(absoluteChild, relativePath);
        nodes.push({
          name: sanitizeName(entry.name),
          path: relativePath,
          type: 'directory',
          children,
        });
      } else if (stats.isFile()) {
        assertNotProtected(relativePath);
        nodes.push({
          name: sanitizeName(entry.name),
          path: relativePath,
          type: 'file',
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        });
      }
    } catch {
      // Ignore entries that cannot be read (e.g., permissions, broken symlinks).
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
};

export const detectBinaryFile = (filePath: string): boolean => {
  let fd: number | null = null;
  try {
    fd = openSync(filePath, fsConstants.O_RDONLY);
    const buffer = Buffer.alloc(1024);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    for (let index = 0; index < bytesRead; index += 1) {
      const byte = buffer[index];
      if (byte === 0) {
        return true;
      }
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // Ignore close errors.
      }
    }
  }
};

export const ensureTextFileExtension = (relativePath: string): void => {
  if (!relativePath) {
    return;
  }
  const extension = extname(relativePath).toLowerCase();
  if (extension && !ALLOWED_TEXT_EXTENSIONS.has(extension)) {
    throw new HttpError(415, `extension_not_allowed:${extension}`);
  }
};

export const decodePathParameter = (rawPath: string): string => {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
};

export const countTreeItems = (nodes: FileTreeNode[]): number => {
  return nodes.reduce((total, node) => {
    if (node.type === 'directory' && node.children) {
      return total + 1 + countTreeItems(node.children);
    }
    return total + 1;
  }, 0);
};

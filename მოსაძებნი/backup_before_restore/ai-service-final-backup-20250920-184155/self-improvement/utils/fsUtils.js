"use strict";
// Safe file system utilities for self-improvement system
// Includes security allowlist but not enforced yet
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_PROJECT_ROOTS = void 0;
exports.safeReadFile = safeReadFile;
exports.safeWriteFile = safeWriteFile;
exports.isPathSafe = isPathSafe;
exports.createBackup = createBackup;
exports.safeScanDirectory = safeScanDirectory;
exports.isCodeFile = isCodeFile;
exports.getRelativePath = getRelativePath;
exports.isPathAllowed = isPathAllowed;
exports.getFileAllowlist = getFileAllowlist;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Safety allowlist - approved project directories for modifications
exports.SAFE_PROJECT_ROOTS = [
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
async function safeReadFile(filePath) {
    try {
        // TODO: Validate path against SAFE_PROJECT_ROOTS
        const normalizedPath = path.normalize(filePath);
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');
        return content;
    }
    catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
}
/**
 * Safe file writing utility
 * TODO: Implement path validation and backup creation
 */
async function safeWriteFile(filePath, content) {
    try {
        // TODO: Validate path against SAFE_PROJECT_ROOTS
        // TODO: Create backup before writing
        const normalizedPath = path.normalize(filePath);
        await fs.promises.writeFile(normalizedPath, content, 'utf-8');
        console.log(`File written safely: ${normalizedPath}`);
    }
    catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        throw error;
    }
}
/**
 * Check if file path is within approved project directories
 * Currently returns true - validation to be implemented
 */
function isPathSafe(filePath) {
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
async function createBackup(filePath) {
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
async function safeScanDirectory(directory, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
    const files = [];
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
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    catch (error) {
        console.error(`Error scanning directory ${directory}:`, error);
    }
    return files;
}
/**
 * Validate file extension for code files
 */
function isCodeFile(filePath) {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.rs'];
    const ext = path.extname(filePath).toLowerCase();
    return codeExtensions.includes(ext);
}
/**
 * Get relative path from project root
 */
function getRelativePath(fullPath) {
    const projectRoot = process.cwd();
    return path.relative(projectRoot, fullPath);
}
function isPathAllowed(filePath, allowlist) {
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
function getFileAllowlist() {
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
    return allowlist;
}
// Simple minimatch implementation for basic glob pattern matching
function minimatch(str, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(str);
}

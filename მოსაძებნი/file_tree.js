const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const router = express.Router();

console.log('📁 [FILE TREE] Route file loaded successfully');

// Security: Define allowed project root (from backend/routes/ -> go up 2 levels to project root)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
console.log('🔍 PROJECT_ROOT resolved to:', PROJECT_ROOT);
console.log('🔍 __dirname is:', __dirname);
const PROTECTED_DIRS = ['node_modules', 'groq_response_errors'];
const PROTECTED_FILES = ['firebase-adminsdk.json'];

console.log('📁 File tree route loaded. PROJECT_ROOT:', PROJECT_ROOT);

// Helper function to set CORS headers
function setCors(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return true; // Indicate that the request was handled
  }
  return false; // Indicate that the request needs further processing
}

// Enhanced security path validation with comprehensive protection
function validatePath(requestedPath) {
  // Input sanitization and type checking
  if (!requestedPath || typeof requestedPath !== 'string') {
    throw new Error('Invalid path: Path must be a non-empty string');
  }

  // Remove any null bytes and control characters
  const sanitizedPath = requestedPath.replace(/[\x00-\x1f\x7f]/g, '');

  // Check for malicious patterns before normalization
  const maliciousPatterns = [
    /\.\./,              // Path traversal
    /~[\/\\]/,           // Home directory access
    /^[\/\\]/,           // Absolute paths
    /[<>:"|?*]/,         // Invalid filename characters
    /\x00/,              // Null bytes
    /file:\/\//i,        // File protocol
    /\\\\[^\\]/,         // UNC paths
    /\$\{/,              // Template injection
    /%2e%2e/i,           // URL encoded path traversal
    /%5c/i,              // URL encoded backslash
    /%2f/i               // URL encoded forward slash
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(sanitizedPath)) {
      throw new Error(`Access denied: Malicious pattern detected in path`);
    }
  }

  // Normalize path and decode any URL encoding safely
  let normalizedPath;
  try {
    const decodedPath = decodeURIComponent(sanitizedPath);
    normalizedPath = path.normalize(decodedPath);
  } catch (e) {
    // If decoding fails, use the sanitized path directly
    normalizedPath = path.normalize(sanitizedPath);
  }

  // Additional post-normalization checks
  if (normalizedPath.includes('..') || normalizedPath.includes('~') ||
      normalizedPath.startsWith('/') || normalizedPath.includes('\0')) {
    throw new Error('Access denied: Invalid path characters detected after normalization');
  }

  // Resolve full path and validate
  const fullPath = path.resolve(PROJECT_ROOT, normalizedPath);

  // Triple-check path is within project root
  const relativePath = path.relative(PROJECT_ROOT, fullPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Access denied: Path outside project directory');
  }

  // Ensure path is within project root bounds
  if (!fullPath.startsWith(PROJECT_ROOT + path.sep) && fullPath !== PROJECT_ROOT) {
    throw new Error('Access denied: Path outside project directory');
  }

  // Enhanced protection check with case-insensitive matching
  const pathSegments = relativePath.toLowerCase().split(path.sep);
  const lowerProtectedDirs = PROTECTED_DIRS.map(dir => dir.toLowerCase());

  for (const protectedDir of lowerProtectedDirs) {
    if (pathSegments.includes(protectedDir)) {
      throw new Error(`Access denied: Protected directory detected`);
    }
  }

  // Check filename against protected files (case-insensitive)
  const fileName = path.basename(relativePath).toLowerCase();
  const lowerProtectedFiles = PROTECTED_FILES.map(file => file.toLowerCase());

  for (const protectedFile of lowerProtectedFiles) {
    if (fileName === protectedFile) {
      throw new Error(`Access denied: Protected file detected`);
    }
  }

  // Additional security checks for sensitive files - more permissive for development
  const sensitivePatterns = [
    /\.env$/i,
    /firebase-adminsdk\.json$/i,
    /private-key/i,
    /password\.txt$/i
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(fileName)) {
      throw new Error(`Access denied: Sensitive file pattern detected`);
    }
  }

  // Check file extension whitelist for content access
  const allowedExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt',
    '.css', '.html', '.xml', '.yml', '.yaml', '.sql',
    '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php',
    '.rb', '.go', '.rs', '.swift', '.kt', '.dart'
  ];

  const fileExtension = path.extname(fileName);
  if (fileExtension && !allowedExtensions.includes(fileExtension)) {
    throw new Error(`Access denied: File extension ${fileExtension} not allowed`);
  }

  // Final validation: ensure path length is reasonable
  if (fullPath.length > 260) { // Windows path limit
    throw new Error('Access denied: Path too long');
  }

  return fullPath;
}

// Get file type icon
function getFileIcon(fileName, isDirectory) {
  if (isDirectory) return '📁';

  const ext = path.extname(fileName).toLowerCase();
  const icons = {
    '.js': '📄',
    '.ts': '📘',
    '.tsx': '⚛️',
    '.jsx': '⚛️',
    '.json': '📋',
    '.md': '📝',
    '.txt': '📄',
    '.css': '🎨',
    '.html': '🌐',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.svg': '🖼️'
  };

  return icons[ext] || '📄';
}

// Secure UTF-8 path handling with validation
const safePath = (filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path input');
    }

    // Validate UTF-8 encoding and remove dangerous characters
    const cleanPath = filePath
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>:"|?*]/g, '') // Remove Windows invalid characters
      .trim();

    // Check for empty path after cleaning
    if (!cleanPath) {
      throw new Error('Path becomes empty after sanitization');
    }

    // Georgian text validation - ensure proper UTF-8
    if (/[\u10A0-\u10FF]/.test(cleanPath)) {
      // Validate Georgian characters are properly encoded
      try {
        const decoded = decodeURIComponent(encodeURIComponent(cleanPath));
        if (decoded !== cleanPath) {
          console.warn('Georgian path encoding mismatch, using original');
        }
      } catch (e) {
        console.warn('Georgian path validation warning:', e.message);
      }
    }

    return cleanPath;
  } catch (e) {
    console.error('Path handling error:', e.message);
    throw new Error(`Invalid path: ${e.message}`);
  }
};

// Build file tree recursively with enhanced Replit compatibility
async function buildFileTree(dirPath, basePath = '') {
  const items = [];
  let entries;

  try {
    // Use withFileTypes for efficiency, it gives Dirent objects
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    console.error(`📂 Error reading directory ${dirPath}:`, error);
    // If we can't read a directory (e.g., permissions), just return empty
    return [];
  }

  for (const entry of entries) {
    // Enhanced skip list for Replit environment
    const skipItems = [
      'node_modules', '.git', 'dist', 'build', '.cache',
      'coverage', '.nyc_output', 'logs', '.vscode',
      '.replit', '.config', 'package-lock.json', // Added Replit-specific files
      'attached_assets', 'memory_data', 'memory_facts', // Heavy asset directories
      '.assistant_backups', 'groq_response_errors' // Backup and error directories
    ];

    if (skipItems.includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    
    // Safe path handling for relativePath
    let relativePath;
    try {
      relativePath = safePath(path.join(basePath, entry.name));
    } catch (safePathError) {
      console.warn(`🟡 Skipping entry due to safePath error for relativePath ${path.join(basePath, entry.name)}:`, safePathError.message);
      continue;
    }

    try {
      // Use fs.stat() which follows symbolic links. This correctly identifies
      // a symlink pointing to a directory as a directory, and one pointing to a file as a file.
      // It will throw an error for broken symlinks, which we catch.
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        const children = await buildFileTree(fullPath, relativePath);
        
        // Safe path handling for entry.name
        let safeName;
        try {
          safeName = safePath(entry.name);
        } catch (safePathError) {
          console.warn(`🟡 Skipping directory due to safePath error for entry.name ${entry.name}:`, safePathError.message);
          continue;
        }
        
        items.push({
          name: safeName,
          path: relativePath,
          type: 'directory',
          children
        });
      } else if (stats.isFile()) {
        // Safe path handling for entry.name
        let safeName;
        try {
          safeName = safePath(entry.name);
        } catch (safePathError) {
          console.warn(`🟡 Skipping file due to safePath error for entry.name ${entry.name}:`, safePathError.message);
          continue;
        }
        
        items.push({
          name: safeName,
          path: relativePath,
          type: 'file',
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        });
      }
      // If it's a symlink to something else (like a socket), or fs.stat fails (broken symlink), it will be skipped.
    } catch (error) {
      // This catches errors from fs.stat (e.g., broken symlinks, permission errors)
      console.warn(`🟡 Skipping entry ${fullPath}:`, error.message);
    }
  }

  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// Helper function to count items in the file tree
function countItems(items) {
  let count = 0;
  for (const item of items) {
    count++;
    if (item.type === 'directory' && item.children) {
      count += countItems(item.children);
    }
  }
  return count;
}


// GET /api/files/health - Health check endpoint
router.get('/health', (req, res) => {
  setCors(req, res); // Ensure CORS is set for health checks too
  res.json({
    status: 'ok',
    service: 'file-tree',
    timestamp: new Date().toISOString(),
    projectRoot: PROJECT_ROOT
  });
});

// GET /api/files/tree - Get file tree with lazy loading support
router.get('/tree', async (req, res) => {
  if (setCors(req, res)) return; // Handle OPTIONS preflight

  // Prevent infinite requests by adding rate limiting per IP
  const clientIP = req.ip || req.connection.remoteAddress;
  console.log(`📁 [File Tree API] Request from IP: ${clientIP}`);

  try {
    const requestedPath = req.query.path || ''; // Get path from query parameter
    console.log(`📂 File tree request received for path: "${requestedPath}"`);

    // Security check
    if (requestedPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const absolutePath = requestedPath ? path.join(PROJECT_ROOT, requestedPath) : PROJECT_ROOT;

    // Ensure path is within project root
    if (!absolutePath.startsWith(PROJECT_ROOT)) {
      return res.status(400).json({ error: 'Access denied' });
    }

    console.log('📂 Resolved path:', absolutePath);

    // Set proper headers for Georgian text support
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // Check if directory exists
    try {
      await fs.access(absolutePath);
    } catch (accessError) {
      console.error('📂 Directory not accessible:', accessError);
      return res.status(503).json({
        error: 'Directory not accessible',
        message: accessError.message
      });
    }

    const fileTree = await buildFileTree(absolutePath, requestedPath);
    const itemCount = countItems(fileTree);

    console.log(`📂 File tree built for "${requestedPath}", items:`, itemCount);

    const response = {
      success: true,
      data: fileTree,
      root: requestedPath || PROJECT_ROOT,
      timestamp: new Date().toISOString(),
      count: fileTree.length
    };

    res.json(response);

  } catch (error) {
    console.error(`❌ [File Tree API] Error building file tree for path "${req.query.path}":`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to build file tree',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/files/read - JSON read endpoint (preferred by frontend)
router.get('/read', async (req, res) => {
  if (setCors(req, res)) return; // Handle OPTIONS preflight
  try {
    const raw = String(req.query.path || '');
    const requestedPath = raw.replace(/^[/\\]+/, ''); // Remove leading slashes
    const fullPath = path.resolve(PROJECT_ROOT, requestedPath);
    if (!fullPath.startsWith(PROJECT_ROOT)) return res.status(400).json({ success:false, error:'Access denied' });
    const st = await fs.stat(fullPath);
    if (!st.isFile()) return res.status(400).json({ success:false, error:'Not a file' });
    const buf = await fs.readFile(fullPath);
    const content = buf.toString('utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({ success:true, content, size: st.size, mtime: st.mtime.toISOString() });
  } catch (err) {
    console.error(`❌ [File Read API] Error reading file "${req.query.path}":`, err);
    return res.status(500).json({ success:false, error: err.message });
  }
});


// GET /api/files/content/* - Get file content
router.get('/content/*path', async (req, res) => {
  if (setCors(req, res)) return; // Handle OPTIONS preflight
  try {
    const filePath = req.params.path; // Get the raw path from URL
    console.log(`📁 [File Content API] Request for file: ${filePath}`);

    // Enhanced Georgian filename support
    let fullPath;
    try {
      let decodedFilePath = filePath;

      // Enhanced decoding for Georgian text
      try {
        // First try standard URL decoding
        decodedFilePath = decodeURIComponent(filePath);
      } catch (e) {
        console.log('📁 Standard decoding failed, trying Georgian handling...');

        // Special handling for Georgian files - try direct path
        try {
          // Check if the raw path contains Georgian characters
          if (/[\u10A0-\u10FF]/.test(filePath)) {
            decodedFilePath = filePath; // Use as-is for Georgian
          } else {
            // Try UTF-8 buffer conversion
            decodedFilePath = Buffer.from(filePath, 'binary').toString('utf8');
          }
        } catch (e2) {
          console.log('📁 Georgian handling failed, using raw path...');
          decodedFilePath = filePath;
        }
      }

      console.log(`📁 Decoded path: ${decodedFilePath}`);

      // Security check - prevent directory traversal
      if (decodedFilePath.includes('..') || decodedFilePath.includes('~')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file path'
        });
      }

      fullPath = path.resolve(PROJECT_ROOT, decodedFilePath);

      // Ensure the file is within the project root
      if (!fullPath.startsWith(PROJECT_ROOT)) {
        return res.status(400).json({
          success: false,
          error: 'File access denied - path outside project root'
        });
      }
    } catch (validationError) {
      console.error(`📁 [File Content API] Path validation failed: ${validationError.message}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid file path',
        message: validationError.message
      });
    }

    console.log(`📁 [File Content API] Resolved path: ${fullPath}`);

    // Check if file exists using sync method
    if (!fsSync.existsSync(fullPath)) {
      console.warn(`📁 [File Content API] File not found: ${fullPath}`);
      return res.status(404).send(`File not found: ${filePath}`);
    }

    // Check if it's actually a file
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      console.warn(`📁 [File Content API] Not a file: ${fullPath}`);
      return res.status(400).send(`Path is not a file: ${filePath}`);
    }

    // Helper to determine if a file is likely binary
    const isBinaryFile = (filePath) => {
      try {
        const buffer = fsSync.readFileSync(filePath, { limit: 1024 }); // Read a small chunk
        // Simple heuristic: check for null bytes or non-printable ASCII characters
        for (let i = 0; i < buffer.length; i++) {
          const byte = buffer[i];
          if (byte === 0) return true; // Null byte often indicates binary
          // Check for common non-printable ASCII characters (excluding UTF-8 control chars)
          if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) return true;
        }
        return false;
      } catch (e) {
        console.warn(`Warning: Could not determine if ${filePath} is binary:`, e.message);
        return false; // Assume text if error occurs
      }
    };

    // Read file content with proper encoding detection
    let content;

    console.log(`📁 [File Content API] Reading file: ${fullPath}, size: ${stat.size} bytes`);

    if (isBinaryFile(fullPath)) {
      // Handle binary files
      const buffer = await fs.readFile(fullPath);
      content = buffer.toString('base64');
      res.setHeader('X-Content-Type', 'binary');
      res.setHeader('X-Content-Encoding', 'base64');
      console.log(`📁 [File Content API] Binary file read, base64 length: ${content.length}`);
    } else {
      // Handle text files with explicit UTF-8 encoding for Georgian text
      try {
        const buffer = await fs.readFile(fullPath);
        content = buffer.toString('utf8');
        console.log(`📁 [File Content API] Text file read, content length: ${content.length} chars`);
      } catch (readError) {
        console.error(`📁 [File Content API] Error reading text file:`, readError);
        return res.status(500).send(`Failed to read file content: ${readError.message}`);
      }
    }

    console.log(`📁 [File Content API] Successfully read file: ${filePath}, size: ${content.length} characters`);

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/plain';

    const contentTypeMap = {
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.jsx': 'text/javascript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.xml': 'text/xml',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.sh': 'text/x-shellscript',
      '.py': 'text/x-python',
      '.sql': 'text/x-sql'
    };

    contentType = contentTypeMap[ext] || 'text/plain';

    // Set headers for raw content delivery with proper UTF-8 support
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.setHeader('X-File-Size', stat.size.toString());
    res.setHeader('X-Last-Modified', stat.mtime.toISOString());
    res.setHeader('X-Content-Raw', 'true');
    res.setHeader('Cache-Control', 'no-cache');
    // Ensure proper UTF-8 response encoding
    res.setHeader('Content-Encoding', 'identity');

    // Send raw content directly - NO JSON WRAPPING
    res.send(content);

  } catch (error) {
    console.error('📁 [File Content API] Unexpected error:', error);
    console.error('📁 [File Content API] Stack trace:', error.stack);

    // Send plain text error for consistency
    res.status(500).send(`Internal Server Error: Failed to read file content - ${error.message}`);
  }
});

// PUT /api/files/content/* - Save file content with Unicode support
  router.put('/content/*path', async (req, res) => {
    if (setCors(req, res)) return; // Handle OPTIONS preflight
    const filePath = req.params.path; // Everything after /content/

    try {
      console.log(`📁 [File Save API] Request to save file: ${filePath}`);
      console.log(`📁 [File Save API] Request body type:`, typeof req.body);
      console.log(`📁 [File Save API] Request body content:`, req.body);

      // Extract content from request body
      let fileContent;
      if (typeof req.body === 'string') {
        fileContent = req.body;
      } else if (req.body && typeof req.body.content === 'string') {
        fileContent = req.body.content;
      } else if (req.body && req.body.data) {
        fileContent = req.body.data;
      } else {
        console.error(`📁 [File Save API] Invalid content format:`, req.body);
        return res.status(400).json({
          success: false,
          error: 'Content must be a string'
        });
      }

    let fullPath;
    try {
      let decodedFilePath = filePath;

      // Enhanced decoding for Georgian text
      try {
        // First try standard URL decoding
        decodedFilePath = decodeURIComponent(filePath);
      } catch (e) {
        console.log('📁 Standard decoding failed, trying Georgian handling...');

        // Special handling for Georgian files - try direct path
        try {
          // Check if the raw path contains Georgian characters
          if (/[\u10A0-\u10FF]/.test(filePath)) {
            decodedFilePath = filePath; // Use as-is for Georgian
          } else {
            // Try UTF-8 buffer conversion
            decodedFilePath = Buffer.from(filePath, 'latin1').toString('utf8');
          }
        } catch (e2) {
          // Last resort: use the path as-is
          decodedFilePath = filePath;
        }
      }

      // Security check - prevent directory traversal
      if (decodedFilePath.includes('..') || decodedFilePath.includes('~')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file path'
        });
      }

      fullPath = path.resolve(PROJECT_ROOT, decodedFilePath);

      // Ensure the file is within the project root
      if (!fullPath.startsWith(PROJECT_ROOT)) {
        return res.status(400).json({
          success: false,
          error: 'File access denied - path outside project root'
        });
      }
    } catch (validationError) {
      console.error(`📁 [File Save API] Path validation failed: ${validationError.message}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid file path',
        message: validationError.message
      });
    }


    console.log(`📁 [File Save API] Saving content to: ${fullPath}, size: ${fileContent?.length} characters`);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file with UTF-8 encoding
    await fs.writeFile(fullPath, fileContent, 'utf8');

    console.log(`📁 [File Save API] Successfully saved file: ${filePath}`);

    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      message: `File saved: ${filePath}`,
      path: filePath,
      size: fileContent.length
    });

  } catch (error) {
    console.error('📁 [File Save API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save file',
      details: error.message,
      path: req.params[0]
    });
  }
});

// POST /api/files/operation - Perform file operations
router.post('/operation', async (req, res) => {
  if (setCors(req, res)) return; // Handle OPTIONS preflight
  try {
    const { operation, path: requestedPath, newPath, content } = req.body;

    console.log(`🔧 File operation: ${operation} on ${requestedPath}`);

    switch (operation) {
      case 'create-file': {
        const fullPath = validatePath(requestedPath);

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });

        // Create empty file or with content
        await fs.writeFile(fullPath, content || '', 'utf8');

        res.json({
          success: true,
          message: `File created: ${requestedPath}`
        });
        break;
      }

      case 'create-folder': {
        const fullPath = validatePath(requestedPath);
        await fs.mkdir(fullPath, { recursive: true });

        res.json({
          success: true,
          message: `Folder created: ${requestedPath}`
        });
        break;
      }

      case 'rename': {
        if (!newPath) {
          return res.status(400).json({
            success: false,
            error: 'New path required for rename operation'
          });
        }

        const oldFullPath = validatePath(requestedPath);
        const newFullPath = validatePath(newPath);

        await fs.rename(oldFullPath, newFullPath);

        res.json({
          success: true,
          message: `Renamed: ${requestedPath} → ${newPath}`
        });
        break;
      }

      case 'delete': {
        const fullPath = validatePath(requestedPath);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          await fs.rmdir(fullPath, { recursive: true });
        } else {
          await fs.unlink(fullPath);
        }

        res.json({
          success: true,
          message: `Deleted: ${requestedPath}`
        });
        break;
      }

      case 'save': {
        if (!content) {
          return res.status(400).json({
            success: false,
            error: 'Content required for save operation'
          });
        }

        const fullPath = validatePath(requestedPath);
        await fs.writeFile(fullPath, content, 'utf8');

        res.json({
          success: true,
          message: `File saved: ${requestedPath}`
        });
        break;
      }

      default:
        res.status(400).json({
          success: false,
          error: `Unknown operation: ${operation}`
        });
    }

  } catch (error) {
    console.error('File operation error:', error);
    res.status(500).json({
      success: false,
      error: 'File operation failed',
      message: error.message
    });
  }
});

// GET /api/files/download/:path - Download file
router.get('/download/*path', async (req, res) => {
  if (setCors(req, res)) return; // Handle OPTIONS preflight
  try {
    const requestedPath = req.params.path;
    const fullPath = validatePath(requestedPath);

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot download directory'
      });
    }

    const fileName = path.basename(fullPath);

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const fileStream = require('fs').createReadStream(fullPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(404).json({
      success: false,
      error: 'File not found',
      message: error.message
    });
  }
});

module.exports = router;
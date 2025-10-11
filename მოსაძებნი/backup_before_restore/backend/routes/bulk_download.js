const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');
const router = express.Router();

console.log('📦 [BULK DOWNLOAD] Route loaded - Optimized ZIP creation');

// Security: Use same PROJECT_ROOT as file_tree.js for consistency  
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PROTECTED_DIRS = ['node_modules', 'groq_response_errors', '.git', 'dist', 'build'];
const PROTECTED_FILES = ['firebase-adminsdk.json', '.env', '.env.local', '.env.production'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file limit
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total limit

// Enhanced security path validation (same as file_tree.js)
function validatePath(requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') {
    throw new Error('Invalid path: Path must be a non-empty string');
  }

  const sanitizedPath = requestedPath.replace(/[\x00-\x1f\x7f]/g, '');

  const maliciousPatterns = [
    /\.\./,              
    /~[\/\\]/,           
    /^[\/\\]/,           
    /[<>:"|?*]/,         
    /\x00/,              
    /file:\/\//i,        
    /\\\\[^\\]/,         
    /\$\{/,              
    /%2e%2e/i,           
    /%5c/i,              
    /%2f/i               
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(sanitizedPath)) {
      throw new Error(`Access denied: Malicious pattern detected in path`);
    }
  }

  let normalizedPath;
  try {
    const decodedPath = decodeURIComponent(sanitizedPath);
    normalizedPath = path.normalize(decodedPath);
  } catch (e) {
    normalizedPath = path.normalize(sanitizedPath);
  }

  if (normalizedPath.includes('..') || normalizedPath.includes('~') ||
      normalizedPath.startsWith('/') || normalizedPath.includes('\0')) {
    throw new Error('Access denied: Invalid path characters detected after normalization');
  }

  const fullPath = path.resolve(PROJECT_ROOT, normalizedPath);
  const relativePath = path.relative(PROJECT_ROOT, fullPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Access denied: Path outside project directory');
  }

  if (!fullPath.startsWith(PROJECT_ROOT + path.sep) && fullPath !== PROJECT_ROOT) {
    throw new Error('Access denied: Path must be within project bounds');
  }

  return { fullPath, relativePath };
}

// Check if path should be excluded for security or performance
function shouldExclude(filePath, fileName) {
  // Exclude protected directories
  const pathSegments = filePath.split(path.sep);
  if (pathSegments.some(segment => PROTECTED_DIRS.includes(segment))) {
    return true;
  }

  // Exclude protected files
  if (PROTECTED_FILES.includes(fileName)) {
    return true;
  }

  // Exclude hidden files and directories (starting with .)
  if (fileName.startsWith('.') && fileName !== '.gitignore' && fileName !== '.env.example') {
    return true;
  }

  // Exclude large binary files by extension
  const largeExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.zip', '.rar', '.7z', '.tar.gz', '.deb', '.rpm'];
  const ext = path.extname(fileName).toLowerCase();
  if (largeExtensions.includes(ext)) {
    return true;
  }

  return false;
}

// Recursively collect all files to be archived with size checks
async function collectFiles(dirPath, relativePath = '') {
  const files = [];
  let totalSize = 0;

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;

      // Skip excluded items
      if (shouldExclude(itemPath, item.name)) {
        console.log(`⚠️ [BULK] Excluding: ${itemRelativePath} (protected/hidden)`);
        continue;
      }

      try {
        const stats = await fs.stat(itemPath);

        if (item.isDirectory()) {
          // Recursively collect from subdirectory
          const subFiles = await collectFiles(itemPath, itemRelativePath);
          files.push(...subFiles.files);
          totalSize += subFiles.totalSize;
        } else if (item.isFile()) {
          // Check file size limits
          if (stats.size > MAX_FILE_SIZE) {
            console.log(`⚠️ [BULK] Skipping large file: ${itemRelativePath} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
            continue;
          }

          files.push({
            fullPath: itemPath,
            relativePath: itemRelativePath,
            size: stats.size
          });
          totalSize += stats.size;

          // Check total size limit
          if (totalSize > MAX_TOTAL_SIZE) {
            console.warn(`⚠️ [BULK] Total size limit exceeded at ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
            break;
          }
        }
      } catch (statError) {
        console.warn(`⚠️ [BULK] Cannot stat ${itemPath}:`, statError.message);
      }
    }
  } catch (readdirError) {
    console.warn(`⚠️ [BULK] Cannot read directory ${dirPath}:`, readdirError.message);
  }

  return { files, totalSize };
}

// POST /api/bulk/download - Create and stream ZIP archive
router.post('/download', async (req, res) => {
  console.log('📦 [BULK DOWNLOAD] ZIP creation request received');
  
  try {
    const startTime = Date.now();

    // Collect all files to be archived
    console.log('📊 [BULK] Scanning project files...');
    const { files, totalSize } = await collectFiles(PROJECT_ROOT);

    console.log(`📊 [BULK] Found ${files.length} files, total size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No files found to archive'
      });
    }

    // Set response headers for streaming ZIP
    const zipFileName = `gurulo-workspace-${new Date().toISOString().split('T')[0]}.zip`;
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName}"`,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    });

    // Create ZIP archive with streaming
    const archive = archiver('zip', {
      zlib: { level: 3 }, // Balanced compression (faster than level 9)
      forceLocalTime: true,
      store: true // Store small files without compression for speed
    });

    let filesProcessed = 0;
    let filesSkipped = 0;

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('❌ [BULK] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Archive creation failed' });
      }
    });

    // Handle archive warnings (non-fatal)
    archive.on('warning', (warning) => {
      console.warn('⚠️ [BULK] Archive warning:', warning);
    });

    // Track progress
    archive.on('entry', (entry) => {
      filesProcessed++;
      if (filesProcessed % 50 === 0) {
        console.log(`📈 [BULK] Progress: ${filesProcessed}/${files.length} files added`);
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive with batching for memory efficiency
    const BATCH_SIZE = 20;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      for (const file of batch) {
        try {
          // Check if file still exists (might have been deleted during scan)
          const stats = await fs.stat(file.fullPath);
          
          // Add file to archive using stream for memory efficiency
          const fileStream = fsSync.createReadStream(file.fullPath);
          archive.append(fileStream, { 
            name: file.relativePath,
            date: stats.mtime
          });
        } catch (fileError) {
          console.warn(`⚠️ [BULK] Cannot add file ${file.relativePath}:`, fileError.message);
          filesSkipped++;
        }
      }

      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Finalize archive
    await archive.finalize();

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`✅ [BULK] ZIP creation completed in ${duration.toFixed(1)}s`);
    console.log(`📊 [BULK] Stats: ${filesProcessed} files processed, ${filesSkipped} skipped`);
    console.log(`📦 [BULK] Archive size: ${(archive.pointer() / 1024 / 1024).toFixed(1)}MB`);

  } catch (error) {
    console.error('❌ [BULK] ZIP creation error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to create ZIP archive',
        details: error.message
      });
    }
  }
});

module.exports = router;
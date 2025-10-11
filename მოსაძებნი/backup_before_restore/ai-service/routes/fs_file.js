const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// GET /api/fs/file?path=<relativePath>
router.get('/', async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    const projectRoot = process.cwd();
    const fullPath = path.join(projectRoot, filePath);

    // Enhanced security validation
    if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - path outside project directory'
      });
    }

    // Additional security checks
    const fileName = path.basename(filePath);
    const sensitivePatterns = [
      /\.env/i, /secret/i, /private/i, /key/i, /token/i,
      /credential/i, /password/i, /admin/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(fileName)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - sensitive file detected'
        });
      }
    }

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - invalid path characters'
      });
    }

    try {
      const stats = await fs.stat(fullPath);

      if (!stats.isFile()) {
        return res.status(400).json({
          success: false,
          error: 'Path is not a file'
        });
      }

      const content = await fs.readFile(fullPath, 'utf8');

      res.json({
        success: true,
        data: {
          content: content,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          path: filePath
        }
      });
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      throw fileError;
    }
  } catch (error) {
    console.error('File read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read file',
      message: error.message
    });
  }
});

// POST /api/fs/file?path=<relativePath>
router.post('/', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    const { content } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    if (content === undefined) {
      return res.status(400).json({
        success: false,
        error: 'File content is required'
      });
    }

    const projectRoot = process.cwd();
    const fullPath = path.join(projectRoot, filePath);

    // Enhanced security validation
    if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - path outside project directory'
      });
    }

    // Additional security checks
    const fileName = path.basename(filePath);
    const sensitivePatterns = [
      /\.env/i, /secret/i, /private/i, /key/i, /token/i,
      /credential/i, /password/i, /admin/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(fileName)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - sensitive file detected'
        });
      }
    }

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - invalid path characters'
      });
    }

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    await fs.mkdir(dirPath, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf8');

    const stats = await fs.stat(fullPath);

    res.json({
      success: true,
      data: {
        path: filePath,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        message: 'File saved successfully'
      }
    });
  } catch (error) {
    console.error('File write error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save file',
      message: error.message
    });
  }
});

// Protected files that AI cannot access
const PROTECTED_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  'firebase-admin-key.json',
  '.gitignore'
];

// Get file content (alternative endpoint)
router.get('/file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Check if file is protected
    const fileName = path.basename(filePath);
    if (PROTECTED_FILES.includes(fileName)) {
      return res.status(403).json({ error: 'Access denied to protected file' });
    }

    const projectRoot = path.join(__dirname, '../../');
    const fullPath = path.join(projectRoot, filePath);

    // Ensure the path is within the project directory
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Additional security checks
    if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - path outside project directory'
      });
    }

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - invalid path characters'
      });
    }


    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (error) {
    console.error('Failed to read file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Save file content (alternative endpoint)
router.post('/file', async (req, res) => {
  try {
    const filePath = req.query.path;
    const { content } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Check if file is protected
    const fileName = path.basename(filePath);
    if (PROTECTED_FILES.includes(fileName)) {
      return res.status(403).json({ error: 'Cannot modify protected file' });
    }

    const projectRoot = path.join(__dirname, '../../');
    const fullPath = path.join(projectRoot, filePath);

    // Ensure the path is within the project directory
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Additional security checks
    if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - path outside project directory'
      });
    }

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - invalid path characters'
      });
    }

    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

module.exports = router;
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Save file endpoint
router.post('/save', async (req, res) => {
  try {
    console.log('💾 File save request received');

    const { path: filePath, content } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        success: false,
        error: 'File content is required'
      });
    }

    const projectRoot = process.cwd();
    const fullPath = path.join(projectRoot, filePath);

    // Security check - ensure file is within project directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(projectRoot);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      console.error('❌ Security violation: attempted to write outside project directory');
      return res.status(403).json({
        success: false,
        error: 'Access denied - path outside project directory'
      });
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Create backup if file exists
    try {
      const exists = await fs.access(fullPath);
      const backupPath = `${fullPath}.backup.${Date.now()}`;
      await fs.copyFile(fullPath, backupPath);
      console.info(`📋 Backup created: ${backupPath}`);
    } catch (error) {
      // File doesn't exist, no backup needed
    }

    // Write file
    await fs.writeFile(fullPath, content, 'utf8');

    console.info(`✅ File saved successfully: ${filePath}`);

    res.json({
      success: true,
      message: 'File saved successfully',
      path: filePath,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ File save error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save file',
      details: error.message
    });
  }
});

module.exports = router;
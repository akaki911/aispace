const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Get project statistics
router.get('/stats', async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '../..');

    // Count files by type
    const stats = {
      totalFiles: 0,
      directories: 0,
      codeFiles: 0,
      configFiles: 0,
      lastUpdate: new Date().toISOString()
    };

    const countFiles = async (dir) => {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;

        if (item.isDirectory()) {
          stats.directories++;
          await countFiles(path.join(dir, item.name));
        } else {
          stats.totalFiles++;
          const ext = path.extname(item.name);
          if (['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp'].includes(ext)) {
            stats.codeFiles++;
          } else if (['.json', '.yaml', '.yml', '.xml', '.config'].includes(ext)) {
            stats.configFiles++;
          }
        }
      }
    };

    await countFiles(projectRoot);
    res.json(stats);
  } catch (error) {
    console.error('Developer stats error:', error);
    res.status(500).json({ error: 'Failed to get project stats' });
  }
});

// Get AI Developer panel status
router.get('/ai-developer/status', async (req, res) => {
  try {
    const status = {
      aiService: {
        status: 'checking',
        port: 5001,
        health: null
      },
      backend: {
        status: 'healthy',
        port: 5002,
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    };

    // Check AI service health
    try {
      const fetch = (await import('node-fetch')).default;
      const aiResponse = await fetch('http://0.0.0.0:5001/health', { 
        timeout: 3000,
        headers: { 'User-Agent': 'Backend-Health-Check' }
      });
      
      if (aiResponse.ok) {
        status.aiService.health = await aiResponse.json();
        status.aiService.status = 'healthy';
        status.aiService.url = 'http://0.0.0.0:5001';
      } else {
        status.aiService.status = 'error';
        status.aiService.error = `HTTP ${aiResponse.status}`;
      }
    } catch (error) {
      status.aiService.status = 'unavailable';
      status.aiService.error = error.message;
      console.warn('AI Service health check failed:', error.message);
    }

    res.json(status);
  } catch (error) {
    console.error('AI Developer status error:', error);
    res.status(500).json({ error: 'Failed to get AI developer status' });
  }
});

// Get file content
router.get('/file-content', async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    const projectRoot = path.resolve(__dirname, '../..');
    const absolutePath = path.resolve(projectRoot, filePath);

    // Security check
    if (!absolutePath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(absolutePath, 'utf8');

    res.json({
      success: true,
      content,
      path: filePath
    });
  } catch (error) {
    console.error('File content error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to read file',
      message: error.message 
    });
  }
});

module.exports = router;
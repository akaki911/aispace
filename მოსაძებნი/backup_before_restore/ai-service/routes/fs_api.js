const express = require('express');
const { searchByName, readFileUtf8 } = require('../tools/fs_reader');
const router = express.Router();

/**
 * SOL-212 Gurulo File System API
 * Secure UTF-8 file access with Georgian support
 */

// GET /api/fs/search?q=... → {success, matches:[{path, rel, size, mtime}]}
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 1 || q.length > 256) {
      return res.status(400).json({
        success: false,
        error: 'Query must be 1-256 characters'
      });
    }
    
    console.log(`🔍 [FS API] Searching for: "${q}"`);
    
    const matches = await searchByName(q);
    
    res.json({
      success: true,
      query: q,
      matches: matches.map(match => ({
        path: match.path,
        rel: match.rel,
        size: match.size,
        mtime: match.mtime
      })),
      count: matches.length
    });
    
  } catch (error) {
    console.error('🚨 [FS API] Search error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

// GET /api/fs/file?path=<urlencoded>&encoding=utf8&include=content
router.get('/file', async (req, res) => {
  try {
    const { path: filePath, encoding = 'utf8', include } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'Path parameter required'
      });
    }
    
    if (encoding !== 'utf8') {
      return res.status(400).json({
        success: false,
        error: 'Only UTF-8 encoding supported'
      });
    }
    
    const decodedPath = decodeURIComponent(filePath);
    console.log(`📖 [FS API] Reading file: "${decodedPath}"`);
    
    // For Gurulo, default to meta only unless explicitly requested
    const includeContent = include === 'content';
    
    const result = await readFileUtf8(decodedPath, includeContent);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('🚨 [FS API] File read error:', error.message);
    res.status(500).json({
      success: false,
      error: 'File read failed'
    });
  }
});

module.exports = router;
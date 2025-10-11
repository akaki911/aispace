const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();

const ALLOWED = ['.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.css', '.html', '.txt'];
const ROOT = path.resolve(__dirname, '../../');

async function walk(dir, results = []) {
  try {
    const list = await fs.readdir(dir);
    for (const file of list) {
      const full = path.join(dir, file);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', '.vite', 'dist', 'build'].includes(file)) {
            await walk(full, results);
          }
        } else if (ALLOWED.includes(path.extname(file))) {
          results.push(full);
        }
      } catch (e) {
        // Skip files we can't access
        continue;
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }
  return results;
}

async function searchFile(filePath, query) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        matches.push({ 
          lineNumber: i + 1, 
          content: lines[i].trim()
        });
        if (matches.length >= 5) break;
      }
    }

    if (matches.length) {
      return {
        file: filePath.replace(ROOT + '/', ''),
        lines: matches,
      };
    }
  } catch (e) {
    // Skip files we can't read
  }
  return null;
}

// Add logging to debug route registration
console.log('🔍 File search route being registered...');

router.get('/search', async (req, res) => {
  console.log('🔍 Search endpoint hit:', {
    method: req.method,
    url: req.url,
    query: req.query,
    originalUrl: req.originalUrl
  });
  console.log('🔍 File search endpoint accessed:', req.query);
  try {
    const q = req.query.q;
    const limit = parseInt(req.query.limit || '50');

    if (!q) {
      return res.status(400).json({ error: 'Missing q parameter' });
    }

    console.log(`🔍 File search request: "${q}" (limit: ${limit})`);

    const files = await walk(ROOT);
    console.log(`📁 Found ${files.length} files to search`);

    const result = [];

    for (const file of files) {
      const match = await searchFile(file, q);
      if (match) {
        result.push(match);
        if (result.length >= limit) break;
      }
    }

    console.log(`✅ Search completed: ${result.length} matches found`);
    res.json(result);
  } catch (error) {
    console.error('❌ File search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
});

module.exports = router;
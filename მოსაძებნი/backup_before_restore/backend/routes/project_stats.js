const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Calculate project statistics
const calculateStats = async (dirPath, stats = { totalFiles: 0, totalLines: 0, languages: {} }) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files and node_modules
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist') {
        continue;
      }

      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        await calculateStats(fullPath, stats);
      } else {
        stats.totalFiles++;

        // Get file extension
        const ext = path.extname(item.name).toLowerCase();
        const language = getLanguageFromExtension(ext);

        if (language) {
          stats.languages[language] = (stats.languages[language] || 0) + 1;

          // Count lines for code files
          if (isCodeFile(ext)) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const lines = content.split('\n').length;
              stats.totalLines += lines;
            } catch (error) {
              // Skip files that can't be read
            }
          }
        }
      }
    }

    return stats;
  } catch (error) {
    console.error(`Error calculating stats for ${dirPath}:`, error);
    return stats;
  }
};

const getLanguageFromExtension = (ext) => {
  const langMap = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.less': 'LESS',
    '.json': 'JSON',
    '.xml': 'XML',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.md': 'Markdown',
    '.sh': 'Shell',
    '.sql': 'SQL'
  };

  return langMap[ext] || null;
};

const isCodeFile = (ext) => {
  const codeExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
    '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.html', '.css', '.scss',
    '.less', '.json', '.xml', '.yml', '.yaml', '.sh', '.sql'
  ];

  return codeExtensions.includes(ext);
};

// GET /api/project/stats - Get project statistics
router.get('/stats', async (req, res) => {
  try {
    const projectRoot = process.cwd();
    const stats = await calculateStats(projectRoot);

    // Add last modified time
    const packageJsonPath = path.join(projectRoot, 'package.json');
    let lastModified = new Date().toISOString();

    try {
      const packageStat = await fs.stat(packageJsonPath);
      lastModified = packageStat.mtime.toISOString();
    } catch (error) {
      // Fallback to current time if package.json doesn't exist
    }

    res.json({
      success: true,
      stats: {
        ...stats,
        lastModified
      }
    });
  } catch (error) {
    console.error('Project stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate project statistics'
    });
  }
});

module.exports = router;
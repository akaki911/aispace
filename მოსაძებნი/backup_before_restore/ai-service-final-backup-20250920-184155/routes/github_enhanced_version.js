
const express = require('express');
const router = express.Router();
const { requireAssistantAuth } = require('../middleware/authz');
const { requireEnv } = require('../lib/requireEnv');
const { getAllPaginated } = require('../lib/githubClient');

class EnhancedGitHubVersionService {
  constructor() {
    const cfg = requireEnv(); // Validate environment variables
    this.cfg = cfg;
    this.githubToken = cfg.GITHUB_TOKEN;
    this.repoOwner = cfg.GITHUB_OWNER;
    this.repoName = cfg.GITHUB_REPO;
  }

  async makeGitHubRequest(endpoint, options = {}) {
    const url = `https://api.github.com${endpoint}`;
    const headers = {
      'Authorization': `token ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gurula-AI-Assistant',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('GitHub API request failed:', error);
      throw error;
    }
  }

  async getEnhancedFileHistory(filePath) {
    try {
      // Get comprehensive commit history for file using pagination
      const commits = await getAllPaginated(
        `/repos/${this.repoOwner}/${this.repoName}/commits`, 
        { path: filePath, per_page: 100 }
      );

      const enhancedHistory = [];
      
      for (const commit of commits) {
        try {
          // Get detailed commit info
          const commitDetails = await this.makeGitHubRequest(
            `/repos/${this.repoOwner}/${this.repoName}/commits/${commit.sha}`
          );

          // Get file content at this commit
          const fileContent = await this.getFileAtCommit(filePath, commit.sha);
          
          enhancedHistory.push({
            hash: commit.sha,
            shortHash: commit.sha.substring(0, 8),
            message: commit.commit.message,
            author: {
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              avatar: commit.author?.avatar_url
            },
            timestamp: commit.commit.author.date,
            stats: commitDetails.stats || { additions: 0, deletions: 0, total: 0 },
            changes: this.extractFileChanges(commitDetails.files, filePath),
            size: fileContent?.size || 0,
            url: commit.html_url,
            verified: commit.commit.verification?.verified || false
          });
        } catch (error) {
          console.warn(`Failed to get details for commit ${commit.sha}:`, error.message);
        }
      }

      return {
        success: true,
        filePath,
        totalCommits: enhancedHistory.length,
        history: enhancedHistory
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getFileAtCommit(filePath, commitSha) {
    try {
      return await this.makeGitHubRequest(
        `/repos/${this.repoOwner}/${this.repoName}/contents/${encodeURIComponent(filePath)}?ref=${commitSha}`
      );
    } catch (error) {
      return null;
    }
  }

  extractFileChanges(files, targetPath) {
    const file = files?.find(f => f.filename === targetPath);
    if (!file) return { additions: 0, deletions: 0, changes: 0 };

    return {
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      status: file.status
    };
  }

  async generateEnhancedDiff(filePath, fromVersion, toVersion) {
    try {
      // Get GitHub's compare API for rich diff data
      const comparison = await this.makeGitHubRequest(
        `/repos/${this.repoOwner}/${this.repoName}/compare/${fromVersion}...${toVersion}`
      );

      const targetFile = comparison.files?.find(f => f.filename === filePath);
      if (!targetFile) {
        throw new Error(`File ${filePath} not found in comparison`);
      }

      // Parse the GitHub patch format into our visual diff format
      const diffLines = this.parseGitHubPatch(targetFile.patch || '');
      
      return {
        success: true,
        diff: diffLines,
        metadata: {
          fromVersion: fromVersion.substring(0, 8),
          toVersion: toVersion.substring(0, 8),
          filePath,
          stats: {
            additions: targetFile.additions,
            deletions: targetFile.deletions,
            changes: targetFile.changes
          },
          status: targetFile.status,
          blob_url: targetFile.blob_url
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  parseGitHubPatch(patch) {
    const lines = patch.split('\n');
    const diffLines = [];
    let lineNumber = 1;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Extract line numbers from hunk header
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          lineNumber = parseInt(match[2]);
        }
        continue;
      }

      if (line.startsWith('+')) {
        diffLines.push({
          type: 'added',
          content: line.substring(1),
          lineNumber: lineNumber++
        });
      } else if (line.startsWith('-')) {
        diffLines.push({
          type: 'removed',
          content: line.substring(1),
          lineNumber: lineNumber
        });
      } else if (line.startsWith(' ')) {
        diffLines.push({
          type: 'context',
          content: line.substring(1),
          lineNumber: lineNumber++
        });
      }
    }

    return diffLines;
  }

  async restoreFileFromGitHub(filePath, commitSha) {
    try {
      const fileContent = await this.getFileAtCommit(filePath, commitSha);
      
      if (!fileContent) {
        throw new Error('File not found at specified commit');
      }

      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      
      return {
        success: true,
        message: `File ${filePath} restored to commit ${commitSha.substring(0, 8)}`,
        content,
        commitSha,
        restoredFrom: {
          sha: commitSha,
          size: fileContent.size,
          url: fileContent.html_url
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const enhancedVersionService = new EnhancedGitHubVersionService();

// Enhanced file history endpoint
router.get('/enhanced-history/:path(*)', requireAssistantAuth, async (req, res) => {
  try {
    const filePath = req.params.path;
    const result = await enhancedVersionService.getEnhancedFileHistory(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced diff endpoint
router.post('/enhanced-diff', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, fromVersion, toVersion } = req.body;
    const result = await enhancedVersionService.generateEnhancedDiff(filePath, fromVersion, toVersion);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced restoration endpoint
router.post('/enhanced-restore', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, commitSha } = req.body;
    const result = await enhancedVersionService.restoreFileFromGitHub(filePath, commitSha);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

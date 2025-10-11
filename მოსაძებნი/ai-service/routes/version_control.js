const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { requireAssistantAuth } = require('../middleware/authz');

// GitHub API integration for enhanced version control
class GitHubVersionService {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_REPO_OWNER || 'bakhmaro';
    this.repoName = process.env.GITHUB_REPO_NAME || 'gurulo-ai';
    this.projectRoot = process.cwd();
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

  async getFileCommitHistory(filePath) {
    try {
      // Get commits for specific file from GitHub API
      const commits = await this.makeGitHubRequest(
        `/repos/${this.repoOwner}/${this.repoName}/commits?path=${encodeURIComponent(filePath)}&per_page=50`
      );

      const fileHistory = [];

      for (const commit of commits) {
        try {
          // Get detailed commit info
          const commitDetails = await this.makeGitHubRequest(
            `/repos/${this.repoOwner}/${this.repoName}/commits/${commit.sha}`
          );

          // Get file content at this commit
          const fileContent = await this.getFileAtCommit(filePath, commit.sha);

          fileHistory.push({
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

      return fileHistory;
    } catch (error) {
      console.error('GitHub file history error:', error);
      return [];
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

  async generateGitHubDiff(filePath, fromVersion, toVersion) {
    try {
      // Get GitHub's compare API for rich diff data
      const comparison = await this.makeGitHubRequest(
        `/repos/${this.repoOwner}/${this.repoName}/compare/${fromVersion}...${toVersion}`
      );

      const targetFile = comparison.files?.find(f => f.filename === filePath);
      if (!targetFile) {
        throw new Error(`File ${filePath} not found in comparison`);
      }

      // Parse the GitHub patch format into visual diff format
      const diffLines = this.parseGitHubPatch(targetFile.patch || '');

      return {
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
      console.error('GitHub diff generation error:', error);
      throw error;
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
      const localFilePath = path.join(this.projectRoot, filePath);

      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(localFilePath), { recursive: true });

      // Write restored content
      await fs.writeFile(localFilePath, content);

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
      console.error('File restore error:', error);
      throw error;
    }
  }

  async executeGitCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.toString().trim());
        }
      });
    });
  }
}

const githubVersionService = new GitHubVersionService();

// Get recent files with changes  
router.get('/recent-files', async (req, res) => {
  try {
    const result = await versionControlService.getRecentFiles();

    // Ensure consistent response format
    if (result.success) {
      res.json({
        success: true,
        files: result.recentFiles || [],
        total: result.recentFiles?.length || 0
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to get recent files',
        files: []
      });
    }
  } catch (error) {
    console.error('Recent files error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      files: []
    });
  }
});

// Enhanced GitHub file history
router.get('/history/:path(*)', requireAssistantAuth, async (req, res) => {
  try {
    const filePath = req.params.path;
    const useGitHub = req.query.github === 'true';

    if (useGitHub && githubVersionService.githubToken) {
      // Use GitHub API for enhanced history
      const versions = await githubVersionService.getFileCommitHistory(filePath);

      res.json({
        success: true,
        filePath,
        versions,
        source: 'github',
        enhanced: true
      });
    } else {
      // Fallback to local git
      const projectRoot = process.cwd();
      const fullPath = path.join(projectRoot, filePath);

      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // Get git log for this file
      const gitCommand = `git log --follow --pretty=format:"%H|%an|%ad|%s" --date=iso -- "${filePath}"`;

      exec(gitCommand, { cwd: projectRoot }, async (error, stdout, stderr) => {
        if (error) {
          return res.status(500).json({
            success: false,
            error: 'Failed to get file history'
          });
        }

        const lines = stdout.trim().split('\n').filter(line => line);
        const versions = [];

        for (const line of lines) {
          const [hash, author, date, message] = line.split('|');

          // Get file size at this commit
          let size = 0;
          try {
            const sizeCommand = `git cat-file -s ${hash}:"${filePath}"`;
            const sizeResult = await new Promise((resolve) => {
              exec(sizeCommand, { cwd: projectRoot }, (err, sizeStdout) => {
                resolve(err ? 0 : parseInt(sizeStdout.trim()) || 0);
              });
            });
            size = sizeResult;
          } catch (e) {
            // Ignore size errors
          }

          versions.push({
            hash,
            author,
            timestamp: date,
            message,
            changes: {
              added: 0,
              deleted: 0,
              modified: 1
            },
            size
          });
        }

        res.json({
          success: true,
          filePath,
          versions,
          source: 'local'
        });
      });
    }
  } catch (error) {
    console.error('File history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Get visual diff between versions
router.post('/diff', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, fromVersion, toVersion } = req.body;
    const result = await versionControlService.getVisualDiff(filePath, fromVersion, toVersion);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced GitHub diff endpoint
router.post('/github-diff', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, fromVersion, toVersion } = req.body;

    if (!githubVersionService.githubToken) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token not configured'
      });
    }

    const diffResult = await githubVersionService.generateGitHubDiff(filePath, fromVersion, toVersion);

    res.json({
      success: true,
      ...diffResult
    });
  } catch (error) {
    console.error('GitHub diff error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate diff'
    });
  }
});

// Restore file to specific version
router.post('/restore', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, version } = req.body;
    const result = await versionControlService.restoreFileVersion(filePath, version);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GitHub file restoration
router.post('/github-restore', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, commitSha } = req.body;

    if (!githubVersionService.githubToken) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token not configured'
      });
    }

    const restoreResult = await githubVersionService.restoreFileFromGitHub(filePath, commitSha);

    res.json(restoreResult);
  } catch (error) {
    console.error('GitHub restore error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to restore file'
    });
  }
});

// Create checkpoint
router.post('/checkpoint', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await versionControlService.createCheckpoint(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get version control status
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      status: {
        versionControl: true,
        checkpointSystem: true,
        fileTracking: true,
        rollbackCapability: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent files with GitHub integration
router.get('/recent-files', requireAssistantAuth, async (req, res) => {
  try {
    const projectRoot = process.cwd();

    // Get recently modified files from git
    const gitCommand = 'git log --pretty=format: --name-only --since="7 days ago" | sort | uniq | head -20';

    exec(gitCommand, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('Git command error:', error);
        return res.json({
          success: true,
          files: [],
          source: 'fallback',
          message: 'Git not available, using fallback'
        });
      }

      const files = stdout.split('\n')
        .filter(file => file.trim())
        .filter(file => !file.startsWith('.'))
        .filter(file => file.length > 0)
        .slice(0, 15)
        .map(file => ({
          path: file,
          lastModified: new Date().toISOString(),
          type: file.includes('.') ? file.split('.').pop() : 'file'
        }));

      res.json({
        success: true,
        files,
        total: files.length,
        source: 'git',
        lastUpdate: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('Recent files error:', error);
    res.json({
      success: true,
      files: [],
      error: error.message
    });
  }
});

module.exports = router;
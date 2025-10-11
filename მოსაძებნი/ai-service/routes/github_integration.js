
const express = require('express');
const router = express.Router();
const gitHubService = require('../services/github_integration_service');
const { requireAssistantAuth } = require('../middleware/authz');

// Use requireAssistantAuth as authenticateUser
const authenticateUser = requireAssistantAuth;

// Initialize Git repository
router.post('/init', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.initializeGit();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add GitHub remote
router.post('/remote', authenticateUser, async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ success: false, error: 'Repository URL არის საჭიროს' });
    }
    
    const result = await gitHubService.addRemote(repoUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get repository status
router.get('/status', authenticateUser, async (req, res) => {
  try {
    // Get local git status
    const localStatus = await gitHubService.getStatus();
    
    // Get GitHub API status
    const githubStatus = await gitHubService.getGitHubRepoStatus();
    
    const result = {
      ...localStatus,
      github: githubStatus,
      connected: !!githubStatus,
      lastSync: githubStatus ? new Date().toISOString() : null
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Full sync to GitHub
router.post('/sync', authenticateUser, async (req, res) => {
  try {
    const { message } = req.body;
    const result = await gitHubService.fullSync(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pull from GitHub
router.post('/pull', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.pullFromGitHub();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enable auto-sync
router.post('/auto-sync/enable', authenticateUser, async (req, res) => {
  try {
    const { intervalMinutes = 5 } = req.body;
    const result = await gitHubService.enableAutoSync(intervalMinutes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disable auto-sync
router.post('/auto-sync/disable', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.disableAutoSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enable auto-commit
router.post('/auto-commit/enable', authenticateUser, async (req, res) => {
  try {
    const { intervalMinutes = 10 } = req.body;
    const result = await gitHubService.enableAutoCommit(intervalMinutes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disable auto-commit
router.post('/auto-commit/disable', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.disableAutoCommit();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual commit with custom message
router.post('/commit', authenticateUser, async (req, res) => {
  try {
    const { message } = req.body;
    const result = await gitHubService.manualCommit(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get commit statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.getCommitStats();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent commits
router.get('/commits', authenticateUser, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const result = await gitHubService.getRecentCommits(parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === BRANCH MANAGEMENT ENDPOINTS ===

// Setup branch structure
router.post('/branches/setup', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.setupBranchStructure();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create feature branch
router.post('/branches/feature', authenticateUser, async (req, res) => {
  try {
    const { featureName } = req.body;
    if (!featureName) {
      return res.status(400).json({ success: false, error: 'Feature name არის საჭირო' });
    }
    
    const result = await gitHubService.createFeatureBranch(featureName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Switch branch
router.post('/branches/switch', authenticateUser, async (req, res) => {
  try {
    const { targetBranch } = req.body;
    if (!targetBranch) {
      return res.status(400).json({ success: false, error: 'Target branch არის საჭირო' });
    }
    
    const result = await gitHubService.switchBranch(targetBranch);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List branches
router.get('/branches', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.listBranches();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get branch status
router.get('/branches/status', authenticateUser, async (req, res) => {
  try {
    const result = await gitHubService.getBranchStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Merge branch
router.post('/branches/merge', authenticateUser, async (req, res) => {
  try {
    const { sourceBranch, targetBranch } = req.body;
    if (!sourceBranch) {
      return res.status(400).json({ success: false, error: 'Source branch არის საჭირო' });
    }
    
    const result = await gitHubService.mergeBranch(sourceBranch, targetBranch);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-resolve conflicts
router.post('/branches/resolve-conflicts', authenticateUser, async (req, res) => {
  try {
    const { strategy = 'smart' } = req.body;
    const result = await gitHubService.autoResolveConflicts(strategy);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete merge
router.post('/branches/complete-merge', authenticateUser, async (req, res) => {
  try {
    const { commitMessage } = req.body;
    const result = await gitHubService.completeMerge(commitMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete feature branch
router.delete('/branches/:branchName', authenticateUser, async (req, res) => {
  try {
    const { branchName } = req.params;
    const { force = false } = req.body;
    
    const result = await gitHubService.deleteFeatureBranch(branchName, force);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced status endpoint for dashboard
router.get('/status/detailed', authenticateUser, async (req, res) => {
  try {
    const [status, branches, stats] = await Promise.all([
      gitHubService.getStatus(),
      gitHubService.listBranches(),
      gitHubService.getCommitStats()
    ]);

    res.json({
      success: true,
      status: status.success ? status : null,
      branches: branches.success ? branches.branches : null,
      stats: stats.success ? stats.stats : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

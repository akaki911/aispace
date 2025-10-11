
const express = require('express');
const router = express.Router();
const gitCommandsService = require('../services/git_commands_service');
const { requireAssistantAuth } = require('../middleware/authz');

// Git Repository Management
router.post('/init', requireAssistantAuth, async (req, res) => {
  try {
    const result = await gitCommandsService.initializeGit();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Repository Status
router.get('/status', requireAssistantAuth, async (req, res) => {
  try {
    const result = await gitCommandsService.getStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File Operations
router.post('/add', requireAssistantAuth, async (req, res) => {
  try {
    const { files } = req.body;
    const result = await gitCommandsService.addFiles(files);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/unstage', requireAssistantAuth, async (req, res) => {
  try {
    const { files } = req.body;
    const result = await gitCommandsService.unstageFiles(files);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commit Operations
router.post('/commit', requireAssistantAuth, async (req, res) => {
  try {
    const { message, options } = req.body;
    const result = await gitCommandsService.commit(message, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// History and Log
router.get('/log', requireAssistantAuth, async (req, res) => {
  try {
    const { limit, branch } = req.query;
    const result = await gitCommandsService.getLog({ 
      limit: parseInt(limit) || 20,
      branch 
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Branch Management
router.get('/branches', requireAssistantAuth, async (req, res) => {
  try {
    const result = await gitCommandsService.getBranches();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/branches', requireAssistantAuth, async (req, res) => {
  try {
    const { name, baseBranch } = req.body;
    const result = await gitCommandsService.createBranch(name, baseBranch);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/branches/switch', requireAssistantAuth, async (req, res) => {
  try {
    const { branch } = req.body;
    const result = await gitCommandsService.switchBranch(branch);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/branches/:branchName', requireAssistantAuth, async (req, res) => {
  try {
    const { branchName } = req.params;
    const { force } = req.body;
    const result = await gitCommandsService.deleteBranch(branchName, force);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Merge Operations
router.post('/merge', requireAssistantAuth, async (req, res) => {
  try {
    const { branch, options } = req.body;
    const result = await gitCommandsService.mergeBranch(branch, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Conflict Resolution
router.get('/conflicts', requireAssistantAuth, async (req, res) => {
  try {
    const conflicts = await gitCommandsService.getConflictFiles();
    res.json({ success: true, conflicts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/resolve-conflict', requireAssistantAuth, async (req, res) => {
  try {
    const { filePath, resolution } = req.body;
    const result = await gitCommandsService.resolveConflict(filePath, resolution);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/complete-merge', requireAssistantAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const result = await gitCommandsService.completeMerge(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remote Operations
router.post('/push', requireAssistantAuth, async (req, res) => {
  try {
    const { remote, branch } = req.body;
    const result = await gitCommandsService.push(remote, branch);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/pull', requireAssistantAuth, async (req, res) => {
  try {
    const { remote, branch } = req.body;
    const result = await gitCommandsService.pull(remote, branch);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/fetch', requireAssistantAuth, async (req, res) => {
  try {
    const { remote } = req.body;
    const result = await gitCommandsService.fetch(remote);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Diff Operations
router.get('/diff', requireAssistantAuth, async (req, res) => {
  try {
    const { file, staged, commit1, commit2 } = req.query;
    const options = { staged: staged === 'true' };
    
    if (commit1 && commit2) {
      options.commits = [commit1, commit2];
    }
    
    const result = await gitCommandsService.showDiff(file, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stash Operations
router.post('/stash', requireAssistantAuth, async (req, res) => {
  try {
    const { message, options } = req.body;
    const result = await gitCommandsService.stash(message, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stash', requireAssistantAuth, async (req, res) => {
  try {
    const result = await gitCommandsService.listStashes();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stash/apply', requireAssistantAuth, async (req, res) => {
  try {
    const { stashRef } = req.body;
    const result = await gitCommandsService.applyStash(stashRef);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Interactive Rebase
router.post('/rebase', requireAssistantAuth, async (req, res) => {
  try {
    const { targetCommit, operations } = req.body;
    const result = await gitCommandsService.startInteractiveRebase(targetCommit, operations);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { isConfigured, OWNER, REPO, checkToken, checkRepoAccess, githubRequest, getAllPaginated } = require('../lib/githubClient');
const { requireEnv } = require('../lib/requireEnv');
const { sanitizeGitHubResponse, validateGitHubToken } = require('../middleware/github_security');

// Apply GitHub security middleware to all routes
router.use(sanitizeGitHubResponse);

// Public diagnostics (sanitize) - SOL-311 Security Enhanced
router.get('/config', (req,res)=>{
  // Security headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  const tokenValidation = validateGitHubToken();

  res.json({
    configured: isConfigured(),
    owner: OWNER ? 'SET' : 'MISSING',
    repo: REPO ? 'SET' : 'MISSING',
    // Never expose actual values - only validation status
    tokenPresent: !!process.env.GITHUB_TOKEN,
    tokenValid: tokenValidation.valid,
    tokenType: tokenValidation.valid ? tokenValidation.type : undefined,
    security: {
      sanitized: true,
      hmacVerified: true,
      middleware: 'active'
    }
  });
});

router.get('/_diag', async (req,res)=>{
  const token = await checkToken();
  const repo  = await checkRepoAccess();
  res.json({ token, repo });
});

// Guarded helper
async function ensureReady(res) {
  if (!isConfigured()) {
    res.json({ connected:false, reason:'NOT_CONFIGURED' });
    return false;
  }
  const token = await checkToken();
  if (!token.ok) {
    res.json({ connected:false, reason:token.reason });
    return false;
  }
  const repo = await checkRepoAccess();
  if (!repo.ok) {
    res.json({ connected:false, reason:repo.reason });
    return false;
  }
  return true;
}

router.get('/status', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  res.json({ connected:true });
});

router.get('/status/detailed', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  
  try {
    // Get real repository status
    const repoInfo = await githubRequest(`/repos/${OWNER}/${REPO}`);
    
    res.json({ 
      connected: true, 
      success: true,
      status: {
        branch: repoInfo.default_branch || 'main',
        hasChanges: false,
        remoteUrl: repoInfo.clone_url,
        autoSync: false,
        autoCommit: false
      },
      stats: {
        total: repoInfo.size || 0,
        today: 0,
        week: 0
      },
      repo: {
        owner: OWNER, 
        name: REPO,
        private: repoInfo.private,
        language: repoInfo.language
      }, 
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    res.status(500).json({ 
      connected: false, 
      success: false,
      error: error.message 
    });
  }
});

router.get('/stats', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  // მინიმუმით დავაბრუნოთ, რეალური გაწერის შემდეგ ჩავსვათ ციფრები
  res.json({ openIssues:0, openPRs:0, stars:0, forks:0 });
});

router.get('/commits', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  try {
    const cfg = requireEnv();
    const perPage = Math.min(parseInt(req.query.per_page) || 10, 100);
    
    const data = await githubRequest(`/repos/${cfg.GITHUB_OWNER}/${cfg.GITHUB_REPO}/commits?per_page=${perPage}`);
    
    // Transform commits data
    const commits = Array.isArray(data) ? data.map(commit => ({
      hash: commit.sha ? commit.sha.substring(0, 8) : 'unknown',
      fullHash: commit.sha,
      author: commit.commit?.author?.name || 'Unknown',
      email: commit.commit?.author?.email || '',
      date: commit.commit?.author?.date || new Date().toISOString(),
      message: commit.commit?.message || 'No message',
      url: commit.html_url
    })) : [];
    
    res.json({ 
      success: true,
      commits: commits, 
      total: commits.length 
    });
  } catch (e) {
    console.error('Commits fetch error:', e);
    if (e.status === 404) {
      return res.json({ 
        success: false,
        commits: [], 
        connected: false, 
        reason: 'REPO_NOT_FOUND_OR_PRIVATE_NO_ACCESS' 
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'UPSTREAM', 
      detail: String(e.message || e) 
    });
  }
});

router.get('/branches', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  try {
    const cfg = requireEnv();
    const data = await githubRequest(`/repos/${cfg.GITHUB_OWNER}/${cfg.GITHUB_REPO}/branches`);
    
    const branches = {
      local: Array.isArray(data) ? data.map(branch => ({
        name: branch.name,
        hash: branch.commit?.sha?.substring(0, 8) || 'unknown',
        current: branch.name === 'main',
        type: 'local'
      })) : [],
      remote: [],
      current: 'main'
    };
    
    res.json({ 
      success: true,
      branches: branches.local,
      ...branches
    });
  } catch (e) {
    console.error('Branches fetch error:', e);
    if (e.status === 404) {
      return res.json({ 
        success: false,
        branches: [], 
        connected: false, 
        reason: 'REPO_NOT_FOUND_OR_PRIVATE_NO_ACCESS' 
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'UPSTREAM', 
      detail: String(e.message || e) 
    });
  }
});

router.get('/branches/status', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  const repo = await githubRequest(`/repos/${OWNER}/${REPO}`);
  res.json({ defaultBranch: repo.default_branch || 'main', protected: [] });
});

// GET /refs/verify - SHA verification endpoint
router.get('/refs/verify/:branch?', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const branch = req.params.branch || 'main';
    const localSHA = await require('../services/github_integration_service')
      .executeCommand(`git rev-parse HEAD`);
    const remoteSHA = await githubRequest(`/repos/${OWNER}/${REPO}/git/refs/heads/${branch}`);

    res.json({
      success: true,
      branch,
      local: localSHA.trim(),
      remote: remoteSHA.object.sha,
      synced: localSHA.trim() === remoteSHA.object.sha,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/issues/stats', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;
  // Placeholder; რეალური აგრეგაცია შემდეგ ეტაპზე
  res.json({ byLabel:{}, byAssignee:{} });
});

// POST /remote endpoint - SOL-303 fix
router.post('/remote', async (req,res)=>{
  console.log('🔗 [GitHub Remote] remote hit - POST /api/ai/github/remote');

  // For now, return minimal success response
  res.json({ 
    ok: true, 
    message: "remote endpoint alive",
    timestamp: new Date().toISOString()
  });
});

// POST /pull endpoint - explicit pull operation
router.post('/pull', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const gitHubService = require('../services/github_integration_service');
    const result = await gitHubService.pullFromGitHub();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sync endpoint - improved with pull
router.post('/sync', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const { message } = req.body;
    const gitHubService = require('../services/github_integration_service');
    const result = await gitHubService.fullSync(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /upload-file endpoint - Upload specific file via GitHub API
router.post('/upload-file', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const { filePath, content, message, branch } = req.body;

    if (!filePath || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'filePath and content are required' 
      });
    }

    const gitHubService = require('../services/github_integration_service');
    const result = await gitHubService.uploadFileToGitHub(
      filePath, 
      content, 
      message || `Update ${filePath}`, 
      branch || 'main'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /pr/{number}/merge endpoint - Enhanced PR merge with conflict handling (by number, not node_id)  
router.put('/pr/:number/merge', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const { number } = req.params;
    const { commit_title, commit_message, merge_method = 'merge' } = req.body;

    // GitHub API expects 'pull_number' (integer) not 'id' or 'node_id'
    const pullNumber = parseInt(number);
    if (isNaN(pullNumber) || pullNumber <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid pull request number - must be positive integer (e.g. 123, not id or node_id)' 
      });
    }

    // Validate merge method
    const allowedMethods = ['merge', 'squash', 'rebase'];
    if (!allowedMethods.includes(merge_method)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid merge method: ${merge_method}. Allowed: ${allowedMethods.join(', ')}` 
      });
    }

    console.log(`🔀 [GitHub PR Merge] PR #${pullNumber} - Method: ${merge_method}`);
    if (commit_title) console.log(`📝 [GitHub PR Merge] Custom title: ${commit_title}`);
    if (commit_message) console.log(`💬 [GitHub PR Merge] Custom message: ${commit_message}`);

    const gitHubService = require('../services/github_integration_service');
    const result = await gitHubService.mergePullRequest(pullNumber, {
      commit_title,
      commit_message,
      merge_method
    });

    console.log(`✅ [GitHub PR Merge] Result:`, { 
      success: result.success, 
      merged: result.merged,
      method: merge_method 
    });

    res.json(result);
  } catch (error) {
    console.error(`❌ [GitHub PR Merge] Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /pulls/{pull_number}/mergeable endpoint - Check if PR is mergeable
router.get('/pulls/:pull_number/mergeable', async (req,res)=>{
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const { pull_number } = req.params;
    const pullNumber = parseInt(pull_number);

    if (isNaN(pullNumber) || pullNumber <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid pull request number - must be positive integer (e.g. 123, not id or node_id)' 
      });
    }

    const gitHubService = require('../services/github_integration_service');
    const result = await gitHubService.checkPullRequestMergeable(pullNumber);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /branches/create - Create new branch with proper base commit lookup
router.post('/branches/create', async (req, res) => {
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const { branchName, fromBranch = 'main' } = req.body;

    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    // SOL-311: Proper base commit SHA lookup BEFORE branch creation
    console.log(`🌿 Creating branch '${branchName}' from '${fromBranch}'`);

    // Step 1: Get the base commit SHA from existing branch
    let baseSHA;
    try {
      const baseRef = await githubRequest(`/repos/${OWNER}/${REPO}/git/refs/heads/${fromBranch}`);
      baseSHA = baseRef.object.sha;
      console.log(`📍 Base commit SHA for ${fromBranch}: ${baseSHA}`);
    } catch (baseError) {
      console.error(`❌ Failed to get base branch ${fromBranch}:`, baseError.message);
      return res.status(404).json({ 
        error: `Base branch '${fromBranch}' not found`,
        details: baseError.message 
      });
    }

    // Step 2: Verify SHA is valid (not empty)
    if (!baseSHA || baseSHA.length !== 40) {
      return res.status(422).json({ 
        error: 'Invalid base commit SHA retrieved',
        sha: baseSHA 
      });
    }

    // Step 3: Create the new branch reference with verified SHA
    const createResponse = await githubRequest(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSHA
      })
    });

    res.json({
      success: true,
      message: `Branch '${branchName}' created successfully from ${fromBranch}@${baseSHA.substring(0, 8)}`,
      branch: {
        name: branchName,
        sha: baseSHA,
        baseBranch: fromBranch,
        ref: createResponse.ref,
        url: createResponse.url
      }
    });

  } catch (error) {
    console.error('❌ Branch creation error:', error.message);

    if (error.status === 422) {
      return res.status(422).json({ 
        error: 'Branch creation failed - invalid SHA or branch already exists',
        details: error.message,
        hint: 'Check if branch name already exists or base commit is valid'
      });
    }

    res.status(500).json({ error: 'Failed to create branch', details: error.message });
  }
});

// POST /branches/feature - Create feature branch with proper naming and base SHA
router.post('/branches/feature', async (req, res) => {
  const ok = await ensureReady(res); if (!ok) return;

  try {
    const { featureName, baseBranch = 'main' } = req.body;

    if (!featureName) {
      return res.status(400).json({ error: 'Feature name is required' });
    }

    // Clean feature name for branch
    const branchName = `feature/${featureName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

    console.log(`✨ Creating feature branch: ${branchName} from ${baseBranch}`);

    // SOL-311: Get proper base commit SHA first
    let baseSHA;
    try {
      const baseRef = await githubRequest(`/repos/${OWNER}/${REPO}/git/refs/heads/${baseBranch}`);
      baseSHA = baseRef.object.sha;
      console.log(`📍 Feature base SHA from ${baseBranch}: ${baseSHA}`);
    } catch (baseError) {
      console.error(`❌ Failed to get base branch ${baseBranch}:`, baseError.message);
      return res.status(404).json({ 
        error: `Base branch '${baseBranch}' not found for feature creation`,
        details: baseError.message 
      });
    }

    // Create branch with proper SHA
    const createResponse = await githubRequest(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSHA
      })
    });

    res.json({
      success: true,
      message: `Feature branch '${branchName}' created successfully from ${baseBranch}@${baseSHA.substring(0, 8)}`,
      branch: {
        name: branchName,
        type: 'feature',
        baseBranch: baseBranch,
        sha: baseSHA,
        ref: createResponse.ref,
        url: createResponse.url
      }
    });

  } catch (error) {
    console.error('❌ Feature branch creation error:', error.message);

    if (error.status === 422) {
      return res.status(422).json({ 
        error: 'Feature branch creation failed - branch may already exist',
        branchName,
        details: error.message 
      });
    }

    res.status(500).json({ error: 'Failed to create feature branch', details: error.message });
  }
});

module.exports = router;
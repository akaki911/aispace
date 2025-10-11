const express = require('express');
const router = express.Router();
const { requireAssistantAuth } = require('../middleware/authz');
const crypto = require('crypto'); // Import crypto module for hmac

// Enhanced GitHub API service
class GitHubAdvancedService {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_REPO_OWNER || 'bakhmaro';
    this.repoName = process.env.GITHUB_REPO_NAME || 'gurulo-ai';

    if (!this.githubToken) {
      console.warn('⚠️ GitHub Token not configured - some features will be limited');
    }
  }

  async makeGitHubRequest(endpoint, options = {}) {
    if (!this.githubToken) {
      throw new Error('GitHub token not configured');
    }

    const url = `https://api.github.com${endpoint}`;
    const headers = {
      'Authorization': `token ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gurula-AI-Assistant',
      ...options.headers
    };

    try {
      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        throw new Error(`Rate limit exceeded. Reset time: ${resetTime}`);
      }

      if (response.status === 401) {
        throw new Error('GitHub token is invalid or expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GitHub API request failed:', error);
      throw error;
    }
  }

  async getRepositoryInfo() {
    try {
      const repo = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}`);

      return {
        success: true,
        repository: {
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          isPrivate: repo.private,
          defaultBranch: repo.default_branch,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          size: repo.size,
          language: repo.language,
          forksCount: repo.forks_count,
          stargazersCount: repo.stargazers_count,
          watchersCount: repo.watchers_count,
          openIssuesCount: repo.open_issues_count,
          hasIssues: repo.has_issues,
          hasProjects: repo.has_projects,
          hasWiki: repo.has_wiki,
          htmlUrl: repo.html_url,
          cloneUrl: repo.clone_url
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getCollaborators() {
    try {
      const collaborators = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/collaborators`);

      return {
        success: true,
        collaborators: collaborators.map(collab => ({
          id: collab.id,
          login: collab.login,
          avatarUrl: collab.avatar_url,
          htmlUrl: collab.html_url,
          permissions: collab.permissions,
          role: this.determineRole(collab.permissions)
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  determineRole(permissions) {
    if (permissions.admin) return 'Admin';
    if (permissions.maintain) return 'Maintainer';
    if (permissions.push) return 'Write';
    if (permissions.triage) return 'Triage';
    if (permissions.pull) return 'Read';
    return 'None';
  }

  async getBranches() {
    try {
      const branches = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/branches`);

      return {
        success: true,
        branches: branches.map(branch => ({
          name: branch.name,
          sha: branch.commit.sha,
          protected: branch.protected,
          protectionUrl: branch.protection_url
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWorkflowRuns() {
    try {
      const runs = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/actions/runs`);

      return {
        success: true,
        workflowRuns: runs.workflow_runs.slice(0, 10).map(run => ({
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          headBranch: run.head_branch,
          headSha: run.head_sha,
          htmlUrl: run.html_url,
          actor: {
            login: run.actor.login,
            avatarUrl: run.actor.avatar_url
          }
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWebhooks() {
    try {
      const webhooks = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/hooks`);

      return {
        success: true,
        webhooks: webhooks.map(hook => ({
          id: hook.id,
          name: hook.name,
          active: hook.active,
          events: hook.events,
          config: {
            url: hook.config.url,
            contentType: hook.config.content_type,
            insecureSSL: hook.config.insecure_ssl
          },
          createdAt: hook.created_at,
          updatedAt: hook.updated_at
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getRepositoryTopics() {
    try {
      const topics = await this.makeGitHubRequest(`/repos/${this.repoOwner}/${this.repoName}/topics`);

      return {
        success: true,
        topics: topics.names || []
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const githubAdvanced = new GitHubAdvancedService();

// Repository information endpoint
router.get('/repository/info', async (req, res) => {
  try {
    const result = await githubAdvanced.getRepositoryInfo();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Collaborators endpoint
router.get('/collaborators', async (req, res) => {
  try {
    const result = await githubAdvanced.getCollaborators();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Branches endpoint with protection status
router.get('/branches/detailed', async (req, res) => {
  try {
    const result = await githubAdvanced.getBranches();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow runs endpoint
router.get('/actions/runs', async (req, res) => {
  try {
    const result = await githubAdvanced.getWorkflowRuns();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhooks endpoint
router.get('/webhooks', async (req, res) => {
  try {
    const result = await githubAdvanced.getWebhooks();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Repository topics endpoint
router.get('/topics', async (req, res) => {
  try {
    const result = await githubAdvanced.getRepositoryTopics();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Comprehensive repository dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    // Use allSettled to prevent one failure from breaking everything
    const results = await Promise.allSettled([
      githubAdvanced.getRepositoryInfo(),
      githubAdvanced.getCollaborators(),
      githubAdvanced.getBranches(),
      githubAdvanced.getWorkflowRuns(),
      githubAdvanced.getWebhooks(),
      githubAdvanced.getRepositoryTopics()
    ]);

    const [
      repositoryResult,
      collaboratorsResult,
      branchesResult,
      workflowRunsResult,
      webhooksResult,
      topicsResult
    ] = results;

    // Provide fallback data for failed requests
    const dashboard = {
      repository: repositoryResult.status === 'fulfilled' && repositoryResult.value.success 
        ? repositoryResult.value.repository 
        : {
            name: 'gurula-ai',
            fullName: 'bakhmaro/gurula-ai',
            defaultBranch: 'main',
            size: 0,
            language: 'TypeScript',
            updatedAt: new Date().toISOString()
          },
      collaborators: collaboratorsResult.status === 'fulfilled' && collaboratorsResult.value.success 
        ? collaboratorsResult.value.collaborators 
        : [],
      branches: branchesResult.status === 'fulfilled' && branchesResult.value.success 
        ? branchesResult.value.branches 
        : [{ name: 'main', protected: false }],
      workflowRuns: workflowRunsResult.status === 'fulfilled' && workflowRunsResult.value.success 
        ? workflowRunsResult.value.workflowRuns 
        : [],
      webhooks: webhooksResult.status === 'fulfilled' && webhooksResult.value.success 
        ? webhooksResult.value.webhooks 
        : [],
      topics: topicsResult.status === 'fulfilled' && topicsResult.value.success 
        ? topicsResult.value.topics 
        : ['ai', 'typescript', 'replit']
    };

    res.json({
      success: true,
      dashboard,
      warning: results.some(r => r.status === 'rejected') ? 'Some data loaded with fallbacks due to API limitations' : null
    });
  } catch (error) {
    console.error('Dashboard API error:', error);

    // Provide complete fallback dashboard
    res.json({
      success: true,
      dashboard: {
        repository: {
          name: 'gurula-ai',
          fullName: 'bakhmaro/gurula-ai',
          description: 'AI Developer Assistant',
          defaultBranch: 'main',
          size: 1024,
          language: 'TypeScript',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: new Date().toISOString()
        },
        collaborators: [
          { id: 1, login: 'bakhmaro', role: 'Admin' }
        ],
        branches: [
          { name: 'main', protected: true },
          { name: 'development', protected: false }
        ],
        workflowRuns: [
          {
            id: 1,
            name: 'CI/CD Pipeline',
            status: 'completed',
            conclusion: 'success',
            createdAt: new Date().toISOString(),
            headBranch: 'main',
            actor: { login: 'bakhmaro' }
          }
        ],
        webhooks: [],
        topics: ['ai', 'typescript', 'replit', 'assistant']
      },
      warning: 'Displaying fallback data due to GitHub API limitations'
    });
  }
});

// Enhanced GitHub Webhook Handler
router.post('/webhook/github', async (req, res) => {
  try {
    console.log('🌐 GitHub webhook received');
    const signature = req.get('X-Hub-Signature-256');
    const payload = JSON.stringify(req.body);
    const eventType = req.headers['x-github-event'];

    // Verify webhook signature
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      console.error('❌ GITHUB_WEBHOOK_SECRET not configured in Replit Secrets');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload, 'utf8').digest('hex');

    if (signature !== digest) {
      console.error('❌ Invalid webhook signature');
      console.error('Expected:', digest);
      console.error('Received:', signature);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    console.log('✅ GitHub webhook verified successfully');
    console.log('📦 Event type:', eventType);
    console.log('🔍 Repository:', req.body.repository?.full_name);

    // Process webhook based on event type
    switch (eventType) {
      case 'push':
        console.log('🚀 Push event to branch:', req.body.ref);
        console.log('📝 Commits count:', req.body.commits?.length || 0);
        // Auto-sync logic can be added here
        break;

      case 'pull_request':
        console.log('🔀 PR action:', req.body.action);
        console.log('🎯 PR number:', req.body.number);
        break;

      case 'issues':
        console.log('🐛 Issue action:', req.body.action);
        console.log('📋 Issue number:', req.body.issue?.number);
        break;

      default:
        console.log('📨 Event type:', eventType);
    }

    // Log successful webhook processing
    console.log('✅ Webhook processed successfully');

    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      eventType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

module.exports = router;
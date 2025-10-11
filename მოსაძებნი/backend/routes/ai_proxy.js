/**
 * AI GitHub automation routes
 * ----------------------------
 *
 * This router replaces the previous stubbed endpoints and now proxies real
 * GitHub + Git operations through Octokit and local git commands. All routes
 * are protected with the admin setup token middleware.
 *
 * Testing checklist (from the admin dashboard):
 *   1. In the Overview tab click “Init” and ensure repository details load.
 *   2. In GitOps tab stage a file, create a commit, and push to GitHub.
 *   3. In Issues tab create/close an issue and verify on GitHub.
 *   4. In Analytics/Webhooks tabs confirm data renders without mock payloads.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const requireAdminSetupToken = require('../middleware/requireAdminSetupToken');
const gitCommands = require('../services/gitCommandsService');
const githubIntegration = require('../services/githubIntegration');
const githubAiService = require('../services/githubAiService');

const SESSION_KEY_HEADER = 'x-session-key';
const metadataFeatureEnabled = (process.env.ENABLE_METADATA || 'false').toLowerCase() === 'true';

const resolveSessionKey = (req) => {
  if (typeof req.headers[SESSION_KEY_HEADER] === 'string') return req.headers[SESSION_KEY_HEADER];
  if (req.session?.user?.uid) return req.session.user.uid;
  if (req.session?.userId) return req.session.userId;
  if (req.user?.uid) return req.user.uid;
  if (req.user?.id) return req.user.id;
  return undefined;
};

const respondSafe = (res, operation) => (promise) =>
  promise
    .then((payload) => {
      res.json({
        success: true,
        operation,
        ...payload,
        timestamp: new Date().toISOString()
      });
    })
    .catch((error) => {
      const status = error.status || error.statusCode || 500;
      console.error(`❌ [AI:${operation}]`, error);
      res.status(status).json({
        success: false,
        operation,
        error: error.message || 'Operation failed',
        timestamp: new Date().toISOString()
      });
    });

const requireToken = (req, _res, next) => {
  if (!process.env.GITHUB_TOKEN) {
    const error = new Error('GITHUB_TOKEN env variable is required for AI GitHub operations');
    error.status = 500;
    throw error;
  }
  next();
};

router.use(requireAdminSetupToken);

router.get('/github/status', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const force = req.query.force === 'true';
  const maxAgeMs = Number.parseInt(req.query.maxAgeMs, 10);

  try {
    const state = await githubAiService.getRealtimeState(sessionKey, { force, maxAgeMs });
    const settings = await githubAiService.getSettings(sessionKey, state);
    res.json({
      success: Boolean(state?.status?.success || state?.connected),
      ...state,
      settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [/api/ai/github/status]', error);
    const status = error.status || error.statusCode || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Unable to load GitHub status',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/github/status/detailed', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const force = req.query.force === 'true';
  const maxAgeMs = Number.parseInt(req.query.maxAgeMs, 10);

  try {
    const detailed = await githubAiService.getDetailedStatus(sessionKey, { force, maxAgeMs });
    res.json({
      ...detailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [/api/ai/github/status/detailed]', error);
    const status = error.status || error.statusCode || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Unable to load GitHub status',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/dashboard', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const force = req.query.force === 'true';
  const maxAgeMs = Number.parseInt(req.query.maxAgeMs, 10);

  try {
    const dashboard = await githubAiService.getDashboard(sessionKey, { force, maxAgeMs });
    res.json({
      ...dashboard,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [/api/ai/dashboard]', error);
    const status = error.status || error.statusCode || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Unable to load dashboard data',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/github/init', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const repoUrl = req.body?.repoUrl || process.env.GITHUB_REPO_URL;
  respondSafe(res, 'init')(
    githubIntegration.connect({ repoUrl, sessionKey, token: process.env.GITHUB_TOKEN }).then((payload) => ({
      message: 'Repository initialization completed.',
      data: payload
    }))
  );
});

router.post('/github/sync', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'sync')(
    githubAiService.refreshSnapshot(sessionKey).then(async () => {
      const detailed = await githubAiService.getDetailedStatus(sessionKey, { force: true });
      return {
        message: 'Repository snapshot refreshed.',
        ...detailed,
      };
    })
  );
});

router.post('/sync', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'syncAll')(
    githubAiService.refreshSnapshot(sessionKey).then(async () => {
      const dashboard = await githubAiService.getDashboard(sessionKey, { force: true });
      return {
        message: 'Dashboard refreshed.',
        ...dashboard,
      };
    })
  );
});

router.post('/github/pull', requireToken, async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const { owner, repo } = await githubAiService.resolveRepoConfig(sessionKey);
  respondSafe(res, 'pull')(
    gitCommands.pull({ branch: req.body?.branch || 'main', remote: 'origin', token: process.env.GITHUB_TOKEN }).then(
      async (result) => {
        await githubAiService.refreshSnapshot(sessionKey);
        return {
          ...result,
          repository: `${owner}/${repo}`
        };
      }
    )
  );
});

router.post('/github/fetch', requireToken, async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'fetch')(
    gitCommands.fetchRemote({ remote: req.body?.remote || 'origin', token: process.env.GITHUB_TOKEN }).then(async (result) => {
      await githubAiService.refreshSnapshot(sessionKey);
      return result;
    })
  );
});

router.post('/github/push', requireToken, async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'push')(
    gitCommands.push({ branch: req.body?.branch || 'main', remote: req.body?.remote || 'origin', token: process.env.GITHUB_TOKEN })
      .then(async (result) => {
        await githubAiService.refreshSnapshot(sessionKey);
        return result;
      })
  );
});

router.post('/github/auto-sync/enable', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'autoSyncEnable')(githubAiService.toggleSetting(sessionKey, 'autoSync', true));
});

router.post('/github/auto-sync/disable', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'autoSyncDisable')(githubAiService.toggleSetting(sessionKey, 'autoSync', false));
});

router.post('/github/auto-commit/enable', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'autoCommitEnable')(githubAiService.toggleSetting(sessionKey, 'autoCommit', true));
});

router.post('/github/auto-commit/disable', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'autoCommitDisable')(githubAiService.toggleSetting(sessionKey, 'autoCommit', false));
});

router.post('/github/auto-merge/enable', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'autoMergeEnable')(githubAiService.toggleSetting(sessionKey, 'autoMerge', true));
});

router.post('/github/auto-merge/disable', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'autoMergeDisable')(githubAiService.toggleSetting(sessionKey, 'autoMerge', false));
});

router.get('/github/commits', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const commits = await githubAiService.getCommits(sessionKey, {
    limit: Number.parseInt(req.query.limit, 10) || 20
  });
  res.json({ success: true, commits, timestamp: new Date().toISOString() });
});

router.get('/github/branches', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const branches = await githubAiService.getBranches(sessionKey);
  res.json({ success: true, branches, timestamp: new Date().toISOString() });
});

router.get('/github/branches/status', async (req, res) => {
  const sessionKey = resolveSessionKey(req);

  try {
    const [integrationStatus, gitStatus] = await Promise.all([
      githubIntegration.getStatus(sessionKey),
      gitCommands.getStatus(),
    ]);

    const hasGitStatus = gitStatus && gitStatus.success;
    const defaultBranch = integrationStatus?.status?.branch
      || (hasGitStatus ? gitStatus.branch : undefined)
      || 'main';

    const branchStatus = hasGitStatus
      ? {
          branch: gitStatus.branch,
          current: gitStatus.branch,
          upstream: gitStatus.upstream,
          aheadBehind: {
            ahead: typeof gitStatus.ahead === 'number' ? gitStatus.ahead : 0,
            behind: typeof gitStatus.behind === 'number' ? gitStatus.behind : 0,
          },
          ahead: typeof gitStatus.ahead === 'number' ? gitStatus.ahead : 0,
          behind: typeof gitStatus.behind === 'number' ? gitStatus.behind : 0,
          changesCount: typeof gitStatus.changesCount === 'number' ? gitStatus.changesCount : 0,
          hasChanges: Boolean(gitStatus.hasChanges),
          hasRemote: Boolean(gitStatus.hasRemote),
        }
      : null;

    res.json({
      success: true,
      defaultBranch,
      branches: integrationStatus?.branches,
      branchStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Failed to resolve GitHub branch status:', error);
    res.status(500).json({ success: false, error: 'Failed to load branch status' });
  }
});

router.post('/github/branches/create', async (req, res) => {
  const name = req.body?.name || req.body?.branch || req.body?.featureName;
  const base = req.body?.baseBranch || 'main';
  respondSafe(res, 'createBranch')(gitCommands.createBranch(name, base));
});

router.post('/github/branches/feature', async (req, res) => {
  const name = req.body?.featureName || `feature/${Date.now()}`;
  respondSafe(res, 'createFeatureBranch')(gitCommands.createBranch(name, req.body?.base || 'main'));
});

router.post('/github/branches/switch', async (req, res) => {
  const target = req.body?.targetBranch || req.body?.branch;
  respondSafe(res, 'switchBranch')(gitCommands.switchBranch(target));
});

router.post('/github/branches/delete', async (req, res) => {
  const name = req.body?.branch;
  respondSafe(res, 'deleteBranch')(gitCommands.deleteBranch(name, { force: Boolean(req.body?.force) }));
});

router.get('/github/advanced/dashboard', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const force = req.query.force === 'true';
  const maxAgeMs = Number.parseInt(req.query.maxAgeMs, 10);
  try {
    const dashboard = await githubAiService.getDashboard(sessionKey, { force, maxAgeMs });
    res.json({
      ...dashboard,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [/api/ai/github/advanced/dashboard]', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to load dashboard analytics',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/github/issues/stats', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const stats = await githubAiService.getIssuesStats(sessionKey);
  res.json({ ...stats, timestamp: new Date().toISOString() });
});

router.get('/github/issues', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const stats = await githubAiService.getIssuesStats(sessionKey);
  res.json({
    success: Boolean(stats?.success !== false),
    issues: stats.issues,
    totals: stats.totals,
    updatedAt: stats.updatedAt,
    timestamp: new Date().toISOString(),
  });
});

router.post('/github/issues/create', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'createIssue')(githubAiService.createIssue(sessionKey, req.body));
});

router.post('/github/issues/:issueNumber/close', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const issueNumber = Number.parseInt(req.params.issueNumber, 10);
  respondSafe(res, 'closeIssue')(githubAiService.closeIssue(sessionKey, issueNumber));
});

router.get('/github/webhooks', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const webhooks = await githubAiService.listWebhooks(sessionKey);
  res.json({ success: true, webhooks });
});

router.delete('/github/webhooks/:id', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'deleteWebhook')(githubAiService.deleteWebhook(sessionKey, Number(req.params.id)));
});

router.post('/github/webhooks/:id/rotate-secret', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'rotateWebhookSecret')(githubAiService.rotateWebhookSecret(sessionKey, Number(req.params.id)));
});

router.patch('/github/webhooks/:id', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'updateWebhook')(githubAiService.updateWebhook(sessionKey, Number(req.params.id), req.body));
});

router.post('/github/upload-file', async (req, res) => {
  const { filePath, content } = req.body || {};
  if (!filePath || typeof content !== 'string') {
    return res.status(400).json({ success: false, error: 'filePath and content required' });
  }
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, content, 'utf8');
  res.json({ success: true, message: 'ფაილი წარმატებით განახლდა.' });
});

router.post('/github/stage', async (req, res) => {
  respondSafe(res, 'stage')(gitCommands.addFiles(req.body?.files));
});

router.post('/github/unstage', async (req, res) => {
  respondSafe(res, 'unstage')(gitCommands.unstageFiles(req.body?.files));
});

router.post('/github/discard', async (req, res) => {
  respondSafe(res, 'discard')(gitCommands.discardChanges(req.body?.files));
});

router.get('/git/status', async (req, res) => {
  const status = await gitCommands.getStatus();
  res.json({ ...status, timestamp: new Date().toISOString() });
});

router.get('/git/log', async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const data = await gitCommands.getLog({ limit, branch: req.query.branch });
  res.json({ ...data, timestamp: new Date().toISOString() });
});

router.get('/git/branches', async (req, res) => {
  const branches = await gitCommands.getBranches();
  res.json({ ...branches, timestamp: new Date().toISOString() });
});

router.post('/git/add', async (req, res) => {
  respondSafe(res, 'gitAdd')(gitCommands.addFiles(req.body?.files));
});

router.post('/git/commit', async (req, res) => {
  respondSafe(res, 'gitCommit')(gitCommands.commit(req.body?.message, req.body?.options));
});

router.post('/git/push', requireToken, async (req, res) => {
  respondSafe(res, 'gitPush')(gitCommands.push({
    remote: req.body?.remote || 'origin',
    branch: req.body?.branch || 'main',
    token: process.env.GITHUB_TOKEN
  }));
});

router.get('/version-control/recent-files', async (req, res) => {
  const data = await gitCommands.recentFiles(Number.parseInt(req.query.limit, 10) || 10);
  res.json({ ...data, timestamp: new Date().toISOString() });
});

router.get('/version-control/history/:filePath', async (req, res) => {
  const history = await gitCommands.fileHistory(req.params.filePath, Number.parseInt(req.query.limit, 10) || 20);
  res.json({ ...history, timestamp: new Date().toISOString() });
});

router.post('/version-control/diff', async (req, res) => {
  const { from, to, filePath } = req.body || {};
  respondSafe(res, 'gitDiff')(gitCommands.diff(from || 'HEAD~1', to || 'HEAD', filePath));
});

router.post('/version-control/restore', async (req, res) => {
  const { filePath, version } = req.body || {};
  respondSafe(res, 'gitRestore')(gitCommands.restore(filePath, version || 'HEAD'));
});

router.post('/version-control/github-diff', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const { filePath, from, to } = req.body || {};
  const { owner, repo } = await githubAiService.resolveRepoConfig(sessionKey);
  const octokit = githubIntegration.getOctokit();
  const comparison = await octokit.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${from || 'HEAD~1'}...${to || 'HEAD'}`
  });
  const file = comparison.data.files?.find((entry) => entry.filename === filePath);
  res.json({
    success: true,
    diff: file?.patch || '',
    stats: file ? { additions: file.additions, deletions: file.deletions, changes: file.changes } : null
  });
});

router.post('/version-control/github-restore', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const { filePath, version } = req.body || {};
  const { owner, repo } = await githubAiService.resolveRepoConfig(sessionKey);
  const octokit = githubIntegration.getOctokit();
  const file = await octokit.repos.getContent({ owner, repo, path: filePath, ref: version });
  const decoded = Buffer.from(file.data.content, file.data.encoding || 'base64').toString('utf8');
  await fs.promises.mkdir(path.dirname(path.resolve(process.cwd(), filePath)), { recursive: true });
  await fs.promises.writeFile(path.resolve(process.cwd(), filePath), decoded, 'utf8');
  res.json({ success: true, message: `${filePath} restored from GitHub.` });
});

router.get('/repository-automation/status', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const maxAgeMs = Number.parseInt(req.query.maxAgeMs, 10);
  try {
    const detailed = await githubAiService.getDetailedStatus(sessionKey, { maxAgeMs });
    const issues = [];
    const tokenAvailable = Boolean(process.env.GITHUB_TOKEN || detailed.settings?.hasToken);
    const repositoryConfigured = Boolean(detailed.repository);
    const webhookUrlConfigured = Boolean(
      (typeof detailed.settings?.webhookUrl === 'string' && detailed.settings.webhookUrl.trim()) ||
        (typeof process.env.GITHUB_AUTOMATION_WEBHOOK_URL === 'string' && process.env.GITHUB_AUTOMATION_WEBHOOK_URL.trim()) ||
        (typeof process.env.REPLIT_URL === 'string' && process.env.REPLIT_URL.trim())
    );
    const branchProtectionConfigured = Array.isArray(detailed.branchProtection) && detailed.branchProtection.length > 0;

    if (!repositoryConfigured) issues.push('Repository metadata unavailable');
    if (!tokenAvailable) issues.push('GitHub token not configured');
    if (!webhookUrlConfigured) issues.push('Webhook target URL not configured');
    if (!Array.isArray(detailed.webhooks) || !detailed.webhooks.some((hook) => hook.active)) {
      issues.push('No active webhooks configured');
    }
    if (!branchProtectionConfigured) {
      issues.push('Branch protection rules missing');
    }

    const valid = issues.length === 0;
    const automationReady = tokenAvailable && repositoryConfigured;
    const capabilities = {
      collaboratorManagement: automationReady,
      webhookConfiguration: automationReady && webhookUrlConfigured,
      metadataManagement: automationReady,
      branchProtection: automationReady,
      releaseNotesGeneration: Array.isArray(detailed.commits) && detailed.commits.length > 0,
      workflowAutomation: Array.isArray(detailed.workflows) && detailed.workflows.length > 0,
      automationOrchestration: automationReady && webhookUrlConfigured && branchProtectionConfigured,
    };

    res.json({
      success: true,
      configuration: {
        valid,
        issues,
        settings: detailed.settings,
      },
      capabilities,
      metrics: {
        workflowSuccessRate: detailed.analytics?.workflowSuccessRate || 0,
        totalCommits: detailed.analytics?.totalCommits || (Array.isArray(detailed.commits) ? detailed.commits.length : 0),
        openIssues: detailed.issues?.open?.length || 0,
        closedIssues: detailed.issues?.closed?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [/api/ai/repository-automation/status]', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to load automation status',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/repository-automation/run-full', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const payload = req.body || {};

  const shouldRun = (value) =>
    value === undefined || value === true || (typeof value === 'object' && value !== null && !Array.isArray(value));
  const extractOptions = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};

  const taskDefinitions = [
    {
      key: 'collaborators',
      label: 'Collaborator management',
      enabled: shouldRun(payload.collaborators),
      runner: () => githubAiService.ensureCollaboratorAccess(sessionKey, extractOptions(payload.collaborators)),
    },
    {
      key: 'webhooks',
      label: 'Webhook configuration',
      enabled: shouldRun(payload.webhooks),
      runner: () => githubAiService.ensureWebhookConfigured(sessionKey, extractOptions(payload.webhooks)),
    },
    {
      key: 'metadata',
      label: 'Repository metadata',
      enabled: shouldRun(payload.metadata),
      runner: () => githubAiService.ensureRepositoryMetadata(sessionKey, extractOptions(payload.metadata)),
    },
    {
      key: 'branchProtection',
      label: 'Branch protection rules',
      enabled: shouldRun(payload.branchProtection),
      runner: () => githubAiService.ensureBranchProtectionRules(sessionKey, extractOptions(payload.branchProtection)),
    },
  ];

  const results = {};
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const task of taskDefinitions) {
    if (!task.enabled) {
      results[task.key] = { success: null, skipped: true };
      skippedCount += 1;
      continue;
    }

    try {
      const outcome = await task.runner();
      results[task.key] = { success: true, outcome };
      successCount += 1;
    } catch (error) {
      console.error(`❌ [Automation:${task.key}]`, error);
      results[task.key] = {
        success: false,
        error: error.message || 'Task failed',
      };
      errorCount += 1;
    }
  }

  if (successCount > 0) {
    githubAiService.refreshSnapshot(sessionKey).catch((error) => {
      console.warn('⚠️ Automation snapshot refresh failed:', error?.message || error);
    });
  }

  const totalTasks = taskDefinitions.filter((task) => task.enabled).length;

  res.json({
    success: errorCount === 0,
    message: errorCount === 0 ? 'Automation tasks completed successfully.' : 'Automation completed with errors.',
    summary: {
      successCount,
      totalTasks,
      errorCount,
      skippedCount,
    },
    results,
    timestamp: new Date().toISOString(),
  });
});

router.post('/repository-automation/collaborators/auto-manage', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'automationCollaborators')(
    (async () => {
      const outcome = await githubAiService.ensureCollaboratorAccess(sessionKey, req.body || {});
      await githubAiService.refreshSnapshot(sessionKey).catch((error) => {
        console.warn('⚠️ Collaborator refresh failed:', error?.message || error);
      });
      return {
        message: 'Collaborator permissions aligned.',
        result: outcome,
      };
    })()
  );
});

router.post('/repository-automation/webhooks/auto-configure', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'automationWebhooks')(
    (async () => {
      const outcome = await githubAiService.ensureWebhookConfigured(sessionKey, req.body || {});
      await githubAiService.refreshSnapshot(sessionKey).catch((error) => {
        console.warn('⚠️ Webhook refresh failed:', error?.message || error);
      });
      return {
        message: 'Webhook configuration ensured.',
        result: outcome,
      };
    })()
  );
});

router.post('/repository-automation/metadata/auto-update', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  if (!metadataFeatureEnabled) {
    return res.json({
      success: true,
      operation: 'automationMetadata',
      message: 'Metadata automation disabled',
      result: {
        success: false,
        metadata: {},
        disabled: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
  respondSafe(res, 'automationMetadata')(
    (async () => {
      const outcome = await githubAiService.ensureRepositoryMetadata(sessionKey, req.body || {});
      await githubAiService.refreshSnapshot(sessionKey).catch((error) => {
        console.warn('⚠️ Metadata refresh failed:', error?.message || error);
      });
      return {
        message: 'Repository metadata updated.',
        result: outcome,
      };
    })()
  );
});

router.post('/repository-automation/branches/auto-protect', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'automationBranchProtection')(
    (async () => {
      const outcome = await githubAiService.ensureBranchProtectionRules(sessionKey, req.body || {});
      await githubAiService.refreshSnapshot(sessionKey).catch((error) => {
        console.warn('⚠️ Branch protection refresh failed:', error?.message || error);
      });
      return {
        message: 'Branch protection rules enforced.',
        result: outcome,
      };
    })()
  );
});

router.post('/repository-automation/release/generate-notes', async (req, res) => {
  const { from, to } = req.body || {};

  try {
    const [log, latestTag, headCommit] = await Promise.all([
      gitCommands.getLog({ limit: 50 }),
      gitCommands.getLatestTag(),
      gitCommands.getHeadCommit(),
    ]);

    if (!log.success) {
      throw new Error(log.error || 'Unable to read git history');
    }

    const commits = Array.isArray(log.commits) ? log.commits : [];

    const normalizeSha = (value) => (typeof value === 'string' ? value.toLowerCase() : null);
    const matchesSha = (commit, value) => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      return (
        typeof commit.fullHash === 'string' && commit.fullHash.toLowerCase().startsWith(normalized)
      ) || (
        typeof commit.hash === 'string' && normalized.startsWith(commit.hash.toLowerCase())
      );
    };

    const normalizedFrom = normalizeSha(from);
    const normalizedTo = normalizeSha(to);

    let startIndex = 0;
    let endIndex = commits.length;

    if (normalizedTo) {
      const index = commits.findIndex((commit) => matchesSha(commit, normalizedTo));
      if (index !== -1) {
        startIndex = index;
      }
    }

    if (normalizedFrom) {
      const index = commits.findIndex((commit) => matchesSha(commit, normalizedFrom));
      if (index !== -1) {
        endIndex = index + 1;
      }
    }

    if (startIndex > endIndex) {
      [startIndex, endIndex] = [0, commits.length];
    }

    const selectedCommits = commits.slice(startIndex, endIndex);
    const effectiveCommits = selectedCommits.length > 0 ? selectedCommits : commits;

    const notes = effectiveCommits
      .map((commit) => `- ${commit.hash} ${commit.message}`)
      .join('\n');

    const headHash = headCommit.success ? headCommit.hash : effectiveCommits[0]?.fullHash || null;
    const versionIdentifier =
      (normalizedTo && effectiveCommits[0]?.fullHash) ||
      (latestTag.success && latestTag.tag) ||
      headHash ||
      null;

    const range = {
      from: from || effectiveCommits[effectiveCommits.length - 1]?.fullHash || (latestTag.success ? latestTag.tag : null),
      to: to || headHash,
    };

    res.json({
      success: true,
      version: versionIdentifier,
      notes,
      range,
      commits: effectiveCommits.map((commit) => ({
        hash: commit.hash,
        fullHash: commit.fullHash,
        message: commit.message,
        author: commit.author,
        date: commit.date instanceof Date ? commit.date.toISOString() : new Date(commit.date).toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [/api/ai/repository-automation/release/generate-notes]', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to generate release notes',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/feedback', async (_req, res) => {
  const stats = await githubAiService.feedbackStats();
  res.json({ ...stats, timestamp: new Date().toISOString() });
});

router.get('/feedback/stats', async (_req, res) => {
  const stats = await githubAiService.feedbackStats();
  res.json({ ...stats, timestamp: new Date().toISOString() });
});

router.post('/feedback/auto-processing/toggle', async (req, res) => {
  res.json({ success: true, enabled: Boolean(req.body?.enabled) });
});

router.post('/feedback/submit', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  const payload = req.body || {};

  try {
    const record = await githubAiService.recordFeedback({ sessionKey, payload });
    let issue = null;

    if (typeof payload.title === 'string' && payload.title.trim()) {
      const labels = Array.isArray(payload.labels)
        ? payload.labels.filter((label) => typeof label === 'string')
        : [];
      const normalizedType = typeof payload.type === 'string' ? payload.type : 'feedback';
      if (!labels.includes(normalizedType)) {
        labels.push(normalizedType);
      }
      if (typeof payload.priority === 'string' && !labels.includes(`priority:${payload.priority.toLowerCase()}`)) {
        labels.push(`priority:${payload.priority.toLowerCase()}`);
      }

      const description = payload.description || payload.body || 'No description provided.';
      const issueBody = [
        description,
        '',
        '---',
        `**Type:** ${normalizedType}`,
        `**Priority:** ${payload.priority || 'normal'}`,
        `**Submitted:** ${new Date().toISOString()}`,
        `**Source:** GitHub მენეჯმენტ ჰაბი Feedback`,
      ].join('\n');

      try {
        issue = await githubAiService.createIssue(sessionKey, {
          title: payload.title,
          body: issueBody,
          labels,
        });
      } catch (error) {
        console.error('❌ [feedback→issue] Unable to create GitHub issue:', error?.message || error);
      }
    }

    res.json({
      success: true,
      feedbackId: record.id,
      firestore: record,
      issueNumber: issue?.issue?.number || null,
      issueUrl: issue?.issue?.html_url || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [/api/ai/feedback/submit]', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Feedback submission failed',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/settings', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  try {
    const settings = await githubAiService.getSettings(sessionKey);
    res.json({ success: true, settings, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ [/api/ai/settings]', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to load settings',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/settings', async (req, res) => {
  const sessionKey = resolveSessionKey(req);
  respondSafe(res, 'saveSettings')(
    githubAiService.saveSettings(sessionKey, req.body || {}).then((settings) => ({
      message: 'GitHub პარამეტრები განახლდა.',
      settings
    }))
  );
});

module.exports = router;

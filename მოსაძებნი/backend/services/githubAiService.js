/**
 * High level GitHub automation helpers for the admin AI dashboard.
 *
 * Responsibilities:
 *  - wrap Octokit calls for commits, branches, issues, pulls, and webhooks
 *  - persist dashboard preferences (auto-sync/commit toggles) via Firestore
 *  - expose analytics summaries consumed by the React tabs
 *
 * Testing:
 *   1. Configure ADMIN_SETUP_TOKEN and GitHub repo credentials.
 *   2. Open /admin/ai-developer → GitHub მენეჯმენტ ჰაბი and trigger actions.
 *   3. Verify commits, branches, and issues update with real GitHub data.
 */

const admin = require('../firebase');
const {
  getStatus,
  parseRepoInput,
  fetchRepositorySnapshot,
  getOctokit,
  loadState,
  updateState
} = require('./githubIntegration');

const firestore = typeof admin?.firestore === 'function' ? admin.firestore() : null;

const FEEDBACK_COLLECTION = process.env.GITHUB_FEEDBACK_COLLECTION || 'ai-feedback';
const SESSION_KEY_FALLBACK = 'global-admin';

const DEFAULT_POLLING_INTERVAL = Number.parseInt(process.env.GITHUB_SYNC_POLLING_INTERVAL_MS || '', 10) || 5 * 60 * 1000;
const MIN_POLLING_INTERVAL = 60 * 1000;
const MAX_POLLING_INTERVAL = 15 * 60 * 1000;

const pollingTimers = new Map();

const resolveSessionKey = (sessionKey) =>
  typeof sessionKey === 'string' && sessionKey.trim().length > 0 ? sessionKey.trim() : SESSION_KEY_FALLBACK;

const normalizePollingInterval = (value) => {
  const numericValue =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number.parseInt(typeof value === 'string' ? value : `${value}`, 10);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_POLLING_INTERVAL;
  }

  return Math.min(Math.max(numericValue, MIN_POLLING_INTERVAL), MAX_POLLING_INTERVAL);
};

const maskToken = (token) => {
  if (typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}•••${trimmed.slice(-4)}`;
};

const maskSecret = (secret) => {
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    return null;
  }

  const trimmed = secret.trim();
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 1)}***${trimmed.slice(-1)}`;
  }

  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-3)}`;
};

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

const normalizePermission = (permission) => {
  const raw = typeof permission === 'string' ? permission.trim().toLowerCase() : '';
  if (!raw) {
    return 'push';
  }

  if (['pull', 'push', 'triage', 'maintain', 'admin'].includes(raw)) {
    return raw;
  }

  if (raw === 'read') return 'pull';
  if (raw === 'write') return 'push';

  return 'push';
};

const parseTopicsInput = (input) => {
  if (input === null) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((topic) => (typeof topic === 'string' ? topic.trim().toLowerCase() : ''))
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((topic) => topic.trim().toLowerCase())
      .filter(Boolean);
  }

  return null;
};

const safeCall = async (label, callback, { fallback = null, transform } = {}) => {
  try {
    const result = await callback();
    if (typeof transform === 'function') {
      return transform(result);
    }
    return result;
  } catch (error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    const message = error?.message || error;
    console.warn(`⚠️ [GitHubAI:${label}] ${message}`, { status });
    if (typeof transform === 'function' && fallback !== null) {
      return transform(fallback);
    }
    return fallback;
  }
};

const mapIssueForUi = (issue) => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  labels: Array.isArray(issue.labels)
    ? issue.labels
        .map((label) => (typeof label === 'string' ? label : label?.name))
        .filter(Boolean)
    : [],
  created_at: issue.created_at,
  updated_at: issue.updated_at,
  html_url: issue.html_url,
  author: issue.user ? { login: issue.user.login, avatar_url: issue.user.avatar_url } : null,
  assignees: Array.isArray(issue.assignees)
    ? issue.assignees.map((assignee) => ({ login: assignee.login, avatar_url: assignee.avatar_url }))
    : [],
  comments: issue.comments,
});

const mapPullForUi = (pull) => ({
  number: pull.number,
  title: pull.title,
  state: pull.state,
  merged_at: pull.merged_at,
  created_at: pull.created_at,
  updated_at: pull.updated_at,
  html_url: pull.html_url,
  author: pull.user ? { login: pull.user.login, avatar_url: pull.user.avatar_url } : null,
});

const mapCollaborator = (collaborator) => ({
  login: collaborator.login,
  avatar_url: collaborator.avatar_url,
  url: collaborator.html_url,
  role: collaborator.permissions?.admin
    ? 'Admin'
    : collaborator.permissions?.push
      ? 'Maintainer'
      : 'Contributor',
  permissions: collaborator.permissions,
});

const mapWebhook = (webhook) => ({
  id: webhook.id,
  url: webhook.config?.url,
  active: webhook.active,
  events: webhook.events,
  lastResponse: webhook.last_response,
  created_at: webhook.created_at,
  updated_at: webhook.updated_at,
});

const mapWorkflow = (workflow) => ({
  id: workflow.id,
  name: workflow.name,
  path: workflow.path,
  state: workflow.state,
  created_at: workflow.created_at,
  updated_at: workflow.updated_at,
  html_url: workflow.html_url,
});

const mapWorkflowRun = (run) => ({
  id: run.id,
  name: run.name,
  event: run.event,
  status: run.status,
  conclusion: run.conclusion,
  created_at: run.created_at,
  updated_at: run.updated_at,
  html_url: run.html_url,
  actor: run.actor ? { login: run.actor.login, avatar_url: run.actor.avatar_url } : null,
});

const getEffectiveSettings = (state) => {
  const settings = { ...(state?.settings || {}) };
  if (typeof state?.status?.autoSync === 'boolean') {
    settings.autoSync = state.status.autoSync;
  }
  if (typeof state?.status?.autoCommit === 'boolean' && typeof settings.autoCommit !== 'boolean') {
    settings.autoCommit = state.status.autoCommit;
  }
  if (typeof state?.status?.autoMerge === 'boolean' && typeof settings.autoMerge !== 'boolean') {
    settings.autoMerge = state.status.autoMerge;
  }
  if (typeof state?.status?.branch === 'string' && !settings.branch) {
    settings.branch = state.status.branch;
  }
  if (!settings.repoUrl && typeof state?.repoUrl === 'string') {
    settings.repoUrl = state.repoUrl;
  }
  if (!settings.owner && typeof state?.owner === 'string') {
    settings.owner = state.owner;
  }
  if (!settings.repo && typeof state?.repo === 'string') {
    settings.repo = state.repo;
  }
  if (!settings.pollingIntervalMs && typeof settings.pollingInterval === 'number') {
    settings.pollingIntervalMs = settings.pollingInterval;
  }
  if (!settings.webhookUrl && typeof state?.settings?.webhookUrl === 'string') {
    settings.webhookUrl = state.settings.webhookUrl;
  }
  if (!settings.branchProtection && state?.settings?.branchProtection) {
    settings.branchProtection = state.settings.branchProtection;
  }
  return settings;
};

function stopAutoRefresh(sessionKey) {
  const key = resolveSessionKey(sessionKey);
  const existing = pollingTimers.get(key);
  if (existing?.timer) {
    clearInterval(existing.timer);
  }
  pollingTimers.delete(key);
}

function scheduleAutoRefreshIfNeeded(sessionKey, state) {
  const key = resolveSessionKey(sessionKey);
  const settings = getEffectiveSettings(state);
  const autoSync = typeof settings.autoSync === 'boolean' ? settings.autoSync : false;

  if (!autoSync) {
    stopAutoRefresh(key);
    return;
  }

  const intervalRaw = settings.pollingIntervalMs ?? settings.pollingInterval ?? DEFAULT_POLLING_INTERVAL;
  const interval = normalizePollingInterval(intervalRaw);
  const existing = pollingTimers.get(key);

  if (existing && existing.interval === interval) {
    return;
  }

  if (existing?.timer) {
    clearInterval(existing.timer);
  }

  const timer = setInterval(() => {
    refreshSnapshot(key).catch((error) => {
      console.error('❌ Automatic GitHub refresh failed:', error?.message || error);
    });
  }, interval);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  pollingTimers.set(key, { timer, interval });
}

const resolveRepoConfig = async (sessionKey) => {
  const resolvedKey = resolveSessionKey(sessionKey);
  const state = await getStatus(resolvedKey);
  if (!state?.connected) {
    throw Object.assign(new Error('GitHub integration is not connected yet'), { status: 412 });
  }

  const settings = getEffectiveSettings(state);

  const repoUrl = settings.repoUrl || state.status?.remoteUrl || process.env.GITHUB_REPO_URL;
  const owner = settings.owner || state.owner || process.env.GITHUB_REPO_OWNER || process.env.GITHUB_OWNER;
  const repo = settings.repo || state.repo || process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO;

  if (repoUrl) {
    const parsed = parseRepoInput(repoUrl);
    return { ...parsed, sessionKey: resolvedKey, state, settings, token: settings.githubToken || process.env.GITHUB_TOKEN };
  }

  if (owner && repo) {
    return {
      owner,
      repo,
      repoUrl: `https://github.com/${owner}/${repo}.git`,
      sessionKey: resolvedKey,
      state,
      settings,
      token: settings.githubToken || process.env.GITHUB_TOKEN
    };
  }

  throw Object.assign(new Error('GitHub repository details missing. Configure repo connection first.'), { status: 500 });
};

const computeStats = (snapshot) => {
  if (!snapshot) return null;
  return {
    total: snapshot.commits?.length || 0,
    today: snapshot.commits?.filter((commit) => {
      if (!commit?.date) return false;
      const ts = new Date(commit.date).getTime();
      return Number.isFinite(ts) && Date.now() - ts < 24 * 60 * 60 * 1000;
    }).length || 0,
    prs: snapshot.pulls?.length || 0,
    issues: snapshot.issues?.length || 0,
    stars: snapshot.stats?.stars || snapshot.repository?.stargazers_count || 0,
    forks: snapshot.stats?.forks || snapshot.repository?.forks_count || 0
  };
};

const fetchRepositoryAnalytics = async ({ owner, repo, token }) => {
  const octokit = getOctokit(token);

  const repository = await safeCall(
    'repos.get',
    () => octokit.repos.get({ owner, repo }),
    { fallback: null, transform: (res) => res?.data || null }
  );

  const collaboratorsRaw = await safeCall(
    'repos.listCollaborators',
    () => octokit.repos.listCollaborators({ owner, repo, per_page: 100 }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const webhooksRaw = await safeCall(
    'repos.listWebhooks',
    () => octokit.repos.listWebhooks({ owner, repo, per_page: 100 }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const workflowsRaw = await safeCall(
    'actions.listRepoWorkflows',
    () => octokit.actions.listRepoWorkflows({ owner, repo, per_page: 100 }),
    { fallback: [], transform: (res) => res?.data?.workflows || [] }
  );

  const workflowRunsRaw = await safeCall(
    'actions.listWorkflowRunsForRepo',
    () => octokit.actions.listWorkflowRunsForRepo({ owner, repo, per_page: 50 }),
    { fallback: [], transform: (res) => res?.data?.workflow_runs || [] }
  );

  const branchesRaw = await safeCall(
    'repos.listBranches',
    () => octokit.repos.listBranches({ owner, repo, per_page: 100 }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const contributorsRaw = await safeCall(
    'repos.listContributors',
    () => octokit.repos.listContributors({ owner, repo, per_page: 100 }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const commitActivity = await safeCall(
    'repos.getCommitActivityStats',
    () => octokit.repos.getCommitActivityStats({ owner, repo }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const participation = await safeCall(
    'repos.getParticipationStats',
    () => octokit.repos.getParticipationStats({ owner, repo }),
    {
      fallback: { all: [], owner: [] },
      transform: (res) => res?.data || { all: [], owner: [] }
    }
  );

  const openIssuesRaw = await safeCall(
    'issues.listForRepo(open)',
    () => octokit.issues.listForRepo({ owner, repo, state: 'open', per_page: 50, sort: 'created', direction: 'desc' }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const closedIssuesRaw = await safeCall(
    'issues.listForRepo(closed)',
    () => octokit.issues.listForRepo({ owner, repo, state: 'closed', per_page: 50, sort: 'updated', direction: 'desc' }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const openPullsRaw = await safeCall(
    'pulls.list(open)',
    () => octokit.pulls.list({ owner, repo, state: 'open', per_page: 50 }),
    { fallback: [], transform: (res) => res?.data || [] }
  );

  const branchProtection = [];
  await Promise.all(
    branchesRaw
      .filter((branch) => branch?.protected)
      .map(async (branch) => {
        const protection = await safeCall(
          `repos.getBranchProtection(${branch.name})`,
          () => octokit.repos.getBranchProtection({ owner, repo, branch: branch.name }),
          { fallback: null, transform: (res) => res?.data || null }
        );
        if (protection) {
          branchProtection.push({ branch: branch.name, rules: protection });
        }
      })
  );

  const collaborators = collaboratorsRaw.map(mapCollaborator);
  const webhooks = webhooksRaw.map(mapWebhook);
  const workflows = workflowsRaw.map(mapWorkflow);
  const workflowRuns = workflowRunsRaw.map(mapWorkflowRun);
  const issuesOpen = openIssuesRaw.map(mapIssueForUi);
  const issuesClosed = closedIssuesRaw.map(mapIssueForUi);
  const pulls = openPullsRaw.map(mapPullForUi);

  const totalCommits = commitActivity.reduce((sum, week) => sum + (week?.total || 0), 0);
  const recentActivity = commitActivity.slice(-4).map((week) => ({
    week: week.week,
    total: week.total,
    days: week.days,
  }));

  const topContributors = contributorsRaw
    .slice(0, 8)
    .map((contributor) => ({
      login: contributor.login,
      contributions: contributor.contributions,
      avatar_url: contributor.avatar_url,
    }));

  const workflowSuccessRate = workflowRuns.length
    ? Math.round(
        (workflowRuns.filter((run) => run.conclusion === 'success').length / workflowRuns.length) * 100
      )
    : 0;

  return {
    repository,
    collaborators,
    webhooks,
    workflows,
    workflowRuns,
    branches: branchesRaw,
    branchProtection,
    commitActivity,
    participation,
    contributors: topContributors,
    issues: {
      open: issuesOpen,
      closed: issuesClosed,
    },
    pulls,
    analyticsSummary: {
      totalCommits,
      workflowSuccessRate,
      openIssues: issuesOpen.length,
      closedIssues: issuesClosed.length,
      openPullRequests: pulls.length,
      recentActivity,
      participation,
    },
    updatedAt: new Date().toISOString(),
  };
};

const refreshSnapshot = async (sessionKey) => {
  const config = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(config.token);
  const snapshot = await fetchRepositorySnapshot(octokit, config.owner, config.repo);
  const updatedState = await updateState(config.sessionKey, (previous) => {
    const previousSettings = getEffectiveSettings(previous);
    const mergedSettings = {
      ...previousSettings,
      ...(config.settings || {}),
      repoUrl: snapshot.repoUrl || config.repoUrl || previousSettings.repoUrl,
      owner: config.owner || previousSettings.owner,
      repo: config.repo || previousSettings.repo,
      updatedAt: new Date().toISOString(),
    };

    const status = {
      ...(previous.status || {}),
      ...(snapshot.status || {}),
      branch:
        snapshot.status?.branch ||
        snapshot.branches?.current ||
        mergedSettings.branch ||
        previous.status?.branch,
      remoteUrl: snapshot.repoUrl || previous.status?.remoteUrl,
      autoSync:
        typeof mergedSettings.autoSync === 'boolean'
          ? Boolean(mergedSettings.autoSync)
          : previous.status?.autoSync,
    };

    return {
      ...previous,
      ...snapshot,
      repoUrl: snapshot.repoUrl || config.repoUrl || previous.repoUrl,
      owner: config.owner,
      repo: config.repo,
      status,
      stats: computeStats(snapshot),
      settings: mergedSettings,
      lastSynced: new Date().toISOString(),
      connected: true,
    };
  });

  scheduleAutoRefreshIfNeeded(config.sessionKey, updatedState);
  return updatedState;
};

const getCommits = async (sessionKey, { limit = 20 } = {}) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const response = await octokit.repos.listCommits({ owner, repo, per_page: Math.min(limit, 100) });
  return response.data.map((commit) => ({
    hash: commit.sha?.slice(0, 7),
    fullHash: commit.sha,
    message: commit.commit?.message,
    date: commit.commit?.author?.date || commit.commit?.committer?.date,
    author: commit.commit?.author?.name || commit.author?.login || 'Unknown',
    url: commit.html_url
  }));
};

const getBranches = async (sessionKey) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const response = await octokit.repos.listBranches({ owner, repo, per_page: 100 });
  return response.data.map((branch) => ({
    name: branch.name,
    hash: branch.commit?.sha,
    protected: branch.protected,
    type: 'remote'
  }));
};

const getIssuesStats = async (sessionKey) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const [openIssues, closedIssues] = await Promise.all([
    octokit.issues.listForRepo({ owner, repo, state: 'open', per_page: 100, sort: 'created', direction: 'desc' }),
    octokit.issues.listForRepo({ owner, repo, state: 'closed', per_page: 100, sort: 'updated', direction: 'desc' })
  ]);

  const open = (openIssues.data || []).map(mapIssueForUi);
  const closed = (closedIssues.data || []).map(mapIssueForUi);

  const labelMatches = (issue, keyword) =>
    Array.isArray(issue.labels) && issue.labels.some((label) => new RegExp(keyword, 'i').test(label));

  // Test by updating settings and verifying data refresh in sections.
  return {
    success: true,
    updatedAt: new Date().toISOString(),
    totals: {
      open: open.length,
      closed: closed.length,
      inProgress: open.filter((issue) => labelMatches(issue, 'progress')).length,
      backlog: open.filter((issue) => labelMatches(issue, 'backlog')).length
    },
    issues: {
      open,
      closed,
    }
  };
};

const createIssue = async (sessionKey, payload) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const result = await octokit.issues.create({ owner, repo, ...payload });
  return { success: true, issue: result.data };
};

const closeIssue = async (sessionKey, issueNumber) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const result = await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' });
  return { success: true, issue: result.data };
};

const listWebhooks = async (sessionKey) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const response = await octokit.repos.listWebhooks({ owner, repo, per_page: 100 });
  return response.data;
};

const deleteWebhook = async (sessionKey, webhookId) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  await octokit.repos.deleteWebhook({ owner, repo, hook_id: webhookId });
  return { success: true };
};

const updateWebhook = async (sessionKey, webhookId, updates) => {
  const { owner, repo, token } = await resolveRepoConfig(sessionKey);
  const octokit = getOctokit(token);
  const result = await octokit.repos.updateWebhook({ owner, repo, hook_id: webhookId, ...updates });
  return { success: true, webhook: result.data };
};

const rotateWebhookSecret = async (sessionKey, webhookId) => {
  const secret = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 40);
  const result = await updateWebhook(sessionKey, webhookId, { config: { secret } });
  return { ...result, secret };
};

const ensureCollaboratorAccess = async (sessionKey, input = {}) => {
  const config = await resolveRepoConfig(sessionKey);
  const { owner, repo, token } = config;
  const octokit = getOctokit(token);

  const collaboratorLogin = pickFirstString(
    input.username,
    input.login,
    config.settings?.defaultCollaborator,
    process.env.GITHUB_AUTOMATION_COLLABORATOR
  );

  if (!collaboratorLogin) {
    throw Object.assign(new Error('Collaborator username is required for automation'), { status: 400 });
  }

  const desiredPermission = normalizePermission(
    input.permission || config.settings?.defaultCollaboratorPermission || process.env.GITHUB_AUTOMATION_COLLABORATOR_PERMISSION
  );

  const { data: collaborators } = await octokit.repos.listCollaborators({ owner, repo, per_page: 100 });
  const existing = collaborators.find((collaborator) => collaborator.login.toLowerCase() === collaboratorLogin.toLowerCase());

  const permissionRank = { pull: 1, triage: 2, push: 3, maintain: 4, admin: 5 };
  const rankFromPermissions = (permissions = {}) => {
    if (!permissions) return 0;
    if (permissions.admin) return permissionRank.admin;
    if (permissions.maintain) return permissionRank.maintain;
    if (permissions.push) return permissionRank.push;
    if (permissions.triage) return permissionRank.triage;
    if (permissions.pull) return permissionRank.pull;
    return 0;
  };

  const currentRank = existing ? rankFromPermissions(existing.permissions) : 0;
  const desiredRank = permissionRank[desiredPermission] || permissionRank.push;

  let action = 'unchanged';

  if (!existing) {
    await octokit.repos.addCollaborator({ owner, repo, username: collaboratorLogin, permission: desiredPermission });
    action = 'invited';
  } else if (currentRank < desiredRank) {
    await octokit.repos.addCollaborator({ owner, repo, username: collaboratorLogin, permission: desiredPermission });
    action = 'permission-updated';
  }

  return {
    success: true,
    collaborator: {
      login: collaboratorLogin,
      permission: desiredPermission,
      action,
    },
  };
};

const ensureWebhookConfigured = async (sessionKey, input = {}) => {
  const config = await resolveRepoConfig(sessionKey);
  const { owner, repo, token } = config;
  const octokit = getOctokit(token);
  const settings = await getSettings(sessionKey, config.state);

  const url = pickFirstString(
    input.url,
    settings.webhookUrl,
    process.env.GITHUB_AUTOMATION_WEBHOOK_URL,
    process.env.REPLIT_URL ? `${process.env.REPLIT_URL.replace(/\/$/, '')}/api/github/webhook` : null
  );

  if (!url) {
    throw Object.assign(new Error('Webhook URL is required before automation can run'), { status: 400 });
  }

  const eventsRaw = Array.isArray(input.events) && input.events.length > 0
    ? input.events
    : Array.isArray(settings.webhookEvents) && settings.webhookEvents.length > 0
      ? settings.webhookEvents
      : ['push', 'pull_request'];

  const events = Array.from(new Set(eventsRaw.map((event) => String(event).trim()).filter(Boolean)));

  const secret = pickFirstString(input.secret, settings.webhookSecret, process.env.GITHUB_WEBHOOK_SECRET);
  const contentType = pickFirstString(input.contentType, 'json');

  const configPayload = {
    url,
    content_type: contentType,
    insecure_ssl: input.insecureSsl ? '1' : '0',
    ...(secret ? { secret } : {}),
  };

  const { data: webhooks } = await octokit.repos.listWebhooks({ owner, repo, per_page: 100 });
  const existing = webhooks.find((hook) => hook.config?.url === url);

  const sortEvents = (list = []) => [...list].map(String).map((value) => value.trim()).filter(Boolean).sort();

  let action = 'unchanged';
  let webhookId = existing?.id || null;

  if (existing) {
    const existingEvents = sortEvents(existing.events);
    const desiredEvents = sortEvents(events);
    const eventsChanged = JSON.stringify(existingEvents) !== JSON.stringify(desiredEvents);
    const contentChanged = (existing.config?.content_type || 'json') !== contentType;
    const secretChanged = secret ? existing.config?.secret !== secret : false;
    const activeChanged = existing.active === false;

    if (eventsChanged || contentChanged || secretChanged || activeChanged) {
      const result = await octokit.repos.updateWebhook({
        owner,
        repo,
        hook_id: existing.id,
        config: configPayload,
        events: desiredEvents,
        active: true,
      });
      webhookId = result.data.id;
      action = 'updated';
    }
  } else {
    const result = await octokit.repos.createWebhook({
      owner,
      repo,
      config: configPayload,
      events,
      active: true,
    });
    webhookId = result.data.id;
    action = 'created';
  }

  return {
    success: true,
    webhook: {
      id: webhookId,
      url,
      events,
      action,
      active: true,
      hasSecret: Boolean(secret),
    },
  };
};

const ensureRepositoryMetadata = async (sessionKey, input = {}) => {
  try {
    const config = await resolveRepoConfig(sessionKey);
    const { owner, repo, token } = config;
    const octokit = getOctokit(token);

    const desiredDescription = pickFirstString(
      input.description,
      process.env.GITHUB_AUTOMATION_DESCRIPTION
    );

    const desiredHomepage = pickFirstString(
      input.homepage,
      process.env.GITHUB_AUTOMATION_HOMEPAGE
    );

    const topicsInput = Object.prototype.hasOwnProperty.call(input, 'topics')
      ? parseTopicsInput(input.topics)
      : parseTopicsInput(process.env.GITHUB_AUTOMATION_TOPICS);

    const repoResponse = await octokit.repos.get({ owner, repo });
    let repository = repoResponse.data;

    const updates = {};
    if (typeof desiredDescription === 'string' && desiredDescription !== repository.description) {
      updates.description = desiredDescription;
    }
    if (typeof desiredHomepage === 'string' && desiredHomepage !== repository.homepage) {
      updates.homepage = desiredHomepage;
    }

    let descriptionUpdated = false;
    if (Object.keys(updates).length > 0) {
      const result = await octokit.repos.update({ owner, repo, ...updates });
      repository = result.data;
      descriptionUpdated = true;
    }

    let topicsUpdated = false;
    let appliedTopics = repository.topics || [];

    if (topicsInput !== null) {
      const normalizedTopics = Array.from(new Set(topicsInput));
      const existingTopics = Array.from(new Set((repository.topics || []).map((topic) => topic.toLowerCase())));
      const normalizedSorted = [...normalizedTopics].sort();
      const existingSorted = [...existingTopics].sort();

      if (JSON.stringify(normalizedSorted) !== JSON.stringify(existingSorted)) {
        await octokit.repos.replaceAllTopics({ owner, repo, names: normalizedTopics });
        topicsUpdated = true;
        appliedTopics = normalizedTopics;
      } else {
        appliedTopics = existingTopics;
      }
    }

    return {
      success: true,
      metadata: {
        description: repository.description,
        homepage: repository.homepage,
        topics: appliedTopics,
      },
      updated: {
        description: descriptionUpdated,
        topics: topicsUpdated,
      },
    };
  } catch (error) {
    if (error?.status === 403 || error?.statusCode === 403) {
      console.warn('⚠️ [Metadata] GitHub denied metadata update (403)');
      return {
        success: false,
        metadata: {},
        updated: {
          description: false,
          topics: false,
        },
        error: 'FORBIDDEN',
      };
    }
    throw error;
  }
};

const ensureBranchProtectionRules = async (sessionKey, input = {}) => {
  const config = await resolveRepoConfig(sessionKey);
  const { owner, repo, token } = config;
  const octokit = getOctokit(token);

  const branchName = pickFirstString(
    input.branch,
    config.settings?.branch,
    config.state?.status?.branch,
    config.state?.repository?.default_branch,
    'main'
  );

  const requiredStatusChecks = Object.prototype.hasOwnProperty.call(input, 'requiredStatusChecks')
    ? input.requiredStatusChecks
    : {
        strict: true,
        contexts: Array.isArray(input.statusCheckContexts) ? input.statusCheckContexts : [],
      };

  const enforceAdmins = Object.prototype.hasOwnProperty.call(input, 'enforceAdmins')
    ? Boolean(input.enforceAdmins)
    : true;

  const requiredPullRequestReviews = Object.prototype.hasOwnProperty.call(input, 'requiredPullRequestReviews')
    ? input.requiredPullRequestReviews
    : {
        required_approving_review_count: 1,
      };

  const restrictions = Object.prototype.hasOwnProperty.call(input, 'restrictions')
    ? input.restrictions
    : null;

  const allowForcePushes = Boolean(input.allowForcePushes);
  const allowDeletions = Boolean(input.allowDeletions);

  await octokit.repos.updateBranchProtection({
    owner,
    repo,
    branch: branchName,
    required_status_checks: requiredStatusChecks,
    enforce_admins: enforceAdmins,
    required_pull_request_reviews: requiredPullRequestReviews,
    restrictions,
    allow_force_pushes: allowForcePushes,
    allow_deletions: allowDeletions,
  });

  const protection = await octokit.repos.getBranchProtection({ owner, repo, branch: branchName });

  return {
    success: true,
    branch: branchName,
    protection: protection.data,
  };
};

const buildDashboardPayload = ({ snapshot, analytics, settings }) => {
  const repository = analytics?.repository || snapshot.repository || null;
  const branches = snapshot.branches || { remote: [], local: [] };
  const pulls = Array.isArray(analytics?.pulls) && analytics.pulls.length > 0 ? analytics.pulls : snapshot.pulls || [];
  const issuesOpen = analytics?.issues?.open || snapshot.issues || [];
  const issuesClosed = analytics?.issues?.closed || [];
  const analyticsSummary = analytics?.analyticsSummary || null;

  return {
    success: true,
    status: snapshot.status,
    stats: snapshot.stats || computeStats(snapshot),
    commits: snapshot.commits || [],
    branches,
    pulls,
    issues: {
      open: issuesOpen,
      closed: issuesClosed,
    },
    repository,
    collaborators: analytics?.collaborators || [],
    webhooks: analytics?.webhooks || [],
    workflows: analytics?.workflows || [],
    workflowRuns: analytics?.workflowRuns || [],
    branchProtection: analytics?.branchProtection || [],
    analytics: analyticsSummary,
    commitActivity: analytics?.commitActivity || [],
    participation: analytics?.participation || { all: [], owner: [] },
    settings,
    lastSynced: snapshot.lastSynced,
    updatedAt: analytics?.updatedAt || snapshot.lastSynced,
    dashboard: {
      repository,
      collaborators: analytics?.collaborators || [],
      branches: Array.isArray(branches?.remote) ? branches.remote : branches,
      workflowRuns: analytics?.workflowRuns || [],
      workflows: analytics?.workflows || [],
      webhooks: analytics?.webhooks || [],
      topics: repository?.topics || [],
      analytics: analyticsSummary,
      issues: {
        open: issuesOpen,
        closed: issuesClosed,
      },
      pulls,
      branchProtection: analytics?.branchProtection || [],
    },
    analyticsRaw: analytics,
  };
};

const getDetailedStatus = async (sessionKey, options = {}) => {
  const snapshot = await ensureSnapshotFresh(sessionKey, options);
  if (!snapshot) {
    const refreshed = await refreshSnapshot(sessionKey);
    const refreshedSettings = await getSettings(sessionKey, refreshed);
    return buildDashboardPayload({ snapshot: refreshed, analytics: null, settings: refreshedSettings });
  }

  const settings = await getSettings(sessionKey, snapshot);
  let analytics = null;
  try {
    const config = await resolveRepoConfig(sessionKey);
    analytics = await fetchRepositoryAnalytics(config);
  } catch (error) {
    console.warn('⚠️ [GitHubAI:detailedStatus] analytics load failed:', error?.message || error);
  }

  return buildDashboardPayload({ snapshot, analytics, settings });
};

const getDashboard = async (sessionKey, options = {}) => {
  const detailed = await getDetailedStatus(sessionKey, options);
  return {
    success: detailed.success,
    dashboard: detailed.dashboard,
    status: detailed.status,
    stats: detailed.stats,
    commits: detailed.commits,
    branches: detailed.branches,
    pulls: detailed.pulls,
    issues: detailed.issues,
    repository: detailed.repository,
    collaborators: detailed.collaborators,
    webhooks: detailed.webhooks,
    workflows: detailed.workflows,
    workflowRuns: detailed.workflowRuns,
    branchProtection: detailed.branchProtection,
    analytics: detailed.analytics,
    settings: detailed.settings,
    lastSynced: detailed.lastSynced,
    updatedAt: detailed.updatedAt,
  };
};

const ensureSnapshotFresh = async (sessionKey, { maxAgeMs, force } = {}) => {
  const resolvedKey = resolveSessionKey(sessionKey);
  const ttl = Number.isFinite(maxAgeMs) ? Math.max(maxAgeMs, MIN_POLLING_INTERVAL) : DEFAULT_POLLING_INTERVAL;

  if (force) {
    return refreshSnapshot(resolvedKey);
  }

  const currentState = await loadState(resolvedKey);
  const lastSyncedAt = currentState?.lastSynced ? Date.parse(currentState.lastSynced) : 0;
  const shouldRefresh = !currentState?.connected || !lastSyncedAt || Date.now() - lastSyncedAt > ttl;

  if (shouldRefresh) {
    try {
      return await refreshSnapshot(resolvedKey);
    } catch (error) {
      console.error('❌ GitHub snapshot refresh failed:', error?.message || error);
    }
  }

  if (currentState) {
    scheduleAutoRefreshIfNeeded(resolvedKey, currentState);
    return currentState;
  }

  return loadState(resolvedKey);
};

const getRealtimeState = async (sessionKey, options = {}) => {
  const state = await ensureSnapshotFresh(sessionKey, options);
  if (state) {
    return state;
  }
  return getStatus(sessionKey);
};

const formatSettingsForClient = (state) => {
  if (!state) {
    return {
      repoUrl: '',
      owner: undefined,
      repo: undefined,
      branch: 'main',
      autoSync: false,
      pollingIntervalMs: DEFAULT_POLLING_INTERVAL,
      tokenMasked: null,
      hasToken: false,
      lastSynced: null,
      updatedAt: null,
      autoCommit: false,
      autoMerge: false,
      webhookUrl: '',
      webhookSecretMasked: null,
      webhookConfigured: false,
      branchProtection: null,
    };
  }

  const settings = getEffectiveSettings(state);
  const pollingIntervalMs = normalizePollingInterval(settings.pollingIntervalMs ?? settings.pollingInterval ?? DEFAULT_POLLING_INTERVAL);

  return {
    repoUrl: settings.repoUrl || '',
    owner: settings.owner || state.owner,
    repo: settings.repo || state.repo,
    branch: settings.branch || state.status?.branch || 'main',
    autoSync: Boolean(settings.autoSync),
    pollingIntervalMs,
    tokenMasked: maskToken(settings.githubToken),
    hasToken: Boolean(settings.githubToken),
    lastSynced: state.lastSynced || null,
    updatedAt: settings.updatedAt || state.updatedAt || null,
    autoCommit: typeof settings.autoCommit === 'boolean' ? settings.autoCommit : Boolean(state.status?.autoCommit),
    autoMerge: typeof settings.autoMerge === 'boolean' ? settings.autoMerge : Boolean(state.status?.autoMerge),
    webhookUrl: settings.webhookUrl || '',
    webhookSecretMasked: maskSecret(settings.webhookSecret),
    webhookConfigured: Boolean(settings.webhookSecret),
    branchProtection: settings.branchProtection || null,
  };
};

const getSettings = async (sessionKey, preloadedState) => {
  const state = preloadedState || await getRealtimeState(sessionKey);
  return formatSettingsForClient(state);
};

const toggleSetting = async (sessionKey, key, value) => {
  const state = await updateState(sessionKey, (previous) => {
    const settings = {
      ...(previous.settings || {}),
      [key]: value,
      updatedAt: new Date().toISOString(),
    };

    return {
      ...previous,
      status: {
        ...(previous.status || {}),
        [key]: value,
      },
      settings,
    };
  });
  return { success: true, status: state.status };
};

const getFeedbackCollection = () => (firestore ? firestore.collection(FEEDBACK_COLLECTION) : null);

const recordFeedback = async ({ sessionKey, payload }) => {
  const collection = getFeedbackCollection();
  if (!collection) {
    return { success: false, error: 'Feedback storage unavailable' };
  }
  const doc = await collection.add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sessionKey: resolveSessionKey(sessionKey)
  });
  return { success: true, id: doc.id };
};

const feedbackStats = async () => {
  const collection = getFeedbackCollection();
  if (!collection) {
    return { success: false, totals: { feedback: 0, bugs: 0, featureRequests: 0 } };
  }
  const snapshot = await collection.get();
  const totals = { feedback: 0, bugs: 0, featureRequests: 0 };
  snapshot.forEach((doc) => {
    const data = doc.data();
    totals.feedback += 1;
    if (data.type === 'bug') totals.bugs += 1;
    if (data.type === 'feature') totals.featureRequests += 1;
  });
  return { success: true, totals };
};

const saveSettings = async (sessionKey, payload = {}) => {
  const resolvedKey = resolveSessionKey(sessionKey);
  const input = typeof payload === 'object' && payload !== null ? payload : {};
  const updates = {};

  if (typeof input.repoUrl === 'string' && input.repoUrl.trim()) {
    updates.repoUrl = input.repoUrl.trim();
  }
  if (typeof input.owner === 'string' && input.owner.trim()) {
    updates.owner = input.owner.trim();
  }
  if (typeof input.repo === 'string' && input.repo.trim()) {
    updates.repo = input.repo.trim();
  }
  if (typeof input.branch === 'string' && input.branch.trim()) {
    updates.branch = input.branch.trim();
  }
  if (typeof input.autoSync === 'boolean') {
    updates.autoSync = input.autoSync;
  }
  if (typeof input.autoCommit === 'boolean') {
    updates.autoCommit = input.autoCommit;
  }
  if (typeof input.autoMerge === 'boolean') {
    updates.autoMerge = input.autoMerge;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'pollingIntervalMs')) {
    updates.pollingIntervalMs = normalizePollingInterval(input.pollingIntervalMs);
  } else if (Object.prototype.hasOwnProperty.call(input, 'pollingInterval')) {
    updates.pollingIntervalMs = normalizePollingInterval(input.pollingInterval);
  }
  if (typeof input.githubToken === 'string' && input.githubToken.trim()) {
    updates.githubToken = input.githubToken.trim();
  }
  if (typeof input.webhookUrl === 'string') {
    updates.webhookUrl = input.webhookUrl.trim();
  }
  if (Object.prototype.hasOwnProperty.call(input, 'webhookSecret')) {
    const secretRaw = typeof input.webhookSecret === 'string' ? input.webhookSecret.trim() : '';
    updates.webhookSecret = secretRaw.length > 0 ? secretRaw : null;
  }
  if (typeof input.branchProtection === 'object' && input.branchProtection !== null) {
    updates.branchProtection = input.branchProtection;
  } else if (Object.prototype.hasOwnProperty.call(input, 'branchProtectionRules')) {
    const rulesRaw = typeof input.branchProtectionRules === 'string' ? input.branchProtectionRules.trim() : '';
    if (!rulesRaw) {
      updates.branchProtection = null;
    } else {
      try {
        updates.branchProtection = JSON.parse(rulesRaw);
      } catch (error) {
        throw Object.assign(new Error('Branch protection rules must be valid JSON'), { status: 400, cause: error });
      }
    }
  }

  let parsedFromUrl = null;
  if (updates.repoUrl) {
    parsedFromUrl = parseRepoInput(updates.repoUrl);
  }

  const updatedState = await updateState(resolvedKey, (previous) => {
    const previousSettings = getEffectiveSettings(previous);
    const mergedSettings = {
      ...previousSettings,
      ...(parsedFromUrl
        ? { repoUrl: parsedFromUrl.repoUrl, owner: parsedFromUrl.owner, repo: parsedFromUrl.repo }
        : {}),
      ...(updates.owner ? { owner: updates.owner } : {}),
      ...(updates.repo ? { repo: updates.repo } : {}),
      ...(updates.branch ? { branch: updates.branch } : {}),
      ...(updates.pollingIntervalMs ? { pollingIntervalMs: updates.pollingIntervalMs } : {}),
      ...(typeof updates.autoSync === 'boolean' ? { autoSync: updates.autoSync } : {}),
      ...(typeof updates.autoCommit === 'boolean' ? { autoCommit: updates.autoCommit } : {}),
      ...(typeof updates.autoMerge === 'boolean' ? { autoMerge: updates.autoMerge } : {}),
      ...(updates.githubToken ? { githubToken: updates.githubToken } : {}),
      ...(typeof updates.webhookUrl !== 'undefined' ? { webhookUrl: updates.webhookUrl } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'webhookSecret')
        ? { webhookSecret: updates.webhookSecret }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'branchProtection')
        ? { branchProtection: updates.branchProtection }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    const status = {
      ...(previous.status || {}),
      remoteUrl: parsedFromUrl?.repoUrl || updates.repoUrl || previous.status?.remoteUrl,
    };

    if (updates.branch) {
      status.branch = updates.branch;
    }
    if (typeof updates.autoSync === 'boolean') {
      status.autoSync = updates.autoSync;
    }
    if (typeof updates.autoCommit === 'boolean') {
      status.autoCommit = updates.autoCommit;
    }
    if (typeof updates.autoMerge === 'boolean') {
      status.autoMerge = updates.autoMerge;
    }

    return {
      ...previous,
      repoUrl: parsedFromUrl?.repoUrl || updates.repoUrl || previous.repoUrl,
      owner: parsedFromUrl?.owner || updates.owner || previous.owner,
      repo: parsedFromUrl?.repo || updates.repo || previous.repo,
      status,
      settings: mergedSettings,
    };
  });

  if (updates.githubToken) {
    process.env.GITHUB_TOKEN = updates.githubToken;
  }

  let latestState = updatedState;
  if (updates.repoUrl || updates.owner || updates.repo || updates.branch) {
    try {
      latestState = await refreshSnapshot(resolvedKey);
    } catch (error) {
      console.warn('⚠️ [GitHubAI:saveSettings] refresh after save failed:', error?.message || error);
    }
  }

  scheduleAutoRefreshIfNeeded(resolvedKey, latestState);

  // Test by updating settings and verifying data refresh.
  return formatSettingsForClient(latestState);
};

module.exports = {
  resolveRepoConfig,
  refreshSnapshot,
  ensureSnapshotFresh,
  getRealtimeState,
  getCommits,
  getBranches,
  getIssuesStats,
  createIssue,
  closeIssue,
  listWebhooks,
  deleteWebhook,
  updateWebhook,
  rotateWebhookSecret,
  ensureCollaboratorAccess,
  ensureWebhookConfigured,
  ensureRepositoryMetadata,
  ensureBranchProtectionRules,
  getDashboard,
  getDetailedStatus,
  toggleSetting,
  recordFeedback,
  feedbackStats,
  loadState,
  getSettings,
  saveSettings,
};

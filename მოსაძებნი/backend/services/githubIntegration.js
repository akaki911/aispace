const { Octokit } = require('@octokit/rest');
const admin = require('../firebase');

const DEFAULT_STATUS = {
  connected: false,
  status: { success: false },
  stats: null,
  commits: [],
  branches: null,
  issues: [],
  pulls: [],
  settings: {},
};

const COLLECTION = process.env.GITHUB_STATE_COLLECTION || 'github-configs';
const DEFAULT_SESSION_KEY = 'global-admin';

const firestore = typeof admin?.firestore === 'function' ? admin.firestore() : null;
const stateCache = new Map();

const isIntegrationEnabled = () => {
  const flag = process.env.GITHUB_INTEGRATION_ENABLED;
  if (flag === undefined) {
    return true;
  }
  return flag !== 'false' && flag !== '0';
};

const getDocRef = (sessionKey = DEFAULT_SESSION_KEY) => {
  if (!firestore) {
    return null;
  }
  return firestore.collection(COLLECTION).doc(sessionKey);
};

const getSessionKey = (inputKey) => {
  if (typeof inputKey === 'string' && inputKey.trim().length > 0) {
    return inputKey.trim();
  }
  return DEFAULT_SESSION_KEY;
};

const parseRepoInput = (input) => {
  const defaultOwner = process.env.GITHUB_REPO_OWNER || '';
  const defaultRepo = process.env.GITHUB_REPO_NAME || '';
  const fallbackUrl = process.env.GITHUB_REPO_URL || (defaultOwner && defaultRepo
    ? `https://github.com/${defaultOwner}/${defaultRepo}.git`
    : '');

  let repoInput = (typeof input === 'string' && input.trim().length > 0) ? input.trim() : fallbackUrl;
  if (!repoInput) {
    throw Object.assign(new Error('Repository URL is required'), { status: 400 });
  }

  // Support owner/repo shorthand
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/.test(repoInput)) {
    const [ownerPart, repoPartRaw] = repoInput.replace(/\.git$/i, '').split('/');
    return {
      owner: ownerPart,
      repo: repoPartRaw,
      repoUrl: `https://github.com/${ownerPart}/${repoPartRaw}.git`,
    };
  }

  // Support git@github.com:owner/repo.git
  if (repoInput.startsWith('git@')) {
    const match = repoInput.match(/^git@[^:]+:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(\.git)?$/);
    if (!match) {
      throw Object.assign(new Error('Invalid Git repository URL'), { status: 400 });
    }
    const [, ownerPart, repoPartRaw] = match;
    return {
      owner: ownerPart,
      repo: repoPartRaw,
      repoUrl: `https://github.com/${ownerPart}/${repoPartRaw}.git`,
    };
  }

  try {
    const parsed = new URL(repoInput);
    if (!/github\.com$/i.test(parsed.hostname)) {
      throw Object.assign(new Error('Only GitHub repositories are supported'), { status: 400 });
    }

    const segments = parsed.pathname.replace(/^\/+|\/+$|\.git$/g, '').split('/');
    if (segments.length < 2) {
      throw Object.assign(new Error('GitHub repository URL must include owner and name'), { status: 400 });
    }

    const [ownerPart, repoPartRaw] = segments;
    return {
      owner: ownerPart,
      repo: repoPartRaw,
      repoUrl: `https://github.com/${ownerPart}/${repoPartRaw}.git`,
    };
  } catch (error) {
    throw Object.assign(new Error('Invalid repository URL'), { status: 400, cause: error });
  }
};

const getOctokit = (token) => {
  const resolvedToken = token || process.env.GITHUB_TOKEN;
  if (!resolvedToken) {
    throw Object.assign(new Error('GitHub token is not configured'), { status: 500 });
  }

  return new Octokit({
    auth: resolvedToken,
    userAgent: 'bakhmaro-management-hub',
  });
};

const mapCommit = (commit) => ({
  hash: commit.sha ? commit.sha.slice(0, 7) : undefined,
  fullHash: commit.sha,
  message: commit.commit?.message?.split('\n')[0] || 'No commit message',
  date: commit.commit?.author?.date || commit.commit?.committer?.date,
  author: commit.author
    ? {
        login: commit.author.login,
        avatar_url: commit.author.avatar_url,
      }
    : commit.commit?.author?.name || 'Unknown',
  url: commit.html_url,
});

const mapIssue = (issue) => ({
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
  url: issue.html_url,
});

const mapPull = (pull) => ({
  number: pull.number,
  title: pull.title,
  state: pull.state,
  created_at: pull.created_at,
  updated_at: pull.updated_at,
  merged_at: pull.merged_at,
  author: pull.user ? { login: pull.user.login, avatar_url: pull.user.avatar_url } : undefined,
  url: pull.html_url,
});

const mapBranch = (branch, defaultBranch) => ({
  name: branch.name,
  hash: branch.commit?.sha,
  type: 'remote',
  current: branch.name === defaultBranch,
});

const extractRateLimit = (headers) => {
  if (!headers) return undefined;
  const remaining = Number.parseInt(headers['x-ratelimit-remaining'] || headers.get?.('x-ratelimit-remaining') || '', 10);
  const reset = Number.parseInt(headers['x-ratelimit-reset'] || headers.get?.('x-ratelimit-reset') || '', 10);
  if (Number.isNaN(remaining) || Number.isNaN(reset)) {
    return undefined;
  }
  return { remaining, reset };
};

const logRecentCommits = (commits) => {
  if (!Array.isArray(commits) || commits.length === 0) {
    console.log('ℹ️ No commits returned from GitHub');
    return;
  }

  console.group('🧪 GitHub Connection Commit Sample');
  commits.slice(0, 5).forEach((commit, index) => {
    const message = commit.commit?.message?.split('\n')[0] || 'No message';
    const sha = commit.sha ? commit.sha.slice(0, 7) : 'unknown';
    console.log(`${index + 1}. ${sha} - ${message}`);
  });
  console.groupEnd();
};

const fetchRepositorySnapshot = async (octokit, owner, repo) => {
  const [repoResponse, commitsResponse, issuesResponse, pullsResponse, branchesResponse] = await Promise.all([
    octokit.repos.get({ owner, repo }),
    octokit.repos.listCommits({ owner, repo, per_page: 25 }),
    octokit.issues.listForRepo({ owner, repo, state: 'open', per_page: 25 }),
    octokit.pulls.list({ owner, repo, state: 'open', per_page: 25 }),
    octokit.repos.listBranches({ owner, repo, per_page: 100 }),
  ]);

  logRecentCommits(commitsResponse.data || []);

  const repoData = repoResponse.data;
  const commits = (commitsResponse.data || []).map(mapCommit);
  const issues = (issuesResponse.data || []).map(mapIssue);
  const pulls = (pullsResponse.data || []).map(mapPull);
  const branches = {
    remote: (branchesResponse.data || []).map((branch) => mapBranch(branch, repoData.default_branch)),
    current: repoData.default_branch,
  };

  const stats = {
    prs: pulls.length,
    issues: issues.length,
    stars: repoData.stargazers_count || 0,
    forks: repoData.forks_count || 0,
    total: repoData.open_issues_count || commits.length,
    today: commits.filter((commit) => {
      if (!commit.date) return false;
      const commitDate = new Date(commit.date);
      if (Number.isNaN(commitDate.getTime())) return false;
      return Date.now() - commitDate.getTime() <= 24 * 60 * 60 * 1000;
    }).length,
  };

  const rateLimit = extractRateLimit(repoResponse.headers);

  return {
    connected: true,
    repoUrl: `https://github.com/${owner}/${repo}.git`,
    owner,
    repo,
    account: repoData.owner ? { login: repoData.owner.login, avatar_url: repoData.owner.avatar_url } : undefined,
    status: {
      success: true,
      branch: repoData.default_branch,
      remoteUrl: `https://github.com/${owner}/${repo}.git`,
      autoSync: false,
      autoCommit: false,
    },
    stats,
    commits,
    branches,
    issues,
    pulls,
    rateLimit,
    repository: {
      name: repoData.name,
      description: repoData.description,
      private: repoData.private,
      default_branch: repoData.default_branch,
      topics: repoData.topics || [],
      html_url: repoData.html_url,
    },
    lastSynced: new Date().toISOString(),
  };
};

const saveState = async (sessionKey, state) => {
  const key = getSessionKey(sessionKey);
  stateCache.set(key, state);

  const docRef = getDocRef(key);
  if (!docRef) {
    return state;
  }

  const payload = {
    ...state,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(payload, { merge: true });
  return state;
};

const FIRESTORE_RETRYABLE_CODES = new Set([
  'resource-exhausted',
  'deadline-exceeded',
  'aborted',
  'cancelled',
  'unavailable',
  8, // gRPC RESOURCE_EXHAUSTED
  10, // gRPC ABORTED
  1, // gRPC CANCELLED
  14, // gRPC UNAVAILABLE
  '8',
  '10',
  '1',
  '14',
]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadState = async (sessionKey) => {
  const key = getSessionKey(sessionKey);
  if (stateCache.has(key)) {
    return stateCache.get(key);
  }

  const docRef = getDocRef(key);
  if (!docRef) {
    return stateCache.get(key) || null;
  }

  let attempt = 0;
  const maxAttempts = 3;
  const baseDelay = 200;

  try {
    let snapshot;
    while (attempt < maxAttempts) {
      try {
        snapshot = await docRef.get();
        break;
      } catch (error) {
        attempt += 1;
        const code = error?.code;
        if (!FIRESTORE_RETRYABLE_CODES.has(code) || attempt >= maxAttempts) {
          throw error;
        }

        const delay = baseDelay * 2 ** (attempt - 1);
        console.warn(
          `⚠️ Firestore loadState retry (${attempt}/${maxAttempts}) due to ${code || 'unknown error'}. Retrying in ${delay}ms.`
        );
        await wait(delay);
      }
    }

    if (!snapshot) {
      return stateCache.get(key) || null;
    }

    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data();
    stateCache.set(key, data);
    return data;
  } catch (error) {
    console.error('❌ Failed to load GitHub state from Firestore:', error.message || error);
    return stateCache.get(key) || null;
  }
};

const getStatus = async (sessionKey) => {
  if (!isIntegrationEnabled()) {
    return { ...DEFAULT_STATUS, integrationDisabled: true };
  }

  const state = await loadState(sessionKey);
  if (!state) {
    return { ...DEFAULT_STATUS };
  }

  return {
    ...DEFAULT_STATUS,
    ...state,
  };
};

const connect = async ({ repoUrl, token, sessionKey }) => {
  if (!isIntegrationEnabled()) {
    return { ...DEFAULT_STATUS, integrationDisabled: true };
  }

  const { owner, repo, repoUrl: normalizedUrl } = parseRepoInput(repoUrl);
  const octokit = getOctokit(token);

  try {
    const snapshot = await fetchRepositorySnapshot(octokit, owner, repo);
    const previousState = await loadState(sessionKey);
    const enriched = {
      ...(previousState || {}),
      ...snapshot,
      repoUrl: normalizedUrl,
      settings: previousState?.settings || {},
    };
    await saveState(sessionKey, enriched);
    return enriched;
  } catch (error) {
    const status = error.status || error.statusCode || error.response?.status;
    console.error('❌ GitHub connect error:', error.message || error, { status });
    if (status === 401 || status === 403) {
      throw Object.assign(new Error('GitHub authentication failed. Please verify your token.'), { status: 401 });
    }
    if (status === 404) {
      throw Object.assign(new Error('Repository not found. Please verify the owner and name.'), { status: 404 });
    }
    throw Object.assign(new Error(error.message || 'Failed to connect to GitHub'), { status: status || 500 });
  }
};

const disconnect = async (sessionKey) => {
  const key = getSessionKey(sessionKey);
  stateCache.delete(key);
  const docRef = getDocRef(key);
  if (docRef) {
    await docRef.delete().catch((error) => {
      console.error('❌ Failed to delete GitHub state from Firestore:', error.message || error);
    });
  }
  return { ...DEFAULT_STATUS };
};

const updateState = async (sessionKey, updater) => {
  const key = getSessionKey(sessionKey);
  const current = await loadState(key) || { ...DEFAULT_STATUS };
  const nextState = typeof updater === 'function' ? updater({ ...current }) : { ...current, ...updater };
  return saveState(key, nextState);
};

// Attempt to warm the cache on startup for the default key
loadState(DEFAULT_SESSION_KEY).catch((error) => {
  console.warn('⚠️ Unable to preload GitHub state:', error.message || error);
});

module.exports = {
  connect,
  disconnect,
  getStatus,
  isIntegrationEnabled,
  parseRepoInput,
  loadState,
  fetchRepositorySnapshot,
  getOctokit,
  updateState,
};

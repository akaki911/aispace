// @ts-nocheck
// TODO(SOL-626): Remove GitHub data ts-nocheck after resolving typing issues in the management module.
// useGitHubData.ts - React hook that hydrates the GitHub overview UI with
// analytics, issues, workflow, and repository metadata from the backend.

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildAdminHeaders } from '../../../utils/adminToken';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export interface GitHubStats {
  prs?: number;
  issues?: number;
  stars?: number;
  forks?: number;
  total?: number;
  today?: number;
  [key: string]: unknown;
}

export interface GitHubCommitSummary {
  hash?: string;
  fullHash?: string;
  sha?: string;
  message?: string;
  date?: string | number | Date;
  author?: string | { name?: string; login?: string; email?: string };
  email?: string;
  parents?: string[];
  isMerge?: boolean;
  [key: string]: unknown;
}

export interface GitHubBranchSummary {
  name?: string;
  hash?: string;
  ahead?: number;
  behind?: number;
  current?: boolean;
  type?: string;
  [key: string]: unknown;
}

export interface GitHubBranchCollection {
  local?: GitHubBranchSummary[];
  remote?: GitHubBranchSummary[];
  current?: string;
  [key: string]: unknown;
}

export interface GitHubStatusPayload {
  branch?: string;
  hasChanges?: boolean;
  changesCount?: number;
  remoteUrl?: string;
  autoSync?: boolean;
  autoCommit?: boolean;
  autoMerge?: boolean;
  success?: boolean;
  clean?: boolean;
  [key: string]: unknown;
}

export interface GitHubIssueSummary {
  number?: number;
  title?: string;
  state?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
  labels?: string[];
}

export interface GitHubIssueGroup {
  open: GitHubIssueSummary[];
  closed: GitHubIssueSummary[];
}

export interface GitHubWebhookSummary {
  id?: number;
  url?: string;
  active?: boolean;
  events?: string[];
  updated_at?: string;
}

export interface GitHubCollaboratorSummary {
  login: string;
  role?: string;
  avatar_url?: string;
}

export interface GitHubWorkflowSummary {
  id: number | string;
  name?: string;
  state?: string;
  html_url?: string;
  updated_at?: string;
}

export interface GitHubWorkflowRunSummary {
  id: number | string;
  name?: string;
  status?: string;
  conclusion?: string | null;
  created_at?: string;
  html_url?: string;
}

export interface GitHubPullRequestSummary {
  number?: number;
  title?: string;
  state?: string;
  url?: string;
  updated_at?: string;
}

export interface GitHubAnalyticsSummary {
  totalCommits?: number;
  workflowSuccessRate?: number;
  openIssues?: number;
  closedIssues?: number;
  openPullRequests?: number;
  recentActivity?: Array<{ week?: string | number; total?: number }>;
  participation?: { all?: number[]; owner?: number[] };
}

export interface GitHubContributorSummary {
  login: string;
  contributions?: number;
  avatar_url?: string;
}

export interface GitHubCommitActivityWeek {
  week?: number;
  total?: number;
  days?: number[];
}

export interface GitHubBranchProtectionRule {
  branch: string;
  rules: Record<string, unknown>;
}

export interface GitHubRepositorySummary {
  name?: string;
  description?: string | null;
  html_url?: string;
  topics?: string[];
  default_branch?: string;
  private?: boolean;
}

export interface GitHubDataState {
  status: GitHubStatusPayload | null;
  stats: GitHubStats | null;
  commits: GitHubCommitSummary[];
  branches: GitHubBranchCollection | null;
  settings: GitHubIntegrationSettings | null;
  repos?: unknown[];
  workflows?: GitHubWorkflowSummary[];
  pulls?: GitHubPullRequestSummary[];
  issues?: GitHubIssueGroup | null;
  webhooks?: GitHubWebhookSummary[];
  collaborators?: GitHubCollaboratorSummary[];
  workflowRuns?: GitHubWorkflowRunSummary[];
  branchProtection?: GitHubBranchProtectionRule[];
  analytics?: GitHubAnalyticsSummary | null;
  repository?: GitHubRepositorySummary | null;
  commitActivity?: GitHubCommitActivityWeek[];
  participation?: { all?: number[]; owner?: number[] } | null;
  contributors?: GitHubContributorSummary[];
  lastSynced?: string | null;
  updatedAt?: string | null;
  connected?: boolean;
  isLoaded?: boolean;
  loading: boolean;
  error: string | null;
  integrationAvailable: boolean;
}

export type UseGitHubDataReturn = GitHubDataState & {
  data: GitHubDataState;
  refetch: () => void;
  canRefetch: boolean;
};

export interface GitHubIntegrationSettings {
  repoUrl?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  autoSync?: boolean;
  autoCommit?: boolean;
  autoMerge?: boolean;
  pollingIntervalMs?: number;
  tokenMasked?: string | null;
  hasToken?: boolean;
  lastSynced?: string | null;
  updatedAt?: string | null;
  webhookUrl?: string;
  webhookSecretMasked?: string | null;
  webhookConfigured?: boolean;
  branchProtection?: unknown;
}

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

const normalizeStats = (input: unknown): GitHubStats | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubStats = {};
  (['prs', 'issues', 'stars', 'forks', 'total', 'today'] as Array<keyof GitHubStats>).forEach((key) => {
    const value = input[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      normalized[key] = value;
    }
  });

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeStatus = (input: unknown): GitHubStatusPayload | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubStatusPayload = {};

  const branch = toStringOrUndefined(input.branch);
  if (branch) normalized.branch = branch;

  if (typeof input.hasChanges === 'boolean') normalized.hasChanges = input.hasChanges;
  if (typeof input.changesCount === 'number') normalized.changesCount = input.changesCount;
  if (typeof input.remoteUrl === 'string') normalized.remoteUrl = input.remoteUrl;
  if (typeof input.autoSync === 'boolean') normalized.autoSync = input.autoSync;
  if (typeof input.autoCommit === 'boolean') normalized.autoCommit = input.autoCommit;
  if (typeof input.autoMerge === 'boolean') normalized.autoMerge = input.autoMerge;
  if (typeof input.success === 'boolean') normalized.success = input.success;
  if (typeof input.clean === 'boolean') normalized.clean = input.clean;

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeIssueSummary = (input: unknown): GitHubIssueSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const issue: GitHubIssueSummary = {};
  if (typeof input.number === 'number' && Number.isFinite(input.number)) issue.number = input.number;
  if (typeof input.title === 'string') issue.title = input.title;
  if (typeof input.state === 'string') issue.state = input.state;
  const url = toStringOrUndefined(input.html_url ?? input.url);
  if (url) issue.url = url;
  if (typeof input.created_at === 'string') issue.created_at = input.created_at;
  if (typeof input.updated_at === 'string') issue.updated_at = input.updated_at;

  if (Array.isArray(input.labels)) {
    const labels = input.labels
      .map((label) => {
        if (typeof label === 'string') return label;
        if (isRecord(label) && typeof label.name === 'string') return label.name;
        return null;
      })
      .filter((label): label is string => Boolean(label));
    if (labels.length) {
      issue.labels = labels;
    }
  }

  return Object.keys(issue).length > 0 ? issue : null;
};

const normalizeIssuesGroup = (input: unknown): GitHubIssueGroup | null => {
  if (!isRecord(input)) {
    if (Array.isArray(input)) {
      const normalized = input.map(normalizeIssueSummary).filter(Boolean) as GitHubIssueSummary[];
      return { open: normalized, closed: [] };
    }
    return null;
  }

  const open = Array.isArray(input.open)
    ? (input.open.map(normalizeIssueSummary).filter(Boolean) as GitHubIssueSummary[])
    : [];
  const closed = Array.isArray(input.closed)
    ? (input.closed.map(normalizeIssueSummary).filter(Boolean) as GitHubIssueSummary[])
    : [];

  return { open, closed };
};

const normalizeWebhookSummary = (input: unknown): GitHubWebhookSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const summary: GitHubWebhookSummary = {};
  if (typeof input.id === 'number') summary.id = input.id;
  if (typeof input.id === 'string' && !Number.isNaN(Number.parseInt(input.id, 10))) {
    summary.id = Number.parseInt(input.id, 10);
  }

  const url = toStringOrUndefined(input.url ?? (isRecord(input.config) ? input.config.url : undefined));
  if (url) summary.url = url;
  if (typeof input.active === 'boolean') summary.active = input.active;
  if (Array.isArray(input.events)) {
    summary.events = input.events.filter((event): event is string => typeof event === 'string');
  }
  if (typeof input.updated_at === 'string') summary.updated_at = input.updated_at;

  return Object.keys(summary).length > 0 ? summary : null;
};

const normalizeCollaboratorSummary = (input: unknown): GitHubCollaboratorSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const login = toStringOrUndefined(input.login);
  if (!login) {
    return null;
  }

  const collaborator: GitHubCollaboratorSummary = { login };
  if (typeof input.role === 'string') collaborator.role = input.role;
  const avatar = toStringOrUndefined(input.avatar_url ?? input.avatar);
  if (avatar) collaborator.avatar_url = avatar;

  return collaborator;
};

const normalizeWorkflowSummary = (input: unknown): GitHubWorkflowSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const id = typeof input.id === 'number' || typeof input.id === 'string' ? input.id : undefined;
  if (id === undefined) {
    return null;
  }

  const workflow: GitHubWorkflowSummary = { id };
  if (typeof input.name === 'string') workflow.name = input.name;
  if (typeof input.state === 'string') workflow.state = input.state;
  const url = toStringOrUndefined(input.html_url ?? input.url);
  if (url) workflow.html_url = url;
  if (typeof input.updated_at === 'string') workflow.updated_at = input.updated_at;

  return workflow;
};

const normalizeWorkflowRunSummary = (input: unknown): GitHubWorkflowRunSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const id = typeof input.id === 'number' || typeof input.id === 'string' ? input.id : undefined;
  if (id === undefined) {
    return null;
  }

  const run: GitHubWorkflowRunSummary = { id };
  if (typeof input.name === 'string') run.name = input.name;
  if (typeof input.status === 'string') run.status = input.status;
  if (typeof input.conclusion === 'string' || input.conclusion === null) run.conclusion = input.conclusion as string | null;
  if (typeof input.created_at === 'string') run.created_at = input.created_at;
  const url = toStringOrUndefined(input.html_url ?? input.url);
  if (url) run.html_url = url;

  return run;
};

const normalizePullSummary = (input: unknown): GitHubPullRequestSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const pull: GitHubPullRequestSummary = {};
  if (typeof input.number === 'number' && Number.isFinite(input.number)) pull.number = input.number;
  if (typeof input.title === 'string') pull.title = input.title;
  if (typeof input.state === 'string') pull.state = input.state;
  const url = toStringOrUndefined(input.html_url ?? input.url);
  if (url) pull.url = url;
  if (typeof input.updated_at === 'string') pull.updated_at = input.updated_at;

  return Object.keys(pull).length > 0 ? pull : null;
};

const normalizeAnalyticsSummary = (input: unknown): GitHubAnalyticsSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const summary: GitHubAnalyticsSummary = {};
  if (typeof input.totalCommits === 'number' && Number.isFinite(input.totalCommits)) {
    summary.totalCommits = input.totalCommits;
  }
  if (typeof input.workflowSuccessRate === 'number' && Number.isFinite(input.workflowSuccessRate)) {
    summary.workflowSuccessRate = input.workflowSuccessRate;
  }
  if (typeof input.openIssues === 'number' && Number.isFinite(input.openIssues)) summary.openIssues = input.openIssues;
  if (typeof input.closedIssues === 'number' && Number.isFinite(input.closedIssues)) summary.closedIssues = input.closedIssues;
  if (typeof input.openPullRequests === 'number' && Number.isFinite(input.openPullRequests)) {
    summary.openPullRequests = input.openPullRequests;
  }

  if (Array.isArray(input.recentActivity)) {
    summary.recentActivity = input.recentActivity
      .map((activity) => {
        if (!isRecord(activity)) {
          return null;
        }
        const week =
          typeof activity.week === 'number' || typeof activity.week === 'string'
            ? (activity.week as number | string)
            : undefined;
        const total = typeof activity.total === 'number' && Number.isFinite(activity.total) ? activity.total : undefined;

        if (week === undefined && total === undefined) {
          return null;
        }

        return { week, total };
      })
      .filter((entry): entry is { week?: string | number; total?: number } => Boolean(entry));
  }

  if (isRecord(input.participation)) {
    const mapSeries = (value: unknown): number[] | undefined =>
      Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? entry : Number.parseInt(String(entry ?? ''), 10)))
            .filter((entry) => Number.isFinite(entry))
        : undefined;

    const allSeries = mapSeries(input.participation.all);
    const ownerSeries = mapSeries(input.participation.owner);
    if (allSeries || ownerSeries) {
      summary.participation = {};
      if (allSeries) summary.participation.all = allSeries;
      if (ownerSeries) summary.participation.owner = ownerSeries;
    }
  }

  return Object.keys(summary).length > 0 ? summary : null;
};

const normalizeContributorSummary = (input: unknown): GitHubContributorSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const login = toStringOrUndefined(input.login);
  if (!login) {
    return null;
  }

  const contributor: GitHubContributorSummary = { login };
  if (typeof input.contributions === 'number' && Number.isFinite(input.contributions)) {
    contributor.contributions = input.contributions;
  }
  const avatar = toStringOrUndefined(input.avatar_url ?? input.avatar);
  if (avatar) contributor.avatar_url = avatar;

  return contributor;
};

const normalizeCommitActivityWeek = (input: unknown): GitHubCommitActivityWeek | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubCommitActivityWeek = {};
  if (typeof input.week === 'number' && Number.isFinite(input.week)) normalized.week = input.week;
  if (typeof input.total === 'number' && Number.isFinite(input.total)) normalized.total = input.total;
  if (Array.isArray(input.days)) {
    const days = input.days
      .map((day) => (typeof day === 'number' && Number.isFinite(day) ? day : Number.parseInt(String(day ?? ''), 10)))
      .filter((day) => Number.isFinite(day));
    if (days.length) {
      normalized.days = days;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeBranchProtectionRule = (input: unknown): GitHubBranchProtectionRule | null => {
  if (!isRecord(input)) {
    return null;
  }

  const branch = toStringOrUndefined(input.branch);
  if (!branch) {
    return null;
  }

  const rulesValue = input.rules && typeof input.rules === 'object' ? (input.rules as Record<string, unknown>) : {};
  return { branch, rules: rulesValue };
};

const normalizeRepositorySummary = (input: unknown): GitHubRepositorySummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const repository: GitHubRepositorySummary = {};
  if (typeof input.name === 'string') repository.name = input.name;
  if (typeof input.description === 'string' || input.description === null) repository.description = input.description as
    | string
    | null;
  const url = toStringOrUndefined(input.html_url ?? input.url);
  if (url) repository.html_url = url;
  if (Array.isArray(input.topics)) {
    repository.topics = input.topics.filter((topic): topic is string => typeof topic === 'string');
  }
  if (typeof input.default_branch === 'string') repository.default_branch = input.default_branch;
  if (typeof input.private === 'boolean') repository.private = input.private;

  return Object.keys(repository).length > 0 ? repository : null;
};

const normalizeWebhooks = (input: unknown): GitHubWebhookSummary[] =>
  Array.isArray(input)
    ? (input.map(normalizeWebhookSummary).filter(Boolean) as GitHubWebhookSummary[])
    : [];

const normalizeCollaborators = (input: unknown): GitHubCollaboratorSummary[] =>
  Array.isArray(input)
    ? (input.map(normalizeCollaboratorSummary).filter(Boolean) as GitHubCollaboratorSummary[])
    : [];

const normalizeWorkflows = (input: unknown): GitHubWorkflowSummary[] =>
  Array.isArray(input)
    ? (input.map(normalizeWorkflowSummary).filter(Boolean) as GitHubWorkflowSummary[])
    : [];

const normalizeWorkflowRuns = (input: unknown): GitHubWorkflowRunSummary[] =>
  Array.isArray(input)
    ? (input.map(normalizeWorkflowRunSummary).filter(Boolean) as GitHubWorkflowRunSummary[])
    : [];

const normalizePulls = (input: unknown): GitHubPullRequestSummary[] =>
  Array.isArray(input)
    ? (input.map(normalizePullSummary).filter(Boolean) as GitHubPullRequestSummary[])
    : [];

const normalizeBranchProtection = (input: unknown): GitHubBranchProtectionRule[] =>
  Array.isArray(input)
    ? (input.map(normalizeBranchProtectionRule).filter(Boolean) as GitHubBranchProtectionRule[])
    : [];

const normalizeAnalytics = (input: unknown): GitHubAnalyticsSummary | null => normalizeAnalyticsSummary(input);

const normalizeCommitActivity = (input: unknown): GitHubCommitActivityWeek[] =>
  Array.isArray(input)
    ? (input.map(normalizeCommitActivityWeek).filter(Boolean) as GitHubCommitActivityWeek[])
    : [];

const normalizeParticipation = (input: unknown): { all?: number[]; owner?: number[] } | null => {
  if (!isRecord(input)) {
    return null;
  }

  const mapSeries = (value: unknown): number[] | undefined =>
    Array.isArray(value)
      ? value
          .map((entry) =>
            typeof entry === 'number' && Number.isFinite(entry)
              ? entry
              : Number.parseInt(String(entry ?? ''), 10)
          )
          .filter((entry) => Number.isFinite(entry))
      : undefined;

  const allSeries = mapSeries(input.all);
  const ownerSeries = mapSeries(input.owner);

  if (!allSeries && !ownerSeries) {
    return null;
  }

  return {
    ...(allSeries ? { all: allSeries } : {}),
    ...(ownerSeries ? { owner: ownerSeries } : {}),
  };
};

const normalizeContributors = (input: unknown): GitHubContributorSummary[] =>
  Array.isArray(input)
    ? (input.map(normalizeContributorSummary).filter(Boolean) as GitHubContributorSummary[])
    : [];

const normalizeBranchSummary = (input: unknown): GitHubBranchSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const name = toStringOrUndefined(input.name);
  if (!name) {
    return null;
  }

  const summary: GitHubBranchSummary = { name };
  const hash = toStringOrUndefined(input.hash);
  if (hash) summary.hash = hash;
  const ahead = toNumberOrUndefined(input.ahead);
  if (ahead !== undefined) summary.ahead = ahead;
  const behind = toNumberOrUndefined(input.behind);
  if (behind !== undefined) summary.behind = behind;
  if (typeof input.current === 'boolean') summary.current = input.current;
  if (typeof input.type === 'string') summary.type = input.type;

  return summary;
};

const normalizeBranchCollection = (input: unknown): GitHubBranchCollection | null => {
  if (Array.isArray(input)) {
    const local = input.map(normalizeBranchSummary).filter(Boolean) as GitHubBranchSummary[];
    return { local };
  }

  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubBranchCollection = {};

  if (Array.isArray(input.local)) {
    normalized.local = input.local.map(normalizeBranchSummary).filter(Boolean) as GitHubBranchSummary[];
  }

  if (Array.isArray(input.remote)) {
    normalized.remote = input.remote.map(normalizeBranchSummary).filter(Boolean) as GitHubBranchSummary[];
  }

  const current = toStringOrUndefined(input.current);
  if (current) {
    normalized.current = current;
  }

  return normalized;
};

const normalizeCommitSummary = (input: unknown): GitHubCommitSummary | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubCommitSummary = {};

  const hash = toStringOrUndefined(input.hash);
  const fullHash = toStringOrUndefined(input.fullHash) ?? toStringOrUndefined(input.sha);
  if (hash) normalized.hash = hash;
  if (fullHash) normalized.fullHash = fullHash;

  if (typeof input.message === 'string') normalized.message = input.message;

  if (
    input.date instanceof Date ||
    typeof input.date === 'string' ||
    typeof input.date === 'number'
  ) {
    normalized.date = input.date as string | number | Date;
  }

  if (typeof input.author === 'string' || isRecord(input.author)) {
    normalized.author = input.author as GitHubCommitSummary['author'];
  }

  if (typeof input.email === 'string') {
    normalized.email = input.email;
  }

  if (Array.isArray(input.parents)) {
    normalized.parents = input.parents.map(String);
  }

  if (typeof input.isMerge === 'boolean') {
    normalized.isMerge = input.isMerge;
  }

  const hasMeaningfulData = Boolean(
    normalized.hash ||
    normalized.fullHash ||
    normalized.message ||
    normalized.date
  );

  return hasMeaningfulData ? normalized : null;
};

const normalizeCommitsPayload = (input: unknown): GitHubCommitSummary[] => {
  if (Array.isArray(input)) {
    return input.map(normalizeCommitSummary).filter(Boolean) as GitHubCommitSummary[];
  }

  if (isRecord(input)) {
    const commitArray = Array.isArray(input.commits)
      ? input.commits
      : Array.isArray(input.data)
        ? input.data
        : [];

    return commitArray.map(normalizeCommitSummary).filter(Boolean) as GitHubCommitSummary[];
  }

  return [];
};

// Rate limiting utility
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests: number = 5, timeWindow: number = 60000) { // 5 requests per minute
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.timeWindow - (Date.now() - oldestRequest));
  }
}

const normalizeSettings = (input: unknown): GitHubIntegrationSettings | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubIntegrationSettings = {};

  if (typeof input.repoUrl === 'string') normalized.repoUrl = input.repoUrl;
  if (typeof input.owner === 'string') normalized.owner = input.owner;
  if (typeof input.repo === 'string') normalized.repo = input.repo;
  if (typeof input.branch === 'string') normalized.branch = input.branch;
  if (typeof input.autoSync === 'boolean') normalized.autoSync = input.autoSync;
  if (typeof input.autoCommit === 'boolean') normalized.autoCommit = input.autoCommit;
  if (typeof input.autoMerge === 'boolean') normalized.autoMerge = input.autoMerge;

  const pollingRaw = isRecord(input.settings)
    ? (input.settings as Record<string, unknown>).pollingIntervalMs
    : input.pollingIntervalMs ?? input.pollingInterval;
  const pollingValue = typeof pollingRaw === 'number' ? pollingRaw : Number.parseInt(String(pollingRaw ?? ''), 10);
  if (Number.isFinite(pollingValue)) {
    normalized.pollingIntervalMs = pollingValue;
  }

  if (typeof input.pollingIntervalMs === 'number') {
    normalized.pollingIntervalMs = input.pollingIntervalMs;
  }

  if (typeof input.tokenMasked === 'string') normalized.tokenMasked = input.tokenMasked;
  if (typeof input.hasToken === 'boolean') normalized.hasToken = input.hasToken;
  if (typeof input.lastSynced === 'string') normalized.lastSynced = input.lastSynced;
  if (typeof input.updatedAt === 'string') normalized.updatedAt = input.updatedAt;
  if (typeof input.webhookUrl === 'string') normalized.webhookUrl = input.webhookUrl;
  if (typeof input.webhookSecretMasked === 'string') normalized.webhookSecretMasked = input.webhookSecretMasked;
  if (typeof input.webhookConfigured === 'boolean') normalized.webhookConfigured = input.webhookConfigured;
  if (input.branchProtection && typeof input.branchProtection === 'object') {
    normalized.branchProtection = input.branchProtection;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const rateLimiter = new RateLimiter();

export const useGitHubData = (): UseGitHubDataReturn => {
  const [data, setData] = useState<GitHubDataState>({
    status: null,
    stats: null,
    commits: [],
    branches: null,
    settings: null,
    repos: [],
    workflows: [],
    pulls: [],
    issues: null,
    webhooks: [],
    collaborators: [],
    workflowRuns: [],
    branchProtection: [],
    analytics: null,
    repository: null,
    commitActivity: [],
    participation: null,
    contributors: [],
    lastSynced: null,
    updatedAt: null,
    connected: undefined,
    loading: true,
    error: null,
    integrationAvailable: true
  });

  const mountedRef = useRef(true);
  const integrationStatusRef = useRef(true);

  const updateIntegrationAvailability = useCallback((available: boolean) => {
    if (!mountedRef.current) return;

    integrationStatusRef.current = available;

    setData(prev => {
      if (prev.integrationAvailable === available) {
        return prev;
      }

      return {
        ...prev,
        integrationAvailable: available
      };
    });
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchWithRetry = useCallback(async (url: string, retries: number = 2): Promise<Response> => {
    // Create new AbortController for this request
    if (abortControllerRef.current) {
      console.log(`🔄 abort:cleanup - Aborting previous request for new one`);
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    for (let i = 0; i <= retries; i++) {
      try {
        // Check if component unmounted
        if (!mountedRef.current) {
          console.log(`🔄 abort:unmount - Component unmounted, cancelling request`);
          currentController.abort();
          return Promise.reject(new Error('Component unmounted'));
        }

        if (!rateLimiter.canMakeRequest()) {
          const waitTime = rateLimiter.getWaitTime();
          console.log(`Rate limit reached, waiting ${waitTime}ms`);
          await sleep(Math.min(waitTime, 30000)); // Max 30s wait
        }

        rateLimiter.recordRequest();

        // Console log for request
        console.log(`🔄 GitHub API Request: ${url}`);
        console.log(`   Attempt: ${i + 1}/${retries + 1}`);

        const response = await fetch(url, {
          headers: buildAdminHeaders({ Accept: 'application/json' }),
          credentials: 'include',
          signal: currentController.signal
        });

        // Console log for response
        console.log(`📡 GitHub API Response: ${url}`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

        // For successful responses, clone and log response data
        if (response.ok && response.status === 200) {
          const clonedResponse = response.clone();
          try {
            const responseData = await clonedResponse.json();
            console.log(`✅ Response Data for ${url}:`, responseData);
          } catch (jsonError) {
            console.log(`⚠️ Could not parse JSON response for ${url}:`, jsonError);
          }
        }

        // SOL-219: Don't retry on 404, 400, 401, 403 - these are permanent errors
        if (response.status === 404) {
          // 404 means endpoint not found - stop retrying and mark as unavailable
          updateIntegrationAvailability(false);
          throw new Error(`GitHub Integration not available: ${url}`);
        }

        if (!response.ok) {
          // Only retry on 429, 502, 503, 504 server errors
          if (response.status === 429 || (response.status >= 502 && response.status <= 504)) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          // Don't retry on other errors - return gracefully
          updateIntegrationAvailability(false);
          throw new Error(`GitHub API Error ${response.status}: ${response.statusText}`);
        }

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          console.log(`Rate limited, waiting ${Math.min(retryAfter, 60)} seconds`);
          await sleep(Math.min(retryAfter * 1000, 60000)); // Max 60s wait
          continue;
        }

        // Only retry on 500, 502, 503, 504
        if ([500, 502, 503, 504].includes(response.status) && i < retries) {
          console.log(`Server error ${response.status}, retrying in ${(i + 1) * 2} seconds...`);
          await sleep((i + 1) * 2000);
          continue;
        }

        return response;
      } catch (error) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : 'Unknown error occurred');
        // SOL-304: Enhanced abort error classification
        if (
          normalizedError.name === 'AbortError' ||
          normalizedError.message?.includes('aborted') ||
          normalizedError.message?.includes('signal is aborted')
        ) {
          console.log(`🔄 abort:race - Request intentionally aborted: ${url}`);
          // Don't throw for abort errors - let them fail silently
          throw new Error('REQUEST_ABORTED');
        }

        if (normalizedError.message === 'Component unmounted') {
          console.log(`🔄 abort:unmount - Component cleanup abort`);
          throw new Error('REQUEST_ABORTED');
        }

        if (i === retries) throw normalizedError;
        await sleep((i + 1) * 1000);
      }
    }
    throw new Error('Max retries exceeded');
  }, [updateIntegrationAvailability]);

  const logPortConflictIfPresent = useCallback((error: unknown) => {
    if (!(error instanceof Error)) {
      return;
    }

    if (/already in use|eaddrinuse/i.test(error.message)) {
      console.warn('⚠️ GitHub data fetch detected a potential port conflict:', error.message);
    }
  }, []);

  const fetchGitHubData = useCallback(async () => {
    if (!mountedRef.current) return;

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.group('🔄 GitHub Data Fetch Process');
      console.log('📋 Fetching GitHub repository snapshot from backend...');

      const statusRes = await fetchWithRetry('/api/ai/github/status/detailed');
      if (!mountedRef.current) {
        console.groupEnd();
        return;
      }

      if (!statusRes.ok) {
        if (statusRes.status === 404) {
          console.warn('Primary AI GitHub endpoint unavailable, attempting fallback /api/github/status');
          const fallbackRes = await fetchWithRetry('/api/github/status', 0);
          if (!fallbackRes.ok) {
            const fallbackMessage = `GitHub status fallback failed: ${fallbackRes.status} ${fallbackRes.statusText}`;
            setData(prev => ({
              ...prev,
              loading: false,
              error: fallbackMessage,
              integrationAvailable: fallbackRes.status !== 404 && fallbackRes.status !== 401,
            }));
            if (fallbackRes.status === 404) {
              updateIntegrationAvailability(false);
            }
            console.groupEnd();
            return;
          }
          const fallbackPayload = await fallbackRes.json();
          setData(prev => {
            const normalizedFallbackStatus = normalizeStatus(fallbackPayload.status ?? fallbackPayload);
            const normalizedFallbackStats = normalizeStats(
              fallbackPayload.stats ?? (fallbackPayload.detailed?.stats as unknown)
            );
            const normalizedFallbackCommits = normalizeCommitsPayload(
              fallbackPayload.commits ?? (fallbackPayload.detailed?.commits as unknown)
            );
            const normalizedFallbackBranches = normalizeBranchCollection(
              fallbackPayload.branches ?? (fallbackPayload.detailed?.branches as unknown)
            );
            const normalizedFallbackSettings = normalizeSettings(
              fallbackPayload.settings ?? (fallbackPayload.detailed?.settings as unknown)
            );
            const normalizedFallbackIssues =
              normalizeIssuesGroup(fallbackPayload.issues ?? fallbackPayload.detailed?.issues) ??
              prev.issues ?? { open: [], closed: [] };
            const normalizedFallbackWebhooks = normalizeWebhooks(
              fallbackPayload.webhooks ?? fallbackPayload.detailed?.webhooks
            );
            const normalizedFallbackCollaborators = normalizeCollaborators(
              fallbackPayload.collaborators ?? fallbackPayload.detailed?.collaborators
            );
            const normalizedFallbackWorkflowRuns = normalizeWorkflowRuns(
              fallbackPayload.workflowRuns ?? fallbackPayload.detailed?.workflowRuns
            );
            const normalizedFallbackWorkflows = normalizeWorkflows(
              fallbackPayload.workflows ?? fallbackPayload.detailed?.workflows
            );
            const normalizedFallbackPulls = normalizePulls(
              fallbackPayload.pulls ?? fallbackPayload.detailed?.pulls ?? fallbackPayload.prs
            );
            const normalizedFallbackBranchProtection = normalizeBranchProtection(
              fallbackPayload.branchProtection ?? fallbackPayload.detailed?.branchProtection
            );
            const normalizedFallbackAnalytics = normalizeAnalytics(
              fallbackPayload.analytics ?? fallbackPayload.detailed?.analytics
            );
            const normalizedFallbackRepository =
              normalizeRepositorySummary(
                fallbackPayload.repository ?? fallbackPayload.detailed?.repository ?? fallbackPayload.repo
              ) ?? prev.repository;
            const normalizedFallbackCommitActivity = normalizeCommitActivity(
              fallbackPayload.commitActivity ?? fallbackPayload.detailed?.commitActivity
            );
            const normalizedFallbackParticipation =
              normalizeParticipation(fallbackPayload.participation ?? fallbackPayload.detailed?.participation) ??
              prev.participation;
            const normalizedFallbackContributors = normalizeContributors(
              fallbackPayload.contributors ?? fallbackPayload.detailed?.contributors
            );

            return {
              ...prev,
              status: normalizedFallbackStatus,
              stats: normalizedFallbackStats,
              commits: normalizedFallbackCommits,
              branches: normalizedFallbackBranches,
              settings: normalizedFallbackSettings,
              issues: normalizedFallbackIssues,
              webhooks: normalizedFallbackWebhooks.length ? normalizedFallbackWebhooks : prev.webhooks,
              collaborators: normalizedFallbackCollaborators.length
                ? normalizedFallbackCollaborators
                : prev.collaborators,
              workflowRuns: normalizedFallbackWorkflowRuns.length
                ? normalizedFallbackWorkflowRuns
                : prev.workflowRuns,
              workflows: normalizedFallbackWorkflows.length ? normalizedFallbackWorkflows : prev.workflows,
              pulls: normalizedFallbackPulls.length ? normalizedFallbackPulls : prev.pulls,
              branchProtection: normalizedFallbackBranchProtection.length
                ? normalizedFallbackBranchProtection
                : prev.branchProtection,
              analytics: normalizedFallbackAnalytics ?? prev.analytics,
              repository: normalizedFallbackRepository ?? prev.repository,
              commitActivity: normalizedFallbackCommitActivity.length
                ? normalizedFallbackCommitActivity
                : prev.commitActivity,
              participation: normalizedFallbackParticipation ?? prev.participation,
              contributors: normalizedFallbackContributors.length
                ? normalizedFallbackContributors
                : prev.contributors,
              repos: Array.isArray(fallbackPayload.repos) ? fallbackPayload.repos : prev.repos,
              lastSynced:
                toStringOrUndefined(fallbackPayload.lastSynced ?? fallbackPayload.updatedAt) ?? prev.lastSynced ?? null,
              updatedAt: toStringOrUndefined(fallbackPayload.updatedAt) ?? prev.updatedAt ?? null,
              connected:
                typeof fallbackPayload.connected === 'boolean' ? fallbackPayload.connected : prev.connected,
              loading: false,
              error: null,
              integrationAvailable:
                fallbackPayload.integrationDisabled ? false : fallbackPayload.connected !== false,
            };
          });
          updateIntegrationAvailability(!(fallbackPayload.integrationDisabled || fallbackPayload.connected === false));
          console.groupEnd();
          return;
        }

        const message = `GitHub status request failed: ${statusRes.status} ${statusRes.statusText}`;
        console.warn(message);
        setData(prev => ({
          ...prev,
          loading: false,
          error: message,
          integrationAvailable: statusRes.status !== 404 && statusRes.status !== 401,
        }));
        if (statusRes.status === 404) {
          updateIntegrationAvailability(false);
        }
        console.groupEnd();
        return;
      }

      const payload = await statusRes.json();
      console.log('✅ GitHub status payload received:', payload);

      setData(prev => {
        const normalizedStatus = normalizeStatus(payload.status ?? payload);
        const normalizedStats = normalizeStats(payload.stats ?? (payload.detailed?.stats as unknown));
        const normalizedCommits = normalizeCommitsPayload(payload.commits ?? (payload.detailed?.commits as unknown));
        const normalizedBranches = normalizeBranchCollection(payload.branches ?? (payload.detailed?.branches as unknown));
        const normalizedSettings = normalizeSettings(payload.settings ?? (payload.detailed?.settings as unknown));
        const normalizedIssues =
          normalizeIssuesGroup(payload.issues ?? payload.detailed?.issues) ?? prev.issues ?? { open: [], closed: [] };
        const normalizedWebhooks = normalizeWebhooks(payload.webhooks ?? payload.detailed?.webhooks);
        const normalizedCollaborators = normalizeCollaborators(payload.collaborators ?? payload.detailed?.collaborators);
        const normalizedWorkflowRuns = normalizeWorkflowRuns(payload.workflowRuns ?? payload.detailed?.workflowRuns);
        const normalizedWorkflows = normalizeWorkflows(payload.workflows ?? payload.detailed?.workflows);
        const normalizedPulls = normalizePulls(payload.pulls ?? payload.detailed?.pulls ?? payload.prs);
        const normalizedBranchProtection = normalizeBranchProtection(
          payload.branchProtection ?? payload.detailed?.branchProtection
        );
        const normalizedAnalytics = normalizeAnalytics(payload.analytics ?? payload.detailed?.analytics);
        const normalizedRepository =
          normalizeRepositorySummary(payload.repository ?? payload.detailed?.repository ?? payload.repo) ?? prev.repository;
        const normalizedCommitActivity = normalizeCommitActivity(
          payload.commitActivity ?? payload.detailed?.commitActivity
        );
        const normalizedParticipation =
          normalizeParticipation(payload.participation ?? payload.detailed?.participation) ?? prev.participation;
        const normalizedContributors = normalizeContributors(payload.contributors ?? payload.detailed?.contributors);

        return {
          ...prev,
          status: normalizedStatus,
          stats: normalizedStats,
          commits: normalizedCommits,
          branches: normalizedBranches,
          settings: normalizedSettings,
          issues: normalizedIssues,
          webhooks: normalizedWebhooks.length ? normalizedWebhooks : prev.webhooks,
          collaborators: normalizedCollaborators.length ? normalizedCollaborators : prev.collaborators,
          workflowRuns: normalizedWorkflowRuns.length ? normalizedWorkflowRuns : prev.workflowRuns,
          workflows: normalizedWorkflows.length ? normalizedWorkflows : prev.workflows,
          pulls: normalizedPulls.length ? normalizedPulls : prev.pulls,
          branchProtection: normalizedBranchProtection.length
            ? normalizedBranchProtection
            : prev.branchProtection,
          analytics: normalizedAnalytics ?? prev.analytics,
          repository: normalizedRepository ?? prev.repository,
          commitActivity: normalizedCommitActivity.length ? normalizedCommitActivity : prev.commitActivity,
          participation: normalizedParticipation ?? prev.participation,
          contributors: normalizedContributors.length ? normalizedContributors : prev.contributors,
          repos: Array.isArray(payload.repos) ? payload.repos : prev.repos,
          lastSynced: toStringOrUndefined(payload.lastSynced ?? payload.updatedAt) ?? prev.lastSynced ?? null,
          updatedAt: toStringOrUndefined(payload.updatedAt) ?? prev.updatedAt ?? null,
          connected: typeof payload.connected === 'boolean' ? payload.connected : prev.connected,
          loading: false,
          error: null,
          integrationAvailable: payload.integrationDisabled ? false : payload.connected !== false,
        };
      });

      updateIntegrationAvailability(!(payload.integrationDisabled || payload.connected === false));

      console.log('✅ GitHub data fetched successfully');
      console.groupEnd();
    } catch (error) {
      const normalizedError = (
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : 'Unknown error occurred')
      );
      const isAbortError =
        normalizedError.name === 'AbortError' ||
        normalizedError.message === 'REQUEST_ABORTED' ||
        normalizedError.message === 'Component unmounted' ||
        normalizedError.message?.includes('aborted') ||
        normalizedError.message?.includes('signal is aborted');

      if (isAbortError) {
        console.log('🔄 GitHub data fetch aborted gracefully (request superseded or component unmounted)');
        if (mountedRef.current) {
          setData(prev => ({ ...prev, loading: false }));
        }
        return;
      }

      logPortConflictIfPresent(normalizedError);
      console.error('GitHub data fetch error:', normalizedError);
      if (mountedRef.current) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: normalizedError.message,
        }));
      }
    }
  }, [fetchWithRetry, logPortConflictIfPresent, updateIntegrationAvailability]);

  useEffect(() => {
    mountedRef.current = true;
    fetchGitHubData();

    // Refresh every 5 minutes to reduce rate limiting, but only if integration is available
    const interval = setInterval(() => {
      if (mountedRef.current && integrationStatusRef.current && rateLimiter.canMakeRequest()) {
        fetchGitHubData();
      } else if (!integrationStatusRef.current) {
        console.log('⏸️ Skipping GitHub refresh - integration unavailable');
      } else {
        console.log('⏸️ Skipping GitHub refresh due to rate limiting');
      }
    }, 300000); // Changed from 2 minutes to 5 minutes

    return () => {
      console.log('🔄 abort:cleanup - Component cleanup, aborting any pending requests');
      mountedRef.current = false;

      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      clearInterval(interval);
    };
  }, [fetchGitHubData]);

  useEffect(() => {
    integrationStatusRef.current = data.integrationAvailable;
  }, [data.integrationAvailable]);

  const refetch = useCallback(() => {
    if (rateLimiter.canMakeRequest()) {
      // Abort any existing request before starting new one
      if (abortControllerRef.current) {
        console.log('🔄 abort:refetch - Manual refetch, aborting previous request');
        abortControllerRef.current.abort();
      }
      fetchGitHubData();
    } else {
      const waitTime = rateLimiter.getWaitTime();
      console.log(`⏸️ Rate limited, retry available in ${Math.ceil(waitTime/1000)}s`);
      setData(prev => ({
        ...prev,
        error: `Rate limited. Retry in ${Math.ceil(waitTime/1000)}s`
      }));
    }
  }, [fetchGitHubData]);

  return {
    ...data,
    data,
    refetch,
    canRefetch: rateLimiter.canMakeRequest()
  };
};

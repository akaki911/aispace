// @ts-nocheck
// TODO(SOL-626): Remove temporary GitHub overview suppression after type errors are resolved.
import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Upload,
  Download,
  Settings,
  Clock,
  Zap,
  GitCommit,
  RefreshCw,
  Users,
  Webhook as WebhookIcon,
  Shield,
  Activity,
  ExternalLink,
  Bug
} from 'lucide-react';
import type { GitHubStatus } from './GitHubManagementHub';
import { buildAdminHeaders } from '../../utils/adminToken';

type MessageType = 'success' | 'error';

interface GitHubOverviewTabProps {
  status: GitHubStatus | null;
  loading: boolean;
  showMessage: (type: MessageType, text: string) => void;
  refetch: () => void;
  onConnectionStateChange?: () => void;
}

interface GitHubOverviewStats {
  total?: number;
  today?: number;
  prs?: number;
  issues?: number;
  stars?: number;
  forks?: number;
}

interface GitHubOverviewCommit {
  hash: string;
  message: string;
  author: string;
  displayDate: string;
}

interface GitHubOverviewBranches {
  local?: number;
  remote?: number;
}

interface GitHubOverviewIssue {
  number?: number;
  title?: string;
  state?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
  labels?: string[];
}

interface GitHubOverviewIssueGroup {
  open: GitHubOverviewIssue[];
  closed: GitHubOverviewIssue[];
}

interface GitHubOverviewWebhook {
  id?: number;
  url?: string;
  active?: boolean;
  events?: string[];
  updated_at?: string;
}

interface GitHubOverviewCollaborator {
  login: string;
  role?: string;
  avatar_url?: string;
}

interface GitHubOverviewWorkflowRun {
  id: number | string;
  name?: string;
  status?: string;
  conclusion?: string | null;
  created_at?: string;
  html_url?: string;
}

interface GitHubOverviewPull {
  number?: number;
  title?: string;
  state?: string;
  url?: string;
  updated_at?: string;
}

interface GitHubOverviewAnalytics {
  totalCommits?: number;
  workflowSuccessRate?: number;
  openIssues?: number;
  closedIssues?: number;
  openPullRequests?: number;
  recentActivity?: Array<{ week?: string | number; total?: number }>;
}

interface GitHubOverviewBranchProtectionRule {
  branch: string;
  rules: Record<string, unknown>;
}

interface GitHubOverviewRepository {
  name?: string;
  description?: string | null;
  html_url?: string;
  topics?: string[];
  default_branch?: string;
  private?: boolean;
}

interface GitHubOverviewData {
  status: GitHubStatus | null;
  stats: GitHubOverviewStats | null;
  commits: GitHubOverviewCommit[];
  branches: GitHubOverviewBranches | null;
  repos?: unknown[];
  workflows?: unknown[];
  pulls?: GitHubOverviewPull[];
  repoUrl?: string;
  connected?: boolean;
  lastSynced?: string;
  settings?: GitHubOverviewSettings | null;
  issues?: GitHubOverviewIssueGroup | null;
  webhooks?: GitHubOverviewWebhook[];
  collaborators?: GitHubOverviewCollaborator[];
  workflowRuns?: GitHubOverviewWorkflowRun[];
  branchProtection?: GitHubOverviewBranchProtectionRule[];
  analytics?: GitHubOverviewAnalytics | null;
  repository?: GitHubOverviewRepository | null;
}

interface GitHubOverviewSettings {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

const formatDateTime = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toLocaleString('ka-GE');
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('ka-GE');
    }
    return String(value);
  }

  return '';
};

const normalizeStatus = (input: unknown, fallback: GitHubStatus | null): GitHubStatus | null => {
  if (!isRecord(input) && !fallback) {
    return null;
  }

  const source = isRecord(input) ? input : {};
  return {
    success: typeof source.success === 'boolean' ? source.success : fallback?.success ?? false,
    branch: toStringOrUndefined(source.branch) ?? fallback?.branch,
    hasChanges: typeof source.hasChanges === 'boolean' ? source.hasChanges : fallback?.hasChanges,
    changesCount: typeof source.changesCount === 'number' ? source.changesCount : fallback?.changesCount,
    remoteUrl: toStringOrUndefined(source.remoteUrl) ?? fallback?.remoteUrl,
    autoSync: typeof source.autoSync === 'boolean' ? source.autoSync : fallback?.autoSync,
    autoCommit: typeof source.autoCommit === 'boolean' ? source.autoCommit : fallback?.autoCommit
  };
};

const normalizeStats = (input: unknown): GitHubOverviewStats | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubOverviewStats = {};
  (['total', 'today', 'prs', 'issues', 'stars', 'forks'] as Array<keyof GitHubOverviewStats>).forEach((key) => {
    const value = input[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      normalized[key] = value;
    }
  });

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeCommitEntry = (input: unknown, index: number): GitHubOverviewCommit | null => {
  if (!isRecord(input)) {
    return null;
  }

  const hash = toStringOrUndefined(input.hash) ?? toStringOrUndefined(input.sha) ?? `commit-${index}`;
  const message = toStringOrUndefined(input.message) ?? 'No commit message';
  const author = typeof input.author === 'string'
    ? input.author
    : isRecord(input.author)
      ? toStringOrUndefined(input.author.name) ?? toStringOrUndefined(input.author.login) ?? 'Unknown Author'
      : 'Unknown Author';

  return {
    hash,
    message,
    author,
    displayDate: formatDateTime(input.date)
  };
};

const normalizeCommits = (input: unknown): GitHubOverviewCommit[] => {
  const commitsRaw = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.commits)
      ? input.commits
      : [];

  return commitsRaw
    .map((entry, index) => normalizeCommitEntry(entry, index))
    .filter(Boolean) as GitHubOverviewCommit[];
};

const normalizeBranches = (input: unknown): GitHubOverviewBranches | null => {
  if (!isRecord(input)) {
    return null;
  }

  const result: GitHubOverviewBranches = {};
  const localRaw = input.local;
  const remoteRaw = input.remote;

  if (Array.isArray(localRaw)) {
    result.local = localRaw.length;
  } else {
    const localValue = toNumberOrUndefined(localRaw);
    if (localValue !== undefined) {
      result.local = localValue;
    }
  }

  if (Array.isArray(remoteRaw)) {
    result.remote = remoteRaw.length;
  } else {
    const remoteValue = toNumberOrUndefined(remoteRaw);
    if (remoteValue !== undefined) {
      result.remote = remoteValue;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};

const normalizeIssueEntry = (input: unknown, index: number): GitHubOverviewIssue | null => {
  if (!isRecord(input)) {
    return null;
  }

  const number = toNumberOrUndefined(input.number) ?? toNumberOrUndefined(input.id);
  const title = toStringOrUndefined(input.title) ?? (number !== undefined ? `Issue #${number}` : `Issue ${index + 1}`);
  const state = toStringOrUndefined(input.state);
  const url = toStringOrUndefined(input.url) ?? toStringOrUndefined(input.html_url);
  const created = toStringOrUndefined(input.created_at) ?? toStringOrUndefined(input.createdAt);
  const updated = toStringOrUndefined(input.updated_at) ?? toStringOrUndefined(input.updatedAt);
  const labels = Array.isArray(input.labels)
    ? input.labels
        .map((label) => (typeof label === 'string' ? label : isRecord(label) ? toStringOrUndefined(label.name) : undefined))
        .filter(Boolean) as string[]
    : [];

  return {
    number: number ?? undefined,
    title,
    state,
    url,
    created_at: created,
    updated_at: updated,
    labels,
  };
};

const normalizeIssuesGroup = (input: unknown): GitHubOverviewIssueGroup | null => {
  if (Array.isArray(input)) {
    return { open: input.map((issue, index) => normalizeIssueEntry(issue, index)).filter(Boolean) as GitHubOverviewIssue[], closed: [] };
  }

  if (!isRecord(input)) {
    return null;
  }

  const openRaw = Array.isArray(input.open) ? input.open : Array.isArray((input as Record<string, unknown>).openIssues) ? (input as Record<string, unknown>).openIssues : [];
  const closedRaw = Array.isArray(input.closed) ? input.closed : Array.isArray((input as Record<string, unknown>).closedIssues) ? (input as Record<string, unknown>).closedIssues : [];

  return {
    open: openRaw.map((issue, index) => normalizeIssueEntry(issue, index)).filter(Boolean) as GitHubOverviewIssue[],
    closed: closedRaw.map((issue, index) => normalizeIssueEntry(issue, index)).filter(Boolean) as GitHubOverviewIssue[],
  };
};

const normalizeWebhookEntry = (input: unknown): GitHubOverviewWebhook | null => {
  if (!isRecord(input)) {
    return null;
  }

  return {
    id: toNumberOrUndefined(input.id),
    url: toStringOrUndefined(input.url) ?? toStringOrUndefined((input.config as Record<string, unknown> | undefined)?.url),
    active: typeof input.active === 'boolean' ? input.active : undefined,
    events: Array.isArray(input.events) ? (input.events.filter((event) => typeof event === 'string') as string[]) : undefined,
    updated_at: toStringOrUndefined(input.updated_at),
  };
};

const normalizeWebhooks = (input: unknown): GitHubOverviewWebhook[] => {
  const list = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray((input as Record<string, unknown>).webhooks)
      ? (input as Record<string, unknown>).webhooks
      : [];
  return list.map(normalizeWebhookEntry).filter(Boolean) as GitHubOverviewWebhook[];
};

const normalizeCollaboratorEntry = (input: unknown): GitHubOverviewCollaborator | null => {
  if (!isRecord(input)) {
    return null;
  }

  const login = toStringOrUndefined(input.login) ?? toStringOrUndefined(input.name);
  if (!login) {
    return null;
  }

  const role = toStringOrUndefined(input.role)
    ?? (isRecord(input.permissions)
      ? (input.permissions.admin ? 'Admin' : input.permissions.push ? 'Maintainer' : 'Collaborator')
      : undefined);

  return {
    login,
    role,
    avatar_url: toStringOrUndefined(input.avatar_url),
  };
};

const normalizeCollaborators = (input: unknown): GitHubOverviewCollaborator[] => {
  const list = Array.isArray(input) ? input : [];
  return list.map(normalizeCollaboratorEntry).filter(Boolean) as GitHubOverviewCollaborator[];
};

const normalizeWorkflowRunEntry = (input: unknown): GitHubOverviewWorkflowRun | null => {
  if (!isRecord(input)) {
    return null;
  }

  const id = toNumberOrUndefined(input.id) ?? toStringOrUndefined(input.id) ?? `run-${Date.now()}`;
  return {
    id: id ?? `run-${Date.now()}`,
    name: toStringOrUndefined(input.name),
    status: toStringOrUndefined(input.status),
    conclusion: toStringOrUndefined(input.conclusion),
    created_at: toStringOrUndefined(input.created_at) ?? toStringOrUndefined(input.run_started_at),
    html_url: toStringOrUndefined(input.html_url),
  };
};

const normalizeWorkflowRuns = (input: unknown): GitHubOverviewWorkflowRun[] => {
  const list = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray((input as Record<string, unknown>).workflowRuns)
      ? (input as Record<string, unknown>).workflowRuns
      : [];
  return list.map(normalizeWorkflowRunEntry).filter(Boolean) as GitHubOverviewWorkflowRun[];
};

const normalizePullEntry = (input: unknown, index: number): GitHubOverviewPull | null => {
  if (!isRecord(input)) {
    return null;
  }

  const number = toNumberOrUndefined(input.number) ?? toNumberOrUndefined(input.id);
  return {
    number: number ?? index,
    title: toStringOrUndefined(input.title) ?? `PR #${number ?? index}`,
    state: toStringOrUndefined(input.state),
    url: toStringOrUndefined(input.html_url) ?? toStringOrUndefined(input.url),
    updated_at: toStringOrUndefined(input.updated_at) ?? toStringOrUndefined(input.created_at),
  };
};

const normalizePulls = (input: unknown): GitHubOverviewPull[] => {
  const list = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray((input as Record<string, unknown>).pulls)
      ? (input as Record<string, unknown>).pulls
      : [];
  return list.map((entry, index) => normalizePullEntry(entry, index)).filter(Boolean) as GitHubOverviewPull[];
};

const normalizeBranchProtection = (input: unknown): GitHubOverviewBranchProtectionRule[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const branch = toStringOrUndefined(entry.branch) ?? toStringOrUndefined(entry.name);
      if (!branch) {
        return null;
      }
      const rules = isRecord(entry.rules)
        ? entry.rules
        : isRecord((entry as Record<string, unknown>).protection)
          ? ((entry as Record<string, unknown>).protection as Record<string, unknown>)
          : entry;
      return { branch, rules: rules as Record<string, unknown> };
    })
    .filter(Boolean) as GitHubOverviewBranchProtectionRule[];
};

const normalizeRepositorySummary = (input: unknown): GitHubOverviewRepository | null => {
  if (!isRecord(input)) {
    return null;
  }

  const summary: GitHubOverviewRepository = {};
  if (typeof input.name === 'string') summary.name = input.name;
  if (typeof input.description === 'string' || input.description === null) summary.description = input.description as string | null;
  const url = toStringOrUndefined(input.html_url);
  if (url) summary.html_url = url;
  if (typeof input.default_branch === 'string') summary.default_branch = input.default_branch;
  if (typeof input.private === 'boolean') summary.private = input.private;
  if (Array.isArray(input.topics)) {
    summary.topics = input.topics.filter((topic) => typeof topic === 'string') as string[];
  }

  return Object.keys(summary).length > 0 ? summary : null;
};

const normalizeAnalyticsSummary = (input: unknown): GitHubOverviewAnalytics | null => {
  if (!isRecord(input)) {
    return null;
  }

  const summary: GitHubOverviewAnalytics = {};
  if (typeof input.totalCommits === 'number') summary.totalCommits = input.totalCommits;
  if (typeof input.workflowSuccessRate === 'number') summary.workflowSuccessRate = input.workflowSuccessRate;
  if (typeof input.openIssues === 'number') summary.openIssues = input.openIssues;
  if (typeof input.closedIssues === 'number') summary.closedIssues = input.closedIssues;
  if (typeof input.openPullRequests === 'number') summary.openPullRequests = input.openPullRequests;

  if (Array.isArray(input.recentActivity)) {
    summary.recentActivity = input.recentActivity
      .map((entry) =>
        isRecord(entry)
          ? {
              week: toStringOrUndefined(entry.week) ?? toStringOrUndefined(entry.week_start) ?? toStringOrUndefined(entry.period),
              total: toNumberOrUndefined(entry.total),
            }
          : null
      )
      .filter(Boolean) as Array<{ week?: string | number; total?: number }>;
  }

  return Object.keys(summary).length > 0 ? summary : null;
};

const normalizeOverviewSettings = (input: unknown): GitHubOverviewSettings | null => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: GitHubOverviewSettings = {};

  if (typeof input.repoUrl === 'string') normalized.repoUrl = input.repoUrl;
  if (typeof input.owner === 'string') normalized.owner = input.owner;
  if (typeof input.repo === 'string') normalized.repo = input.repo;
  if (typeof input.branch === 'string') normalized.branch = input.branch;
  if (typeof input.autoSync === 'boolean') normalized.autoSync = input.autoSync;
  if (typeof input.autoCommit === 'boolean') normalized.autoCommit = input.autoCommit;
  if (typeof input.autoMerge === 'boolean') normalized.autoMerge = input.autoMerge;

  const pollingRaw = input.pollingIntervalMs ?? input.pollingInterval;
  const pollingValue = typeof pollingRaw === 'number' ? pollingRaw : Number.parseInt(String(pollingRaw ?? ''), 10);
  if (Number.isFinite(pollingValue)) {
    normalized.pollingIntervalMs = pollingValue;
  }

  if (typeof input.tokenMasked === 'string') normalized.tokenMasked = input.tokenMasked;
  if (typeof input.hasToken === 'boolean') normalized.hasToken = input.hasToken;
  if (typeof input.lastSynced === 'string') normalized.lastSynced = input.lastSynced;
  if (typeof input.updatedAt === 'string') normalized.updatedAt = input.updatedAt;
  if (typeof input.webhookUrl === 'string') normalized.webhookUrl = input.webhookUrl;
  if (typeof input.webhookSecretMasked === 'string') normalized.webhookSecretMasked = input.webhookSecretMasked;
  if (typeof input.webhookConfigured === 'boolean') normalized.webhookConfigured = input.webhookConfigured;
  if (isRecord(input.branchProtection)) normalized.branchProtection = input.branchProtection;

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeOverviewData = (
  input: unknown,
  fallbackStatus: GitHubStatus | null
): GitHubOverviewData | null => {
  if (!isRecord(input)) {
    const status = normalizeStatus(input, fallbackStatus);
    return status
      ? {
          status,
          stats: null,
          commits: [],
          branches: null,
          repos: [],
          workflows: [],
          pulls: [],
          repoUrl: undefined,
          connected: false,
          lastSynced: undefined,
          settings: null,
          issues: { open: [], closed: [] },
          webhooks: [],
          collaborators: [],
          workflowRuns: [],
          branchProtection: [],
          analytics: null,
          repository: null,
        }
      : null;
  }

  const dashboard = isRecord(input.dashboard) ? (input.dashboard as Record<string, unknown>) : null;

  const rawStatus = isRecord(input.status) ? input.status : dashboard?.status;
  const rawStats = isRecord(input.stats) ? input.stats : dashboard?.stats;
  const rawCommits = Array.isArray(input.commits) ? input.commits : dashboard?.commits;
  const rawBranches = isRecord(input.branches) ? input.branches : dashboard?.branches;
  const rawWorkflows = Array.isArray(input.workflows)
    ? input.workflows
    : Array.isArray(dashboard?.workflows)
      ? (dashboard?.workflows as unknown[])
      : [];

  return {
    status: normalizeStatus(rawStatus ?? dashboard, fallbackStatus),
    stats: normalizeStats(rawStats ?? dashboard),
    commits: normalizeCommits(rawCommits ?? dashboard),
    branches: normalizeBranches(rawBranches ?? dashboard),
    repos: Array.isArray(input.repos)
      ? input.repos
      : Array.isArray(dashboard?.repos)
        ? (dashboard?.repos as unknown[])
        : [],
    workflows: rawWorkflows,
    pulls: normalizePulls(input.pulls ?? dashboard?.pulls ?? input.prs),
    repoUrl: toStringOrUndefined(input.repoUrl ?? dashboard?.repoUrl),
    connected:
      typeof input.connected === 'boolean'
        ? input.connected
        : typeof dashboard?.connected === 'boolean'
          ? (dashboard.connected as boolean)
          : undefined,
    lastSynced: toStringOrUndefined(input.lastSynced ?? dashboard?.lastSynced),
    settings: normalizeOverviewSettings(input.settings ?? dashboard?.settings),
    issues: normalizeIssuesGroup(input.issues ?? dashboard?.issues),
    webhooks: normalizeWebhooks(input.webhooks ?? dashboard?.webhooks),
    collaborators: normalizeCollaborators(input.collaborators ?? dashboard?.collaborators),
    workflowRuns: normalizeWorkflowRuns(input.workflowRuns ?? dashboard?.workflowRuns),
    branchProtection: normalizeBranchProtection(input.branchProtection ?? dashboard?.branchProtection),
    analytics: normalizeAnalyticsSummary(input.analytics ?? dashboard?.analytics),
    repository: normalizeRepositorySummary(input.repository ?? dashboard?.repository ?? input.repo),
  };
};

const GitHubOverviewTab: React.FC<GitHubOverviewTabProps> = ({
  status,
  loading,
  showMessage,
  refetch,
  onConnectionStateChange
}) => {
  const [overviewData, setOverviewData] = useState<GitHubOverviewData | null>(null);
  const [settingsData, setSettingsData] = useState<GitHubOverviewSettings | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [repositoryUrlInput, setRepositoryUrlInput] = useState('');
  const [branchStatus, setBranchStatus] = useState<{ branch?: string; ahead?: number; behind?: number; changesCount?: number } | null>(null);
  const [isBranchStatusLoading, setIsBranchStatusLoading] = useState(false);

  const syncSettingsData = useCallback((incoming: GitHubOverviewSettings | null | undefined) => {
    setSettingsData(incoming ?? null);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/settings', {
        method: 'GET',
        headers: buildAdminHeaders({ Accept: 'application/json' }),
        credentials: 'include'
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (!payload?.success) {
        return;
      }
      const normalizedSettings = normalizeOverviewSettings(payload.settings);
      syncSettingsData(normalizedSettings);
    } catch (error) {
      console.error('Settings fetch error:', error);
    }
  }, [syncSettingsData]);

  const data = overviewData;
  const reposFromHook = Array.isArray(data?.repos) ? data.repos : [];
  const branchesRaw = (data?.branches ?? null) as unknown;
  const branchesFromHook = Array.isArray(branchesRaw) ? branchesRaw : [];
  const workflowsFromHook = Array.isArray(data?.workflows) ? data.workflows : [];
  const commitsFromHook = Array.isArray(data?.commits) ? data.commits : [];
  const pullsFromHook = Array.isArray(data?.pulls) ? data.pulls : [];

  const statsFromHook =
    data?.stats && typeof data.stats === 'object'
      ? data.stats
      : { prs: 0, issues: 0, stars: 0, forks: 0, total: 0, today: 0 };

  const totalCommits =
    typeof statsFromHook.total === 'number' && !Number.isNaN(statsFromHook.total)
      ? statsFromHook.total
      : commitsFromHook.length;

  const todayCommits =
    typeof statsFromHook.today === 'number' && !Number.isNaN(statsFromHook.today)
      ? statsFromHook.today
      : 0;

  const currentStatus = data?.status ?? status;
  const remoteUrl = currentStatus?.remoteUrl
    ?? settingsData?.repoUrl
    ?? overviewData?.repoUrl
    ?? '';
  const commitsList = commitsFromHook;
  const analyticsData = overviewData?.analytics ?? null;
  const issuesGroup = overviewData?.issues ?? null;
  const openIssuesList = issuesGroup?.open ?? [];
  const closedIssuesList = issuesGroup?.closed ?? [];
  const webhooksList = overviewData?.webhooks ?? [];
  const webhookActiveCount = webhooksList.filter((hook) => hook.active).length;
  const collaboratorsList = overviewData?.collaborators ?? [];
  const workflowRunsList = overviewData?.workflowRuns ?? [];
  const branchProtectionList = overviewData?.branchProtection ?? [];
  const repositoryMeta = overviewData?.repository ?? null;
  const topicsList = Array.isArray(repositoryMeta?.topics)
    ? (repositoryMeta.topics as unknown[]).filter((topic): topic is string => typeof topic === 'string' && topic.length > 0)
    : [];
  const collaboratorCount = collaboratorsList.length;
  const branchProtectionCount = branchProtectionList.length;
  const workflowSuccessRate = analyticsData?.workflowSuccessRate ?? 0;
  const analyticsTotalCommits = analyticsData?.totalCommits ?? totalCommits;
  const analyticsOpenIssues = analyticsData?.openIssues ?? openIssuesList.length;
  const analyticsClosedIssues = analyticsData?.closedIssues ?? closedIssuesList.length;
  const analyticsOpenPullRequests = analyticsData?.openPullRequests ?? pullsFromHook.length;
  const aheadCount =
    typeof branchStatus?.ahead === 'number' && !Number.isNaN(branchStatus.ahead)
      ? branchStatus.ahead
      : 0;
  const behindCount =
    typeof branchStatus?.behind === 'number' && !Number.isNaN(branchStatus.behind)
      ? branchStatus.behind
      : 0;
  const branchSyncChanges =
    typeof branchStatus?.changesCount === 'number' && !Number.isNaN(branchStatus.changesCount)
      ? branchStatus.changesCount
      : undefined;
  const localChangesCount =
    typeof currentStatus?.changesCount === 'number' && !Number.isNaN(currentStatus.changesCount)
      ? currentStatus.changesCount
      : branchSyncChanges ?? 0;
  const branchName = branchStatus?.branch ?? currentStatus?.branch ?? undefined;
  const hasRemoteConfigured = Boolean(remoteUrl);
  const hasLocalChanges = Boolean(currentStatus?.hasChanges ?? (localChangesCount > 0));

  const isDataLoaded =
    reposFromHook.length > 0 ||
    branchesFromHook.length > 0 ||
    workflowsFromHook.length > 0 ||
    commitsFromHook.length > 0 ||
    pullsFromHook.length > 0;

  const isBusy = isProcessing || isLoading || loading;

  const loadBranchStatus = useCallback(async () => {
    setIsBranchStatusLoading(true);
    try {
      const response = await fetch('/api/ai/github/branches/status', {
        method: 'GET',
        headers: buildAdminHeaders({ Accept: 'application/json' }),
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          setBranchStatus(null);
        }
        return;
      }

      const payload = await response.json();
      const branchPayload = isRecord(payload?.branchStatus) ? payload.branchStatus : null;

      if (branchPayload) {
        const aheadBehindRaw = branchPayload.aheadBehind;
        const ahead =
          isRecord(aheadBehindRaw) && typeof aheadBehindRaw.ahead === 'number' && !Number.isNaN(aheadBehindRaw.ahead)
            ? aheadBehindRaw.ahead
            : 0;
        const behind =
          isRecord(aheadBehindRaw) && typeof aheadBehindRaw.behind === 'number' && !Number.isNaN(aheadBehindRaw.behind)
            ? aheadBehindRaw.behind
            : 0;
        const branchName =
          toStringOrUndefined(branchPayload.current) ??
          toStringOrUndefined(branchPayload.branch) ??
          undefined;
        const changesCount =
          typeof branchPayload.changesCount === 'number' && !Number.isNaN(branchPayload.changesCount)
            ? branchPayload.changesCount
            : undefined;

        setBranchStatus({
          branch: branchName,
          ahead,
          behind,
          changesCount
        });
      } else {
        setBranchStatus(null);
      }
    } catch (error) {
      console.error('Branch status fetch error:', error);
    } finally {
      setIsBranchStatusLoading(false);
    }
  }, []);

  const loadOverviewData = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = '/api/ai/github/status/detailed';
      console.log(`🔄 GitHub Overview Data Request: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: buildAdminHeaders({ Accept: 'application/json' }),
        credentials: 'include'
      });
      console.log(`📡 GitHub Overview Data Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('GitHub detailed endpoint returned 404, falling back to /api/github/status');
          const fallback = await fetch('/api/github/status', {
            headers: buildAdminHeaders({ Accept: 'application/json' }),
            credentials: 'include'
          });
          if (fallback.ok) {
            const fallbackData = await fallback.json();
            const normalizedFallback = normalizeOverviewData(fallbackData, status);
            setOverviewData(
              normalizedFallback ?? {
                status: status ?? null,
                stats: null,
                commits: [],
                branches: null,
                repos: [],
                workflows: [],
                pulls: [],
                repoUrl: undefined,
                connected: false,
                lastSynced: undefined,
                settings: null,
                issues: { open: [], closed: [] },
                webhooks: [],
                collaborators: [],
                workflowRuns: [],
                branchProtection: [],
                analytics: null,
                repository: null,
              }
            );
            if (normalizedFallback?.settings) {
              syncSettingsData(normalizedFallback.settings);
            } else {
              await fetchSettings();
            }
          }
        } else if (response.status === 401) {
          showMessage('error', 'გთხოვთ, დაადასტუროთ ადმინისტრატორის წვდომა');
        }
        await loadBranchStatus();
        return;
      }

      const data = await response.json();
      console.log(`✅ GitHub Overview Data Result:`, data);
      const normalized = normalizeOverviewData(data, status);
      setOverviewData(
        normalized ?? {
          status: status ?? null,
          stats: null,
          commits: [],
          branches: null,
          repos: [],
          workflows: [],
          pulls: [],
          repoUrl: undefined,
          connected: false,
          lastSynced: undefined,
          settings: null,
          issues: { open: [], closed: [] },
          webhooks: [],
          collaborators: [],
          workflowRuns: [],
          branchProtection: [],
          analytics: null,
          repository: null,
        }
      );
      if (normalized?.settings) {
        syncSettingsData(normalized.settings);
      } else {
        await fetchSettings();
      }
    } catch (error) {
      console.error('Overview data loading error:', error);
    } finally {
      setIsLoading(false);
    }
    await loadBranchStatus();

  }, [status, showMessage, fetchSettings, syncSettingsData, loadBranchStatus]);


  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOverviewData();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadOverviewData]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setRepositoryUrlInput(settingsData?.repoUrl ?? '');
  }, [settingsData?.repoUrl]);

  const handleInitGit = async () => {
    setIsProcessing(true);
    try {
      const url = '/api/ai/github/init';
      console.log(`🔄 GitHub Init Request: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include'
      });
      console.log(`📡 GitHub Init Response: ${response.status} ${response.statusText}`);

      const result = await response.json();
      console.log(`✅ GitHub Init Result:`, result);

      if (result.success) {
        showMessage('success', result.message);
        await loadOverviewData();
        refetch();
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      console.error('Git init failed:', error);
      showMessage('error', 'Git ინიციალიზაციის შეცდომა');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddRemote = async () => {
    const trimmedRepoUrl = repositoryUrlInput.trim();
    if (!trimmedRepoUrl) {
      showMessage('error', 'Repository URL შეიყვანეთ');
      return;
    }

    setIsProcessing(true);
    try {
      const url = '/api/github/connect';
      const requestBody = { repoUrl: trimmedRepoUrl };
      console.log(`🔄 GitHub Add Remote Request: ${url}`);
      console.log(`   Request Body:`, requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });
      console.log(`📡 GitHub Add Remote Response: ${response.status} ${response.statusText}`);

      const result = await response.json();
      console.log(`✅ GitHub Add Remote Result:`, result);

      if (response.ok && (result.connected || result.status?.success)) {
        showMessage('success', 'Repository წარმატებით დაუკავშირდა GitHub-ს');
        setRepositoryUrlInput(trimmedRepoUrl);
        const normalized = normalizeOverviewData(result, status);
        if (normalized) {
          setOverviewData(normalized);
        }
        await loadOverviewData();
        refetch();
        onConnectionStateChange?.();
      } else {
        showMessage('error', result.error || 'GitHub ვერიფიკაცია ვერ შესრულდა');
      }
    } catch (error) {
      console.error('Add remote failed:', error);
      showMessage('error', 'Remote დამატების შეცდომა');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSync = async () => {
    setIsProcessing(true);
    try {
      const url = '/api/ai/github/sync';
      const requestBody = { message: commitMessage || undefined };
      console.log(`🔄 GitHub Sync Request: ${url}`);
      console.log(`   Request Body:`, requestBody);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });
      console.log(`📡 GitHub Sync Response: ${response.status} ${response.statusText}`);
      
      const result = await response.json();
      console.log(`✅ GitHub Sync Result:`, result);
      
      if (result.success) {
        if (result.skipped) {
          showMessage('success', 'ცვლილებები არ იყო საჭირო');
        } else {
          showMessage('success', `სინქრონიზაცია წარმატებული: ${result.commitMessage}`);
        }
        setCommitMessage('');
        await loadOverviewData();
        refetch();
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      showMessage('error', 'სინქრონიზაციის შეცდომა');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePull = async () => {
    setIsProcessing(true);
    try {
      const url = '/api/ai/github/pull';
      console.log(`🔄 GitHub Pull Request: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include'
      });
      console.log(`📡 GitHub Pull Response: ${response.status} ${response.statusText}`);

      const result = await response.json();
      console.log(`✅ GitHub Pull Result:`, result);

      if (result.success) {
        showMessage('success', result.message);
        await loadOverviewData();
        refetch();
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      console.error('Pull failed:', error);
      showMessage('error', 'Pull შეცდომა');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePush = async () => {
    setIsProcessing(true);
    try {
      const url = '/api/ai/github/push';
      const requestBody = { message: commitMessage || undefined };
      console.log(`🔄 GitHub Push Request: ${url}`);
      console.log(`   Request Body:`, requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });
      console.log(`📡 GitHub Push Response: ${response.status} ${response.statusText}`);

      const result = await response.json();
      console.log(`✅ GitHub Push Result:`, result);

      if (result.success) {
        showMessage('success', result.message ?? 'Push შესრულებულია');
        await loadOverviewData();
        refetch();
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      console.error('Push failed:', error);
      showMessage('error', 'Push შეცდომა');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Sync Status Overview */}
      {hasRemoteConfigured && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity size={20} />
                Git სინქრონიზაციის სტატუსი
              </h3>
              <div className="text-sm text-gray-400">
                აქტიური branch:{' '}
                <span className="text-gray-200 font-medium">{branchName ?? 'უცნობი'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isBranchStatusLoading ? (
                <span className="text-xs text-blue-300">განახლება...</span>
              ) : (
                <button
                  onClick={loadBranchStatus}
                  disabled={isBranchStatusLoading}
                  className="px-3 py-1 bg-gray-700 text-xs text-gray-200 rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  განახლება
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={16} className={aheadCount > 0 ? 'text-orange-400' : 'text-gray-400'} />
                <span className="text-sm text-gray-400">ასატვირთი commits</span>
              </div>
              <div className={`text-3xl font-bold ${aheadCount > 0 ? 'text-orange-300' : 'text-gray-200'}`}>{aheadCount}</div>
              <div className="text-xs text-gray-500">origin-ზე გადასაგზავნი</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Download size={16} className={behindCount > 0 ? 'text-red-400' : 'text-gray-400'} />
                <span className="text-sm text-gray-400">ჩამოსატვირთი commits</span>
              </div>
              <div className={`text-3xl font-bold ${behindCount > 0 ? 'text-red-300' : 'text-gray-200'}`}>{behindCount}</div>
              <div className="text-xs text-gray-500">origin-დან მოსატანი</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitCommit size={16} className={hasLocalChanges ? 'text-blue-400' : 'text-gray-400'} />
                <span className="text-sm text-gray-400">ლოკალური ცვლილებები</span>
              </div>
              <div className={`text-3xl font-bold ${hasLocalChanges ? 'text-blue-300' : 'text-gray-200'}`}>{localChangesCount}</div>
              <div className="text-xs text-gray-500">დასაკომიტებელი ფაილები</div>
            </div>
          </div>
        </div>
      )}
      {/* Repository Setup */}
      {!remoteUrl && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} />
            Repository Setup
          </h3>

          <div className="space-y-4">
            <button
              onClick={handleInitGit}
              disabled={isBusy}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <GitBranch size={16} />
              Git Repository ინიციალიზაცია
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={repositoryUrlInput}
                onChange={(event) => setRepositoryUrlInput(event.target.value)}
                placeholder="https://github.com/username/repo.git"
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
              <button
                onClick={handleAddRemote}
                disabled={isBusy || !repositoryUrlInput.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                ვერიფიკაცია
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Actions */}
      {remoteUrl && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap size={20} />
            GitHub მოქმედებები
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Commit Message (არჩევითი)</label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="AI შექმნის ავტომატურ message-ს თუ ცარიელია"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSync}
                disabled={isBusy}
                className="flex-1 min-w-[200px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Sync with Remote
              </button>

              <button
                onClick={handlePull}
                disabled={isBusy}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Pull
              </button>

              <button
                onClick={handlePush}
                disabled={isBusy}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                Push
              </button>

              <button
                onClick={loadOverviewData}
                disabled={isBusy}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {repositoryMeta && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ExternalLink size={20} />
            Repository Metadata
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <div><strong>სახელი:</strong> {repositoryMeta.name ?? '—'}</div>
            {repositoryMeta.description && <div className="text-gray-400">{repositoryMeta.description}</div>}
            <div>
              <strong>Default branch:</strong> {repositoryMeta.default_branch ?? settingsData?.branch ?? '—'}
            </div>
            <div><strong>სტატუსი:</strong> {repositoryMeta.private ? 'Private' : 'Public'}</div>
            {topicsList.length > 0 && (
              <div>
                <strong>Topics:</strong> {topicsList.join(', ')}
              </div>
            )}
            {repositoryMeta.html_url && (
              <a
                href={repositoryMeta.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                GitHub ბმული
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {(analyticsData || workflowRunsList.length > 0) && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} />
            GitHub Analytics
          </h3>

          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 uppercase">ჯამი Commits</div>
                <div className="text-xl font-bold text-white">{analyticsTotalCommits}</div>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 uppercase">Workflow Success</div>
                <div className="text-xl font-bold text-white">{workflowSuccessRate}%</div>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 uppercase">ღია Issues</div>
                <div className="text-xl font-bold text-white">{analyticsOpenIssues}</div>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-xs text-gray-400 uppercase">ღია PR-ები</div>
                <div className="text-xl font-bold text-white">{analyticsOpenPullRequests}</div>
              </div>
            </div>
          )}

          {workflowRunsList.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">ბოლო Workflow Runs</h4>
              <div className="space-y-2">
                {workflowRunsList.slice(0, 4).map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                  >
                    <div>
                      <div className="font-medium">{run.name || `Run #${run.id}`}</div>
                      <div className="text-xs text-gray-400">{formatDateTime(run.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase text-gray-400">{run.status ?? 'pending'}</div>
                      <div
                        className={
                          run.conclusion === 'success'
                            ? 'text-green-400 text-xs font-semibold'
                            : run.conclusion
                              ? 'text-orange-400 text-xs font-semibold'
                              : 'text-gray-500 text-xs font-semibold'
                        }
                      >
                        {run.conclusion || 'Running'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(openIssuesList.length > 0 || closedIssuesList.length > 0) && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bug size={20} />
            Issues & Bug Tracking
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">ღია Issues ({openIssuesList.length})</h4>
              <div className="space-y-2">
                {openIssuesList.slice(0, 5).map((issue, index) => (
                  <a
                    key={issue.number ?? index}
                    href={issue.url ?? undefined}
                    target={issue.url ? '_blank' : undefined}
                    rel={issue.url ? 'noreferrer' : undefined}
                    className="block bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2"
                  >
                    <div className="text-sm font-medium text-white truncate">{issue.title}</div>
                    <div className="text-xs text-gray-400">#{issue.number} • {issue.labels?.join(', ') || 'no labels'}</div>
                    <div className="text-xs text-gray-500">შეიქმნა: {formatDateTime(issue.created_at)}</div>
                  </a>
                ))}
                {openIssuesList.length === 0 && (
                  <p className="text-xs text-gray-500">ღია issue არ მოიძებნა</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">დახურული Issues ({closedIssuesList.length})</h4>
              <div className="space-y-2">
                {closedIssuesList.slice(0, 5).map((issue, index) => (
                  <a
                    key={issue.number ?? index}
                    href={issue.url ?? undefined}
                    target={issue.url ? '_blank' : undefined}
                    rel={issue.url ? 'noreferrer' : undefined}
                    className="block bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2"
                  >
                    <div className="text-sm font-medium text-white truncate">{issue.title}</div>
                    <div className="text-xs text-gray-400">#{issue.number} • {issue.labels?.join(', ') || 'no labels'}</div>
                    <div className="text-xs text-gray-500">დახურული: {formatDateTime(issue.updated_at ?? issue.created_at)}</div>
                  </a>
                ))}
                {closedIssuesList.length === 0 && (
                  <p className="text-xs text-gray-500">დახურული issue არ მოიძებნა</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {collaboratorsList.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users size={20} />
            Collaborators ({collaboratorCount})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {collaboratorsList.slice(0, 6).map((collaborator) => (
              <div key={collaborator.login} className="bg-gray-700 rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-semibold uppercase">
                  {collaborator.login.substring(0, 2)}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">{collaborator.login}</div>
                  <div className="text-xs text-gray-400">{collaborator.role ?? 'Contributor'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {webhooksList.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <WebhookIcon size={20} />
            Webhooks ({webhookActiveCount}/{webhooksList.length} აქტიური)
          </h3>
          <div className="space-y-3">
            {webhooksList.slice(0, 5).map((hook, index) => (
              <div key={hook.id ?? hook.url ?? index} className="bg-gray-700 rounded-lg p-3 text-sm text-gray-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white truncate">{hook.url ?? 'Webhook'}</span>
                  <span className={`text-xs font-semibold ${hook.active ? 'text-green-400' : 'text-red-400'}`}>
                    {hook.active ? 'აქტიური' : 'გათიშული'}
                  </span>
                </div>
                {hook.events && hook.events.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">Events: {hook.events.join(', ')}</div>
                )}
                {hook.updated_at && (
                  <div className="text-xs text-gray-500 mt-1">განახლდა: {formatDateTime(hook.updated_at)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {branchProtectionList.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield size={20} />
            Branch Protection ({branchProtectionCount})
          </h3>
          <div className="space-y-3">
            {branchProtectionList.map((rule) => {
              const rules = rule.rules as Record<string, unknown>;
              const requiredStatusChecksRaw = isRecord(rules.required_status_checks)
                ? (rules.required_status_checks as Record<string, unknown>)
                : null;
              const statusContexts = requiredStatusChecksRaw && Array.isArray(requiredStatusChecksRaw.contexts)
                ? (requiredStatusChecksRaw.contexts as unknown[]).filter((ctx): ctx is string => typeof ctx === 'string')
                : [];
              const requiresReviews = Boolean(rules.required_pull_request_reviews);
              return (
                <div key={rule.branch} className="bg-gray-700 rounded-lg p-3 text-sm text-gray-300">
                  <div className="text-white font-medium mb-1">{rule.branch}</div>
                  <div className="text-xs text-gray-400">
                    Status checks: {statusContexts.length > 0 ? statusContexts.join(', ') : 'None'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Pull request reviews: {requiresReviews ? 'Required' : 'Optional'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {commitsList.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <GitCommit size={20} />
            Recent Commits
          </h3>

          <div className="space-y-3">
            {commitsList.slice(0, 8).map((commit, index) => (
              <div key={commit.hash || index} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-mono">
                  {commit.hash ? commit.hash.substring(0, 2) : `#${index + 1}`}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{commit.message}</div>
                  <div className="text-xs text-gray-400">
                    by {commit.author} • {commit.displayDate}
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {commit.hash ? commit.hash.substring(0, 7) : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubOverviewTab;

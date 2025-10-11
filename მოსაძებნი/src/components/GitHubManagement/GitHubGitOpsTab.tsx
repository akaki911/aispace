// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  Plus,
  Minus,
  RefreshCw,
  Upload,
  Eye,
  Edit,
  AlertTriangle,
  Clock,
  User,
  FileText,
  Zap,
  History,
  Code,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { EmptyState } from '../EmptyState';
import type { GitHubStatus } from './GitHubManagementHub';
import type {
  GitHubDataState,
  GitHubStats,
  GitHubCommitSummary
} from './hooks/useGitHubData';
import { buildAdminHeaders } from '../../utils/adminToken';

type MessageType = 'success' | 'error';
type SubTabKey = 'workspace' | 'history' | 'branches' | 'files';

interface GitHubGitOpsTabProps {
  status: GitHubStatus | null;
  loading: boolean;
  showMessage: (type: MessageType, text: string) => void;
  refetch: () => void;
  data?: GitHubDataState | null;
  error?: string | null;
  isLoading?: boolean;
}

interface FileStatus {
  path: string;
  status: string;
  staged: boolean;
  modified: boolean;
  untracked: boolean;
}

interface GitStatus {
  branch: string;
  files: FileStatus[];
  hasChanges: boolean;
  clean: boolean;
}

interface Commit {
  hash: string;
  fullHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  parents: string[];
  isMerge: boolean;
}

interface Branch {
  name: string;
  hash?: string;
  current: boolean;
  type: 'local' | 'remote';
  ahead?: number;
  behind?: number;
}

interface FileVersion {
  hash: string;
  author: string;
  timestamp: string;
  message: string;
  changes: {
    added: number;
    deleted: number;
    modified: number;
  };
  size: number;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  lineNumber: number;
}

const DEFAULT_BRANCH = 'main';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface JsonOnceResult<T = unknown> {
  status: number;
  ok: boolean;
  ct: string;
  data: T | null;
}

const normalizeHeadersInit = (headers?: HeadersInit): Record<string, string> => {
  if (headers == null) {
    return {};
  }

  if (headers instanceof Headers) {
    return Array.from(headers.entries()).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return { ...headers };
};

const hasHeader = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

const withAdminHeaders = (options: RequestInit = {}): RequestInit => {
  const normalized = normalizeHeadersInit(options.headers);

  if (hasHeader(normalized, 'Accept') === false) {
    normalized.Accept = 'application/json';
  }

  const headers = buildAdminHeaders(normalized);

  return {
    ...options,
    headers,
    credentials: options.credentials ?? 'include'
  };
};

const isAbortError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError'
  );

async function getJsonOnce<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<JsonOnceResult<T>> {
  const res = await fetch(input, withAdminHeaders(init));
  const status = res.status;
  const ok = res.ok;
  const ct = res.headers.get('content-type') || '';

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch (error) {
    const contentType = ct.toLowerCase();
    if (status !== 204 && contentType.includes('json')) {
      throw error;
    }
  }

  return { status, ok, ct, data };
}

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

const normalizeFileStatus = (input: unknown): FileStatus | null => {
  if (!isRecord(input)) {
    return null;
  }

  const path = toStringOrUndefined(input.path);
  const status = toStringOrUndefined(input.status) ?? 'modified';

  if (!path) {
    return null;
  }

  return {
    path,
    status,
    staged: Boolean(input.staged),
    modified: Boolean(input.modified),
    untracked: Boolean(input.untracked)
  };
};

const normalizeGitStatusResponse = (input: unknown): GitStatus | null => {
  if (!isRecord(input)) {
    return null;
  }

  const filesRaw = Array.isArray(input.files) ? input.files : [];
  const files = filesRaw.map(normalizeFileStatus).filter(Boolean) as FileStatus[];

  const branch = toStringOrUndefined(input.branch) ?? toStringOrUndefined(input.current) ?? DEFAULT_BRANCH;
  const hasChanges = typeof input.hasChanges === 'boolean' ? input.hasChanges : files.length > 0;
  const clean = typeof input.clean === 'boolean' ? input.clean : !hasChanges;

  return {
    branch,
    files,
    hasChanges,
    clean
  };
};

const parseAuthor = (value: unknown): { name: string; email?: string } => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return { name: value };
  }

  if (isRecord(value)) {
    const name = toStringOrUndefined(value.name) ?? toStringOrUndefined(value.login) ?? 'Unknown Author';
    const email = toStringOrUndefined(value.email);
    return email ? { name, email } : { name };
  }

  return { name: 'Unknown Author' };
};

const parseCommitDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const normalizeCommitResponse = (input: unknown): Commit | null => {
  if (!isRecord(input)) {
    return null;
  }

  const authorDetails = parseAuthor(input.author);
  const email = toStringOrUndefined(input.email) ?? authorDetails.email ?? 'unknown@example.com';
  const rawFullHash = toStringOrUndefined(input.fullHash) ?? toStringOrUndefined(input.sha);
  const rawHash = toStringOrUndefined(input.hash);
  const fullHash = rawFullHash ?? rawHash ?? 'unknown';
  const hash = rawHash ?? (fullHash.length >= 7 ? fullHash.slice(0, 7) : fullHash);
  const date = parseCommitDate(input.date);
  const message = toStringOrUndefined(input.message) ?? 'No commit message';
  const parents = Array.isArray(input.parents) ? input.parents.map(String) : [];
  const isMerge = typeof input.isMerge === 'boolean' ? input.isMerge : parents.length > 1;

  return {
    hash,
    fullHash,
    author: authorDetails.name,
    email,
    date,
    message,
    parents,
    isMerge
  };
};

const normalizeBranch = (input: unknown, type: Branch['type']): Branch | null => {
  if (!isRecord(input)) {
    return null;
  }

  const name = toStringOrUndefined(input.name);
  if (!name) {
    return null;
  }

  const branch: Branch = {
    name,
    current: type === 'local' ? Boolean(input.current) : false,
    type
  };

  const hash = toStringOrUndefined(input.hash);
  if (hash) {
    branch.hash = hash;
  }

  const ahead = toNumberOrUndefined(input.ahead);
  if (ahead !== undefined) {
    branch.ahead = ahead;
  }

  const behind = toNumberOrUndefined(input.behind);
  if (behind !== undefined) {
    branch.behind = behind;
  }

  return branch;
};

const createEmptyBranchState = (): { local: Branch[]; remote: Branch[]; current: string } => ({
  local: [],
  remote: [],
  current: DEFAULT_BRANCH
});

const normalizeBranchCollectionFromHook = (collection: unknown): { local: Branch[]; remote: Branch[]; current: string } => {
  if (!collection) {
    return createEmptyBranchState();
  }

  if (Array.isArray(collection)) {
    const local = collection.map(item => normalizeBranch(item, 'local')).filter(Boolean) as Branch[];
    const current = local.find(branch => branch.current)?.name ?? DEFAULT_BRANCH;
    return {
      local,
      remote: [],
      current
    };
  }

  if (!isRecord(collection)) {
    return createEmptyBranchState();
  }

  const localRaw = collection.local;
  const remoteRaw = collection.remote;

  const local = Array.isArray(localRaw)
    ? localRaw.map(item => normalizeBranch(item, 'local')).filter(Boolean) as Branch[]
    : [];

  const remote = Array.isArray(remoteRaw)
    ? remoteRaw.map(item => normalizeBranch(item, 'remote')).filter(Boolean) as Branch[]
    : [];

  const current =
    toStringOrUndefined(collection.current) ??
    toStringOrUndefined(collection.branch) ??
    local.find(branch => branch.current)?.name ??
    DEFAULT_BRANCH;

  return { local, remote, current };
};

const extractRecentFiles = (input: unknown): string[] => {
  if (!isRecord(input) || !Array.isArray(input.files)) {
    return [];
  }

  return input.files
    .map(file => (typeof file === 'string' ? file : String(file)))
    .filter((file): file is string => Boolean(file));
};

const normalizeFileVersionResponse = (input: unknown): FileVersion | null => {
  if (!isRecord(input)) {
    return null;
  }

  const hash = toStringOrUndefined(input.hash) ?? 'unknown';
  const author = toStringOrUndefined(input.author) ?? 'Unknown Author';

  const timestampValue = input.timestamp;
  let timestamp: string;
  if (timestampValue instanceof Date) {
    timestamp = timestampValue.toISOString();
  } else if (typeof timestampValue === 'string') {
    timestamp = timestampValue;
  } else if (typeof timestampValue === 'number') {
    const parsed = new Date(timestampValue);
    timestamp = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    timestamp = new Date().toISOString();
  }

  const message = toStringOrUndefined(input.message) ?? 'No message';

  const changesRecord = isRecord(input.changes) ? input.changes : {};
  const added = toNumberOrUndefined(changesRecord.added) ?? 0;
  const deleted = toNumberOrUndefined(changesRecord.deleted) ?? 0;
  const modified = toNumberOrUndefined(changesRecord.modified) ?? 0;

  const size = toNumberOrUndefined(input.size) ?? 0;

  return {
    hash,
    author,
    timestamp,
    message,
    changes: {
      added,
      deleted,
      modified
    },
    size
  };
};

const normalizeDiffLineResponse = (input: unknown): DiffLine | null => {
  if (!isRecord(input)) {
    return null;
  }

  const content = toStringOrUndefined(input.content);
  if (!content) {
    return null;
  }

  const typeValue = toStringOrUndefined(input.type);
  const type: DiffLine['type'] = typeValue === 'added' || typeValue === 'removed' ? typeValue : 'context';
  const lineNumber = toNumberOrUndefined(input.lineNumber) ?? 0;

  return {
    type,
    content,
    lineNumber
  };
};

const GitHubGitOpsTab: React.FC<GitHubGitOpsTabProps> = ({
  status: hubStatus,
  loading: hubLoading,
  showMessage,
  refetch,
  data,
  error,
  isLoading
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branchCollections, setBranchCollections] = useState(createEmptyBranchState);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('workspace');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffData, setDiffData] = useState<DiffLine[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateBranch, setShowCreateBranch] = useState(false);

  const branchesFromHook = Array.isArray(data?.branches) ? data?.branches ?? [] : [];
  const commitsFromHook = Array.isArray(data?.commits) ? data?.commits ?? [] : [];
  const workflowsFromHook = Array.isArray(data?.workflows) ? data?.workflows ?? [] : [];
  const reposFromHook = Array.isArray(data?.repos) ? data?.repos ?? [] : [];
  const pullsFromHook = Array.isArray(data?.pulls) ? data?.pulls ?? [] : [];
  const statsFromHook =
    data?.stats && typeof data.stats === 'object'
      ? data.stats
      : { prs: 0, issues: 0, stars: 0, forks: 0 };

  const [selectedFromVersion, setSelectedFromVersion] = useState<string>('');
  const [selectedToVersion, setSelectedToVersion] = useState<string>('');

  const isDataLoaded = data?.isLoaded ?? (
    reposFromHook.length > 0 ||
    branchesFromHook.length > 0 ||
    workflowsFromHook.length > 0 ||
    pullsFromHook.length > 0 ||
    commitsFromHook.length > 0
  );

  const gitStatusFiles = Array.isArray(gitStatus?.files) ? gitStatus.files : [];
  const localBranches = Array.isArray(branchCollections?.local) ? branchCollections.local : [];
  const normalizedStats = {
    prs: Number(statsFromHook?.prs ?? 0),
    issues: Number(statsFromHook?.issues ?? 0),
    stars: Number(statsFromHook?.stars ?? 0),
    forks: Number(statsFromHook?.forks ?? 0)
  };
  const hookCounts = {

    branches: branchesFromHook.length,
    commits: commitsFromHook.length,
    workflows: workflowsFromHook.length,
    repos: reposFromHook.length
  };
  const commitCount = commits.length > 0 ? commits.length : hookCounts.commits;

  const loadGitStatus = useCallback(async () => {
    try {
      const { ok, data } = await getJsonOnce('/api/ai/git/status');
      if (!ok) {
        return;
      }

      const normalizedStatus = normalizeGitStatusResponse(data);
      if (normalizedStatus) {
        setGitStatus(normalizedStatus);
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to load git status:', error);
      showMessage('error', 'Git სტატუსის ჩატვირთვა ვერ მოხერხდა');
    }
  }, [showMessage]);

  const loadCommitHistory = useCallback(async () => {
    try {
      const { ok, data } = await getJsonOnce('/api/ai/git/log?limit=20');
      if (!ok || !isRecord(data)) {
        return;
      }

      const commits = Array.isArray(data.commits) ? data.commits : [];
      const normalizedCommits = commits
        .map(normalizeCommitResponse)
        .filter(Boolean) as Commit[];
      setCommits(normalizedCommits);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to load commit history:', error);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const { ok, data } = await getJsonOnce('/api/ai/git/branches');
      if (!ok) {
        return;
      }

      setBranchCollections(normalizeBranchCollectionFromHook(data));
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to load branches:', error);
    }
  }, []);

  const loadRecentFiles = useCallback(async () => {
    try {
      const { ok, data } = await getJsonOnce('/api/ai/version-control/recent-files');
      if (!ok) {
        return;
      }

      setRecentFiles(extractRecentFiles(data));
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Recent files loading error:', error);
    }
  }, []);

  useEffect(() => {
    loadGitStatus();
    loadCommitHistory();
    loadBranches();
    loadRecentFiles();
  }, [loadGitStatus, loadCommitHistory, loadBranches, loadRecentFiles]);

  const loadFileHistory = async (filePath: string) => {
    try {
      const { ok, data } = await getJsonOnce(
        `/api/ai/version-control/history/${encodeURIComponent(filePath)}`
      );
      if (!ok || !isRecord(data)) {
        showMessage('error', 'ფაილის ისტორიის ჩატვირთვის შეცდომა');
        return;
      }

      const versions = Array.isArray(data.versions) ? data.versions : [];
      const normalizedVersions = versions
        .map(normalizeFileVersionResponse)
        .filter(Boolean) as FileVersion[];
      setFileVersions(normalizedVersions);
      setSelectedFile(filePath);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to load file history:', error);
      showMessage('error', 'ფაილის ისტორიის ჩატვირთვის შეცდომა');
    }
  };

  const loadDiff = async (fromVersion: string, toVersion: string, filePath: string) => {
    setSelectedFromVersion(fromVersion);
    setSelectedToVersion(toVersion);
    try {
      const { ok, data } = await getJsonOnce('/api/ai/version-control/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          fromVersion,
          toVersion
        })
      });

      if (!ok || !isRecord(data)) {
        showMessage('error', 'Diff-ის გენერაციის შეცდომა');
        return;
      }

      const diffLines = Array.isArray(data.diff)
        ? data.diff.map(normalizeDiffLineResponse).filter(Boolean) as DiffLine[]
        : [];
      setDiffData(diffLines);
      setShowDiffViewer(true);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to generate diff:', error);
      showMessage('error', 'Diff-ის გენერაციის შეცდომა');
    }
  };

  const rollbackToVersion = async (filePath: string, version: string) => {
    setRollbackLoading(version);
    try {
      const { ok, data } = await getJsonOnce('/api/ai/version-control/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          version
        })
      });

      if (ok) {
        const message = isRecord(data) && typeof data?.message === 'string'
          ? data.message
          : 'Rollback წარმატებით შესრულდა';
        showMessage('success', message);
        loadFileHistory(filePath);
        refetch();
      } else {
        const errorMessage =
          (isRecord(data) && typeof data?.error === 'string' && data.error) ||
          'Rollback შეცდომა';
        showMessage('error', errorMessage);
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to rollback file version:', error);
      showMessage('error', 'Rollback შეცდომა');
    } finally {
      setRollbackLoading(null);
    }
  };

  const stageFiles = async (files: string[]) => {
    setActionLoading(true);
    try {
      const response = await fetch(
        '/api/ai/git/add',
        withAdminHeaders({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files })
        })
      );

      if (response.ok) {
        await loadGitStatus();
        showMessage('success', 'ფაილები წარმატებით დაემატა staging area-ში');
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to stage files:', error);
      showMessage('error', 'ფაილების staging ვერ მოხერხდა');
    } finally {
      setActionLoading(false);
    }
  };

  const commitChanges = async () => {
    if (!commitMessage.trim()) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        '/api/ai/git/commit',
        withAdminHeaders({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: commitMessage })
        })
      );

      if (response.ok) {
        setCommitMessage('');
        await loadGitStatus();
        await loadCommitHistory();
        showMessage('success', 'ცვლილებები წარმატებით commit გაუკეთდა');
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to commit changes:', error);
      showMessage('error', 'Commit-ის შექმნა ვერ მოხერხდა');
    } finally {
      setActionLoading(false);
    }
  };

  const pushChanges = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        '/api/ai/git/push',
        withAdminHeaders({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remote: 'origin', branch: gitStatus?.branch })
        })
      );

      if (response.ok) {
        await loadGitStatus();
        showMessage('success', 'ცვლილებები წარმატებით გაიგზავნა GitHub-ზე');
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to push changes:', error);
      showMessage('error', 'GitHub-ზე გაგზავნა ვერ მოხერხდა');
    } finally {
      setActionLoading(false);
    }
  };

  const createFeatureBranch = async () => {
    if (!newBranchName.trim()) {
      showMessage('error', 'Branch name აუცილებელია');
      return;
    }

    try {
      const response = await fetch(
        '/api/ai/github/branches/feature',
        withAdminHeaders({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featureName: newBranchName })
        })
      );

      if (response.ok) {
        showMessage('success', 'Feature branch შექმნილი წარმატებით');
        setNewBranchName('');
        setShowCreateBranch(false);
        loadBranches();
      } else {
        showMessage('error', 'Branch შექმნის შეცდომა');
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to create feature branch:', error);
      showMessage('error', 'Branch შექმნის შეცდომა');
    }
  };

  const switchBranch = async (branchName: string) => {
    try {
      const response = await fetch(
        '/api/ai/github/branches/switch',
        withAdminHeaders({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetBranch: branchName })
        })
      );

      if (response.ok) {
        showMessage('success', `${branchName}-ზე გადართულია`);
        loadBranches();
        loadGitStatus();
        refetch();
      } else {
        showMessage('error', 'Branch switching შეცდომა');
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error('Failed to switch branch:', error);
      showMessage('error', 'Branch switching შეცდომა');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added': return <Plus className="text-green-500" size={16} />;
      case 'modified': return <Edit className="text-blue-500" size={16} />;
      case 'deleted': return <Minus className="text-red-500" size={16} />;
      case 'untracked': return <FileText className="text-gray-500" size={16} />;
      case 'conflict': return <AlertTriangle className="text-orange-500" size={16} />;
      default: return <FileText className="text-gray-500" size={16} />;
    }
  };

  const getDiffLineClass = (type: string) => {
    switch (type) {
      case 'added': return 'bg-green-100 dark:bg-green-900 dark:bg-opacity-20 text-green-800 dark:text-green-200';
      case 'removed': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200';
      default: return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ka-GE');
  };

  const renderWorkspaceView = () => (
    <div className="space-y-6">
      {/* Repository Status */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch size={20} />
            Git Workspace
          </h3>
          <button
            onClick={loadGitStatus}
            disabled={actionLoading}
            className="p-2 text-gray-400 hover:text-white"
          >
            <RefreshCw size={16} className={actionLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-400">მიმდინარე ბრენჩი</div>
            <div className="text-lg font-medium">{gitStatus?.branch || 'main'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">სტატუსი</div>
            <div className={`text-lg font-medium ${gitStatus?.clean ? 'text-green-400' : 'text-orange-400'}`}>
              {gitStatus?.clean ? 'სუფთა' : `${gitStatusFiles.length} ცვლილება`}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={pushChanges}
            disabled={actionLoading || gitStatus?.clean}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Upload size={16} />
            Push to GitHub
          </button>
        </div>
      </div>

      {/* File Changes */}
      {gitStatus && gitStatusFiles.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">შეცვლილი ფაილები</h3>

          <div className="space-y-2 mb-4">
            {gitStatusFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 bg-gray-700 rounded"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(file.status)}
                  <span className="font-mono text-sm">{file.path}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    file.staged ? 'bg-green-900 text-green-300' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {file.staged ? 'Staged' : 'Modified'}
                  </span>
                </div>

                <div className="flex gap-2">
                  {!file.staged ? (
                    <button
                      onClick={() => stageFiles([file.path])}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      Stage
                    </button>
                  ) : (
                    <button
                      onClick={() => stageFiles([file.path])}
                      className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                    >
                      Unstage
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Commit Section */}
          <div className="border-t border-gray-600 pt-4">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="შეიყვანეთ commit მესიჯი..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-2"
              rows={3}
            />
            <button
              onClick={commitChanges}
              disabled={!commitMessage.trim() || actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <GitCommit size={16} />
              Commit ცვლილებები
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryView = () => (
    <div className="space-y-6">
      {/* Commit History */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock size={20} />
          Commit ისტორია
        </h3>

        <div className="space-y-3">
          {commits.map((commit) => (
            <div key={commit.hash} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-blue-400">{commit.hash}</span>
                  {commit.isMerge && (
                    <span className="px-2 py-1 bg-purple-900 text-purple-300 text-xs rounded">
                      MERGE
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setExpandedCommit(
                    expandedCommit === commit.hash ? null : commit.hash
                  )}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  {expandedCommit === commit.hash ?
                    <ChevronUp size={16} /> : <ChevronDown size={16} />
                  }
                </button>
              </div>

              <div className="text-white font-medium mb-1">{commit.message}</div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <User size={12} />
                <span>{commit.author}</span>
                <span>•</span>
                <span>{commit.date.toLocaleDateString()}</span>
                <span>•</span>
                <span>{commit.date.toLocaleTimeString()}</span>
              </div>

              {expandedCommit === commit.hash && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="text-sm text-gray-300">
                    Full Hash: <span className="font-mono">{commit.fullHash}</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    Email: {commit.email}
                  </div>
                  {Array.isArray(commit.parents) && commit.parents.length > 0 && (
                    <div className="text-sm text-gray-300">
                      Parents: {(commit.parents ?? []).map(p => p.substring(0, 8)).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBranchesView = () => (
    <div className="space-y-6">
      {/* Branch Management */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch size={18} />
            Branches
          </h4>
          <button
            onClick={() => setShowCreateBranch(!showCreateBranch)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <Plus size={14} />
            ახალი Feature
          </button>
        </div>

        {/* Create Branch Form */}
        {showCreateBranch && (
          <div className="mb-4 p-4 bg-gray-700 rounded-lg">
            <div className="flex gap-3">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature name (e.g., user-authentication)"
                className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
              />
              <button
                onClick={createFeatureBranch}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                შექმნა
              </button>
              <button
                onClick={() => setShowCreateBranch(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                გაუქმება
              </button>
            </div>
          </div>
        )}

        {/* Branches List */}
        <div className="space-y-3">
          {localBranches.map((branch) => (
            <div
              key={branch.name}
              className={`flex items-center justify-between p-3 rounded-lg ${
                branch.current ? 'bg-blue-900/30 border border-blue-600' : 'bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🌿</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${branch.current ? 'text-blue-400' : 'text-white'}`}>
                      {branch.name}
                    </span>
                    {branch.current && (
                      <span className="px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    local
                    {(branch.ahead || branch.behind) && (
                      <span className="ml-2">
                        {branch.ahead ? `↑${branch.ahead}` : ''}
                        {branch.behind ? `↓${branch.behind}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!branch.current && (
                <button
                  onClick={() => switchBranch(branch.name)}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500 text-sm"
                >
                  Switch
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFilesTab = () => (
    <div className="space-y-6">
      {/* File History Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText size={18} />
          File History & Version Control
        </h4>

        {/* Recent Files Quick Access */}
        <div className="mb-4">
          <div className="text-sm text-gray-400 mb-2">ახლახან შეცვლილი ფაილები:</div>
          <div className="flex flex-wrap gap-2">
            {recentFiles.slice(0, 8).map((file) => (
              <button
                key={file}
                onClick={() => loadFileHistory(file)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                {file.split('/').pop()}
              </button>
            ))}
          </div>
        </div>

        {/* File Path Input */}
        <div className="mb-4">
          <input
            type="text"
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            placeholder="ფაილის path (მაგ: src/components/Header.tsx)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
          />
          <button
            onClick={() => selectedFile && loadFileHistory(selectedFile)}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ისტორიის ჩატვირთვა
          </button>
        </div>

        {/* File Versions */}
        {fileVersions.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-300">
              ფაილი: {selectedFile} - {fileVersions.length} ვერსია
            </div>

            {fileVersions.map((version, index) => (
              <div
                key={version.hash}
                className="bg-gray-700 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <span className="font-mono text-sm text-gray-300">
                      {version.hash.substring(0, 8)}
                    </span>
                    <span className="text-sm text-gray-400">
                      {version.author}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {index < fileVersions.length - 1 && (
                      <button
                        onClick={() => loadDiff(version.hash, fileVersions[index + 1].hash, selectedFile)}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center gap-1"
                      >
                        <Eye size={14} />
                        Diff
                      </button>
                    )}

                    <button
                      onClick={() => rollbackToVersion(selectedFile, version.hash)}
                      disabled={rollbackLoading === version.hash}
                      className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <RotateCcw size={14} className={rollbackLoading === version.hash ? 'animate-spin' : ''} />
                      Rollback
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-300 mb-2">{version.message}</div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{formatTimestamp(version.timestamp)}</span>
                  <span>{version.size} bytes</span>
                  {version.changes.added > 0 && (
                    <span className="text-green-400">+{version.changes.added}</span>
                  )}
                  {version.changes.deleted > 0 && (
                    <span className="text-red-400">-{version.changes.deleted}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!isDataLoaded) {
    return (
      <EmptyState
        icon={Clock}
        title="Loading GitOps…"
        description="Fetching the latest GitHub automation data."
      />
    );
  }

  if (reposFromHook.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No repositories"
        description="Connect GitHub or add a repository to continue."
      />
    );
  }

  const isFetching = Boolean(isLoading || hubLoading);

  if (isFetching) {
    return (
      <div className="h-full bg-gray-900 text-white p-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-9 bg-gray-800 rounded" />
          <div className="h-32 bg-gray-800 rounded" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 text-white p-6">
      {error && (
        <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap size={24} className="text-yellow-500" />
          Git Operations & Version Control
        </h2>

        <div className="flex items-center gap-2">
          {gitStatus && (
            <div className={`px-3 py-1 rounded text-sm ${
              gitStatus.clean ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'
            }`}>
              {gitStatus.clean ? 'Repository სუფთაა' : `${gitStatusFiles.length} ცვლილება`}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-xs text-gray-400">
        <span>PRs: {normalizedStats.prs}</span>
        <span>Issues: {normalizedStats.issues}</span>
        <span>Stars: {normalizedStats.stars}</span>
        <span>Forks: {normalizedStats.forks}</span>
        <span>Repos: {hookCounts.repos}</span>
        <span>Workflows: {hookCounts.workflows}</span>
        <span>Branches: {hookCounts.branches}</span>
        <span>Commits: {commitCount}</span>
        {hubLoading && <span className="text-blue-300">Refreshing…</span>}
        {hubStatus?.branch && <span>Active Hub Branch: {hubStatus.branch}</span>}
      </div>

      {/* Sub Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 mb-6 rounded-t-lg">
        <div className="flex">
          {tabDefinitions.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                activeSubTab === tab.key
                  ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                  : 'border-transparent hover:bg-gray-700 text-gray-300 hover:text-white'
              }`}
              title={tab.desc}
            >
              <tab.icon size={16} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeSubTab === 'workspace' && renderWorkspaceView()}
        {activeSubTab === 'history' && renderHistoryView()}
        {activeSubTab === 'branches' && renderBranchesView()}
        {activeSubTab === 'files' && renderFilesTab()}
      </div>

      {/* Visual Diff Viewer Modal */}
      {showDiffViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <Code size={18} />
                Visual Diff: {selectedFile}
              </h4>
              <button
                onClick={() => setShowDiffViewer(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                დახურვა
              </button>
            </div>

            <div className="mb-4 text-sm text-gray-400">
              Comparing {selectedFromVersion.substring(0, 8)} → {selectedToVersion.substring(0, 8)}
            </div>

            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-96 overflow-auto">
              {diffData.map((line, index) => (
                <div
                  key={index}
                  className={`px-2 py-1 ${getDiffLineClass(line.type)} border-l-4 ${
                    line.type === 'added' ? 'border-green-500' :
                    line.type === 'removed' ? 'border-red-500' : 'border-gray-500'
                  }`}
                >
                  <span className="text-gray-500 w-12 inline-block">
                    {line.lineNumber}
                  </span>
                  <span className="ml-2">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubGitOpsTab;
export interface GitHubStatus {
  success: boolean;
  branch?: string;
  hasChanges?: boolean;
  changesCount?: number;
  remoteUrl?: string;
  autoSync?: boolean;
  autoCommit?: boolean;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  account?: {
    login: string;
    avatar_url: string;
  };
  scopes?: string[];
  rateLimit?: {
    remaining: number;
    reset: number;
  };
  integrationDisabled?: boolean;
  authorizationUrl?: string;
  error?: string;
}

export interface GitHubCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitHubBranch {
  name: string;
  isCurrent: boolean;
  type: 'local' | 'remote';
  lastCommit?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface GitHubRepository {
  name: string;
  description: string;
  private: boolean;
  default_branch: string;
  topics: string[];
  collaborators: GitHubCollaborator[];
  webhooks: GitHubWebhook[];
}

export interface GitHubCollaborator {
  login: string;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

export interface GitHubWebhook {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
  };
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
}

export interface GitHubSettings {
  autoSync: boolean;
  autoCommit: boolean;
  autoMerge: boolean;
  webhookEnabled: boolean;
  issueTracking: boolean;
  syncInterval: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  defaultCommitTitle?: string;
  defaultCommitMessage?: string;
}
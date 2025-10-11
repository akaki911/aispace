// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Webhook,
  Key,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  GitMerge, // Import GitMerge icon
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import WebhookManager from './WebhookManager';
import type { GitHubConnectionStatus } from './types';
import { buildAdminHeaders } from '../../utils/adminToken';

interface GitHubConnectionControls {
  status: GitHubConnectionStatus;
  isLoading: boolean;
  error: string | null;
  connectOAuth: () => Promise<GitHubConnectionStatus | null>;
  savePAT: (token: string) => Promise<GitHubConnectionStatus | null>;
  test: () => Promise<GitHubConnectionStatus | null>;
  disconnect: () => Promise<GitHubConnectionStatus | null>;
  refreshStatus: () => Promise<GitHubConnectionStatus | null>;
}

interface GitHubSettingsTabProps {
  status: any;
  loading: boolean;
  showMessage: (type: 'success' | 'error', text: string) => void;
  refetch: () => void;
  connection: GitHubConnectionControls;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : undefined;

const createDefaultIntegrationSettingsForm = () => ({
  repoUrl: '',
  owner: '',
  repo: '',
  branch: '',
  pollingIntervalMs: 300000,
  autoSync: false,
  autoCommit: false,
  autoMerge: false,
  githubToken: '',
  webhookUrl: '',
  webhookSecret: '',
  branchProtectionRules: '',
  clearWebhookSecret: false,
});

const formatDateTime = (value: unknown): string => {
  if (!value) return '—';
  const date = typeof value === 'string' || typeof value === 'number'
    ? new Date(value)
    : value instanceof Date
      ? value
      : null;

  if (!date || Number.isNaN(date.valueOf())) {
    return String(value);
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const normalizeIntegrationSettings = (input: unknown) => {
  if (!isRecord(input)) {
    return null;
  }

  const normalized: Record<string, unknown> = {};

  if (typeof input.repoUrl === 'string') normalized.repoUrl = input.repoUrl;
  if (typeof input.owner === 'string') normalized.owner = input.owner;
  if (typeof input.repo === 'string') normalized.repo = input.repo;
  if (typeof input.branch === 'string') normalized.branch = input.branch;
  if (typeof input.autoSync === 'boolean') normalized.autoSync = input.autoSync;
  if (typeof input.autoCommit === 'boolean') normalized.autoCommit = input.autoCommit;
  if (typeof input.autoMerge === 'boolean') normalized.autoMerge = input.autoMerge;

  const pollingRaw = input.pollingIntervalMs ?? input.pollingInterval;
  const pollingValue = typeof pollingRaw === 'number'
    ? pollingRaw
    : Number.parseInt(String(pollingRaw ?? ''), 10);
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

const GitHubSettingsTab: React.FC<GitHubSettingsTabProps> = ({
  status,
  loading,
  showMessage,
  refetch,
  connection
}) => {
  const [settings, setSettings] = useState({
    autoSync: status?.autoSync || false,
    autoCommit: status?.autoCommit || false,
    syncInterval: 5,
    commitInterval: 10,
    webhookUrl: '',
    branchProtection: false,
    autoMerge: status?.autoMerge || false, // Add autoMerge state
    mergeMethod: status?.mergeMethod || 'merge', // Add mergeMethod state
    defaultCommitTitle: status?.defaultCommitTitle || '', // Add defaultCommitTitle state
    defaultCommitMessage: status?.defaultCommitMessage || '' // Add defaultCommitMessage state
  });

  const [webhookStatus, setWebhookStatus] = useState({
    secretConfigured: false,
    securityEnabled: false,
    lastVerified: null,
    loading: true,
    success: false
  });

  const [saving, setSaving] = useState(false);
  const [patToken, setPatToken] = useState('');
  const [integrationForm, setIntegrationForm] = useState(createDefaultIntegrationSettingsForm());
  const [integrationSettingsData, setIntegrationSettingsData] = useState(null);
  const [integrationSettingsDirty, setIntegrationSettingsDirty] = useState(false);
  const [savingIntegrationSettings, setSavingIntegrationSettings] = useState(false);
  const [lastConnectionToast, setLastConnectionToast] = useState<string | null>(null);

  const connectionStatus = connection.status;
  const isConnected = Boolean(connectionStatus?.connected);
  const integrationDisabled = Boolean(connectionStatus?.integrationDisabled);
  const connectionLoading = connection.isLoading;
  const scopes = connectionStatus?.scopes ?? [];
  const rateLimit = connectionStatus?.rateLimit;
  const rateLimitReset = rateLimit?.reset ? new Date(rateLimit.reset * 1000) : null;
  const statusLabel = integrationDisabled
    ? 'Integration disabled'
    : isConnected
      ? 'Connected'
      : 'Not connected';
  const connectionPillClasses = integrationDisabled
    ? 'border-gray-600 bg-gray-800 text-gray-400'
    : isConnected
      ? 'border-green-500/40 bg-green-500/10 text-green-200'
      : 'border-gray-600 bg-gray-800 text-gray-300';
  const integrationFormBusy = savingIntegrationSettings || connectionLoading || loading;
  const canSubmitIntegration = integrationSettingsDirty || Boolean(integrationForm.githubToken.trim());
  const branchProtectionSummary = Array.isArray(integrationSettingsData?.branchProtection)
    ? (integrationSettingsData.branchProtection as unknown[])
        .map((entry) =>
          isRecord(entry)
            ? toStringOrUndefined(entry.branch) ?? toStringOrUndefined(entry.name)
            : undefined
        )
        .filter((value): value is string => Boolean(value))
    : [];
  const integrationUpdatedLabel = integrationSettingsData?.updatedAt
    ? `განახლდა: ${formatDateTime(integrationSettingsData.updatedAt)}`
    : 'პარამეტრები არ არის შენახული';

  useEffect(() => {
    if (connection.error && connection.error !== lastConnectionToast) {
      toast.error(connection.error);
      setLastConnectionToast(connection.error);
    }
  }, [connection.error, lastConnectionToast]);

  const notifySuccess = (message: string) => {
    setLastConnectionToast(message);
    toast.success(message);
    showMessage('success', message);
  };

  const notifyError = (message: string) => {
    setLastConnectionToast(message);
    toast.error(message);
    showMessage('error', message);
  };

  const syncIntegrationSettings = useCallback(
    (incoming: unknown, options: { force?: boolean } = {}) => {
      const force = Boolean(options.force);
      const normalized = normalizeIntegrationSettings(incoming);

      setIntegrationSettingsData(normalized);

      if (!normalized) {
        if (force) {
          setIntegrationForm(createDefaultIntegrationSettingsForm());
          setIntegrationSettingsDirty(false);
        }
        return;
      }

      setIntegrationForm({
        repoUrl: normalized.repoUrl ?? '',
        owner: normalized.owner ?? '',
        repo: normalized.repo ?? '',
        branch: normalized.branch ?? '',
        pollingIntervalMs:
          typeof normalized.pollingIntervalMs === 'number'
            ? normalized.pollingIntervalMs
            : createDefaultIntegrationSettingsForm().pollingIntervalMs,
        autoSync: Boolean(normalized.autoSync),
        autoCommit: Boolean(normalized.autoCommit),
        autoMerge: Boolean(normalized.autoMerge),
        githubToken: '',
        webhookUrl: normalized.webhookUrl ?? '',
        webhookSecret: '',
        branchProtectionRules: normalized.branchProtection
          ? JSON.stringify(normalized.branchProtection, null, 2)
          : '',
        clearWebhookSecret: false,
      });

      setIntegrationSettingsDirty(false);

      setSettings((prev) => ({
        ...prev,
        autoSync: typeof normalized.autoSync === 'boolean' ? normalized.autoSync : prev.autoSync,
        autoCommit: typeof normalized.autoCommit === 'boolean' ? normalized.autoCommit : prev.autoCommit,
        autoMerge: typeof normalized.autoMerge === 'boolean' ? normalized.autoMerge : prev.autoMerge,
      }));
    },
    []
  );

  const fetchIntegrationSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/settings', {
        method: 'GET',
        headers: buildAdminHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      if (!payload?.success) {
        return;
      }

      syncIntegrationSettings(payload.settings, { force: true });
    } catch (error) {
      console.error('Integration settings fetch error:', error);
    }
  }, [syncIntegrationSettings]);

  useEffect(() => {
    fetchIntegrationSettings();
  }, [fetchIntegrationSettings]);

  const handleIntegrationTextChange = useCallback(
    (field: 'repoUrl' | 'owner' | 'repo' | 'branch' | 'githubToken' | 'webhookUrl') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setIntegrationSettingsDirty(true);
        const value = event.target.value;
        setIntegrationForm((prev) => ({
          ...prev,
          [field]: value,
        }));
      },
    []
  );

  const handleIntegrationPollingChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setIntegrationSettingsDirty(true);
    const value = Number.parseInt(event.target.value, 10);
    setIntegrationForm((prev) => ({
      ...prev,
      pollingIntervalMs: Number.isFinite(value) ? value : prev.pollingIntervalMs,
    }));
  }, []);

  const handleIntegrationSecretChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setIntegrationSettingsDirty(true);
    const value = event.target.value;
    setIntegrationForm((prev) => ({
      ...prev,
      webhookSecret: value,
      clearWebhookSecret: false,
    }));
  }, []);

  const handleIntegrationBranchRulesChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIntegrationSettingsDirty(true);
    setIntegrationForm((prev) => ({
      ...prev,
      branchProtectionRules: event.target.value,
    }));
  }, []);

  const handleIntegrationBooleanToggle = useCallback(
    (field: 'autoSync' | 'autoCommit' | 'autoMerge' | 'clearWebhookSecret') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setIntegrationSettingsDirty(true);
        const checked = event.target.checked;
        setIntegrationForm((prev) => ({
          ...prev,
          [field]: checked,
          ...(field === 'clearWebhookSecret' && checked ? { webhookSecret: '' } : {}),
        }));

        if (field === 'autoSync' || field === 'autoCommit' || field === 'autoMerge') {
          setSettings((prev) => ({
            ...prev,
            [field]: checked,
          }));
        }
      },
    []
  );

  const handleIntegrationReset = useCallback(() => {
    syncIntegrationSettings(integrationSettingsData, { force: true });
  }, [integrationSettingsData, syncIntegrationSettings]);

  const handleIntegrationSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSavingIntegrationSettings(true);
      try {
        const webhookUrlTrimmed = integrationForm.webhookUrl.trim();
        const branchRulesTrimmed = integrationForm.branchProtectionRules.trim();

        const payload: Record<string, unknown> = {
          repoUrl: integrationForm.repoUrl.trim() || undefined,
          owner: integrationForm.owner.trim() || undefined,
          repo: integrationForm.repo.trim() || undefined,
          branch: integrationForm.branch.trim() || undefined,
          autoSync: integrationForm.autoSync,
          autoCommit: integrationForm.autoCommit,
          autoMerge: integrationForm.autoMerge,
          pollingIntervalMs: Number.isFinite(integrationForm.pollingIntervalMs)
            ? integrationForm.pollingIntervalMs
            : undefined,
          githubToken: integrationForm.githubToken.trim() || undefined,
          webhookUrl:
            webhookUrlTrimmed.length > 0
              ? webhookUrlTrimmed
              : integrationSettingsData?.webhookUrl && webhookUrlTrimmed === ''
                ? ''
                : undefined,
        };

        if (integrationForm.clearWebhookSecret) {
          payload.webhookSecret = '';
        } else if (integrationForm.webhookSecret.trim().length > 0) {
          payload.webhookSecret = integrationForm.webhookSecret.trim();
        }

        if (branchRulesTrimmed.length > 0) {
          payload.branchProtectionRules = branchRulesTrimmed;
        } else if (integrationSettingsData?.branchProtection && branchRulesTrimmed === '') {
          payload.branchProtectionRules = '';
        }

        const response = await fetch('/api/ai/settings', {
          method: 'POST',
          headers: buildAdminHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          notifySuccess(result.message || 'პარამეტრები განახლდა');
          syncIntegrationSettings(result.settings, { force: true });
          await connection.refreshStatus();
          refetch();
        } else {
          notifyError(result.error || 'პარამეტრების შენახვა ვერ მოხერხდა');
        }
      } catch (error) {
        console.error('Integration settings save failed:', error);
        notifyError('პარამეტრების შენახვის შეცდომა');
      } finally {
        setSavingIntegrationSettings(false);
      }
    },
    [
      connection,
      integrationForm,
      integrationSettingsData,
      notifyError,
      notifySuccess,
      refetch,
      syncIntegrationSettings,
    ]
  );

  const handleOAuthConnect = async () => {
    const result = await connection.connectOAuth();

    if (!result) {
      if (connection.error) {
        notifyError(connection.error);
      }
      return;
    }

    if (result.integrationDisabled) {
      notifyError('GitHub integration is disabled');
      return;
    }

    if (result.connected) {
      notifySuccess('GitHub connected successfully');
      await connection.refreshStatus();
      return;
    }

    if (result.authorizationUrl) {
      toast.success('Opening GitHub authorization in a new window…');
      showMessage('success', 'GitHub authorization started');
      return;
    }

    if (result.error) {
      notifyError(result.error);
      return;
    }

    toast('OAuth connection request sent');
  };

  const handleSaveToken = async () => {
    const trimmedToken = patToken.trim();
    if (!trimmedToken) {
      return;
    }

    const result = await connection.savePAT(trimmedToken);

    if (!result) {
      if (connection.error) {
        notifyError(connection.error);
      }
      return;
    }

    if (result.integrationDisabled) {
      notifyError('GitHub integration is disabled');
      return;
    }

    if (result.connected) {
      notifySuccess('GitHub token saved successfully');
      setPatToken('');
      await connection.refreshStatus();
      return;
    }

    notifyError(result.error || 'Failed to validate GitHub token');
  };

  const handleTestConnection = async () => {
    const result = await connection.test();

    if (!result) {
      if (connection.error) {
        notifyError(connection.error);
      }
      return;
    }

    if (result.integrationDisabled) {
      notifyError('GitHub integration is disabled');
      return;
    }

    if (result.connected) {
      notifySuccess('GitHub connection verified');
      await connection.refreshStatus();
      return;
    }

    notifyError(result.error || 'GitHub connection test failed');
  };

  const handleDisconnect = async () => {
    const result = await connection.disconnect();

    if (!result) {
      if (connection.error) {
        notifyError(connection.error);
      }
      return;
    }

    if (result.integrationDisabled) {
      notifyError('GitHub integration is disabled');
      return;
    }

    notifySuccess('GitHub credentials disconnected');
    setPatToken('');
    await connection.refreshStatus();
  };

  // Check webhook security status on component mount
  useEffect(() => {
    const checkWebhookSecurity = async () => {
      try {
        console.log('🔍 Checking GitHub webhook security status...');
        const response = await fetch('/api/ai/github/issues/webhook/github/security-status');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Webhook security status received:', data);

        // Handle both old and new response formats
        if (data.success !== undefined) {
          setWebhookStatus({
            success: data.success,
            secretConfigured: data.secretConfigured,
            securityEnabled: data.securityEnabled,
            lastVerified: data.lastVerified,
            loading: false
          });
        } else {
          // Legacy format fallback
          setWebhookStatus({
            success: data.webhook_security?.secret_configured || false,
            secretConfigured: data.webhook_security?.secret_configured || false,
            securityEnabled: data.webhook_security?.signature_verification === 'enabled',
            lastVerified: data.webhook_security?.timestamp,
            loading: false
          });
        }
      } catch (error) {
        console.error('Webhook security check failed:', error);
        // This part of the error handling seems to be duplicated or incorrect.
        // It's setting webhookStatus with an incorrect structure.
        // Based on the interface, it should be:
        // setWebhookStatus({
        //   success: false,
        //   secretConfigured: false, // Assuming failure means not configured
        //   securityEnabled: false, // Assuming failure means not enabled
        //   lastVerified: null,
        //   loading: false,
        //   // The 'status' property with nested properties is not in the interface.
        //   // If this is meant to convey more error details, a new state or
        //   // a more specific error state should be introduced.
        // });
        // For now, let's stick to the interface definition.
        setWebhookStatus({
          success: false,
          secretConfigured: false,
          securityEnabled: false,
          lastVerified: null,
          loading: false
        });
      }
    };

    checkWebhookSecurity();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save auto-sync settings
      if (settings.autoSync !== status?.autoSync) {
        if (settings.autoSync) {
          await fetch('/api/ai/github/auto-sync/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intervalMinutes: settings.syncInterval })
          });
        } else {
          await fetch('/api/ai/github/auto-sync/disable', { method: 'POST' });
        }
      }

      // Save auto-commit settings
      if (settings.autoCommit !== status?.autoCommit) {
        if (settings.autoCommit) {
          await fetch('/api/ai/github/auto-commit/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intervalMinutes: settings.commitInterval })
          });
        } else {
          await fetch('/api/ai/github/auto-commit/disable', { method: 'POST' });
        }
      }

      // Save auto-merge settings
      if (settings.autoMerge !== status?.autoMerge) {
        if (settings.autoMerge) {
          await fetch('/api/ai/github/auto-merge/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mergeMethod: settings.mergeMethod,
              commitTitle: settings.defaultCommitTitle,
              commitMessage: settings.defaultCommitMessage
            })
          });
        } else {
          await fetch('/api/ai/github/auto-merge/disable', { method: 'POST' });
        }
      }

      showMessage('success', 'პარამეტრები შენახულია');
      refetch();
    } catch (error) {
      showMessage('error', 'პარამეტრების შენახვის შეცდომა');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* GitHub Connection */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key size={20} />
              GitHub Connection
            </h3>
            <p className="text-sm text-gray-400">
              Authenticate with GitHub using OAuth or a personal access token.
            </p>
          </div>

          <div
            className={`flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-medium ${connectionPillClasses}`}
          >
            {connectionLoading && <Loader2 size={14} className="animate-spin" />}
            <span className="uppercase tracking-wide">{statusLabel}</span>
            {isConnected && connectionStatus?.account?.avatar_url && (
              <img
                src={connectionStatus.account.avatar_url}
                alt={connectionStatus.account.login || 'GitHub account'}
                className="h-6 w-6 rounded-full border border-black/20"
              />
            )}
            {isConnected && connectionStatus?.account?.login && (
              <span className="text-xs">@{connectionStatus.account.login}</span>
            )}
          </div>
        </div>

        {integrationDisabled && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
            <AlertCircle size={14} />
            <span>GitHub integration is disabled by configuration.</span>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <button
              onClick={handleOAuthConnect}
              disabled={connectionLoading || integrationDisabled}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connectionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Connect to GitHub</span>
            </button>
            <p className="text-xs text-gray-400">
              Use OAuth to link your GitHub account without sharing personal access tokens.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <Key size={16} />
              Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxx"
              disabled={integrationDisabled || connectionLoading}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSaveToken}
                disabled={!patToken.trim() || connectionLoading || integrationDisabled}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connectionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Token
              </button>
              <button
                onClick={() => setPatToken('')}
                disabled={!patToken || connectionLoading}
                className="rounded-lg border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Tokens are sent securely to the backend and never stored in your browser.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleTestConnection}
            disabled={connectionLoading || integrationDisabled}
            className="flex items-center gap-2 rounded-lg border border-blue-500 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connectionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Test connection
          </button>
          <button
            onClick={handleDisconnect}
            disabled={connectionLoading || integrationDisabled || !isConnected}
            className="flex items-center gap-2 rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>

        {scopes.length > 0 && (
          <div className="text-xs text-gray-400">
            <span className="font-medium text-gray-300">Scopes:</span> {scopes.join(', ')}
          </div>
        )}

        {rateLimit && (
          <div className="text-xs text-gray-400">
            <span className="font-medium text-gray-300">Rate limit remaining:</span>{' '}
            <span className="text-gray-200">{rateLimit.remaining}</span>
            {rateLimitReset && (
              <span className="ml-3">Resets at {rateLimitReset.toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </div>

      {/* GitHub Integration Parameters */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings size={20} />
          GitHub პარამეტრები
        </h3>

        <form onSubmit={handleIntegrationSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Repository URL</label>
              <input
                type="text"
                value={integrationForm.repoUrl}
                onChange={handleIntegrationTextChange('repoUrl')}
                placeholder="https://github.com/akaki911/bakhmaro.co.git"
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">GitHub Owner</label>
              <input
                type="text"
                value={integrationForm.owner}
                onChange={handleIntegrationTextChange('owner')}
                placeholder="akaki911"
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Repository Name</label>
              <input
                type="text"
                value={integrationForm.repo}
                onChange={handleIntegrationTextChange('repo')}
                placeholder="bakhmaro.co"
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">ძირითადი Branch</label>
              <input
                type="text"
                value={integrationForm.branch}
                onChange={handleIntegrationTextChange('branch')}
                placeholder="main"
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Polling Interval (მილიწამი)</label>
              <input
                type="number"
                min={60000}
                step={1000}
                value={integrationForm.pollingIntervalMs}
                onChange={handleIntegrationPollingChange}
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
              />
              <p className="text-xs text-gray-400 mt-1">მინიმუმი 60000 ms (≈1 წუთი), მაქსიმუმი 900000 ms.</p>
            </div>

            <label className="flex items-center gap-2 text-gray-200 mt-2 md:mt-6">
              <input
                type="checkbox"
                checked={integrationForm.autoSync}
                onChange={handleIntegrationBooleanToggle('autoSync')}
                disabled={integrationFormBusy}
                className="h-4 w-4 text-blue-500"
              />
              Auto-sync გააქტიურება
            </label>

            <label className="flex items-center gap-2 text-gray-200 mt-2 md:mt-6">
              <input
                type="checkbox"
                checked={integrationForm.autoCommit}
                onChange={handleIntegrationBooleanToggle('autoCommit')}
                disabled={integrationFormBusy}
                className="h-4 w-4 text-teal-500"
              />
              Auto-commit ჩართვა
            </label>

            <label className="flex items-center gap-2 text-gray-200 mt-2 md:mt-6">
              <input
                type="checkbox"
                checked={integrationForm.autoMerge}
                onChange={handleIntegrationBooleanToggle('autoMerge')}
                disabled={integrationFormBusy}
                className="h-4 w-4 text-purple-500"
              />
              Auto-merge ჩართვა
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">GitHub Token (არჩევითი)</label>
            <input
              type="password"
              value={integrationForm.githubToken}
              onChange={handleIntegrationTextChange('githubToken')}
              placeholder="ახალი GITHUB_TOKEN"
              disabled={integrationFormBusy}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
            />
            {integrationSettingsData?.tokenMasked && (
              <p className="text-xs text-gray-400 mt-1">ამჟამინდელი Token: {integrationSettingsData.tokenMasked}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Webhook URL</label>
              <input
                type="text"
                value={integrationForm.webhookUrl}
                onChange={handleIntegrationTextChange('webhookUrl')}
                placeholder="https://bakhmaro.co/api/github/webhook"
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
              />
              {integrationSettingsData?.webhookUrl && (
                <p className="text-xs text-gray-400 mt-1">ამჟამინდელი URL: {integrationSettingsData.webhookUrl}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Webhook Secret</label>
              <input
                type="password"
                value={integrationForm.webhookSecret}
                onChange={handleIntegrationSecretChange}
                placeholder="ახალი Secret ან დატოვეთ ცარიელი"
                disabled={integrationFormBusy}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 disabled:opacity-50"
              />
              {integrationSettingsData?.webhookSecretMasked && (
                <p className="text-xs text-gray-400 mt-1">დაცული Secret: {integrationSettingsData.webhookSecretMasked}</p>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-300 mt-2">
                <input
                  type="checkbox"
                  checked={integrationForm.clearWebhookSecret}
                  onChange={handleIntegrationBooleanToggle('clearWebhookSecret')}
                  disabled={integrationFormBusy}
                  className="h-4 w-4 text-red-500"
                />
                Secret-ის წაშლა (GitHub-ზე rotation)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Branch Protection Rules (JSON)</label>
            <textarea
              value={integrationForm.branchProtectionRules}
              onChange={handleIntegrationBranchRulesChange}
              placeholder='[{"branch":"main","rules":{"required_status_checks":{}}}]'
              disabled={integrationFormBusy}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 h-32 resize-y disabled:opacity-50"
            />
            {branchProtectionSummary.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                მიმდინარე დაცული ბრენჩები: {branchProtectionSummary.join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{integrationUpdatedLabel}</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleIntegrationReset}
                disabled={integrationFormBusy || (!integrationSettingsDirty && !integrationForm.githubToken)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                გაუქმება
              </button>
              <button
                type="submit"
                disabled={integrationFormBusy || !canSubmitIntegration}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingIntegrationSettings ? 'შენახვა...' : 'პარამეტრების შენახვა'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Repository Configuration */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings size={20} />
          Repository კონფიგურაცია
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">Auto-Sync</label>
              <p className="text-xs text-gray-400">ავტომატური სინქრონიზაცია GitHub-თან</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIntegrationSettingsDirty(true);
                  setSettings({ ...settings, autoSync: checked });
                  setIntegrationForm((prev) => ({ ...prev, autoSync: checked }));
                }}
                disabled={!isConnected || connectionLoading || integrationDisabled}
                className="rounded disabled:opacity-50"
              />
              {settings.autoSync && (
                <input
                  type="number"
                  value={settings.syncInterval}
                  onChange={(e) => setSettings({...settings, syncInterval: parseInt(e.target.value)})}
                  min="1"
                  max="60"
                  disabled={!isConnected || connectionLoading || integrationDisabled}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs disabled:opacity-50"
                />
              )}
              <span className="text-xs text-gray-400">წუთი</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">Auto-Commit</label>
              <p className="text-xs text-gray-400">ავტომატური commit-ები</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoCommit}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIntegrationSettingsDirty(true);
                  setSettings({ ...settings, autoCommit: checked });
                  setIntegrationForm((prev) => ({ ...prev, autoCommit: checked }));
                }}
                disabled={!isConnected || connectionLoading || integrationDisabled}
                className="rounded disabled:opacity-50"
              />
              {settings.autoCommit && (
                <input
                  type="number"
                  value={settings.commitInterval}
                  onChange={(e) => setSettings({...settings, commitInterval: parseInt(e.target.value)})}
                  min="1"
                  max="120"
                  disabled={!isConnected || connectionLoading || integrationDisabled}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs disabled:opacity-50"
                />
              )}
              <span className="text-xs text-gray-400">წუთი</span>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Configuration */}
      <WebhookManager
        webhookStatus={webhookStatus}
        setWebhookStatus={setWebhookStatus}
        settings={settings}
        setSettings={setSettings}
        showMessage={showMessage}
      />

      {/* Auto-Merge Configuration */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <GitMerge size={20} />
          Auto-Merge კონფიგურაცია
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.autoMerge}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIntegrationSettingsDirty(true);
                  setSettings((prev) => ({ ...prev, autoMerge: checked }));
                  setIntegrationForm((prev) => ({ ...prev, autoMerge: checked }));
                }}
                disabled={!isConnected || connectionLoading || integrationDisabled}
                className="rounded disabled:opacity-50"
              />
            <span className="text-sm text-white">Enable auto-merge for approved PRs</span>
          </label>

          {settings.autoMerge && (
            <>
              {/* Merge Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Merge Method:
                </label>
                <select
                  value={settings.mergeMethod || 'merge'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    mergeMethod: e.target.value as 'merge' | 'squash' | 'rebase'
                  }))}
                  disabled={!isConnected || connectionLoading || integrationDisabled}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-50"
                >
                  <option value="merge">Create a merge commit</option>
                  <option value="squash">Squash and merge</option>
                  <option value="rebase">Rebase and merge</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {settings.mergeMethod === 'squash' && 'Combines all commits into one commit'}
                  {settings.mergeMethod === 'rebase' && 'Replays commits without creating merge commit'}
                  {settings.mergeMethod === 'merge' && 'Preserves branch history with merge commit'}
                </p>
              </div>

              {/* Default Commit Message Templates */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Commit Title Template:
                </label>
                <input
                  type="text"
                  value={settings.defaultCommitTitle || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultCommitTitle: e.target.value }))}
                  placeholder="e.g., feat: #{pr_number} - {pr_title}"
                  disabled={!isConnected || connectionLoading || integrationDisabled}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Commit Message Template:
                </label>
                <textarea
                  value={settings.defaultCommitMessage || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultCommitMessage: e.target.value }))}
                  placeholder="Additional commit message details..."
                  rows={3}
                  disabled={!isConnected || connectionLoading || integrationDisabled}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 disabled:opacity-50"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Repository Information */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ExternalLink size={20} />
          Repository ინფორმაცია
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Repository URL</div>
              <div className="text-white font-mono text-sm break-all">
                {status?.remoteUrl || 'არ არის კონფიგურირებული'}
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">მიმდინარე Branch</div>
              <div className="text-white font-medium">
                {status?.branch || 'main'}
              </div>
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Repository Statistics</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-400">5089</div>
                <div className="text-xs text-gray-400">Total Commits</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">15</div>
                <div className="text-xs text-gray-400">Branches</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-400">0</div>
                <div className="text-xs text-gray-400">Open Issues</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collaborators Management */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CheckCircle size={20} />
          Collaborators Management
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                A
              </div>
              <div>
                <div className="text-white font-medium">AI Developer (Owner)</div>
                <div className="text-xs text-gray-400">gurulo@bakhmaro.ai</div>
              </div>
            </div>
            <div className="px-2 py-1 bg-green-600 text-white text-xs rounded">
              Owner
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                B
              </div>
              <div>
                <div className="text-white font-medium">Bakhmaro Team</div>
                <div className="text-xs text-gray-400">team@bakhmaro.ai</div>
              </div>
            </div>
            <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
              Admin
            </div>
          </div>

          <button className="w-full px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2">
            <CheckCircle size={16} />
            Collaborator-ების მართვა
          </button>
        </div>
      </div>

      {/* Current Status */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">მიმდინარე სტატუსი</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            {status?.autoSync ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-yellow-500" />
            )}
            <div>
              <div className="text-sm font-medium text-white">Auto-Sync</div>
              <div className="text-xs text-gray-400">
                {status?.autoSync ? 'ჩართული' : 'გამორთული'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            {status?.autoCommit ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-yellow-500" />
            )}
            <div>
              <div className="text-sm font-medium text-white">Auto-Commit</div>
              <div className="text-xs text-gray-400">
                {status?.autoCommit ? 'ჩართული' : 'გამორთული'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            <CheckCircle size={16} className="text-blue-500" />
            <div>
              <div className="text-sm font-medium text-white">CI/CD Pipeline</div>
              <div className="text-xs text-gray-400">ჩართული და მუშაობს</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            <CheckCircle size={16} className="text-green-500" />
            <div>
              <div className="text-sm font-medium text-white">Security Scan</div>
              <div className="text-xs text-gray-400">ყოველდღიურად</div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={saving || connectionLoading || integrationDisabled}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'შენახვა...' : 'პარამეტრების შენახვა'}
        </button>
      </div>
    </div>
  );
};

export default GitHubSettingsTab;
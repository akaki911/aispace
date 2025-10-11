import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings,
  BarChart3,
  GitBranch,
  RefreshCw,
  Terminal,
  Bug,
  TestTube,
  Loader2
} from 'lucide-react';
import GitHubEndpointsVerifier from '../../utils/githubVerification';
import GitHubOverviewTab from './GitHubOverviewTab';
import GitHubSettingsTab from './GitHubSettingsTab';
import GitHubIssuesTab from './GitHubIssuesTab';
import GitHubAnalyticsTab from './GitHubAnalyticsTab';
import GitHubGitOpsTab from './GitHubGitOpsTab';
import RepositoryAutomationTab from './RepositoryAutomationTab'; // Assuming this component exists
import { useGitHubConnection, useGitHubData, useGitHubOperations } from './hooks';

export interface GitHubStatus {
  success: boolean;
  branch?: string;
  hasChanges?: boolean;
  changesCount?: number;
  remoteUrl?: string;
  autoSync?: boolean;
  autoCommit?: boolean;
}

const GitHubManagementHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'git-ops' | 'settings' | 'issues' | 'analytics' | 'automation'>('overview');
  const [status] = useState<GitHubStatus | null>(null);
  const [loading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);

  // Custom hooks for data management
  const { data, loading: dataLoading, error: dataError, refetch } = useGitHubData();
  const { } = useGitHubOperations();
  const gitHubConnection = useGitHubConnection();
  const connectionStatus = gitHubConnection.status;
  const connectionLoading = gitHubConnection.isLoading;
  const isConnected = Boolean(connectionStatus?.connected);
  const statusLabel = connectionStatus.integrationDisabled
    ? 'Integration disabled'
    : isConnected
      ? 'CONNECTED'
      : 'NOT CONNECTED';
  const connectionPillStyles = connectionStatus.integrationDisabled
    ? 'border-gray-600 bg-gray-800 text-gray-400'
    : isConnected
      ? 'border-green-500/40 bg-green-500/10 text-green-200'
      : 'border-gray-600 bg-gray-800 text-gray-300';

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  useEffect(() => {
    if (gitHubConnection.error && gitHubConnection.error !== lastConnectionError) {
      showMessage('error', gitHubConnection.error);
      setLastConnectionError(gitHubConnection.error);
    }
  }, [gitHubConnection.error, lastConnectionError, showMessage]);

  const tabs = [
    {
      key: 'overview',
      icon: GitBranch,
      label: 'მთავარი',
      description: 'Repository სტატუსი, სინქრონიზაცია და მთავარი მოქმედებები'
    },
    {
      key: 'git-ops',
      icon: Terminal,
      label: 'Git Operations',
      description: 'Git კომანდები, commit-ები, branches და version control'
    },
    {
      key: 'automation', // Added Automation Tab
      icon: Terminal, // Placeholder icon, consider a more suitable one
      label: 'ავტომატიზაცია',
      description: 'Repository სრული ავტომატიზაცია'
    },
    {
      key: 'analytics',
      icon: BarChart3,
      label: 'ანალიტიკა',
      description: 'Repository მეტრიკები, commit ისტორია და პერფორმანსი'
    },
    {
      key: 'issues',
      icon: Bug,
      label: 'Issues',
      description: 'Bug tracking, feature requests და feedback'
    },
    {
      key: 'settings',
      icon: Settings,
      label: 'პარამეტრები',
      description: 'Repository კონფიგურაცია, webhooks და collaborators'
    }
  ];

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    refetch();
  };

  const handleVerifyEndpoints = async () => {
    console.log('🧪 Starting GitHub endpoints verification...');
    setIsVerifying(true);

    try {
      const verifier = new GitHubEndpointsVerifier();
      const results = await verifier.verifyAllEndpoints();

      const allPassed = results.every(r => r.success);

      if (allPassed) {
        showMessage('success', `✅ ყველა ${results.length} endpoint ვერიფიცირებულია წარმატებით!`);
        console.log('🎉 All GitHub endpoints verification completed successfully!');
      } else {
        const failed = results.filter(r => !r.success).length;
        showMessage('error', `⚠️ ${failed}/${results.length} endpoint-მა ვერ გაიარა ვერიფიკაცია`);
        console.warn(`⚠️ ${failed} out of ${results.length} endpoints failed verification`);
      }

    } catch (error) {
      console.error('❌ Verification process failed:', error);
      showMessage('error', 'ვერიფიკაციის პროცესში დაფიქსირდა შეცდომა');
    } finally {
      setIsVerifying(false);
    }
  };

  const renderActiveTab = () => {
    const commonProps = {
      status,
      loading,
      showMessage,
      refetch
    };

    switch (activeTab) {
      case 'overview':
        return <GitHubOverviewTab {...commonProps} onConnectionStateChange={gitHubConnection.refreshStatus} />;
      case 'git-ops':
        return (
          <GitHubGitOpsTab
            {...commonProps}
            data={data}
            error={dataError}
            isLoading={dataLoading}
          />
        );
      case 'automation': // Render for the new automation tab
        return <RepositoryAutomationTab />;
      case 'analytics':
        return (
          <GitHubAnalyticsTab
            {...commonProps}
            data={data}
            error={dataError}
            isLoadingData={dataLoading}
          />
        );
      case 'issues':
        return <GitHubIssuesTab {...commonProps} />; // Passing commonProps to issues tab
      case 'settings':
        return <GitHubSettingsTab {...commonProps} connection={gitHubConnection} />;
      default:
        return <GitHubOverviewTab {...commonProps} onConnectionStateChange={gitHubConnection.refreshStatus} />;
    }
  };

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch size={24} className="text-blue-500" />
            <div>
              <h1 className="text-xl font-semibold">GitHub Management Hub</h1>
              <p className="text-sm text-gray-400">ყოვლისმომცველი GitHub ინტეგრაცია</p>
            </div>
          </div>

          {/* Quick Status */}
          <div className="flex items-center gap-3 text-sm">
            <div
              className={`flex items-center gap-2 border rounded-full px-3 py-1 transition-colors ${connectionPillStyles}`}
            >
              {connectionLoading && <Loader2 size={14} className="animate-spin" />}
              <span className="text-xs font-medium uppercase tracking-wide">{statusLabel}</span>
              {isConnected && connectionStatus?.account?.avatar_url && (
                <img
                  src={connectionStatus.account.avatar_url}
                  alt={connectionStatus.account.login || 'GitHub account'}
                  className="h-5 w-5 rounded-full border border-black/20"
                />
              )}
              {isConnected && connectionStatus?.account?.login && (
                <span className="text-xs font-medium">@{connectionStatus.account.login}</span>
              )}
            </div>
          </div>
        </div>
        {/* Verification Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleVerifyEndpoints}
            disabled={isVerifying}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title="Verify all GitHub endpoints"
          >
            <TestTube size={16} className={isVerifying ? 'animate-pulse' : ''} />
            {isVerifying ? 'ვერიფიკაცია...' : 'Verify'}
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh GitHub data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                  : 'border-transparent hover:bg-gray-700 text-gray-300 hover:text-white'
              }`}
              title={tab.description}
            >
              <tab.icon size={16} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`px-4 py-2 ${
          message.type === 'success'
            ? 'bg-green-900/50 border-l-4 border-green-500 text-green-200'
            : 'bg-red-900/50 border-l-4 border-red-500 text-red-200'
        }`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {renderActiveTab()}
      </div>

      {/* Footer Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>GitHub Hub v2.1 - Optimized</span>
            {data && data.status && (
              <span>ბოლო განახლება: {new Date().toLocaleTimeString('ka-GE')}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dataLoading && <span className="text-blue-400">იტვირთება...</span>}
            {dataError && <span className="text-red-400">შეცდომა</span>}
            <button
              onClick={refetch}
              className="text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-700"
            >
              განახლება
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubManagementHub;
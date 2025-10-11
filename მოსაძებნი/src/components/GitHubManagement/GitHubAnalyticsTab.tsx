// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  GitCommit,
  Users,
  Calendar,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  GitBranch,
  GitPullRequest,
  Bug,
  Star,
  GitFork,
  GitMerge,
  Shield,
  Zap,
  Target,
  Settings
} from 'lucide-react';

interface GitHubAnalyticsTabProps {
  status: any;
  loading: boolean;
  showMessage: (type: 'success' | 'error', text: string) => void;
  refetch: () => void;
  data?: any;
  error?: string | null;
  isLoadingData?: boolean;
}

interface RepositoryDashboard {
  repository: any;
  collaborators: any[];
  branches: any[];
  workflowRuns: any[];
  webhooks: any[];
  topics: string[];
}

const GitHubAnalyticsTab: React.FC<GitHubAnalyticsTabProps> = ({
  status,
  loading,
  showMessage,
  refetch,
  data,
  error: dataError,
  isLoadingData
}) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [dashboardData, setDashboardData] = useState<RepositoryDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // State to hold error messages

  const overviewData = data ?? {};
  const statsFromHook =
    overviewData?.stats && typeof overviewData.stats === 'object'
      ? overviewData.stats
      : {};

  const displayedStats = {
    prs: Number(statsFromHook.prs ?? 0),
    issues: Number(statsFromHook.issues ?? 0),
    stars: Number(statsFromHook.stars ?? 0),
    forks: Number(statsFromHook.forks ?? 0)
  };

  const totalCommits =
    typeof statsFromHook.total === 'number' && !Number.isNaN(statsFromHook.total)
      ? statsFromHook.total
      : Array.isArray(overviewData?.commits)
        ? overviewData.commits.length
        : 0;

  const todayCommits =
    typeof statsFromHook.today === 'number' && !Number.isNaN(statsFromHook.today)
      ? statsFromHook.today
      : 0;

  const branchesRaw = overviewData?.branches;
  const branchCount = Array.isArray(branchesRaw)
    ? branchesRaw.length
    : branchesRaw && typeof branchesRaw === 'object'
      ? Number(branchesRaw.local ?? 0) + Number(branchesRaw.remote ?? 0)
      : 0;

  const autoSyncEnabled = Boolean(overviewData?.settings?.autoSync ?? overviewData?.status?.autoSync);
  const autoCommitEnabled = Boolean(overviewData?.settings?.autoCommit ?? overviewData?.status?.autoCommit);
  const autoMergeEnabled = Boolean(overviewData?.settings?.autoMerge ?? overviewData?.status?.autoMerge);

  const showOverviewStats = Boolean(data) && !(isLoadingData && !totalCommits && !todayCommits);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear previous errors

      // Add timeout and better error handling
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const url = '/api/ai/github/advanced/dashboard';
      console.log(`🔄 GitHub Analytics Dashboard Request: ${url}`);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeout);
      
      console.log(`📡 GitHub Analytics Dashboard Response: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before retrying.');
      }

      if (response.status === 500) {
        throw new Error('Server error. GitHub integration may be temporarily unavailable.');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ GitHub Analytics Dashboard Result:`, data);

      if (data.success) {
        console.log(`📊 Dashboard Data Loaded:`, data.dashboard);
        setDashboardData(data.dashboard);
      } else {
        console.log(`❌ Dashboard Data Error:`, data.error);
        // Use the showMessage prop for errors from the API response
        showMessage('error', data.error || 'Dashboard მონაცემების ჩატვირთვის შეცდომა');
        // Also set local error state for UI feedback if needed
        setError(data.error || 'Dashboard მონაცემების ჩატვირთვის შეცდომა');
      }
    } catch (error) {
      console.error('Dashboard API Error:', error);
      if (error.name === 'AbortError') {
        setError('Request timeout. Please try again.');
        showMessage('error', 'Request timeout. Please try again.');
      } else {
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        showMessage('error', `Dashboard API-ს შეცდომა: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      }

      // Fallback data to prevent UI crashes
      setDashboardData({
        repository: null,
        collaborators: [],
        branches: [],
        workflowRuns: [],
        webhooks: [],
        topics: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch with delay to avoid overwhelming API
    const initialTimeout = setTimeout(fetchDashboardData, 2000);

    // Auto-refresh every 10 minutes instead of 5
    const interval = setInterval(fetchDashboardData, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);


  if (isLoading && !dashboardData) { // Show loading state only if no data has been loaded yet
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
            <BarChart3 size={48} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">GitHub Analytics ჩაიტვირთება...</h3>
          <p className="text-gray-400">Repository მონაცემების ანალიზი</p>
        </div>
      </div>
    );
  }

  // Display error message if present
  if (error && !dashboardData) {
    return (
      <div className="p-6 text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-xl font-semibold mb-2 text-red-500">დაფიქსირდა შეცდომა</h3>
        <p className="text-gray-400">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Activity size={16} /> განმეორებითი მცდელობა
        </button>
      </div>
    );
  }

  // Render dashboard if data is available
  const getWorkflowSuccessRate = () => {
    if (!dashboardData || !dashboardData.workflowRuns || dashboardData.workflowRuns.length === 0) return 0;
    const successful = dashboardData.workflowRuns.filter(run => run.conclusion === 'success').length;
    return Math.round((successful / dashboardData.workflowRuns.length) * 100);
  };

  const getRecentActivity = () => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (!dashboardData || !dashboardData.workflowRuns) return 0;

    return dashboardData.workflowRuns.filter(run => 
      new Date(run.createdAt) > lastWeek
    ).length;
  };

  // Safe getter functions with null checks
  const getRepositorySize = () => {
    return dashboardData?.repository?.size || 0;
  };

  const getBranchesCount = () => {
    return dashboardData?.branches?.length || 0;
  };

  const getProtectedBranches = () => {
    return dashboardData?.branches?.filter(b => b.protected)?.length || 0;
  };

  const getCollaboratorsCount = () => {
    return dashboardData?.collaborators?.length || 0;
  };

  const getAdminCollaborators = () => {
    return dashboardData?.collaborators?.filter(c => c.role === 'Admin')?.length || 0;
  };

  return (
    <div className="p-6 space-y-6">
      {showOverviewStats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            მთავარი სტატისტიკა
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitCommit size={16} className="text-blue-400" />
                <span className="text-sm text-gray-400">სულ Commits</span>
              </div>
              <div className="text-2xl font-bold text-white">{totalCommits}</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-green-400" />
                <span className="text-sm text-gray-400">დღეს</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{todayCommits}</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch size={16} className="text-purple-400" />
                <span className="text-sm text-gray-400">Branches</span>
              </div>
              <div className="text-2xl font-bold text-purple-300">{branchCount}</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-yellow-400" />
                <span className="text-sm text-gray-400">Auto-sync</span>
              </div>
              <div className="text-lg font-bold text-yellow-300">
                {autoSyncEnabled ? 'ჩართული' : 'გამორთული'}
              </div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitCommit size={16} className="text-teal-300" />
                <span className="text-sm text-gray-400">Auto-commit</span>
              </div>
              <div className="text-lg font-bold text-teal-200">
                {autoCommitEnabled ? 'ჩართული' : 'გამორთული'}
              </div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitMerge size={16} className="text-indigo-300" />
                <span className="text-sm text-gray-400">Auto-merge</span>
              </div>
              <div className="text-lg font-bold text-indigo-200">
                {autoMergeEnabled ? 'ჩართული' : 'გამორთული'}
              </div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitPullRequest size={16} className="text-pink-400" />
                <span className="text-sm text-gray-400">Pull Requests</span>
              </div>
              <div className="text-2xl font-bold text-pink-300">{displayedStats.prs}</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bug size={16} className="text-red-400" />
                <span className="text-sm text-gray-400">Issues</span>
              </div>
              <div className="text-2xl font-bold text-red-300">{displayedStats.issues}</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={16} className="text-amber-300" />
                <span className="text-sm text-gray-400">Stars</span>
              </div>
              <div className="text-2xl font-bold text-amber-200">{displayedStats.stars}</div>
            </div>

            <div className="bg-gray-900/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitFork size={16} className="text-cyan-400" />
                <span className="text-sm text-gray-400">Forks</span>
              </div>
              <div className="text-2xl font-bold text-cyan-200">{displayedStats.forks}</div>
            </div>
          </div>
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Repository Analytics</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {range === 'week' ? 'კვირა' : range === 'month' ? 'თვე' : 'კვარტალი'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <GitCommit size={20} className="text-green-400" />
            <span className="text-sm text-gray-400">Commits</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {getRepositorySize()}
          </div>
          <div className="text-xs text-green-400">+{getRecentActivity()} ამ კვირაში</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch size={20} className="text-blue-400" />
            <span className="text-sm text-gray-400">Branches</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {getBranchesCount()}
          </div>
          <div className="text-xs text-blue-400">
            {getProtectedBranches()} protected
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-purple-400" />
            <span className="text-sm text-gray-400">Collaborators</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {getCollaboratorsCount()}
          </div>
          <div className="text-xs text-purple-400">
            {getAdminCollaborators()} admins
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Target size={20} className="text-yellow-400" />
            <span className="text-sm text-gray-400">CI/CD Success</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {getWorkflowSuccessRate()}%
          </div>
          <div className="text-xs text-yellow-400">
            {dashboardData?.workflowRuns?.length || 0} runs total
          </div>
        </div>
      </div>

      {/* Repository Health */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield size={20} />
          Repository Health
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Security & Compliance</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Branch Protection</span>
                <CheckCircle size={16} className="text-green-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Webhooks Active</span>
                {dashboardData?.webhooks?.some(w => w.active) ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-400" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Topics Configured</span>
                {(dashboardData?.topics?.length || 0) > 0 ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-400" />
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Repository Metrics</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Repository Size</span>
                <span className="text-sm text-blue-400">
                  {Math.round((dashboardData?.repository?.size || 0) / 1024)} MB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Default Branch</span>
                <span className="text-sm text-green-400">
                  {dashboardData?.repository?.defaultBranch || 'main'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Updated</span>
                <span className="text-sm text-gray-400">
                  {dashboardData?.repository?.updatedAt ? 
                    new Date(dashboardData.repository.updatedAt).toLocaleDateString('ka-GE') : 
                    'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Workflow Runs */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={20} />
          Recent CI/CD Runs
        </h3>

        <div className="space-y-3">
          {(dashboardData?.workflowRuns || []).slice(0, 5).map((run, index) => (
            <div key={run.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  run.conclusion === 'success' ? 'bg-green-400' :
                  run.conclusion === 'failure' ? 'bg-red-400' :
                  'bg-yellow-400'
                }`} />
                <div>
                  <div className="text-sm font-medium text-white">{run.name}</div>
                  <div className="text-xs text-gray-400">{run.headBranch}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-300 capitalize">{run.status}</div>
                <div className="text-xs text-gray-400">
                  {new Date(run.createdAt).toLocaleString('ka-GE')}
                </div>
              </div>
            </div>
          ))}

          {(dashboardData?.workflowRuns?.length || 0) === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Workflow runs არ არის</p>
            </div>
          )}
        </div>
      </div>

      {/* Repository Topics */}
      {(dashboardData?.topics?.length || 0) > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Repository Topics</h3>
          <div className="flex flex-wrap gap-2">
            {(dashboardData?.topics || []).map((topic, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={fetchDashboardData}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          <Activity size={16} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'განახლება...' : 'მონაცემების განახლება'}
        </button>
      </div>
    </div>
  );
};

export default GitHubAnalyticsTab;
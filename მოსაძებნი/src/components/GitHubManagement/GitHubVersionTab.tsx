import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  GitBranch,
  GitMerge,
  Tag,
  Calendar,
  User,
  Hash,
  ExternalLink,
  RefreshCw,
  Plus,
  ArrowRight,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Code,
  FileText,
  History
} from 'lucide-react';

interface GitHubVersionTabProps {
  status: any;
  loading: boolean;
  showMessage: (type: 'success' | 'error', text: string) => void;
  refetch: () => void;
}

interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  branch?: string;
}

interface Branch {
  name: string;
  isCurrent: boolean;
  type: string;
  ahead?: number;
  behind?: number;
}

type VersionAuthor =
  | string
  | {
      name?: string;
      avatar?: string;
    };

interface FileVersion {
  hash: string;
  shortHash?: string;
  author: VersionAuthor;
  timestamp: string;
  message: string;
  changes: {
    added?: number;
    deleted?: number;
    modified?: number;
    additions?: number;
    deletions?: number;
  };
  size: number;
  verified?: boolean;
  url?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  lineNumber: number;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  lineNumber: number;
}

const GitHubVersionTab: React.FC<GitHubVersionTabProps> = ({
  status,
  loading,
  showMessage,
  refetch
}) => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffData, setDiffData] = useState<DiffLine[]>([]);
  const [selectedFromVersion, setSelectedFromVersion] = useState<string>('');
  const [selectedToVersion, setSelectedToVersion] = useState<string>('');
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  useEffect(() => {
    loadVersionData();
    loadRecentFiles();
  }, []);

  const loadVersionData = async () => {
    setVersionLoading(true);
    try {
      const [commitsRes, branchesRes] = await Promise.all([
        fetch('/api/ai/github/commits?limit=20'),
        fetch('/api/ai/github/branches')
      ]);

      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        setCommits(commitsData.commits || []);
      }

      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        setBranches(branchesData.branches?.local || []);
      }
    } catch (error) {
      console.error('Version data loading error:', error);
      showMessage('error', 'Version მონაცემების ჩატვირთვის შეცდომა');
    } finally {
      setVersionLoading(false);
    }
  };

  const loadRecentFiles = async () => {
    try {
      const response = await fetch('/api/ai/version-control/recent-files');
      if (response.ok) {
        const data = await response.json();
        setRecentFiles(data.files || []);
      }
    } catch (error) {
      console.error('Recent files loading error:', error);
    }
  };

  const loadFileHistory = async (filePath: string) => {
    try {
      // Try GitHub integration first
      const response = await fetch(`/api/ai/version-control/history/${encodeURIComponent(filePath)}?github=true`);
      if (response.ok) {
        const data = await response.json();
        setFileVersions(data.versions || []);
        setSelectedFile(filePath);
        
        if (data.enhanced) {
          showMessage('success', `GitHub-იდან ჩაიტვირთა ${data.versions.length} ვერსია`);
        }
      } else {
        showMessage('error', 'ფაილის ისტორიის ჩატვირთვის შეცდომა');
      }
    } catch (error) {
      showMessage('error', 'ფაილის ისტორიის ჩატვირთვის შეცდომა');
    }
  };

  const loadDiff = async (fromVersion: string, toVersion: string, filePath: string) => {
    setSelectedFromVersion(fromVersion);
    setSelectedToVersion(toVersion);
    try {
      // Use GitHub API for enhanced diff
      const response = await fetch('/api/ai/version-control/github-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          fromVersion,
          toVersion
        })
      });

      if (response.ok) {
        const data = await response.json();
        setDiffData(data.diff || []);
        setShowDiffViewer(true);

        // Store additional metadata
        if (data.metadata) {
          console.log('📊 GitHub Diff metadata:', data.metadata);
          showMessage('success', `Diff გენერირებული: +${data.metadata.stats.additions} -${data.metadata.stats.deletions}`);
        }
      } else {
        showMessage('error', 'GitHub Diff-ის გენერაციის შეცდომა');
      }
    } catch (error) {
      showMessage('error', 'GitHub Diff-ის გენერაციის შეცდომა');
    }
  };

  const rollbackToVersion = async (filePath: string, version: string) => {
    setRollbackLoading(version);
    try {
      // Use GitHub API for file restoration
      const response = await fetch('/api/ai/version-control/github-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          commitSha: version
        })
      });

      if (response.ok) {
        const data = await response.json();
        showMessage('success', `ფაილი აღდგენილი GitHub-იდან: ${data.message}`);
        loadFileHistory(filePath); // Reload history
        refetch(); // Refresh the parent component
      } else {
        const errorData = await response.json();
        showMessage('error', errorData.error || 'GitHub Rollback შეცდომა');
      }
    } catch (error) {
      showMessage('error', 'GitHub Rollback შეცდომა');
    } finally {
      setRollbackLoading(null);
    }
  };

  const createFeatureBranch = async () => {
    if (!newBranchName.trim()) {
      showMessage('error', 'Branch name აუცილებელია');
      return;
    }

    try {
      const response = await fetch('/api/ai/github/branches/feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureName: newBranchName })
      });

      if (response.ok) {
        showMessage('success', 'Feature branch შექმნილი წარმატებით');
        setNewBranchName('');
        setShowCreateBranch(false);
        loadVersionData();
      } else {
        showMessage('error', 'Branch შექმნის შეცდომა');
      }
    } catch (error) {
      showMessage('error', 'Branch შექმნის შეცდომა');
    }
  };

  const switchBranch = async (branchName: string) => {
    try {
      const response = await fetch('/api/ai/github/branches/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetBranch: branchName })
      });

      if (response.ok) {
        showMessage('success', `${branchName}-ზე გადართულია`);
        loadVersionData();
        refetch();
      } else {
        showMessage('error', 'Branch switching შეცდომა');
      }
    } catch (error) {
      showMessage('error', 'Branch switching შეცდომა');
    }
  };

  const getBranchTypeIcon = (type: string) => {
    switch (type) {
      case 'production': return '🚀';
      case 'staging': return '🔧';
      case 'feature': return '✨';
      case 'hotfix': return '🔥';
      default: return '🌿';
    }
  };

  const getBranchTypeColor = (type: string) => {
    switch (type) {
      case 'production': return 'text-green-400';
      case 'staging': return 'text-yellow-400';
      case 'feature': return 'text-blue-400';
      case 'hotfix': return 'text-red-400';
      default: return 'text-gray-400';
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <History size={20} />
          Enhanced Version Control & File History
        </h3>
        <button
          onClick={loadVersionData}
          disabled={versionLoading}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw size={16} className={versionLoading ? 'animate-spin' : ''} />
          განახლება
        </button>
      </div>

      {/* File History Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText size={18} />
          File History & Visual Diff
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

            {fileVersions.map((version, index) => {
              const authorAvatar = typeof version.author === 'string' ? undefined : version.author?.avatar;
              const authorName = typeof version.author === 'string' ? version.author : version.author?.name || 'Unknown';
              const additions = version.changes.additions ?? version.changes.added ?? 0;
              const deletions = version.changes.deletions ?? version.changes.deleted ?? 0;

              return (
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
                      {version.shortHash || version.hash.substring(0, 8)}
                    </span>
                    <div className="flex items-center gap-2">
                      {authorAvatar && (
                        <img
                          src={authorAvatar}
                          alt={authorName}
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      <span className="text-sm text-gray-400">
                        {authorName}
                      </span>
                    </div>
                    {version.verified && (
                      <span className="text-xs bg-green-600 text-white px-1 py-0.5 rounded">
                        ✓ Verified
                      </span>
                    )}
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
                  {additions > 0 && (
                    <span className="text-green-400">+{additions}</span>
                  )}
                  {deletions > 0 && (
                    <span className="text-red-400">-{deletions}</span>
                  )}
                  {version.url && (
                    <a
                      href={version.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      GitHub
                    </a>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        )}
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
          {branches.map((branch) => (
            <div
              key={branch.name}
              className={`flex items-center justify-between p-3 rounded-lg ${
                branch.isCurrent ? 'bg-blue-900/30 border border-blue-600' : 'bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{getBranchTypeIcon(branch.type)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${branch.isCurrent ? 'text-blue-400' : 'text-white'}`}>
                      {branch.name}
                    </span>
                    {branch.isCurrent && (
                      <span className="px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${getBranchTypeColor(branch.type)}`}>
                    {branch.type}
                    {(branch.ahead || branch.behind) && (
                      <span className="ml-2 text-gray-400">
                        {branch.ahead ? `↑${branch.ahead}` : ''} 
                        {branch.behind ? `↓${branch.behind}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!branch.isCurrent && (
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

      {/* Recent Commits */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <GitCommit size={18} />
          ბოლო Commits
        </h4>

        {versionLoading ? (
          <div className="text-center py-8 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            Commits იტვირთება...
          </div>
        ) : commits.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <GitCommit size={48} className="mx-auto mb-4 text-gray-600" />
            <p>Commits არ არის</p>
          </div>
        ) : (
          <div className="space-y-3">
            {commits.map((commit, index) => (
              <div key={commit.hash || index} className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-mono">
                      <Hash size={12} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-white font-medium pr-4">{commit.message}</p>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {commit.hash ? commit.hash.substring(0, 7) : `#${index + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {commit.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {commit.date}
                        </span>
                        {commit.branch && (
                          <span className="flex items-center gap-1">
                            <GitBranch size={12} />
                            {commit.branch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedCommit(
                      expandedCommit === commit.hash ? null : commit.hash
                    )}
                    className="ml-2 p-1 text-gray-400 hover:text-white"
                  >
                    {expandedCommit === commit.hash ? 
                      <ChevronUp size={16} /> : <ChevronDown size={16} />
                    }
                  </button>
                </div>

                {expandedCommit === commit.hash && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="text-sm text-gray-300">
                      მეტი ინფორმაცია ამ commit-ზე იქნება ხელმისაწვდომი მალე...
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Version Info */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Tag size={18} />
          Version Information
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Current Branch</div>
            <div className="text-lg font-semibold text-white">
              {status?.branch || 'main'}
            </div>
          </div>

          <div className="p-4 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Total Commits</div>
            <div className="text-lg font-semibold text-white">
              {commits.length}
            </div>
          </div>

          <div className="p-4 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Active Branches</div>
            <div className="text-lg font-semibold text-white">
              {branches.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubVersionTab;
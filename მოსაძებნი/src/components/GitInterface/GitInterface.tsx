
import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Plus,
  Minus,
  Check,
  X,
  RefreshCw,
  Upload,
  Download,
  Archive,
  Eye,
  Edit,
  AlertTriangle,
  Clock,
  User,
  FileText,
  Zap
} from 'lucide-react';

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
  hash: string;
  current: boolean;
  type: 'local' | 'remote';
}

interface ConflictFile {
  file: string;
  conflicts: Array<{
    start: number;
    end: number;
    ours: string[];
    theirs: string[];
    base: string;
    their: string;
  }>;
}

const GitInterface: React.FC = () => {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<{ local: Branch[]; remote: Branch[]; current: string }>({
    local: [],
    remote: [],
    current: 'main'
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'log' | 'branches' | 'conflicts'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ConflictFile[]>([]);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ConflictFile | null>(null);

  useEffect(() => {
    loadGitStatus();
    loadCommitHistory();
    loadBranches();
    checkConflicts();
  }, []);

  const loadGitStatus = async () => {
    try {
      const response = await fetch('/api/ai/git/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatus(data);
        }
      }
    } catch (error) {
      console.error('Failed to load git status:', error);
    }
  };

  const loadCommitHistory = async () => {
    try {
      const response = await fetch('/api/ai/git/log?limit=20');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCommits(data.commits.map((c: any) => ({
            ...c,
            date: new Date(c.date)
          })));
        }
      }
    } catch (error) {
      console.error('Failed to load commit history:', error);
    }
  };

  const loadBranches = async () => {
    try {
      const response = await fetch('/api/ai/git/branches');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBranches(data);
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

  const checkConflicts = async () => {
    try {
      const response = await fetch('/api/ai/git/conflicts');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.conflicts.length > 0) {
          setConflicts(data.conflicts);
        }
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
    }
  };

  const stageFiles = async (files: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      });
      
      if (response.ok) {
        await loadGitStatus();
      }
    } catch (error) {
      console.error('Failed to stage files:', error);
    } finally {
      setLoading(false);
    }
  };

  const unstageFiles = async (files: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/unstage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      });
      
      if (response.ok) {
        await loadGitStatus();
      }
    } catch (error) {
      console.error('Failed to unstage files:', error);
    } finally {
      setLoading(false);
    }
  };

  const commitChanges = async () => {
    if (!commitMessage.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage })
      });
      
      if (response.ok) {
        setCommitMessage('');
        await loadGitStatus();
        await loadCommitHistory();
      }
    } catch (error) {
      console.error('Failed to commit changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const pushChanges = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: 'origin', branch: status?.branch })
      });
      
      if (response.ok) {
        await loadGitStatus();
      }
    } catch (error) {
      console.error('Failed to push changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const pullChanges = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: 'origin', branch: status?.branch })
      });
      
      if (response.ok) {
        await loadGitStatus();
        await loadCommitHistory();
      }
    } catch (error) {
      console.error('Failed to pull changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBranch = async (name: string, baseBranch?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, baseBranch })
      });
      
      if (response.ok) {
        await loadBranches();
        await loadGitStatus();
      }
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchBranch = async (branchName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/git/branches/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: branchName })
      });
      
      if (response.ok) {
        await loadBranches();
        await loadGitStatus();
        await loadCommitHistory();
      }
    } catch (error) {
      console.error('Failed to switch branch:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (filePath: string, resolution: any) => {
    try {
      const response = await fetch('/api/ai/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, resolution })
      });
      
      if (response.ok) {
        await checkConflicts();
        await loadGitStatus();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
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

  const renderStatusTab = () => (
    <div className="space-y-6">
      {/* Repository Status */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch size={20} />
            Repository Status
          </h3>
          <button
            onClick={loadGitStatus}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-400">Current Branch</div>
            <div className="text-lg font-medium">{status?.branch || 'main'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Status</div>
            <div className={`text-lg font-medium ${status?.clean ? 'text-green-400' : 'text-orange-400'}`}>
              {status?.clean ? 'Clean' : `${status?.files.length || 0} changes`}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={pullChanges}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Download size={16} />
            Pull
          </button>
          <button
            onClick={pushChanges}
            disabled={loading || status?.clean}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Upload size={16} />
            Push
          </button>
        </div>
      </div>

      {/* File Changes */}
      {status && status.files.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Changed Files</h3>
          
          <div className="space-y-2 mb-4">
            {status.files.map((file) => (
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
                      onClick={() => unstageFiles([file.path])}
                      className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                    >
                      Unstage
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => stageFiles([])}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Stage All
            </button>
            <button
              onClick={() => unstageFiles([])}
              className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
            >
              Unstage All
            </button>
          </div>

          {/* Commit Section */}
          <div className="border-t border-gray-600 pt-4">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter commit message..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-2"
              rows={3}
            />
            <button
              onClick={commitChanges}
              disabled={!commitMessage.trim() || loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <GitCommit size={16} />
              Commit Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderLogTab = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock size={20} />
        Commit History
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
              <span className="text-xs text-gray-400">
                {commit.date.toLocaleDateString()}
              </span>
            </div>
            
            <div className="text-white font-medium mb-1">{commit.message}</div>
            
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <User size={12} />
              <span>{commit.author}</span>
              <span>•</span>
              <span>{commit.date.toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBranchesTab = () => (
    <div className="space-y-6">
      {/* Current Branch */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Current Branch</h3>
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="text-green-400" size={20} />
          <span className="text-xl font-medium">{branches.current}</span>
        </div>
      </div>

      {/* Local Branches */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Local Branches</h3>
        <div className="space-y-2">
          {branches.local.map((branch) => (
            <div
              key={branch.name}
              className={`flex items-center justify-between p-2 rounded ${
                branch.current ? 'bg-green-900 border border-green-600' : 'bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <GitBranch size={16} className={branch.current ? 'text-green-400' : 'text-gray-400'} />
                <span className={branch.current ? 'font-semibold' : ''}>{branch.name}</span>
                <span className="font-mono text-xs text-gray-400">{branch.hash}</span>
                {branch.current && (
                  <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded">
                    CURRENT
                  </span>
                )}
              </div>
              
              {!branch.current && (
                <button
                  onClick={() => switchBranch(branch.name)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Switch
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Remote Branches */}
      {branches.remote.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Remote Branches</h3>
          <div className="space-y-2">
            {branches.remote.map((branch) => (
              <div key={branch.name} className="flex items-center gap-3 p-2 bg-gray-700 rounded">
                <GitBranch size={16} className="text-orange-400" />
                <span>origin/{branch.name}</span>
                <span className="font-mono text-xs text-gray-400">{branch.hash}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderConflictsTab = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle size={20} className="text-orange-500" />
        Merge Conflicts
      </h3>
      
      {conflicts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Check size={48} className="mx-auto mb-4 text-green-500" />
          <p>No merge conflicts detected</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <div key={conflict.file} className="border border-orange-500 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-orange-300">{conflict.file}</h4>
                <span className="text-xs bg-orange-900 text-orange-300 px-2 py-1 rounded">
                  {conflict.conflicts.length} conflicts
                </span>
              </div>
              
              <div className="space-y-2">
                {conflict.conflicts.map((conf, index) => (
                  <div key={index} className="bg-gray-900 rounded p-3">
                    <div className="text-sm text-gray-400 mb-2">
                      Conflict {index + 1} (lines {conf.start}-{conf.end})
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-green-400 mb-1">Our changes:</div>
                        <pre className="text-xs bg-green-900/20 p-2 rounded border-l-2 border-green-500">
                          {conf.ours.join('\n')}
                        </pre>
                      </div>
                      
                      <div>
                        <div className="text-xs text-blue-400 mb-1">Their changes:</div>
                        <pre className="text-xs bg-blue-900/20 p-2 rounded border-l-2 border-blue-500">
                          {conf.theirs.join('\n')}
                        </pre>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => resolveConflict(conflict.file, { type: 'ours' })}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Accept Ours
                      </button>
                      <button
                        onClick={() => resolveConflict(conflict.file, { type: 'theirs' })}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        Accept Theirs
                      </button>
                      <button
                        onClick={() => {
                          setActiveConflict(conflict);
                          setShowConflictResolver(true);
                        }}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                      >
                        Manual Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Zap size={24} className="text-yellow-500" />
            Git Interface
          </h1>
          
          <div className="flex items-center gap-2">
            {status && (
              <div className={`px-3 py-1 rounded text-sm ${
                status.clean ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'
              }`}>
                {status.clean ? 'Repository Clean' : `${status.files.length} Changes`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex">
          {[
            { key: 'status', label: 'Status', icon: FileText },
            { key: 'log', label: 'History', icon: Clock },
            { key: 'branches', label: 'Branches', icon: GitBranch },
            { key: 'conflicts', label: 'Conflicts', icon: AlertTriangle }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                  : 'border-transparent hover:bg-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              <span className="text-sm font-medium">{tab.label}</span>
              {tab.key === 'conflicts' && conflicts.length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                  {conflicts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'log' && renderLogTab()}
        {activeTab === 'branches' && renderBranchesTab()}
        {activeTab === 'conflicts' && renderConflictsTab()}
      </div>
    </div>
  );
};

export default GitInterface;

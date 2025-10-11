// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Bug,
  Plus,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  MessageSquare,
  ExternalLink,
  GitMerge
} from 'lucide-react';
import AutoIssueStatus from './AutoIssueStatus';

interface GitHubIssuesTabProps {
  status: any;
  loading: boolean;
  showMessage: (type: 'success' | 'error', text: string) => void;
  refetch: () => void;
}

interface Issue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  created_at: string;
  updated_at: string;
  html_url: string;
}

const GitHubIssuesTab: React.FC<GitHubIssuesTabProps> = ({
  status,
  loading,
  showMessage,
  refetch
}) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [newIssue, setNewIssue] = useState({
    type: 'bug',
    title: '',
    description: '',
    priority: 'medium'
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

  // PR Merge Modal states
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    loadIssues();
  }, [filter]);

  // Mock mergePullRequest function for demonstration
  const mergePullRequest = async (prNumber: number, options?: any) => {
    console.log('Mock mergePullRequest called:', prNumber, options);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Simulate success or failure
    return { success: true, prNumber: prNumber };
  };

  const loadIssues = async () => {
    setIssuesLoading(true);
    try {
      const response = await fetch(`/api/ai/github/issues/stats?per_page=100&page=1`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Issues stats loaded:', data);

        // Mock issues data for demo with pagination info
        setIssues([
          {
            number: 1,
            title: 'Auto-sync არ მუშაობს properly',
            body: 'Auto-sync functionality sometimes fails to commit changes',
            state: 'open',
            labels: ['bug', 'auto-detected', 'severity:medium'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: '#'
          },
          {
            number: 2,
            title: 'Add branch protection rules',
            body: 'Need to implement branch protection for main branch',
            state: 'open',
            labels: ['enhancement', 'feature-request'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: '#'
          }
        ].filter(issue => filter === 'all' || issue.state === filter));
      }
    } catch (error) {
      console.error('Issues loading error:', error);
      showMessage('error', 'Issues-ის ჩატვირთვის შეცდომა');
    } finally {
      setIssuesLoading(false);
    }
  };

  const createIssue = async () => {
    if (!newIssue.title.trim() || !newIssue.description.trim()) {
      showMessage('error', 'Title და Description აუცილებელია');
      return;
    }

    try {
      // Use new user feedback endpoint for automatic GitHub issue creation
      const endpoint = '/api/ai/feedback/submit';

      const payload = {
        type: newIssue.type,
        title: newIssue.title,
        description: newIssue.description,
        priority: newIssue.priority,
        component: 'github-issues-tab'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        showMessage('success', `Issue შექმნილი წარმატებით! GitHub Issue #${result.issueNumber}`);
        setNewIssue({ type: 'bug', title: '', description: '', priority: 'medium' });
        setShowCreateForm(false);
        loadIssues();
      } else {
        showMessage('error', result.error || 'Issue-ის შექმნის შეცდომა');
      }
    } catch (error) {
      showMessage('error', 'Issue-ის შექმნის შეცდომა');
    }
  };

  const getStatusIcon = (state: string) => {
    return state === 'open' ? (
      <AlertTriangle size={16} className="text-orange-500" />
    ) : (
      <CheckCircle size={16} className="text-green-500" />
    );
  };

  const getLabelColor = (label: string) => {
    if (label.includes('bug')) return 'bg-red-900 text-red-300';
    if (label.includes('enhancement')) return 'bg-blue-900 text-blue-300';
    if (label.includes('feature')) return 'bg-green-900 text-green-300';
    if (label.includes('auto-detected')) return 'bg-purple-900 text-purple-300';
    if (label.includes('severity:high')) return 'bg-red-800 text-red-200';
    if (label.includes('severity:medium')) return 'bg-yellow-800 text-yellow-200';
    if (label.includes('severity:low')) return 'bg-gray-800 text-gray-200';
    return 'bg-gray-800 text-gray-300';
  };

  const handleMergePR = async () => {
    if (!selectedPR) return;

    setMergeLoading(true);
    try {
      const mergeOptions = {
        merge_method: mergeMethod,
        ...(commitTitle.trim() && { commit_title: commitTitle.trim() }),
        ...(commitMessage.trim() && { commit_message: commitMessage.trim() })
      };

      console.log(`🔀 Merging PR #${selectedPR.number} with options:`, mergeOptions);

      const result = await mergePullRequest(selectedPR.number, mergeOptions);
      if (result.success) {
        showMessage('success', `Pull Request #${selectedPR.number} merged successfully using ${mergeMethod}`);
        setShowMergeModal(false);
        setSelectedPR(null);
        // Reset form
        setCommitTitle('');
        setCommitMessage('');
        setMergeMethod('merge');
        refetch();
      } else {
        showMessage('error', result.error || 'Failed to merge PR');
      }
    } catch (error) {
      console.error('Merge operation failed:', error);
      showMessage('error', 'Merge operation failed');
    } finally {
      setMergeLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Bug size={20} />
          Issues & Bug Tracking
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} />
          ახალი Issue
        </button>
      </div>

      {/* Auto-Issue Detection Status */}
      <AutoIssueStatus showMessage={showMessage} />

      {/* Create Issue Form */}
      {showCreateForm && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">ახალი Issue შექმნა</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Type</label>
              <select
                value={newIssue.type}
                onChange={(e) => setNewIssue({...newIssue, type: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="bug">🐛 Bug Report</option>
                <option value="feature">✨ Feature Request</option>
                <option value="feedback">💬 Feedback</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Title</label>
              <input
                type="text"
                value={newIssue.title}
                onChange={(e) => setNewIssue({...newIssue, title: e.target.value})}
                placeholder="Issue-ის მოკლე აღწერა"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Description</label>
              <textarea
                value={newIssue.description}
                onChange={(e) => setNewIssue({...newIssue, description: e.target.value})}
                placeholder="დეტალური აღწერა..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Priority</label>
              <select
                value={newIssue.priority}
                onChange={(e) => setNewIssue({...newIssue, priority: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createIssue}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                შექმნა
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                გაუქმება
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Filter size={16} className="text-gray-400" />
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3 py-1 rounded-lg text-sm ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterOption === 'all' ? 'ყველა' :
               filterOption === 'open' ? 'ღია' : 'დახურული'}
            </button>
          ))}
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {issuesLoading ? (
          <div className="text-center py-8 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            Issues იტვირთება...
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bug size={48} className="mx-auto mb-4 text-gray-600" />
            <p>Issues არ არის</p>
          </div>
        ) : (
          issues.map((issue) => (
            <div key={issue.number} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {getStatusIcon(issue.state)}
                  <div>
                    <h4 className="text-white font-medium">{issue.title}</h4>
                    <p className="text-sm text-gray-400 mt-1">#{issue.number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Button to trigger the merge modal */}
                  <button
                    onClick={() => {
                      setSelectedPR(issue); // Assuming 'issue' object has PR details like number, title, user, commits
                      setShowMergeModal(true);
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Merge
                  </button>
                  <a
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-white"
                    title="GitHub-ზე გახსნა"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-3">{issue.body}</p>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {issue.labels.map((label, index) => (
                    <span
                      key={index}
                      className={`px-2 py-1 rounded text-xs ${getLabelColor(label)}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(issue.updated_at).toLocaleDateString('ka-GE')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Merge PR Modal */}
      {showMergeModal && selectedPR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Merge Pull Request #{selectedPR.number}</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">{selectedPR.title}</p>
              <p className="text-xs text-gray-400">
                By {selectedPR.user?.login} • {selectedPR.commits} commits
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {/* Merge Method */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Merge Method:
                </label>
                <select
                  value={mergeMethod}
                  onChange={(e) => setMergeMethod(e.target.value as 'merge' | 'squash' | 'rebase')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="merge">Create a merge commit</option>
                  <option value="squash">Squash and merge</option>
                  <option value="rebase">Rebase and merge</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {mergeMethod === 'squash' && 'Combines all commits into one commit'}
                  {mergeMethod === 'rebase' && 'Replays commits without creating merge commit'}
                  {mergeMethod === 'merge' && 'Preserves branch history with merge commit'}
                </p>
              </div>

              {/* Commit Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Commit Title (Optional):
                </label>
                <input
                  type="text"
                  value={commitTitle}
                  onChange={(e) => setCommitTitle(e.target.value)}
                  placeholder={`${selectedPR.title} (#${selectedPR.number})`}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
                />
              </div>

              {/* Commit Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Commit Message (Optional):
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Additional commit details..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleMergePR}
                disabled={mergeLoading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <GitMerge size={16} />
                {mergeLoading ? 'Merging...' : `${mergeMethod.charAt(0).toUpperCase() + mergeMethod.slice(1)} Merge`}
              </button>
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubIssuesTab;
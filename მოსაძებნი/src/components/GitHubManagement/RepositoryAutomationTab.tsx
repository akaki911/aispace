
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Webhook,
  Shield,
  Tag,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Bot,
  Zap,
  GitBranch,
  FileText,
  ExternalLink
} from 'lucide-react';

interface AutomationResult {
  success: boolean;
  results?: any;
  summary?: {
    successCount: number;
    totalTasks: number;
    errorCount: number;
  };
  error?: string;
}

interface AutomationStatus {
  configuration: {
    valid: boolean;
    issues: string[];
  };
  capabilities: {
    [key: string]: boolean;
  };
}

const RepositoryAutomationTab: React.FC = () => {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningTasks, setRunningTasks] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<AutomationResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [automationConfig, setAutomationConfig] = useState({
    collaborators: true,
    webhooks: true,
    metadata: true,
    branchProtection: true,
    releaseNotes: false,
    autoTrigger: true
  });

  useEffect(() => {
    loadAutomationStatus();
  }, []);

  const loadAutomationStatus = async () => {
    try {
      const response = await fetch('/api/ai/repository-automation/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to load automation status:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const runFullAutomation = async () => {
    setLoading(true);
    setRunningTasks(['collaborators', 'webhooks', 'metadata', 'branchProtection']);
    
    try {
      const response = await fetch('/api/ai/repository-automation/run-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automationConfig)
      });

      if (response.ok) {
        const result = await response.json();
        setLastResult(result);
        
        if (result.success) {
          showMessage('success', `ავტომატიზაცია დასრულდა: ${result.summary.successCount}/${result.summary.totalTasks} დავალება`);
        } else {
          showMessage('error', `ავტომატიზაცია დასრულდა შეცდომებით: ${result.summary.errorCount} შეცდომა`);
        }
      } else {
        throw new Error('Automation request failed');
      }
    } catch (error) {
      console.error('Automation failed:', error);
      showMessage('error', 'ავტომატიზაციის შეცდომა');
    } finally {
      setLoading(false);
      setRunningTasks([]);
    }
  };

  const runSpecificTask = async (taskType: string, endpoint: string) => {
    setLoading(true);
    setRunningTasks([taskType]);

    try {
      const response = await fetch(`/api/ai/repository-automation/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          showMessage('success', `${taskType} წარმატებით დასრულდა`);
        } else {
          showMessage('error', `${taskType} შეცდომით დასრულდა`);
        }
      } else {
        throw new Error(`${taskType} request failed`);
      }
    } catch (error) {
      console.error(`${taskType} failed:`, error);
      showMessage('error', `${taskType} შეცდომა`);
    } finally {
      setLoading(false);
      setRunningTasks([]);
    }
  };

  const generateReleaseNotes = async () => {
    setLoading(true);
    setRunningTasks(['releaseNotes']);

    try {
      const response = await fetch('/api/ai/repository-automation/release/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentInfo: {
            environment: 'production',
            buildStatus: 'success',
            healthCheck: 'passed'
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          showMessage('success', `Release v${result.version} შეიქმნა წარმატებით`);
        } else {
          showMessage('error', 'Release notes-ის შექმნის შეცდომა');
        }
      }
    } catch (error) {
      showMessage('error', 'Release notes-ის შექმნის შეცდომა');
    } finally {
      setLoading(false);
      setRunningTasks([]);
    }
  };

  const isTaskRunning = (taskName: string) => runningTasks.includes(taskName);

  const automationTasks = [
    {
      id: 'collaborators',
      name: 'Collaborators Management',
      description: 'ავტომატური collaborators-ების permission management',
      icon: Users,
      endpoint: 'collaborators/auto-manage',
      color: 'text-blue-400',
      capabilityKey: 'collaboratorManagement'
    },
    {
      id: 'webhooks',
      name: 'Webhooks Configuration',
      description: 'webhooks auto-configuration real-time sync-ისთვის',
      icon: Webhook,
      endpoint: 'webhooks/auto-configure',
      color: 'text-green-400',
      capabilityKey: 'webhookConfiguration'
    },
    {
      id: 'metadata',
      name: 'Repository Metadata',
      description: 'repository topics და description auto-update',
      icon: Tag,
      endpoint: 'metadata/auto-update',
      color: 'text-purple-400',
      capabilityKey: 'metadataManagement'
    },
    {
      id: 'branchProtection',
      name: 'Branch Protection',
      description: 'branch protection rules ავტომატური სეტაპი',
      icon: Shield,
      endpoint: 'branches/auto-protect',
      color: 'text-orange-400',
      capabilityKey: 'branchProtection'
    }
  ];

  const capabilityReady = (key?: string) => (key ? Boolean(status?.capabilities?.[key]) : false);
  const canRunFullAutomation = status?.configuration?.valid && automationTasks.every((task) => capabilityReady(task.capabilityKey));
  const releaseNotesReady = Boolean(status?.capabilities?.releaseNotesGeneration);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={28} className="text-blue-500" />
          <div>
            <h3 className="text-xl font-semibold">Repository Automation</h3>
            <p className="text-sm text-gray-400">სრული ავტომატიზაცია GitHub repository-ისთვის</p>
          </div>
        </div>
        
        <button
          onClick={loadAutomationStatus}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Configuration Status */}
      {status && status.configuration && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} />
            კონფიგურაციის სტატუსი
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${
              status.configuration?.valid ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {status.configuration?.valid ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <AlertCircle size={16} className="text-red-400" />
                )}
                <span className="font-medium">
                  {status.configuration?.valid ? 'კონფიგურაცია OK' : 'კონფიგურაციის საჭირო'}
                </span>
              </div>
              
              {!status.configuration?.valid && status.configuration?.issues?.length > 0 && (
                <div className="text-sm space-y-1">
                  {status.configuration.issues.map((issue, index) => (
                    <div key={index} className="text-red-300">• {issue}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">შესაძლებლობები</div>
              <div className="space-y-1">
                {Object.entries(status.capabilities || {}).map(([capability, enabled]) => (
                  <div key={capability} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={12} className={enabled ? 'text-green-400' : 'text-gray-500'} />
                    <span className={enabled ? 'text-white' : 'text-gray-400'}>
                      {capability.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Automation Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap size={20} />
          ავტომატიზაციის კონტროლი
        </h4>

        {/* Quick Actions */}
        <div className="flex flex-col gap-3 mb-6 md:flex-row">
          {canRunFullAutomation ? (
            <button
              onClick={runFullAutomation}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              <Play size={18} />
              {loading ? 'მუშაობს...' : 'სრული ავტომატიზაცია'}
            </button>
          ) : (
            <div className="px-6 py-3 bg-blue-900/20 border border-blue-600/40 rounded-lg text-sm text-blue-200 flex items-center gap-2">
              <AlertCircle size={16} />
              ავტომატიზაციის გაშვება ხელმისაწვდომი გახდება, როცა GitHub-ის კონფიგურაცია დასრულდება.
            </div>
          )}

          {releaseNotesReady ? (
            <button
              onClick={generateReleaseNotes}
              disabled={loading}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FileText size={18} />
              Release Notes
            </button>
          ) : (
            <div className="px-4 py-3 bg-green-900/20 border border-green-600/40 rounded-lg text-sm text-green-200 flex items-center gap-2">
              <Clock size={16} />
              Release notes გენერატორი მალე დაემატება.
            </div>
          )}
        </div>

        {/* Individual Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {automationTasks.map(task => {
            const ready = capabilityReady(task.capabilityKey);
            return (
            <div key={task.id} className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <task.icon size={20} className={task.color} />
                  <div>
                    <div className="font-medium text-white">{task.name}</div>
                    <div className="text-sm text-gray-400">{task.description}</div>
                  </div>
                </div>

                {isTaskRunning(task.id) && (
                  <RefreshCw size={16} className="text-blue-400 animate-spin" />
                )}
              </div>

              {ready ? (
                <button
                  onClick={() => runSpecificTask(task.id, task.endpoint)}
                  disabled={loading || !status?.configuration?.valid}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50 text-sm"
                >
                  {isTaskRunning(task.id) ? 'მუშაობს...' : 'გაშვება'}
                </button>
              ) : (
                <div className="w-full px-3 py-2 bg-gray-800/60 text-gray-300 rounded text-sm flex items-center gap-2">
                  <Clock size={14} className="text-yellow-300" />
                  ფუნქცია მალე დაემატება.
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>

      {/* Last Automation Results */}
      {lastResult && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} />
            ბოლო ავტომატიზაციის შედეგები
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-900/20 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">
                {lastResult.summary?.successCount || 0}
              </div>
              <div className="text-sm text-gray-400">წარმატებული</div>
            </div>

            <div className="bg-blue-900/20 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400">
                {lastResult.summary?.totalTasks || 0}
              </div>
              <div className="text-sm text-gray-400">სულ დავალება</div>
            </div>

            <div className="bg-red-900/20 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-400">
                {lastResult.summary?.errorCount || 0}
              </div>
              <div className="text-sm text-gray-400">შეცდომები</div>
            </div>
          </div>

          <div className={`p-3 rounded text-sm ${
            lastResult.success ? 'bg-green-900/20 text-green-300' : 'bg-orange-900/20 text-orange-300'
          }`}>
            {lastResult.success ? 
              '✅ ყველა ავტომატიზაცია წარმატებით დასრულდა' : 
              '⚠️ ავტომატიზაცია დასრულდა, მაგრამ რამდენიმე შეცდომით'
            }
          </div>
        </div>
      )}

      {/* Configuration Help */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">კონფიგურაციის მითითებები</h4>
        
        <div className="space-y-3 text-sm text-gray-300">
          <div>
            <strong>GITHUB_TOKEN:</strong> GitHub Personal Access Token (repo permissions)
          </div>
          <div>
            <strong>GITHUB_WEBHOOK_SECRET:</strong> Webhook secret for secure communication
          </div>
          <div>
            <strong>GITHUB_REPO_OWNER:</strong> Repository owner (default: bakhmaro)
          </div>
          <div>
            <strong>GITHUB_REPO_NAME:</strong> Repository name (default: gurula-ai)
          </div>
          <div>
            <strong>REPLIT_URL:</strong> Your Replit app URL for webhook configuration
          </div>
        </div>

        <div className="mt-4">
          <a
            href="/admin/javshnissia"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            <ExternalLink size={16} />
            Replit Secrets მართვა
          </a>
        </div>
      </div>
    </div>
  );
};

export default RepositoryAutomationTab;

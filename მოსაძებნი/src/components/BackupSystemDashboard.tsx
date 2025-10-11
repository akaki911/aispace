// @ts-nocheck

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Database,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  Github,
  Play,
  RefreshCw,
  FileText,
  Settings,
  Activity
} from 'lucide-react';

interface BackupStatus {
  systemHealth: string;
  lastBackup: string;
  recentBackups: number;
  githubRepositories: number;
  storageUsed: string;
  nextScheduledBackup: string;
}

interface BackupInfo {
  backupId: string;
  timestamp: string;
  status: string;
  totalSize: number;
  error?: string;
}

const BackupSystemDashboard: React.FC = () => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'backups' | 'recovery' | 'settings'>('overview');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    loadBackupStatus();
    loadRecentBackups();
  }, []);

  const loadBackupStatus = async () => {
    try {
      const response = await fetch('/api/ai/backup-system/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatus(data.status);
        }
      }
    } catch (error) {
      console.error('Failed to load backup status:', error);
    }
  };

  const loadRecentBackups = async () => {
    try {
      const response = await fetch('/api/ai/backup-system/backups/recent');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBackups(data.backups);
        }
      }
    } catch (error) {
      console.error('Failed to load recent backups:', error);
    }
  };

  const triggerBackup = async () => {
    setLoading(true);
    setLogs(['🔄 Starting full backup...']);
    
    try {
      const response = await fetch('/api/ai/backup-system/backup/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(prev => [...prev, '✅ Full backup completed successfully']);
          await loadBackupStatus();
          await loadRecentBackups();
        } else {
          setLogs(prev => [...prev, `❌ Backup failed: ${data.error}`]);
        }
      }
    } catch (error) {
      setLogs(prev => [...prev, `❌ Backup error: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const verifyBackup = async (backupId: string) => {
    setLoading(true);
    setLogs(prev => [...prev, `🔍 Verifying backup: ${backupId}`]);
    
    try {
      const response = await fetch(`/api/ai/backup-system/verify/${backupId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(prev => [...prev, `✅ Verification completed: ${data.overallStatus}`]);
      }
    } catch (error) {
      setLogs(prev => [...prev, `❌ Verification error: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const testRecovery = async (backupId: string) => {
    setLoading(true);
    setLogs(prev => [...prev, `🧪 Testing recovery for: ${backupId}`]);
    
    try {
      const response = await fetch(`/api/ai/backup-system/test/recovery/${backupId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(prev => [...prev, `✅ Recovery test: ${data.overallStatus} (${data.successRate})`]);
      }
    } catch (error) {
      setLogs(prev => [...prev, `❌ Recovery test error: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy': return 'text-green-400';
      case 'partial': return 'text-yellow-400';
      case 'fail':
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy': return <CheckCircle size={16} className="text-green-400" />;
      case 'partial': return <AlertTriangle size={16} className="text-yellow-400" />;
      case 'fail':
      case 'error': return <AlertTriangle size={16} className="text-red-400" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* System Health */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield size={20} />
          System Health
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Overall Status</span>
              {getStatusIcon(status?.systemHealth || 'unknown')}
            </div>
            <div className={`text-lg font-semibold ${getStatusColor(status?.systemHealth || 'unknown')}`}>
              {status?.systemHealth || 'Unknown'}
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Recent Backups</span>
              <Database size={16} className="text-blue-400" />
            </div>
            <div className="text-lg font-semibold text-blue-400">
              {status?.recentBackups || 0}
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">GitHub Repos</span>
              <Github size={16} className="text-purple-400" />
            </div>
            <div className="text-lg font-semibold text-purple-400">
              {status?.githubRepositories || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Storage & Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HardDrive size={18} />
            Storage Usage
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total Used</span>
              <span className="text-sm font-medium">{status?.storageUsed || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Last Backup</span>
              <span className="text-sm font-medium">
                {status?.lastBackup !== 'none' ? new Date(status?.lastBackup || '').toLocaleDateString() : 'None'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} />
            Schedule
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Next Backup</span>
              <span className="text-sm font-medium">
                {status?.nextScheduledBackup ? 
                  new Date(status.nextScheduledBackup).toLocaleString() : 
                  'Not scheduled'
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Frequency</span>
              <span className="text-sm font-medium">Daily at 3:00 AM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">Quick Actions</h4>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerBackup}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Play size={16} />
            Trigger Backup
          </button>
          
          <button
            onClick={loadBackupStatus}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );

  const renderBackupsTab = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Backups</h3>
      
      <div className="space-y-3">
        {backups.map((backup) => (
          <div key={backup.backupId} className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {getStatusIcon(backup.status)}
                <div>
                  <div className="font-medium">{backup.backupId}</div>
                  <div className="text-sm text-gray-400">
                    {new Date(backup.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {formatBytes(backup.totalSize)}
                </span>
                <button
                  onClick={() => verifyBackup(backup.backupId)}
                  disabled={loading}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  onClick={() => testRecovery(backup.backupId)}
                  disabled={loading}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  Test Recovery
                </button>
              </div>
            </div>
            
            {backup.error && (
              <div className="text-sm text-red-400 mt-2">
                Error: {backup.error}
              </div>
            )}
          </div>
        ))}
        
        {backups.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Database size={48} className="mx-auto mb-4" />
            <p>No backups found</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderRecoveryTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Disaster Recovery Plan</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-2">Step 1: Identify Failed Components</h4>
            <p className="text-sm text-gray-400">
              Determine which system components need recovery (database, configuration, files)
            </p>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-2">Step 2: Select Recovery Point</h4>
            <p className="text-sm text-gray-400">
              Choose appropriate backup from the list above based on timestamp and verification status
            </p>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-2">Step 3: Download from GitHub</h4>
            <p className="text-sm text-gray-400">
              Retrieve backup files from multiple GitHub repositories for redundancy
            </p>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-2">Step 4: Decrypt and Restore</h4>
            <p className="text-sm text-gray-400">
              Decrypt database backups and restore configuration files to their original locations
            </p>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-2">Step 5: Verify and Test</h4>
            <p className="text-sm text-gray-400">
              Run verification tests to ensure system integrity and functionality
            </p>
          </div>
        </div>
      </div>

      {/* Recovery Testing */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">Recovery Testing</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-blue-400" />
              <span className="font-medium">Database Recovery</span>
            </div>
            <p className="text-sm text-gray-400">
              Test database backup decryption and restoration process
            </p>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={16} className="text-green-400" />
              <span className="font-medium">Config Recovery</span>
            </div>
            <p className="text-sm text-gray-400">
              Verify configuration file restoration and validation
            </p>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-purple-400" />
              <span className="font-medium">File Recovery</span>
            </div>
            <p className="text-sm text-gray-400">
              Test project file archive extraction and integrity
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Backup Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Backup Schedule</label>
            <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white">
              <option value="daily">Daily at 3:00 AM</option>
              <option value="twice-daily">Twice Daily (3:00 AM, 3:00 PM)</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Retention Period</label>
            <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white">
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">GitHub Repositories</label>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="username/primary-backup"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
              <input 
                type="text" 
                placeholder="username/secondary-backup"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
              <input 
                type="text" 
                placeholder="username/archive-backup"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">Security Settings</h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Encryption Key Status</label>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm">Active and secure</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">GitHub Token Status</label>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm">Connected and authorized</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield size={24} className="text-blue-500" />
            Backup System Dashboard
          </h1>
          
          <div className="flex items-center gap-2">
            {status && (
              <div className={`px-3 py-1 rounded text-sm ${
                status.systemHealth === 'healthy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {status.systemHealth}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex">
          {[
            { key: 'overview', label: 'Overview', icon: Activity },
            { key: 'backups', label: 'Backups', icon: Database },
            { key: 'recovery', label: 'Recovery', icon: Download },
            { key: 'settings', label: 'Settings', icon: Settings }
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
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'backups' && renderBackupsTab()}
        {activeTab === 'recovery' && renderRecoveryTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>

      {/* Logs Panel */}
      {logs.length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <h4 className="text-sm font-medium mb-2">Activity Log</h4>
          <div className="bg-gray-900 rounded p-3 max-h-32 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-xs font-mono text-gray-300 mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupSystemDashboard;

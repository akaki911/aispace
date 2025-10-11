// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Settings, Shield, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

interface AutoUpdateConfig {
  masterSwitch: 'off' | 'propose-only' | 'auto-apply-low-risk';
  scopes: {
    guruloCore: boolean;
    frontendUI: boolean;
    adminPanel: boolean;
    backend: boolean;
    aiService: boolean;
  };
  limits: {
    maxChangesPerDay: number;
    maxFilesPerCycle: number;
    timeWindow: {
      start: string; // HH:MM format
      end: string;
    };
  };
  guards: {
    highRiskProposalOnly: boolean;
    configSecretMigrationBlock: boolean;
  };
}

interface AutoUpdateProposal {
  id: string;
  scope: keyof AutoUpdateConfig['scopes'];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  filesAffected: string[];
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto-applied';
}

const AutoUpdateControl: React.FC = () => {
  const { userRole } = useAuth();
  const [config, setConfig] = useState<AutoUpdateConfig>({
    masterSwitch: 'off',
    scopes: {
      guruloCore: false,
      frontendUI: false,
      adminPanel: false,
      backend: false,
      aiService: false
    },
    limits: {
      maxChangesPerDay: 5,
      maxFilesPerCycle: 3,
      timeWindow: {
        start: '02:00',
        end: '06:00'
      }
    },
    guards: {
      highRiskProposalOnly: true,
      configSecretMigrationBlock: true
    }
  });

  const [proposals, setProposals] = useState<AutoUpdateProposal[]>([]);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState({
    todayChanges: 0,
    currentCycleFiles: 0,
    lastUpdate: null as string | null
  });

  // Only super admin can modify auto-update settings
  const canModify = userRole === 'SUPER_ADMIN';

  useEffect(() => {
    loadConfig();
    loadProposals();
    loadUsageStats();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/auto-update/config', {
        headers: {
          'x-admin-setup-token': 'DEV_ADMIN_SETUP_TOKEN_' + Date.now()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config || config);
      }
    } catch (error) {
      console.error('Error loading auto-update config:', error);
    }
  };

  const saveConfig = async (newConfig: AutoUpdateConfig) => {
    if (!canModify) {
      showAlert('მხოლოდ სუპერ ადმინს შეუძლია კონფიგურაციის ცვლილება', 'error');
      return;
    }

    try {
      const response = await fetch('/api/admin/auto-update/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-setup-token': 'DEV_ADMIN_SETUP_TOKEN_' + Date.now()
        },
        body: JSON.stringify({ config: newConfig })
      });

      if (response.ok) {
        setConfig(newConfig);
        showAlert('კონფიგურაცია შენახულია', 'success');
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showAlert('კონფიგურაციის შენახვის შეცდომა', 'error');
    }
  };

  const loadProposals = async () => {
    try {
      const response = await fetch('/api/admin/auto-update/proposals', {
        headers: {
          'x-admin-setup-token': 'DEV_ADMIN_SETUP_TOKEN_' + Date.now()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProposals(data.proposals || []);
      }
    } catch (error) {
      console.error('Error loading proposals:', error);
    }
  };

  const loadUsageStats = async () => {
    try {
      const response = await fetch('/api/admin/auto-update/stats', {
        headers: {
          'x-admin-setup-token': 'DEV_ADMIN_SETUP_TOKEN_' + Date.now()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsageStats(data.stats || usageStats);
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'warning') => {
    setShowToast(`${type}:${message}`);
    setTimeout(() => setShowToast(null), 5000);
  };

  const handleMasterSwitchChange = (value: AutoUpdateConfig['masterSwitch']) => {
    const newConfig = { ...config, masterSwitch: value };
    saveConfig(newConfig);
  };

  const handleScopeToggle = (scope: keyof AutoUpdateConfig['scopes']) => {
    const newConfig = {
      ...config,
      scopes: {
        ...config.scopes,
        [scope]: !config.scopes[scope]
      }
    };
    saveConfig(newConfig);
  };

  const handleLimitChange = (field: string, value: number | string) => {
    const newConfig = { ...config };
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      (newConfig.limits as any)[parent][child] = value;
    } else {
      (newConfig.limits as any)[field] = value;
    }
    saveConfig(newConfig);
  };

  const approveProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/admin/auto-update/proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-setup-token': 'DEV_ADMIN_SETUP_TOKEN_' + Date.now()
        }
      });

      if (response.ok) {
        loadProposals();
        showAlert('წინადადება დამტკიცდა', 'success');
      }
    } catch (error) {
      console.error('Error approving proposal:', error);
      showAlert('დამტკიცების შეცდომა', 'error');
    }
  };

  const rejectProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/admin/auto-update/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-setup-token': 'DEV_ADMIN_SETUP_TOKEN_' + Date.now()
        }
      });

      if (response.ok) {
        loadProposals();
        showAlert('წინადადება უარყვილია', 'warning');
      }
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      showAlert('უარყოფის შეცდომა', 'error');
    }
  };

  const getScopeDisplayName = (scope: keyof AutoUpdateConfig['scopes']) => {
    const names = {
      guruloCore: '🤖 გურულოს ბირთვი',
      frontendUI: '🎨 Frontend UI',
      adminPanel: '⚙️ Admin Panel',
      backend: '🔧 Backend',
      aiService: '🧠 AI Service'
    };
    return names[scope];
  };

  const getMasterSwitchColor = () => {
    switch (config.masterSwitch) {
      case 'off': return 'text-gray-500 bg-gray-100';
      case 'propose-only': return 'text-yellow-700 bg-yellow-100';
      case 'auto-apply-low-risk': return 'text-green-700 bg-green-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const isWithinTimeWindow = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTime >= config.limits.timeWindow.start && currentTime <= config.limits.timeWindow.end;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
          showToast.startsWith('success') ? 'bg-green-500 text-white' :
          showToast.startsWith('error') ? 'bg-red-500 text-white' :
          'bg-yellow-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {showToast.startsWith('success') ? <CheckCircle size={16} /> :
             showToast.startsWith('error') ? <X size={16} /> :
             <AlertTriangle size={16} />}
            <span>{showToast.split(':')[1]}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            ავტო-განახლების კონტროლი
          </h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getMasterSwitchColor()}`}>
          {config.masterSwitch === 'off' ? 'გამორთული' :
           config.masterSwitch === 'propose-only' ? 'მხოლოდ წინადადებები' :
           'ავტო-გამოყენება (დაბალი რისკი)'}
        </div>
      </div>

      {/* Master Switch */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5" />
          მთავარი სვიჩი
        </h3>
        <div className="space-y-2">
          {[
            { value: 'off', label: 'გამორთული', desc: 'ავტო-განახლებები სრულად გამორთული' },
            { value: 'propose-only', label: 'მხოლოდ წინადადებები', desc: 'ყველა ცვლილება საჭიროებს დამტკიცებას' },
            { value: 'auto-apply-low-risk', label: 'ავტო-გამოყენება (დაბალი რისკი)', desc: 'დაბალი რისკის ცვლილებები ავტომატურად' }
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                value={option.value}
                checked={config.masterSwitch === option.value}
                onChange={(e) => handleMasterSwitchChange(e.target.value as any)}
                disabled={!canModify}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{option.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Scopes */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">სკოპები</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(config.scopes).map(([scope, enabled]) => (
            <label
              key={scope}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                enabled 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700' 
                  : 'bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => handleScopeToggle(scope as keyof AutoUpdateConfig['scopes'])}
                disabled={!canModify || config.masterSwitch === 'off'}
                className="rounded"
              />
              <span className="font-medium text-gray-900 dark:text-white">
                {getScopeDisplayName(scope as keyof AutoUpdateConfig['scopes'])}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Limits */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5" />
          ლიმიტები
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              მაქს ცვლილებები დღეში
            </label>
            <input
              type="number"
              value={config.limits.maxChangesPerDay}
              onChange={(e) => handleLimitChange('maxChangesPerDay', parseInt(e.target.value))}
              disabled={!canModify}
              min="1"
              max="20"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="text-sm text-gray-500 mt-1">
              დღეს გამოყენებული: {usageStats.todayChanges}/{config.limits.maxChangesPerDay}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              მაქს ფაილები ერთ ციკლში
            </label>
            <input
              type="number"
              value={config.limits.maxFilesPerCycle}
              onChange={(e) => handleLimitChange('maxFilesPerCycle', parseInt(e.target.value))}
              disabled={!canModify}
              min="1"
              max="10"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              დროის ფანჯრის დაწყება
            </label>
            <input
              type="time"
              value={config.limits.timeWindow.start}
              onChange={(e) => handleLimitChange('timeWindow.start', e.target.value)}
              disabled={!canModify}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              დროის ფანჯრის დასასრული
            </label>
            <input
              type="time"
              value={config.limits.timeWindow.end}
              onChange={(e) => handleLimitChange('timeWindow.end', e.target.value)}
              disabled={!canModify}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="text-sm text-gray-500 mt-1">
              {isWithinTimeWindow() ? '✅ ახლა აქტიურია' : '⏸️ ახლა გამორთულია'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Proposals */}
      <div>
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">
          ბოლო წინადადებები ({proposals.length})
        </h3>
        {proposals.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>ახალი წინადადებები არ არის</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.slice(0, 5).map((proposal) => (
              <div
                key={proposal.id}
                className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {getScopeDisplayName(proposal.scope)}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getRiskColor(proposal.riskLevel)}`}>
                      {proposal.riskLevel}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      proposal.status === 'approved' ? 'bg-green-100 text-green-800' :
                      proposal.status === 'auto-applied' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {proposal.status}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {proposal.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {proposal.description}
                  </p>
                  <div className="text-xs text-gray-500">
                    ფაილები: {proposal.filesAffected.length} • {new Date(proposal.timestamp).toLocaleString('ka-GE')}
                  </div>
                </div>
                
                {proposal.status === 'pending' && canModify && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => approveProposal(proposal.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      ✅ დამტკიცება
                    </button>
                    <button
                      onClick={() => rejectProposal(proposal.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      ❌ უარყოფა
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!canModify && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <Shield className="w-4 h-4" />
            <span className="text-sm">
              მხოლოდ სუპერ ადმინისტრატორს შეუძლია ავტო-განახლების კონფიგურაციის ცვლილება
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoUpdateControl;

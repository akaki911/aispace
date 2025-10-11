
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User, 
  Globe, 
  Key,
  Eye,
  RefreshCw,
  Calendar,
  Sparkles,
  Database,
  RotateCw,
  ShieldAlert
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  userId?: string;
  role?: string;
  deviceId?: string;
  ipHash: string;
  success: boolean;
  details: Record<string, any>;
}

interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byRole: Record<string, number>;
  successRate: string;
  uniqueUsers: number;
  uniqueDevices: number;
}

const SecurityAuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditUnavailable, setAuditUnavailable] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [timeRange, setTimeRange] = useState('24');

  const availableActions = [
    'LOGIN_SUCCESS',
    'LOGIN_FAIL', 
    'DEVICE_TRUSTED',
    'PASSKEY_VERIFY_OK',
    'LOGOUT_SUCCESS',
    'ADMIN_ACCESS'
  ];

  const availableRoles = ['SUPER_ADMIN', 'PROVIDER', 'CUSTOMER'];

  useEffect(() => {
    fetchAuditData();
  }, [actionFilter, roleFilter, successFilter]);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (actionFilter) params.append('action', actionFilter);
      if (roleFilter) params.append('role', roleFilter);
      if (successFilter) params.append('success', successFilter);
      params.append('limit', '200');

      const response = await fetch(`/api/admin/security-audit/logs?${params}`, {
        credentials: 'include'
      });

      if (response.status === 404) {
        setAuditUnavailable(true);
        setLogs([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAuditUnavailable(false);
      setLogs(data.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      })));
    } catch (error) {
      console.error('❌ Failed to fetch audit logs:', error);
      if ((error as { message?: string })?.message?.includes('404')) {
        setAuditUnavailable(true);
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/admin/security-audit/stats?hours=${timeRange}`, {
        credentials: 'include'
      });

      if (response.status === 404) {
        setAuditUnavailable(true);
        setStats(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAuditUnavailable(false);
      setStats(data.stats);
    } catch (error) {
      console.error('❌ Failed to fetch audit stats:', error);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipHash.includes(searchTerm);
    
    return matchesSearch;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'LOGIN_FAIL': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'DEVICE_TRUSTED': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'PASSKEY_VERIFY_OK': return <Key className="w-4 h-4 text-purple-500" />;
      case 'LOGOUT_SUCCESS': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'ADMIN_ACCESS': return <Eye className="w-4 h-4 text-orange-500" />;
      case 'AI_PROMPT_UPDATED': return <Sparkles className="w-4 h-4 text-sky-500" />;
      case 'AI_KEY_ROTATED': return <RefreshCw className="w-4 h-4 text-emerald-500" />;
      case 'AI_BACKUP_TRIGGERED': return <Database className="w-4 h-4 text-indigo-500" />;
      case 'AI_RESTORE_TRIGGERED': return <RotateCw className="w-4 h-4 text-amber-500" />;
      case 'AI_USER_BANNED': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      default: return <Globe className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      'LOGIN_SUCCESS': 'წარმატებული შესვლა',
      'LOGIN_FAIL': 'შესვლის შეცდომა',
      'DEVICE_TRUSTED': 'მოწყობილობას ენდო',
      'PASSKEY_VERIFY_OK': 'Passkey დადასტურება',
      'LOGOUT_SUCCESS': 'გამოსვლა',
      'ADMIN_ACCESS': 'ადმინ წვდომა',
      'AI_PROMPT_UPDATED': 'AI პრომპტის განახლება',
      'AI_KEY_ROTATED': 'AI გასაღების როტაცია',
      'AI_BACKUP_TRIGGERED': 'AI ბექაპი',
      'AI_RESTORE_TRIGGERED': 'AI აღდგენა',
      'AI_USER_BANNED': 'AI მომხმარებლის დაბლოკვა',
    };
    return actionMap[action] || action;
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      'SUPER_ADMIN': 'სუპერ ადმინი',
      'PROVIDER': 'მომწოდებელი',
      'CUSTOMER': 'მომხმარებელი'
    };
    return roleMap[role] || role;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-500" />
            Security Audit Logs
          </h2>
          <p className="text-gray-400 mt-1">
            SOL-425: ყველა ავტორიზაციის მცდელობის მონიტორინგი
          </p>
        </div>
        <button
          onClick={() => {
            fetchAuditData();
            fetchStats();
          }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          განახლება
        </button>
      </div>

      {auditUnavailable && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-100">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Security audit service unavailable</p>
            <p className="text-sm text-yellow-200/80">
              The backend did not expose the audit log endpoints (HTTP 404). Historical records are temporarily hidden while the service is offline.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">სულ მოვლენები</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Globe className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">წარმატების პროცენტი</p>
                <p className="text-2xl font-bold text-green-400">{stats.successRate}%</p>
              </div>
              <div className="p-2 bg-green-600/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">უნიკალური მომხმარებლები</p>
                <p className="text-2xl font-bold text-blue-400">{stats.uniqueUsers}</p>
              </div>
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <User className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">უნიკალური მოწყობილობები</p>
                <p className="text-2xl font-bold text-orange-400">{stats.uniqueDevices}</p>
              </div>
              <div className="p-2 bg-orange-600/20 rounded-lg">
                <Shield className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ძიება მომხმარებლის ID-ით ან IP-ით..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="">ყველა მოქმედება</option>
            {availableActions.map(action => (
              <option key={action} value={action}>{getActionText(action)}</option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="">ყველა როლი</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{getRoleText(role)}</option>
            ))}
          </select>

          {/* Success Filter */}
          <select
            value={successFilter}
            onChange={(e) => setSuccessFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="">ყველა სტატუსი</option>
            <option value="true">წარმატებული</option>
            <option value="false">შეცდომა</option>
          </select>

          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="1">ბოლო 1 საათი</option>
            <option value="24">ბოლო 24 საათი</option>
            <option value="168">ბოლო კვირა</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  მოქმედება
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  მომხმარებელი
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  როლი
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  IP Hash
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  დრო
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  სტატუსი
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      ლოგების ჩატვირთვა...
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    ლოგები ვერ მოიძებნა
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="text-sm text-white">
                          {getActionText(log.action)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300 font-mono">
                        {log.userId ? log.userId.substring(0, 8) + '...' : 'anonymous'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">
                        {log.role ? getRoleText(log.role) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-400 font-mono">
                        {log.ipHash.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {log.timestamp.toLocaleString('ka-GE')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.success 
                          ? 'bg-green-600/20 text-green-400' 
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {log.success ? 'წარმატება' : 'შეცდომა'}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-4">
        <p>🔒 <strong>უსაფრთხოების შენიშვნა:</strong> IP მისამართები hash-ირებულია PII-დაცვისთვის. წვდომა მხოლოდ SUPER_ADMIN-ს.</p>
        <p className="mt-1">📊 ნაჩვენებია {filteredLogs.length} ლოგი სულ {logs.length}-დან</p>
      </div>
    </div>
  );
};

export default SecurityAuditTab;

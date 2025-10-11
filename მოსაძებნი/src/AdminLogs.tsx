
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';
// Authentication hooks removed - unused
import { motion } from 'framer-motion';
import { 
  FileText, 
  Search, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Calendar,
  User,
  Database
} from 'lucide-react';

interface Log {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'cottage' | 'hotel' | 'vehicle' | 'user' | 'booking'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as Log[];
      setLogs(logsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (logId: string) => {
    if (window.confirm('დარწმუნებული ხართ რომ გსურთ ლოგის წაშლა?')) {
      try {
        await deleteDoc(doc(db, 'logs', logId));
        fetchLogs();
      } catch (error) {
        console.error('Error deleting log:', error);
      }
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      case 'warning': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'success': return 'bg-green-100 dark:bg-green-900 dark:bg-opacity-20 text-green-800 dark:text-green-300';
      default: return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300';
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'error': return 'შეცდომა';
      case 'warning': return 'გაფრთხილება';
      case 'success': return 'წარმატება';
      case 'info': return 'ინფორმაცია';
      default: return level;
    }
  };

  const getResourceIcon = (resource: string) => {
    switch (resource) {
      case 'cottage': return '🏠';
      case 'hotel': return '🏨';
      case 'vehicle': return '🚗';
      case 'user': return '👤';
      case 'booking': return '📅';
      default: return '📄';
    }
  };

  const getResourceText = (resource: string) => {
    switch (resource) {
      case 'cottage': return 'კოტეჯი';
      case 'hotel': return 'სასტუმრო';
      case 'vehicle': return 'ტრანსპორტი';
      case 'user': return 'მომხმარებელი';
      case 'booking': return 'ჯავშანი';
      default: return resource;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesResource = resourceFilter === 'all' || log.resource === resourceFilter;
    return matchesSearch && matchesLevel && matchesResource;
  });

  if (loading) {
    return (
      <div className="h-full bg-[#0D1117] text-gray-300">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-gray-400 font-medium">ლოგების ჩატვირთვა...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0D1117] text-gray-300 p-4 overflow-y-auto">
      <div className="max-w-full">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-4 lg:mb-0">
                <h1 className="text-2xl font-bold text-white flex items-center mb-2">
                  <div className="p-2 rounded-lg mr-3 bg-gradient-to-r from-blue-600 to-purple-600">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  სისტემის ლოგები
                </h1>
                <p className="text-sm text-gray-400">მონიტორინგი და აუდიტი</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:bg-gray-750 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">შეცდომები</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">
                    {logs.filter(l => l.level === 'error').length}
                  </p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-emerald-900/20 rounded-2xl p-6 shadow-lg border border-emerald-200/50 dark:border-emerald-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">წარმატება</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    {logs.filter(l => l.level === 'success').length}
                  </p>
                </div>
                <div className="bg-emerald-100/80 dark:bg-emerald-900/40 p-3 rounded-xl shadow-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-800 dark:to-indigo-900/20 rounded-2xl p-6 shadow-lg border border-indigo-200/50 dark:border-indigo-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-indigo-200/50 dark:hover:shadow-indigo-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">გაფრთხილებები</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
                    {logs.filter(l => l.level === 'warning').length}
                  </p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">სულ ლოგები</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{logs.length}</p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ძებნა შეტყობინებით, მომხმარებლით ან მოქმედებით..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა დონე</option>
                  <option value="info">ინფორმაცია</option>
                  <option value="success">წარმატება</option>
                  <option value="warning">გაფრთხილება</option>
                  <option value="error">შეცდომა</option>
                </select>

                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა რესურსი</option>
                  <option value="cottage">კოტეჯები</option>
                  <option value="hotel">სასტუმროები</option>
                  <option value="vehicle">ტრანსპორტი</option>
                  <option value="user">მომხმარებლები</option>
                  <option value="booking">ჯავშნები</option>
                </select>

                <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-3 ${viewMode === 'grid' ? 'bg-brown-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'} transition-colors`}
                  >
                    <div className="grid grid-cols-2 gap-1 w-4 h-4">
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                    </div>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-3 ${viewMode === 'list' ? 'bg-brown-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'} transition-colors`}
                  >
                    <div className="flex flex-col gap-1 w-4 h-4">
                      <div className="bg-current h-1 rounded-sm"></div>
                      <div className="bg-current h-1 rounded-sm"></div>
                      <div className="bg-current h-1 rounded-sm"></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Grid */}
          {filteredLogs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <FileText className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ლოგები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400">შეცვალეთ ძებნის ან ფილტრის პარამეტრები</p>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{getResourceIcon(log.resource)}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{log.action}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{getResourceText(log.resource)}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                        {getLevelIcon(log.level)}
                        <span className="ml-1">{getLevelText(log.level)}</span>
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{log.message}</p>
                      <div className="flex items-center text-sm">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 dark:text-gray-400">{log.userName}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {log.timestamp.toLocaleString('ka-GE')}
                        </span>
                      </div>
                      {log.resourceId && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {log.resourceId}
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {filteredLogs.length > 0 && (
            <div className="text-center mt-12">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-8 py-3 rounded-xl font-medium transition-colors shadow-lg border border-gray-200 dark:border-gray-700"
              >
                მეტის ჩატვირთვა
              </motion.button>
            </div>
          )}
        </div>
      </div>
  );
};

export default AdminLogs;

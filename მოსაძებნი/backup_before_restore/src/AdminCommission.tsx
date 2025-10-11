
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Plus,
  TrendingUp,
  Calendar,
  Users,
  Building2,
  Grid,
  List,
  Activity
} from 'lucide-react';

interface Commission {
  id: string;
  providerId: string;
  providerName: string;
  resourceType: 'cottage' | 'hotel' | 'vehicle' | 'horse' | 'snowmobile';
  commissionRate: number;
  totalBookings: number;
  totalRevenue: number;
  commissionAmount: number;
  period: string;
  createdAt: Date;
  status: 'pending' | 'paid' | 'overdue';
}

const AdminCommission: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { isDarkMode } = useTheme();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'cottage' | 'hotel' | 'vehicle' | 'horse' | 'snowmobile'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'commissions'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const commissionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Commission[];
      setCommissions(commissionsData);
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCommissionStatus = async (commissionId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'commissions', commissionId), {
        status: newStatus,
        updatedAt: new Date()
      });
      fetchCommissions();
    } catch (error) {
      console.error('Error updating commission status:', error);
    }
  };

  const deleteCommission = async (commissionId: string) => {
    if (window.confirm('დარწმუნებული ხართ რომ გსურთ საკომისიოს წაშლა?')) {
      try {
        await deleteDoc(doc(db, 'commissions', commissionId));
        fetchCommissions();
      } catch (error) {
        console.error('Error deleting commission:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'paid': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      case 'overdue': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'მოლოდინში';
      case 'paid': return 'გადახდილი';
      case 'overdue': return 'ვადაგადაცილებული';
      default: return status;
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'cottage': return '🏠';
      case 'hotel': return '🏨';
      case 'vehicle': return '🚗';
      case 'horse': return '🐎';
      case 'snowmobile': return '🛷';
      default: return '📍';
    }
  };

  const getResourceText = (type: string) => {
    switch (type) {
      case 'cottage': return 'კოტეჯი';
      case 'hotel': return 'სასტუმრო';
      case 'vehicle': return 'ტრანსპორტი';
      case 'horse': return 'ცხენი';
      case 'snowmobile': return 'სანოუმობილი';
      default: return type;
    }
  };

  const filteredCommissions = commissions.filter(commission => {
    const matchesSearch = commission.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commission.period.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || commission.status === statusFilter;
    const matchesResource = resourceFilter === 'all' || commission.resourceType === resourceFilter;
    return matchesSearch && matchesStatus && matchesResource;
  });

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 transition-colors">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-brown-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">საკომისიოების ჩატვირთვა...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-6 lg:mb-0">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center mb-2">
                  <div className={`p-3 rounded-2xl mr-4 ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600'
                  }`}>
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                  საკომისიო
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">მართეთ პროვაიდერების საკომისიო გადახდები</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {/* Add new commission logic */}}
                  className={`text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი საკომისიო
                </motion.button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-slate-800 dark:to-rose-900/20 rounded-2xl p-6 shadow-lg border border-rose-200/50 dark:border-rose-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-rose-200/50 dark:hover:shadow-rose-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">მოლოდინში</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">
                    ₾{commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commissionAmount, 0)}
                  </p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <Calendar className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-emerald-900/20 rounded-2xl p-6 shadow-lg border border-emerald-200/50 dark:border-emerald-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">გადახდილი</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    ₾{commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commissionAmount, 0)}
                  </p>
                </div>
                <div className="bg-emerald-100/80 dark:bg-emerald-900/40 p-3 rounded-xl shadow-lg">
                  <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-800 dark:to-indigo-900/20 rounded-2xl p-6 shadow-lg border border-indigo-200/50 dark:border-indigo-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-indigo-200/50 dark:hover:shadow-indigo-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">ვადაგადაცილებული</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
                    ₾{commissions.filter(c => c.status === 'overdue').reduce((sum, c) => sum + c.commissionAmount, 0)}
                  </p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <DollarSign className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">სულ შემოსავალი</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    ₾{commissions.reduce((sum, c) => sum + c.commissionAmount, 0)}
                  </p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ძებნა პროვაიდერით ან პერიოდით..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა სტატუსი</option>
                  <option value="pending">მოლოდინში</option>
                  <option value="paid">გადახდილი</option>
                  <option value="overdue">ვადაგადაცილებული</option>
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
                  <option value="horse">ცხენები</option>
                  <option value="snowmobile">სანოუმობილები</option>
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

          {/* Commissions Grid */}
          {filteredCommissions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <DollarSign className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">საკომისიოები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">შეცვალეთ ძებნის ან ფილტრის პარამეტრები</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {}}
                  className={`text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი საკომისიოს დამატება
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCommissions.map((commission, index) => (
                <motion.div
                  key={commission.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{getResourceIcon(commission.resourceType)}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{commission.providerName}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{getResourceText(commission.resourceType)}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(commission.status)}`}>
                        {getStatusText(commission.status)}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">საკომისიო განაკვეთი:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{commission.commissionRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">ჯავშნები:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{commission.totalBookings}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">შემოსავალი:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">₾{commission.totalRevenue}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">საკომისიო:</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">₾{commission.commissionAmount}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{commission.period}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      {commission.status === 'pending' && (
                        <button
                          onClick={() => updateCommissionStatus(commission.id, 'paid')}
                          className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors text-sm font-medium"
                        >
                          გადახდილი
                        </button>
                      )}
                      <button
                        onClick={() => deleteCommission(commission.id)}
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
          {filteredCommissions.length > 0 && (
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
    </div>
  );
};

export default AdminCommission;

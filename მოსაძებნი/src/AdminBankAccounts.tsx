// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  CreditCard, 
  Building2, 
  Users, 
  CheckCircle, 
  XCircle,
  DollarSign,
  TrendingUp,
  Activity,
  Search,
  Filter,
  Grid,
  List
} from 'lucide-react';
import BankAccountManager from './components/BankAccountManager';
import { Card } from './components/ui/card';

interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string;
  accountNumber: string;
  isActive: boolean;
  isShared: boolean;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BankAccountStats {
  totalAccounts: number;
  activeAccounts: number;
  sharedAccounts: number;
  personalAccounts: number;
}

export default function AdminBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'shared' | 'personal'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [stats, setStats] = useState<BankAccountStats>({
    totalAccounts: 0,
    activeAccounts: 0,
    sharedAccounts: 0,
    personalAccounts: 0
  });

  const { user } = useAuth();
  const { canViewAllResources, canEditResource, canDeleteResource, isSuperAdmin } = usePermissions();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    filterAndSortAccounts();
  }, [bankAccounts, searchTerm, filterType, filterStatus]);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      let accountsQuery;

      if (isSuperAdmin) {
        accountsQuery = query(collection(db, 'bankAccounts'));
      } else {
        accountsQuery = query(
          collection(db, 'bankAccounts'),
          where('ownerId', '==', user?.uid || '')
        );
      }

      const snapshot = await getDocs(accountsQuery);
      const accountsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      }) as BankAccount[];

      setBankAccounts(accountsData);
      calculateStats(accountsData);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (accountsList: BankAccount[]) => {
    const totalAccounts = accountsList.length;
    const activeAccounts = accountsList.filter(a => a.isActive).length;
    const sharedAccounts = accountsList.filter(a => a.isShared).length;
    const personalAccounts = accountsList.filter(a => !a.isShared).length;

    setStats({
      totalAccounts,
      activeAccounts,
      sharedAccounts,
      personalAccounts
    });
  };

  const filterAndSortAccounts = () => {
    let filtered = [...bankAccounts];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountHolder.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.iban.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (filterType === 'shared') {
      filtered = filtered.filter(account => account.isShared);
    } else if (filterType === 'personal') {
      filtered = filtered.filter(account => !account.isShared);
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter(account => account.isActive);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(account => !account.isActive);
    }

    // Sort by creation date
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    setFilteredAccounts(filtered);
  };

  const handleDelete = async (accountId: string) => {
    const account = bankAccounts.find(a => a.id === accountId);
    if (!account || !canDeleteResource(account.ownerId)) {
      alert('თქვენ არ გაქვთ ამ ანგარიშის წაშლის უფლება');
      return;
    }

    if (!window.confirm('ნამდვილად გსურთ ბანკის ანგარიშის წაშლა?')) return;

    try {
      await deleteDoc(doc(db, 'bankAccounts', accountId));
      setBankAccounts(prev => prev.filter(a => a.id !== accountId));
      alert('ბანკის ანგარიში წარმატებით წაიშალა');
    } catch (error) {
      console.error('Error deleting bank account:', error);
      alert('შეცდომა წაშლისას');
    }
  };

  const handleSave = () => {
    fetchBankAccounts();
    setShowForm(false);
    setEditingAccount(null);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-brown-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">ბანკის ანგარიშების ჩატვირთვა...</p>
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

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-6 lg:mb-0">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center mb-2">
                  <div className={`p-3 rounded-2xl mr-4 ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600'
                  }`}>
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  ბანკის ანგარიშები
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">მართეთ ბანკის ანგარიშები ერთ ადგილას</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowForm(true)}
                  className={`text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი ანგარიში
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
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">სულ ანგარიშები</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">{stats.totalAccounts}</p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <CreditCard className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-emerald-900/20 rounded-2xl p-6 shadow-lg border border-emerald-200/50 dark:border-emerald-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">აქტიური</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats.activeAccounts}</p>
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
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">გაზიარებული</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{stats.sharedAccounts}</p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">პერსონალური</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats.personalAccounts}</p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ძებნა ბანკით ან IBAN-ით..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა ტიპი</option>
                  <option value="shared">გაზიარებული</option>
                  <option value="personal">პერსონალური</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა სტატუსი</option>
                  <option value="active">აქტიური</option>
                  <option value="inactive">არააქტიური</option>
                </select>

                <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-3 ${viewMode === 'grid' ? 'bg-brown-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'} transition-colors`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-3 ${viewMode === 'list' ? 'bg-brown-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'} transition-colors`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Accounts Grid/List */}
          {filteredAccounts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <CreditCard className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ბანკის ანგარიშები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">სცადეთ სხვა საძიებო კრიტერიუმები ან დაამატეთ ახალი ანგარიში</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowForm(true)}
                  className={`text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი ანგარიშის დამატება
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
            }>
              <AnimatePresence>
                {filteredAccounts.map((account, index) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 ${
                      viewMode === 'list' ? 'flex' : ''
                    }`}
                  >
                    <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-brown-100 dark:bg-brown-900/30 p-3 rounded-xl">
                            <Building2 className="w-6 h-6 text-brown-600 dark:text-brown-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{account.bankName}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{account.accountHolder}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {account.isShared && (
                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs font-medium px-2.5 py-1 rounded-full">
                              გაზიარებული
                            </span>
                          )}
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            account.isActive
                              ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-800 dark:text-green-200'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          }`}>
                            {account.isActive ? 'აქტიური' : 'არააქტიური'}
                          </span>
                        </div>
                      </div>

                      {/* Account Details */}
                      <div className="space-y-3 mb-4">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">IBAN</div>
                          <div className="font-mono text-sm text-gray-900 dark:text-white">{account.iban}</div>
                        </div>
                        {account.accountNumber && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ანგარიშის ნომერი</div>
                            <div className="font-mono text-sm text-gray-900 dark:text-white">{account.accountNumber}</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {canEditResource(account.ownerId) && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setEditingAccount(account);
                              setShowForm(true);
                            }}
                            className="flex-1 bg-brown-100 dark:bg-brown-900/30 text-brown-700 dark:text-brown-300 py-2 px-3 rounded-lg hover:bg-brown-200 dark:hover:bg-brown-900/50 transition-colors text-center text-sm font-medium flex items-center justify-center"
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            რედაქტირება
                          </motion.button>
                        )}
                        {canDeleteResource(account.ownerId) && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(account.id)}
                            className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 py-2 px-3 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-center text-sm font-medium flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            წაშლა
                          </motion.button>
                        )}
                      </div>

                      {/* Metadata Footer */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          შექმნილია {account.createdAt.toLocaleDateString('ka-GE')}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Bank Account Form Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => {
                  setShowForm(false);
                  setEditingAccount(null);
                }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                      {editingAccount ? 'ანგარიშის რედაქტირება' : 'ახალი ბანკის ანგარიში'}
                    </h2>
                    <BankAccountManager
                      editingAccount={editingAccount}
                      onSave={handleSave}
                      onCancel={() => {
                        setShowForm(false);
                        setEditingAccount(null);
                      }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
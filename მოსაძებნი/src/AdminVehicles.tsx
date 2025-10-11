// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import VehicleForm from './VehicleForm';
import VehicleCard from './components/VehicleCard';
import { SearchInput } from './components/SearchInput';
import { StatusFilter } from './components/StatusFilter';
import { OwnerFilter } from './components/OwnerFilter';
import { ViewToggle } from './components/ViewToggle';
import { EmptyState } from './components/EmptyState';
import { 
  Plus, 
  Car, 
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

interface Vehicle {
  id: string;
  name: string;
  type: string;
  pricePerDay: number;
  capacity: number;
  transmission: string;
  fuelType: string;
  features: string[];
  isAvailable: boolean;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
  images?: string[];
  description?: string;
}

interface VehicleStats {
  totalVehicles: number;
  availableVehicles: number;
  unavailableVehicles: number;
  averagePrice: number;
}

export default function AdminVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'my' | 'others'>('all');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'name' | 'price'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [stats, setStats] = useState<VehicleStats>({
    totalVehicles: 0,
    availableVehicles: 0,
    unavailableVehicles: 0,
    averagePrice: 0
  });

  const { user } = useAuth();
  const { canViewAllResources, canEditResource, canDeleteResource, isSuperAdmin } = usePermissions();
  const { isDarkMode, theme } = useTheme();

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    filterAndSortVehicles();
  }, [vehicles, searchTerm, statusFilter, ownerFilter, sortOption]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      let vehiclesQuery;

      if (isSuperAdmin || canViewAllResources) {
        vehiclesQuery = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
      } else {
        vehiclesQuery = query(
          collection(db, 'vehicles'),
          where('ownerId', '==', user?.uid || ''),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(vehiclesQuery);
      const vehiclesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      }) as Vehicle[];

      setVehicles(vehiclesData);
      calculateStats(vehiclesData);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (vehiclesList: Vehicle[]) => {
    const totalVehicles = vehiclesList.length;
    const availableVehicles = vehiclesList.filter(v => v.isAvailable).length;
    const unavailableVehicles = totalVehicles - availableVehicles;
    const averagePrice = vehiclesList.length > 0 
      ? vehiclesList.reduce((sum, v) => sum + v.pricePerDay, 0) / vehiclesList.length 
      : 0;

    setStats({
      totalVehicles,
      availableVehicles,
      unavailableVehicles,
      averagePrice
    });
  };

  const filterAndSortVehicles = () => {
    let filtered = [...vehicles];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(vehicle =>
        vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.transmission.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.fuelType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter === 'available') {
      filtered = filtered.filter(vehicle => vehicle.isAvailable);
    } else if (statusFilter === 'unavailable') {
      filtered = filtered.filter(vehicle => !vehicle.isAvailable);
    }

    // Owner filter
    if (ownerFilter === 'my') {
      filtered = filtered.filter(vehicle => vehicle.ownerId === user?.uid);
    } else if (ownerFilter === 'others') {
      filtered = filtered.filter(vehicle => vehicle.ownerId !== user?.uid);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return b.pricePerDay - a.pricePerDay;
        case 'newest':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    setFilteredVehicles(filtered);
  };

  const handleDelete = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle || !canDeleteResource(vehicle.ownerId)) {
      alert('თქვენ არ გაქვთ ამ ავტომობილის წაშლის უფლება');
      return;
    }

    if (!window.confirm('ნამდვილად გსურთ ავტომობილის წაშლა?')) return;

    try {
      await deleteDoc(doc(db, 'vehicles', vehicleId));
      setVehicles(prev => prev.filter(v => v.id !== vehicleId));
      alert('ავტომობილი წარმატებით წაიშალა');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('შეცდომა წაშლისას');
    }
  };

  const handleSave = () => {
    fetchVehicles();
    setShowForm(false);
    setEditingVehicle(null);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">ავტომობილების ჩატვირთვა...</p>
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
                    <Car className="w-8 h-8 text-white" />
                  </div>
                  ავტომობილები
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">ავტომობილების მართვა და კონტროლი</p>
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
                  ახალი ავტომობილი
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
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">სულ ავტომობილები</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">{stats.totalVehicles}</p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <Car className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-emerald-900/20 rounded-2xl p-6 shadow-lg border border-emerald-200/50 dark:border-emerald-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">ხელმისაწვდომი</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats.availableVehicles}</p>
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
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">დაკავებული</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{stats.unavailableVehicles}</p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <XCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">საშუალო ფასი</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{Math.round(stats.averagePrice)}₾</p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
                  placeholder="ძებნა სახელით ან ტიპით..."
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
                  <option value="available">ხელმისაწვდომი</option>
                  <option value="unavailable">დაკავებული</option>
                </select>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="newest">ყველაზე ახალი</option>
                  <option value="oldest">ყველაზე ძველი</option>
                  <option value="name">სახელით</option>
                  <option value="price">ფასით</option>
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

          {/* Vehicles Grid/List */}
          {filteredVehicles.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <Car className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ავტომობილები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">სცადეთ სხვა საძიებო კრიტერიუმები ან დაამატეთ ახალი ავტომობილი</p>
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
                  ახალი ავტომობილის დამატება
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
            }>
              <AnimatePresence>
                {filteredVehicles.map((vehicle, index) => (
                  <motion.div
                    key={vehicle.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <VehicleCard
                      vehicle={vehicle}
                      viewMode={viewMode}
                      onEdit={canEditResource(vehicle.ownerId) ? () => {
                        setEditingVehicle(vehicle);
                        setShowForm(true);
                      } : undefined}
                      onDelete={canDeleteResource(vehicle.ownerId) ? () => handleDelete(vehicle.id) : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Vehicle Form Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => {
                  setShowForm(false);
                  setEditingVehicle(null);
                }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <VehicleForm
                    editingVehicle={editingVehicle}
                    onSave={handleSave}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingVehicle(null);
                    }}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
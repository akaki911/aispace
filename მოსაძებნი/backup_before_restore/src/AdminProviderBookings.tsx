import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar,
  Search,
  Filter,
  MapPin,
  Clock,
  DollarSign,
  User,
  Check,
  X,
  AlertCircle,
  Eye,
  Grid,
  List,
  Activity,
  TrendingUp
} from 'lucide-react';

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  resourceType: 'cottage' | 'hotel' | 'vehicle' | 'horse' | 'snowmobile';
  resourceName: string;
  providerId: string;
  providerName: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
  adults: number;
  children: number;
}

const AdminProviderBookings: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { isDarkMode } = useTheme();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'cottage' | 'hotel' | 'vehicle' | 'horse' | 'snowmobile'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'bookings'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const bookingsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Booking[];
      setBookings(bookingsData);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: newStatus,
        updatedAt: new Date()
      });
      fetchBookings();
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'confirmed': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      case 'completed': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300';
      default: return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'მოლოდინში';
      case 'confirmed': return 'დადასტურებული';
      case 'cancelled': return 'გაუქმებული';
      case 'completed': return 'დასრულებული';
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

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = (booking.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (booking.resourceName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (booking.providerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    const matchesResource = resourceFilter === 'all' || booking.resourceType === resourceFilter;
    return matchesSearch && matchesStatus && matchesResource;
  });

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 transition-colors">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-brown-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">ჯავშნების ჩატვირთვა...</p>
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
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  პროვაიდერის ჯავშნები
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">მართეთ ყველა ჯავშანი ერთ ადგილას</p>
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
                    {bookings.filter(b => b.status === 'pending').length}
                  </p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <Clock className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-emerald-900/20 rounded-2xl p-6 shadow-lg border border-emerald-200/50 dark:border-emerald-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">დადასტურებული</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    {bookings.filter(b => b.status === 'confirmed').length}
                  </p>
                </div>
                <div className="bg-emerald-100/80 dark:bg-emerald-900/40 p-3 rounded-xl shadow-lg">
                  <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-800 dark:to-indigo-900/20 rounded-2xl p-6 shadow-lg border border-indigo-200/50 dark:border-indigo-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-indigo-200/50 dark:hover:shadow-indigo-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">სულ შემოსავალი</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
                    ₾{bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').reduce((sum, b) => sum + b.totalPrice, 0)}
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
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">სულ ჯავშნები</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{bookings.length}</p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
                  placeholder="ძებნა მომხმარებლით, რესურსით ან პროვაიდერით..."
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
                  <option value="confirmed">დადასტურებული</option>
                  <option value="cancelled">გაუქმებული</option>
                  <option value="completed">დასრულებული</option>
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

          {/* Bookings Grid */}
          {filteredBookings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <Calendar className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ჯავშნები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400">შეცვალეთ ძებნის ან ფილტრის პარამეტრები</p>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredBookings.map((booking, index) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{getResourceIcon(booking.resourceType)}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{booking.resourceName}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{getResourceText(booking.resourceType)}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center text-sm">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 dark:text-gray-400">{booking.customerName}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {booking.startDate.toLocaleDateString('ka-GE')} - {booking.endDate.toLocaleDateString('ka-GE')}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 dark:text-gray-400">₾{booking.totalPrice}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {booking.adults} მზრუნველი, {booking.children} ბავშვი
                        </span>
                      </div>
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                          className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors text-sm font-medium"
                        >
                          დადასტურება
                        </button>
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                          className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
                        >
                          გაუქმება
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {filteredBookings.length > 0 && (
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

export default AdminProviderBookings;
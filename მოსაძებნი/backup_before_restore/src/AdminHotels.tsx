import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc, query, where, limit, updateDoc } from 'firebase/firestore';
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Building2, 
  DollarSign, 
  CheckCircle, 
  XCircle,
  Eye,
  Calendar,
  ImageIcon,
  BarChart3,
  Power,
  PowerOff,
  MapPin,
  Search,
  Filter,
  Home,
  Activity,
  Users,
  Star,
  AlertTriangle,
  AlertCircle,
  Grid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from './firebaseConfig';
import { Hotel } from './types/hotel';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/ThemeContext';
import { logAuditEvent } from './services/auditService';
import { createPriceCode } from './services/priceCodeService';

interface HotelStats {
  totalHotels: number;
  activeHotels: number;
  totalRooms: number;
  averagePrice: number;
}

interface Notification {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  hotelId: string;
}

export default function AdminHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'created' | 'updated' | 'activity' | 'popularity'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [stats, setStats] = useState<HotelStats>({
    totalHotels: 0,
    activeHotels: 0,
    totalRooms: 0,
    averagePrice: 0
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { canViewAllResources, canEditResource, canDeleteResource, currentUserId, isSuperAdmin } = usePermissions();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchHotels();
  }, []);

  useEffect(() => {
    filterAndSortHotels();
    generateNotifications();
  }, [hotels, searchTerm, filterStatus, sortBy, sortOrder]);

  const fetchHotels = async () => {
    try {
      setLoading(true);

      let hotelsQuery;
      if (isSuperAdmin) {
        hotelsQuery = query(collection(db, 'hotels'));
      } else {
        hotelsQuery = query(
          collection(db, 'hotels'),
          where('ownerId', '==', user?.uid || '')
        );
      }

      const hotelsSnapshot = await getDocs(hotelsQuery);
      const hotelsData = hotelsSnapshot.docs.map(doc => {
        const data = doc.data();

        // Calculate average price from room types
        const roomTypes = data.roomTypes || [];
        const averagePrice = roomTypes.length > 0 
          ? roomTypes.reduce((sum: number, room: any) => sum + (room.price || 0), 0) / roomTypes.length
          : 0;

        return {
          id: doc.id,
          ...data,
          averagePrice,
          totalRooms: roomTypes.length,
          lastBookingDate: data.lastBookingDate || new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        };
      }) as Hotel[];

      setHotels(hotelsData);

      // Calculate stats
      const totalHotels = hotelsData.length;
      const activeHotels = hotelsData.filter(h => h.roomTypes && h.roomTypes.length > 0).length;
      const totalRooms = hotelsData.reduce((sum, h) => sum + (h.roomTypes?.length || 0), 0);
      const averagePrice = hotelsData.reduce((sum, h) => {
        const roomTypes = h.roomTypes || [];
        const hotelAvg = roomTypes.length > 0 
          ? roomTypes.reduce((rSum: number, room: any) => rSum + (room.price || 0), 0) / roomTypes.length
          : 0;
        return sum + hotelAvg;
      }, 0) / totalHotels || 0;

      setStats({
        totalHotels,
        activeHotels,
        totalRooms,
        averagePrice: Math.round(averagePrice)
      });

    } catch (error) {
      console.error('Error fetching hotels:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = () => {
    const newNotifications: Notification[] = [];

    hotels.forEach(hotel => {
      // Check for missing room types
      if (!hotel.roomTypes || hotel.roomTypes.length === 0) {
        newNotifications.push({
          id: `rooms-${hotel.id}`,
          type: 'warning',
          message: `${hotel.name} - ოთახების ტიპები არ არის განსაზღვრული`,
          hotelId: hotel.id
        });
      }

      // Check for missing photos
      if (!hotel.images || hotel.images.length === 0) {
        newNotifications.push({
          id: `photos-${hotel.id}`,
          type: 'error',
          message: `${hotel.name} - ფოტოები არ არის ატვირთული`,
          hotelId: hotel.id
        });
      }

      // Check for no recent activity
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (!hotel.lastBookingDate || hotel.lastBookingDate < thirtyDaysAgo) {
        newNotifications.push({
          id: `activity-${hotel.id}`,
          type: 'info',
          message: `${hotel.name} - ბოლო 30 დღეში აქტივობა არ მომხდარა`,
          hotelId: hotel.id
        });
      }
    });

    setNotifications(newNotifications);
  };

  const filterAndSortHotels = () => {
    let filtered = hotels.filter(hotel => {
      const matchesSearch = hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           hotel.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && hotel.roomTypes && hotel.roomTypes.length > 0) ||
                           (filterStatus === 'inactive' && (!hotel.roomTypes || hotel.roomTypes.length === 0));

      return matchesSearch && matchesStatus;
    });

    // Sort hotels
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'price':
          const aPrice = a.roomTypes?.length ? a.roomTypes.reduce((sum, room) => sum + (room.price || 0), 0) / a.roomTypes.length : 0;
          const bPrice = b.roomTypes?.length ? b.roomTypes.reduce((sum, room) => sum + (room.price || 0), 0) / b.roomTypes.length : 0;
          compareValue = aPrice - bPrice;
          break;
        case 'created':
          compareValue = (a.createdAt?.toDate?.() || new Date(0)).getTime() - 
                        (b.createdAt?.toDate?.() || new Date(0)).getTime();
          break;
        case 'updated':
          compareValue = (a.updatedAt?.toDate?.() || new Date(0)).getTime() - 
                        (b.updatedAt?.toDate?.() || new Date(0)).getTime();
          break;
        case 'activity':
          compareValue = (a.lastBookingDate?.getTime() || 0) - (b.lastBookingDate?.getTime() || 0);
          break;
        case 'popularity':
          compareValue = (a.roomTypes?.length || 0) - (b.roomTypes?.length || 0);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    setFilteredHotels(filtered);
  };

  const handleDelete = async (id: string) => {
    const hotel = hotels.find(h => h.id === id);
    if (!hotel || !canDeleteResource(hotel.ownerId)) {
      alert('თქვენ არ გაქვთ ამ სასტუმროს წაშლის უფლება');
      return;
    }

    if (!window.confirm('ნამდვილად გსურთ სასტუმროს წაშლა?')) return;

    try {
      await deleteDoc(doc(db, 'hotels', id));
      setHotels(prev => prev.filter(h => h.id !== id));

      if (user) {
        await logAuditEvent(
          user.uid,
          user.email,
          'DELETE',
          'hotel',
          id,
          hotel,
          null
        );
      }

      alert('სასტუმრო წარმატებით წაიშალა');
    } catch (error) {
      console.error('Error deleting hotel:', error);
      alert('შეცდომა წაშლისას');
    }
  };

  const toggleHotelStatus = async (hotelId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'hotels', hotelId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });

      setHotels(prev => prev.map(hotel => 
        hotel.id === hotelId 
          ? { ...hotel, isActive: !currentStatus }
          : hotel
      ));
    } catch (error) {
      console.error('Error updating hotel status:', error);
    }
  };

  const handleBulkAction = async (action: 'delete' | 'activate' | 'deactivate') => {
    if (selectedHotels.length === 0) return;

    if (action === 'delete') {
      if (window.confirm(`დარწმუნებული ხართ რომ გსურთ ${selectedHotels.length} სასტუმროს წაშლა?`)) {
        for (const hotelId of selectedHotels) {
          await deleteDoc(doc(db, 'hotels', hotelId));
        }
        setHotels(prev => prev.filter(hotel => !selectedHotels.includes(hotel.id)));
      }
    } else {
      const isActive = action === 'activate';
      for (const hotelId of selectedHotels) {
        await updateDoc(doc(db, 'hotels', hotelId), {
          isActive,
          updatedAt: new Date()
        });
      }
      setHotels(prev => prev.map(hotel => 
        selectedHotels.includes(hotel.id)
          ? { ...hotel, isActive }
          : hotel
      ));
    }

    setSelectedHotels([]);
  };

  const toggleHotelSelection = (hotelId: string) => {
    setSelectedHotels(prev => 
      prev.includes(hotelId) 
        ? prev.filter(id => id !== hotelId)
        : [...prev, hotelId]
    );
  };

  const selectAllHotels = () => {
    setSelectedHotels(
      selectedHotels.length === filteredHotels.length 
        ? [] 
        : filteredHotels.map(h => h.id)
    );
  };

  const handleGeneratePriceCode = async (productId: string, productType: 'cottage' | 'hotel' | 'vehicle', productName: string) => {
    try {
      const code = await createPriceCode(productId, productType);

      const message = `ფასის კოდი გენერირებულია:\n\n${code}\n\nკოდი მოქმედებს 12 საათის განმავლობაში და შეიძლება გამოყენებულ იქნეს მხოლოდ ერთხელ.\n\nპროდუქტი: ${productName}`;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        alert(message + '\n\n✅ კოდი კოპირებულია!');
      } else {
        alert(message);
      }
    } catch (error) {
      console.error('Error generating price code:', error);
      alert('კოდის გენერაციისას მოხდა შეცდომა');
    }
  };

  const renderQuickActions = (hotel: Hotel) => (
    <div className="flex gap-1">
      {/* View Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          try {
            navigate(`/hotel/${hotel.id}`);
          } catch (error) {
            console.error('Error navigating to hotel view:', error);
            alert('შეცდომა სასტუმროს გვერდზე გადასვლისას');
          }
        }}
        className="relative btn-tooltip p-2 text-brown-600 dark:text-brown-400 hover:bg-brown-50 dark:hover:bg-brown-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="ნახვა"
      >
        <Eye className="w-4 h-4" />
      </motion.button>

      {/* Edit Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          try {
            if (canEditResource(hotel.ownerId)) {
              navigate(`/admin/hotels/${hotel.id}`);
            } else {
              alert('თქვენ არ გაქვთ ამ სასტუმროს რედაქტირების უფლება');
            }
          } catch (error) {
            console.error('Error navigating to hotel edit:', error);
            alert('შეცდომა სასტუმროს რედაქტირების გვერდზე გადასვლისას');
          }
        }}
        className="relative btn-tooltip p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="რედაქტირება"
      >
        <Edit2 className="w-4 h-4" />
      </motion.button>

      {/* Photos Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          try {
            navigate(`/admin/hotels/${hotel.id}?tab=images`);
          } catch (error) {
            console.error('Error navigating to hotel photos:', error);
            alert('შეცდომა ფოტოების მართვის გვერდზე გადასვლისას');
          }
        }}
        className="relative btn-tooltip p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="ფოტოები"
      >
        <ImageIcon className="w-4 h-4" />
      </motion.button>

      {/* Analytics Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          alert(`${hotel.name} - სტატისტიკის მოდული ჯერ არ არის მზად. ინახება განვითარების ქვეშ.`);
        }}
        className="relative btn-tooltip p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="სტატისტიკა"
      >
        <BarChart3 className="w-4 h-4" />
      </motion.button>

      {/* Price Code Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          handleGeneratePriceCode(hotel.id, 'hotel', hotel.name);
        }}
        className="relative btn-tooltip p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="ფასის კოდი"
      >
        <DollarSign className="w-4 h-4" />
      </motion.button>

      {/* Toggle Status Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={async (e) => {
          e.stopPropagation();
          const currentStatus = hotel.isActive !== false;
          try {
            if (canEditResource(hotel.ownerId)) {
              await toggleHotelStatus(hotel.id, currentStatus);
              alert(`სასტუმრო "${hotel.name}" ${currentStatus ? 'გამოირთო' : 'ჩაირთო'}`);
            } else {
              alert('თქვენ არ გაქვთ ამ სასტუმროს სტატუსის შეცვლის უფლება');
            }
          } catch (error) {
            console.error('Error toggling hotel status:', error);
            alert('შეცდომა სასტუმროს სტატუსის შეცვლისას');
          }
        }}
        className={`relative btn-tooltip p-2 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm ${
          hotel.isActive !== false
            ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
        }`}
        title={hotel.isActive !== false ? 'გათიშვა' : 'გააქტიურება'}
      >
        {hotel.isActive !== false ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
      </motion.button>

      {/* Delete Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          try {
            if (canDeleteResource(hotel.ownerId)) {
              if (window.confirm(`დარწმუნებული ხართ რომ გსურთ "${hotel.name}" სასტუმროს წაშლა?\n\nეს მოქმედება უკვე ვერ გაუქმდება!`)) {
                handleDelete(hotel.id);
              }
            } else {
              alert('თქვენ არ გაქვთ ამ სასტუმროს წაშლის უფლება');
            }
          } catch (error) {
            console.error('Error deleting hotel:', error);
            alert('შეცდომა სასტუმროს წაშლისას');
          }
        }}
        className="relative btn-tooltip p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="წაშლა"
      >
        <Trash2 className="w-4 h-4" />
      </motion.button>
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-brown-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">სასტუმროების ჩატვირთვა...</p>
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
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  სასტუმროების მართვა
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">მართეთ თქვენი სასტუმროები ერთ ადგილას</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/admin/hotels/new')}
                  className={`text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი სასტუმრო
                </motion.button>
              </div>
            </div>
          </div>

          {/* Notifications Panel */}
          <AnimatePresence>
            {showNotifications && notifications.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-orange-200 dark:border-orange-800"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <AlertTriangle className="w-6 h-6 text-orange-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        სისტემის შეტყობინებები ({notifications.length})
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    {notifications.slice(0, 5).map(notification => (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          notification.type === 'error' 
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-500' 
                            : notification.type === 'warning'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                        }`}
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
                      </div>
                    ))}
                  </div>

                  {notifications.length > 5 && (
                    <div className="mt-3 text-center">
                      <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        ყველას ნახვა ({notifications.length - 5} დამატებითი)
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-slate-800 dark:to-rose-900/20 rounded-2xl p-6 shadow-lg border border-rose-200/50 dark:border-rose-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-rose-200/50 dark:hover:shadow-rose-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">სულ სასტუმროები</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">{stats.totalHotels}</p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <Building2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
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
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats.activeHotels}</p>
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
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">ოთახების ტიპები</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{stats.totalRooms}</p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <Home className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">საშ. ფასი</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">₾{stats.averagePrice}</p>
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
                  placeholder="ძებნა სასტუმროს სახელით ან ლოკაციით..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა სტატუსი</option>
                  <option value="active">აქტიური</option>
                  <option value="inactive">არააქტიური</option>
                </select>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="updated-desc">უახლესი</option>
                  <option value="updated-asc">უძველესი</option>
                  <option value="name-asc">სახელი (ა-ჰ)</option>
                  <option value="name-desc">სახელი (ჰ-ა)</option>
                  <option value="price-asc">ფასი (იაფი)</option>
                  <option value="price-desc">ფასი (ძვირი)</option>
                  <option value="activity-desc">უახლესი აქტივობა</option>
                  <option value="popularity-desc">ყველაზე პოპულარული</option>
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

            {/* Bulk Actions */}
            <AnimatePresence>
              {selectedHotels.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-brown-50 dark:bg-brown-900/20 rounded-xl border border-brown-200 dark:border-brown-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-brown-800 dark:text-brown-200 font-medium">
                      {selectedHotels.length} სასტუმრო არჩეულია
                    </p>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBulkAction('activate')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        გააქტიურება
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBulkAction('deactivate')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                      >
                        გათიშვა
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBulkAction('delete')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        წაშლა
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Select All */}
            {filteredHotels.length > 0 && (
              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedHotels.length === filteredHotels.length}
                  onChange={selectAllHotels}
                  className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 mr-2"
                />
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  ყველას არჩევა ({filteredHotels.length})
                </label>
              </div>
            )}
          </div>

          {/* Hotels Grid/List */}
          {filteredHotels.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <Building2 className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">სასტუმროები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">სცადეთ სხვა საძიებო კრიტერიუმები ან დაამატეთ ახალი სასტუმრო</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/admin/hotels/new')}
                  className={`text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი სასტუმროს დამატება
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start"
              : "space-y-4"
            }>
              <AnimatePresence>
                {filteredHotels.map((hotel, index) => (
                  <motion.div
                    key={hotel.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 group ${
                      viewMode === 'list' ? 'flex' : ''
                    } relative`}
                  >
                    {/* Header Section with Title and Status - Always visible */}
                    <div className="absolute top-3 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-20">
                      <div className="flex items-start justify-between">
                        {/* Left side - Checkbox and Title */}
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedHotels.includes(hotel.id)}
                            onChange={() => toggleHotelSelection(hotel.id)}
                            className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 
                              className="text-lg font-bold text-white drop-shadow-lg truncate mb-1 opacity-100 transition-opacity duration-300"
                              title={hotel.name}
                              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                            >
                              {hotel.name}
                            </h3>
                          </div>
                        </div>

                        {/* Right side - Status Only */}
                        <div className="flex items-start space-x-2">
                          {hotel.roomTypes && hotel.roomTypes.length > 0 ? (
                            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 min-w-[85px]">
                              <CheckCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="whitespace-nowrap">აქტიური</span>
                            </span>
                          ) : (
                            <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 min-w-[100px]">
                              <XCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="whitespace-nowrap">არააქტიური</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Image */}
                    <div className={`relative ${viewMode === 'grid' ? 'aspect-[4/3]' : 'w-48 h-32'} overflow-hidden`}>
                      {hotel.images && hotel.images.length > 0 ? (
                        <img
                          src={hotel.images[hotel.mainImageIndex || 0]}
                          alt={hotel.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}

                      {/* Bottom Icon Menu - Show on entire card hover */}
                      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-black/70 backdrop-blur-sm rounded-xl p-2 border border-white/20 shadow-xl">
                          {renderQuickActions(hotel)}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      <div className="flex items-center text-gray-600 dark:text-gray-400 mb-3">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="text-sm">{hotel.location}</span>
                      </div>

                      <div className="flex flex-wrap gap-3 mb-4">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <Building2 className="w-4 h-4 mr-1" />
                          <span className="text-sm">{hotel.roomTypes?.length || 0} ოთახის ტიპი</span>
                        </div>

                        {hotel.amenities?.wifi && (
                          <div className="flex items-center text-blue-600 dark:text-blue-400" title="WiFi">
                            <span className="text-sm">📶</span>
                          </div>
                        )}

                        {hotel.amenities?.parking && (
                          <div className="flex items-center text-green-600 dark:text-green-400" title="პარკინგი">
                            <span className="text-sm">🚗</span>
                          </div>
                        )}

                        {hotel.amenities?.restaurant && (
                          <div className="flex items-center text-purple-600 dark:text-purple-400" title="რესტორანი">
                            <span className="text-sm">🍽️</span>
                          </div>
                        )}
                      </div>

                      {hotel.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed mb-4">{hotel.description}</p>
                      )}

                      {/* Bottom Info */}
                      <div className="mt-4 space-y-3">
                        {/* Average Price Display */}
                        {hotel.roomTypes && hotel.roomTypes.length > 0 && (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              საშუალო ფასი
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                ₾{Math.round(hotel.roomTypes.reduce((sum, room) => sum + (room.price || 0), 0) / hotel.roomTypes.length)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                ღამეში
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Compact Metadata Footer */}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                            <span className="flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                              </svg>
                              შექმნილია {hotel.createdAt?.toDate?.()?.toLocaleDateString('ka-GE') || 'უცნობი'}
                            </span>
                            <span className="flex items-center">
                              <Building2 className="w-3 h-3 mr-1" />
                              სასტუმრო
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load More Button */}
          {filteredHotels.length > 0 && (
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
}
// Updated focus ring colors from blue to brown and the view mode button active state from blue to brown
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, where, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MapPin, 
  Users, 
  Home, 
  Star,
  Eye,
  Clock,
  Bed,
  Bath,
  Wifi,
  Car,
  Coffee,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  ImageIcon,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Building,
  Copy,
  MoreHorizontal,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  Settings,
  Info,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Activity,
  Zap,
  Shield,
  Target,
  Globe,
  Phone,
  Mail,
  Link,
  ExternalLink,
  Download,
  Upload,
  FileText,
  Database,
  CloudUpload,
  HardDrive,
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  Archive,
  Layers,
  Package,
  Tag,
  Flag,
  Compass,
  Navigation,
  Route,
  Truck,
  Plane,
  Ship,
  Train,
  Bike,
  Footprints,
  Mountain,
  Trees,
  Waves,
  Sunrise,
  Sunset,
  CloudRain,
  CloudSnow,
  Wind,
  Thermometer,
  Umbrella,
  Snowflake,
  Droplets,
  Flame,
  Lightbulb,
  Battery,
  Cpu,
  HardDisk,
  MemoryStick,
  Printer,
  Scanner,
  Keyboard,
  Mouse,
  Headphones,
  Mic,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Stop,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Music,
  Video,
  Camera,
  Image,
  Film,
  Tv,
  Radio,
  Gamepad2,
  Joystick,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Spade,
  Heart,
  Diamond,
  Club,
  Crown,
  Gift,
  Award,
  Medal,
  Trophy,
  Ribbon,
  Gem,
  Coins,
  Banknote,
  Wallet,
  PiggyBank,
  TrendingUp as TrendUp,
  TrendingDown as TrendDown,
  BarChart,
  LineChart,
  PieChart as Pie,
  Percent,
  Hash,
  AtSign,
  Ampersand,
  Asterisk,
  Minus,
  Plus as PlusIcon,
  Equal,
  Slash,
  Backslash,
  Pipe,
  Tilde,
  Underscore,
  Quote,
  Apostrophe,
  Semicolon,
  Colon,
  Comma,
  Period,
  QuestionMark,
  ExclamationMark,
  ParenthesesOpen,
  ParenthesesClose,
  BracketsOpen,
  BracketsClose,
  BracesOpen,
  BracesClose,
  AngleBracketsOpen,
  AngleBracketsClose,
  CreditCard,
  Power,
  PowerOff
} from 'lucide-react';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/useTheme';
import { getActivePrice, getPriceLabel, formatPrice } from './types/seasonalPricing';

interface Booking {
  id: string;
  cottageId: string;
  cottageName: string;
  customerName: string;
  startDate: any;
  endDate: any;
  status: 'confirmed' | 'pending' | 'cancelled';
  totalPrice: number;
  guests: number;
  cottage?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdAt: any;
  updatedAt: any;
}

interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  averagePrice: number;
}

interface Notification {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  bookingId: string;
}

export default function Javshnissia() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, canEditResource } = usePermissions();
  const { isDarkMode } = useTheme();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');
  const [sortBy, setSortBy] = useState<'created' | 'startDate' | 'price' | 'status'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [stats, setStats] = useState<BookingStats>({
    totalBookings: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    averagePrice: 0
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterAndSortBookings();
    generateNotifications();
  }, [bookings, searchTerm, filterStatus, sortBy, sortOrder]);

  const fetchBookings = async () => {
    try {
      setLoading(true);

      let bookingsQuery;
      if (isSuperAdmin) {
        // For super admin, get all bookings without complex ordering
        bookingsQuery = query(collection(db, 'bookings'));
      } else {
        // For provider admin, filter by user ID without ordering to avoid index issues
        bookingsQuery = query(
          collection(db, 'bookings'),
          where('providerId', '==', user?.uid || '')
        );
      }

      const bookingsSnapshot = await getDocs(bookingsQuery);
      let bookingsData = bookingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
        };
      }) as Booking[];

      // Sort in memory by createdAt descending
      bookingsData = bookingsData.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      setBookings(bookingsData);

      // Calculate stats
      const totalBookings = bookingsData.length;
      const confirmedBookings = bookingsData.filter(b => b.status === 'confirmed').length;
      const totalRevenue = bookingsData.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const averagePrice = totalBookings > 0 ? totalRevenue / totalBookings : 0;

      setStats({
        totalBookings,
        confirmedBookings,
        totalRevenue: Math.round(totalRevenue),
        averagePrice: Math.round(averagePrice)
      });

    } catch (error) {
      console.error('Error fetching bookings:', error);
      // Show user-friendly error without trying to log to Firebase
      alert('ჯავშნების ჩატვირთვისას მოხდა შეცდომა. გთხოვთ განაახლოთ გვერდი.');
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = () => {
    const newNotifications: Notification[] = [];

    bookings.forEach(booking => {
      // Check for pending bookings older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (booking.status === 'pending' && booking.createdAt < oneDayAgo) {
        newNotifications.push({
          id: `pending-${booking.id}`,
          type: 'warning',
          message: `${booking.cottageName || 'ჯავშანი'} - 24 საათზე მეტია მოლოდინშია`,
          bookingId: booking.id
        });
      }

      // Check for bookings starting soon
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      if (booking.status === 'confirmed' && booking.startDate <= threeDaysFromNow && booking.startDate >= new Date()) {
        newNotifications.push({
          id: `upcoming-${booking.id}`,
          type: 'info',
          message: `${booking.cottageName || 'ჯავშანი'} - მალე იწყება (${booking.startDate.toLocaleDateString('ka-GE')})`,
          bookingId: booking.id
        });
      }
    });

    setNotifications(newNotifications);
  };

  const filterAndSortBookings = () => {
    let filtered = bookings.filter(booking => {
      const matchesSearch = (booking.cottageName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (booking.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (booking.customerEmail || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;

      return matchesSearch && matchesStatus;
    });

    // Sort bookings
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'created':
          compareValue = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
          break;
        case 'startDate':
          compareValue = (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0);
          break;
        case 'price':
          compareValue = (a.totalPrice || 0) - (b.totalPrice || 0);
          break;
        case 'status':
          compareValue = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    setFilteredBookings(filtered);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('დარწმუნებული ხართ რომ გსურთ ამ ჯავშნის წაშლა?')) {
      try {
        await deleteDoc(doc(db, 'bookings', id));
        setBookings(bookings.filter(booking => booking.id !== id));
        console.log('✅ Booking deleted successfully:', id);
      } catch (error) {
        console.error('❌ Error deleting booking:', error);
        alert('შეცდომა ჯავშნის წაშლისას');
      }
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'pending' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: newStatus,
        updatedAt: new Date()
      });

      setBookings(prev => prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: newStatus }
          : booking
      ));
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
  };

  const handleBulkAction = async (action: 'delete' | 'confirm' | 'cancel') => {
    if (selectedBookings.length === 0) return;

    try {
      if (action === 'delete') {
        if (window.confirm(`დარწმუნებული ხართ რომ გსურთ ${selectedBookings.length} ჯავშნის წაშლა?`)) {
          for (const bookingId of selectedBookings) {
            await deleteDoc(doc(db, 'bookings', bookingId));
          }
          setBookings(prev => prev.filter(booking => !selectedBookings.includes(booking.id)));
        }
      } else {
        const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
        for (const bookingId of selectedBookings) {
          await updateDoc(doc(db, 'bookings', bookingId), {
            status: newStatus,
            updatedAt: new Date()
          });
        }
        setBookings(prev => prev.map(booking => 
          selectedBookings.includes(booking.id)
            ? { ...booking, status: newStatus }
            : booking
        ));
      }

      setSelectedBookings([]);
    } catch (error) {
      console.error('❌ Bulk action error:', error);
      alert('მოქმედების შესრულებისას მოხდა შეცდომა');
    }
  };

  const toggleBookingSelection = (bookingId: string) => {
    setSelectedBookings(prev => 
      prev.includes(bookingId) 
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const selectAllBookings = () => {
    setSelectedBookings(
      selectedBookings.length === filteredBookings.length 
        ? [] 
        : filteredBookings.map(b => b.id)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-800 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'pending':
        return <Clock className="w-3 h-3 mr-1" />;
      case 'cancelled':
        return <XCircle className="w-3 h-3 mr-1" />;
      default:
        return <AlertCircle className="w-3 h-3 mr-1" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'დადასტურებული';
      case 'pending':
        return 'მოლოდინში';
      case 'cancelled':
        return 'გაუქმებული';
      default:
        return 'უცნობი';
    }
  };

  const renderQuickActions = (booking: Booking) => (
    <div className="flex gap-1">
      {/* View Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          // Navigate to booking details or cottage page
          if (booking.cottage) {
            navigate(`/cottage/${booking.cottage}`);
          }
        }}
        className="relative btn-tooltip p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
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
          // Navigate to booking edit page or modal
          alert('ჯავშნის რედაქტირების ფუნქცია მალე დაემატება');
        }}
        className="relative btn-tooltip p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 dark:hover:bg-opacity-20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
        title="რედაქტირება"
      >
        <Edit className="w-4 h-4" />
      </motion.button>

      {/* Status Toggle Buttons */}
      {booking.status === 'pending' && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={async (e) => {
            e.stopPropagation();
            await updateBookingStatus(booking.id, 'confirmed');
          }}
          className="relative btn-tooltip p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 dark:hover:bg-opacity-20 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm"
          title="დადასტურება"
        >
          <CheckCircle className="w-4 h-4" />
        </motion.button>
      )}

      {booking.status !== 'cancelled' && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={async (e) => {
            e.stopPropagation();
            if (window.confirm('დარწმუნებული ხართ რომ გსურთ ჯავშნის გაუქმება?')) {
              await updateBookingStatus(booking.id, 'cancelled');
            }
          }}
          className="relative btn-tooltip p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm"
          title="გაუქმება"
        >
          <XCircle className="w-4 h-4" />
        </motion.button>
      )}

      {/* Delete Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          if (canEditResource(booking.providerId || '')) {
            handleDelete(booking.id);
          } else {
            alert('თქვენ არ გაქვთ ამ ჯავშნის წაშლის უფლება');
          }
        }}
        className="relative btn-tooltip p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm"
        title="წაშლა"
      >
        <Trash2 className="w-4 h-4" />
      </motion.button>
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  ჯავშნების მართვა
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">მართეთ თქვენი ობიექტის ჯავშნები</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/admin/cottages')}
                  className={`text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი ჯავშანი
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
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">სულ ჯავშნები</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">{stats.totalBookings}</p>
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
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">დადასტურებული</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats.confirmedBookings}</p>
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
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">მოლოდინში</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{stats.pendingBookings}</p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">მთლიანი შემოსავალი</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">₾{stats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col gap-4">

              {/* Search */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ძებნა ჯავშნის, კოტეჯის ან კლიენტის სახელით..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filters Row */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">

                {/* Left side filters */}
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-0 flex-shrink-0"
                  >
                    <option value="all">ყველა სტატუსი</option>
                    <option value="confirmed">დადასტურებული</option>
                    <option value="pending">მოლოდინში</option>
                    <option value="cancelled">გაუქმებული</option>
                  </select>

                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
const [field, order] = e.target.value.split('-');
                      setSortBy(field as any);
                      setSortOrder(order as any);
                    }}
                    className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-0 flex-shrink-0"
                  >
                    <option value="created-desc">უახლესი</option>
                    <option value="created-asc">უძველესი</option>
                    <option value="startDate-asc">თარიღი (ახლო)</option>
                    <option value="startDate-desc">თარიღი (შორს)</option>
                    <option value="price-desc">ფასი (ძვირი)</option>
                    <option value="price-asc">ფასი (იაფი)</option>
                  </select>
                </div>

                {/* Right side view toggle - fixed position */}
                <div className="flex-shrink-0">
                  <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-3 flex items-center justify-center ${viewMode === 'grid' ? 'bg-brown-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'} transition-colors`}
                      title="ბადის ხედი"
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
                      className={`px-4 py-3 flex items-center justify-center ${viewMode === 'list' ? 'bg-brown-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'} transition-colors`}
                      title="სიის ხედი"
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

            {/* Bulk Actions */}
            <AnimatePresence>
              {selectedBookings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-brown-50 dark:bg-brown-900/20 rounded-xl border border-brown-200 dark:border-brown-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-brown-800 dark:text-brown-200 font-medium">
                      {selectedBookings.length} ჯავშანი არჩეულია
                    </p>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBulkAction('confirm')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        დადასტურება
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBulkAction('cancel')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                      >
                        გაუქმება
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
            {filteredBookings.length > 0 && (
              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedBookings.length === filteredBookings.length}
                  onChange={selectAllBookings}
                  className="w-4 h-4 text-brown-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-brown-500 mr-2"
                />
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  ყველას არჩევა ({filteredBookings.length})
                </label>
              </div>
            )}
          </div>

          {/* Bookings Grid/List */}
          {filteredBookings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <Calendar className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ჯავშნები არ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">სცადეთ სხვა საძიებო კრიტერიუმები</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/admin/cottages')}
                  className={`text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი ჯავშნის დამატება
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start"
              : "space-y-4"
            }>
              <AnimatePresence>
                {filteredBookings.map((booking, index) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 group ${
                      viewMode === 'list' ? 'flex' : ''
                    } relative`}
                  >
                    {/* Content */}
                    <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedBookings.includes(booking.id)}
                            onChange={() => toggleBookingSelection(booking.id)}
                            className="w-5 h-5 text-brown-600 bg-white border-2 border-gray-300 rounded focus:ring-brown-500 mt-1"
                          />
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                              {booking.cottageName || 'კოტეჯი'}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {booking.customerName || 'უცნობი კლიენტი'}
                            </p>
                          </div>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          {getStatusText(booking.status)}
                        </span>
                      </div>

                      {/* Booking Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="text-sm">
                            {booking.startDate.toLocaleDateString('ka-GE')} - {booking.endDate.toLocaleDateString('ka-GE')}
                          </span>
                        </div>

                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4 mr-2" />
                          <span className="text-sm">{booking.guests || 1} სტუმარი</span>
                        </div>

                        <div className="flex items-center text-brown-600 dark:text-brown-400">
                          <DollarSign className="w-4 h-4 mr-2" />
                          <span className="text-sm font-medium">₾{booking.totalPrice || 0}</span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      {(booking.customerEmail || booking.customerPhone) && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mb-4">
                          {booking.customerEmail && (
                            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mb-1">
                              <Mail className="w-3 h-3 mr-2" />
                              {booking.customerEmail}
                            </div>
                          )}
                          {booking.customerPhone && (
                            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
                              <Phone className="w-3 h-3 mr-2" />
                              {booking.customerPhone}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-black/10 dark:bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/20 shadow-lg">
                          {renderQuickActions(booking)}
                        </div>
                      </div>

                      {/* Metadata Footer */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            შექმნილია {booking.createdAt?.toLocaleDateString?.('ka-GE') || 'უცნობი'}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            ID: {booking.id.slice(-8)}
                          </span>
                        </div>
                      </div>

                      </div>
                  </motion.div>
                ))}
              </AnimatePresence>
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
}
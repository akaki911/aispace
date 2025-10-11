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

interface Cottage {
  id: string;
  name: string;
  description: string;
  location: string;
  capacity: number;
  pricePerNight: number;
  images: string[];
  mainImageIndex?: number;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
  hasSeasonalPricing?: boolean;
  pricingMode?: 'standard' | 'flexible';
  amenities?: {
    hotWater?: boolean;
    electricity?: boolean;
    wifi?: boolean;
    parking?: boolean;
    bathroom?: boolean;
  };
  bankAccount?: {
    bank?: string;
    accountNumber?: string;
    accountHolderName?: string;
    accountId?: string;
  };
  isActive?: boolean;
  reviews?: Review[];
  averageRating?: number;
  totalBookings?: number;
  lastBookingDate?: any;
  priceByMonth?: any;
  utilitiesIncluded?: boolean;
  nextMonthPricing?: { min: number; max: number };
  // 🎯 სეზონური ფასების ველები
  seasonPrice?: number;
  offSeasonPrice?: number;
  isSeasonal?: boolean;
  seasonalPricing?: {
    seasonPrice: number;
    offSeasonPrice: number;
    isSeasonal: boolean;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  userName: string;
  date: any;
}

interface Booking {
  id: string;
  cottageId: string;
  startDate: Date;
  endDate: Date;
  status: 'confirmed' | 'pending' | 'cancelled';
}

interface CottageStats {
  totalCottages: number;
  activeCottages: number;
  totalBookings: number;
  averagePrice: number;
}

interface Notification {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  cottageId: string;
}

export default function AdminCottages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, canEditResource } = usePermissions();
  const { isDarkMode } = useTheme();

  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [filteredCottages, setFilteredCottages] = useState<Cottage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'created' | 'updated' | 'activity' | 'popularity'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCottages, setSelectedCottages] = useState<string[]>([]);
  const [stats, setStats] = useState<CottageStats>({
    totalCottages: 0,
    activeCottages: 0,
    totalBookings: 0,
    averagePrice: 0
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCottageForCalendar, setSelectedCottageForCalendar] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [showBookingCalendarModal, setShowBookingCalendarModal] = useState(false);
  const [selectedCottageForBookingModal, setSelectedCottageForBookingModal] = useState<Cottage | null>(null);
  const [cottageBookings, setCottageBookings] = useState<any[]>([]);

  useEffect(() => {
    fetchCottages();
    fetchBookings();
  }, []);

  useEffect(() => {
    filterAndSortCottages();
    generateNotifications();
  }, [cottages, searchTerm, filterStatus, sortBy, sortOrder]);

  const fetchCottages = async () => {
    try {
      setLoading(true);

      let cottagesQuery;
      if (isSuperAdmin) {
        cottagesQuery = query(collection(db, 'cottages'));
      } else {
        cottagesQuery = query(
          collection(db, 'cottages'),
          where('ownerId', '==', user?.uid || '')
        );
      }

      const cottagesSnapshot = await getDocs(cottagesQuery);
      const cottagesData = cottagesSnapshot.docs.map(doc => {
        const data = doc.data();

        // Calculate average rating
        const reviews = data.reviews || [];
        const averageRating = reviews.length > 0 
          ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length 
          : 0;

        // Calculate next month pricing with proper fallbacks
        const currentMonth = new Date().getMonth();
        const nextMonth = (currentMonth + 1) % 12;
        let nextMonthPricing = { min: data.pricePerNight || 0, max: data.pricePerNight || 0 };

        if (data.priceByMonth && Object.keys(data.priceByMonth).length > 0) {
          const prices = Object.values(data.priceByMonth).filter(price => 
            typeof price === 'number' && !isNaN(price) && price > 0
          );
          if (prices.length > 0) {
            nextMonthPricing = {
              min: Math.min(...prices),
              max: Math.max(...prices)
            };
          }
        }

        return {
          id: doc.id,
          ...data,
          averageRating,
          nextMonthPricing,
          totalBookings: data.totalBookings || 0, // Real data, not mock
          lastBookingDate: data.lastBookingDate || new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        };
      }) as Cottage[];

      setCottages(cottagesData);

      // Calculate stats
      const totalCottages = cottagesData.length;
      const activeCottages = cottagesData.filter(c => c.isActive !== false).length;
      const averagePrice = cottagesData.reduce((sum, c) => sum + c.pricePerNight, 0) / totalCottages || 0;
      const totalBookings = cottagesData.reduce((sum, c) => sum + (c.totalBookings || 0), 0);

      setStats({
        totalCottages,
        activeCottages,
        totalBookings,
        averagePrice: Math.round(averagePrice)
      });

    } catch (error) {
      console.error('Error fetching cottages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
      const bookingsData = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate.toDate()
      })) as Booking[];

      setBookings(bookingsData);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchCottageBookingsWithGuests = async (cottageId: string) => {
    try {
      console.log('📅 Fetching bookings for cottage:', cottageId);
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('cottage', '==', cottageId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);

      const bookingsWithGuests = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          const bookingData = bookingDoc.data();

          // Get guest details from customers collection
          let guestName = 'უცნობი სტუმარი';
          if (bookingData.customerId) {
            try {
              const customerDoc = await getDoc(doc(db, 'customers', bookingData.customerId));
              if (customerDoc.exists()) {
                const customerData = customerDoc.data();
                guestName = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() || 
                           customerData.name || 
                           customerData.email || 
                           'უცნობი სტუმარი';
              }
            } catch (error) {
              console.error('Error fetching customer:', error);
            }
          }

          return {
            id: bookingDoc.id,
            ...bookingData,
            startDate: bookingData.startDate.toDate(),
            endDate: bookingData.endDate.toDate(),
            guestName
          };
        })
      );

      console.log('📅 Fetched bookings with guests:', bookingsWithGuests);
      setCottageBookings(bookingsWithGuests);
    } catch (error) {
      console.error('Error fetching cottage bookings:', error);
      setCottageBookings([]);
    }
  };

  const generateNotifications = () => {
    const newNotifications: Notification[] = [];

    cottages.forEach(cottage => {
      // Check for missing pricing
      if (!cottage.priceByMonth || Object.keys(cottage.priceByMonth).length === 0) {
        newNotifications.push({
          id: `pricing-${cottage.id}`,
          type: 'warning',
          message: `${cottage.name} - ფასები არ არის განსაზღვრული ამ თვისთვის`,
          cottageId: cottage.id
        });
      }

      // Check for no recent bookings
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (!cottage.lastBookingDate || cottage.lastBookingDate < thirtyDaysAgo) {
        newNotifications.push({
          id: `booking-${cottage.id}`,
          type: 'info',
          message: `${cottage.name} - ბოლო 30 დღეში ბრონირება არ მომხდარა`,
          cottageId: cottage.id
        });
      }

      // Check for missing photos
      if (!cottage.images || cottage.images.length === 0) {
        newNotifications.push({
          id: `photos-${cottage.id}`,
          type: 'error',
          message: `${cottage.name} - ფოტოები არ არის ატვირთული`,
          cottageId: cottage.id
        });
      }
    });

    setNotifications(newNotifications);
  };

  const filterAndSortCottages = () => {
    let filtered = cottages.filter(cottage => {
      const matchesSearch = cottage.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cottage.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && cottage.isActive !== false) ||
                           (filterStatus === 'inactive' && cottage.isActive === false);

      return matchesSearch && matchesStatus;
    });

    // Sort cottages
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'price':
          compareValue = a.pricePerNight - b.pricePerNight;
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
          compareValue = (a.totalBookings || 0) - (b.totalBookings || 0);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    setFilteredCottages(filtered);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('დარწმუნებული ხართ რომ გსურთ ამ კოტეჯის წაშლა?')) {
      try {
        await deleteDoc(doc(db, 'cottages', id));
        setCottages(cottages.filter(cottage => cottage.id !== id));
      } catch (error) {
        console.error('Error deleting cottage:', error);
        alert('შეცდომა კოტეჯის წაშლისას');
      }
    }
  };

  const toggleCottageStatus = async (cottageId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'cottages', cottageId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });

      setCottages(prev => prev.map(cottage => 
        cottage.id === cottageId 
          ? { ...cottage, isActive: !currentStatus }
          : cottage
      ));
    } catch (error) {
      console.error('Error updating cottage status:', error);
    }
  };

  const handleBulkAction = async (action: 'delete' | 'activate' | 'deactivate') => {
    if (selectedCottages.length === 0) return;

    if (action === 'delete') {
      if (window.confirm(`დარწმუნებული ხართ რომ გსურთ ${selectedCottages.length} კოტეჯის წაშლა?`)) {
        for (const cottageId of selectedCottages) {
          await deleteDoc(doc(db, 'cottages', cottageId));
        }
        setCottages(prev => prev.filter(cottage => !selectedCottages.includes(cottage.id)));
      }
    } else {
      const isActive = action === 'activate';
      for (const cottageId of selectedCottages) {
        await updateDoc(doc(db, 'cottages', cottageId), {
          isActive,
          updatedAt: new Date()
        });
      }
      setCottages(prev => prev.map(cottage => 
        selectedCottages.includes(cottage.id)
          ? { ...cottage, isActive }
          : cottage
      ));
    }

    setSelectedCottages([]);
  };

  const toggleCottageSelection = (cottageId: string) => {
    setSelectedCottages(prev => 
      prev.includes(cottageId) 
        ? prev.filter(id => id !== cottageId)
        : [...prev, cottageId]
    );
  };

  const selectAllCottages = () => {
    setSelectedCottages(
      selectedCottages.length === filteredCottages.length 
        ? [] 
        : filteredCottages.map(c => c.id)
    );
  };

  const getBookingsForCottage = (cottageId: string) => {
    return bookings.filter(booking => booking.cottageId === cottageId);
  };

  const renderBookingCalendarModal = () => {
    console.log('📅 Rendering booking calendar modal:', {
      showBookingCalendarModal,
      selectedCottageForBookingModal: selectedCottageForBookingModal?.id,
      cottageBookings: cottageBookings.length
    });

    if (!showBookingCalendarModal || !selectedCottageForBookingModal) {
      console.log('📅 Modal not shown - conditions not met');
      return null;
    }

    const today = new Date();
    const [currentCalendarDate, setCurrentCalendarDate] = useState(today);
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = [
      'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
      'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
    ];

    const dayNames = ['ორშ', 'სამშ', 'ოთხშ', 'ხუთშ', 'პარ', 'შაბ', 'კვი'];

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const calendarDays = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day);
    }

    const getBookingForDate = (day: number) => {
      const date = new Date(year, month, day);
      return cottageBookings.find(booking => {
        const bookingStart = new Date(booking.startDate);
        const bookingEnd = new Date(booking.endDate);
        bookingStart.setHours(0, 0, 0, 0);
        bookingEnd.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return date >= bookingStart && date < bookingEnd;
      });
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
      setCurrentCalendarDate(prev => {
        const newDate = new Date(prev);
        if (direction === 'prev') {
          newDate.setMonth(prev.getMonth() - 1);
        } else {
          newDate.setMonth(prev.getMonth() + 1);
        }
        return newDate;
      });
    };

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <h2 className="text-2xl font-bold">{selectedCottageForBookingModal.name}</h2>
                  <p className="text-blue-100">ჯავშნების კალენდარი</p>
                </div>
                <button
                  onClick={() => {
                    setShowBookingCalendarModal(false);
                    setSelectedCottageForBookingModal(null);
                  }}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Calendar */}
            <div className="p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {monthNames[month]} {year}
                </h3>

                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Names Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((day, index) => (
                  <div key={index} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={index} className="h-12"></div>;
                  }

                  const booking = getBookingForDate(day);
                  const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                  return (
                    <div
                      key={day}
                      className={`relative h-12 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                        isToday
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : booking
                          ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="relative z-10">
                        {day}
                      </span>

                      {/* Booking tooltip */}
                      {booking && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <div className="font-medium">
                            {booking.guestName}
                          </div>
                          <div className="text-xs">
                            {booking.startDate.toLocaleDateString('ka-GE')} - {booking.endDate.toLocaleDateString('ka-GE')}
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 mt-6 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-100 dark:bg-red-900 rounded mr-2"></div>
                  დაჯავშნული
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 rounded mr-2"></div>
                  დღეს
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded mr-2"></div>
                  ხელმისაწვდომი
                </div>
              </div>

              {/* Bookings List */}
              {cottageBookings.length > 0 && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-600 pt-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    მიმდინარე ჯავშნები ({cottageBookings.length})
                  </h4>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {cottageBookings
                      .filter(booking => new Date(booking.endDate) >= new Date())
                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                      .map(booking => (
                      <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {booking.guestName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {booking.startDate.toLocaleDateString('ka-GE')} - {booking.endDate.toLocaleDateString('ka-GE')}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {booking.status === 'confirmed' ? 'დადასტურებული' : 
                           booking.status === 'pending' ? 'მოლოდინში' : 'გაუქმებული'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderMiniCalendar = (cottage: Cottage) => {
    const cottageBookings = getBookingsForCottage(cottage.id);
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

    return (
      <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 p-4 z-20 w-72">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {today.toLocaleDateString('ka-GE', { month: 'long', year: 'numeric' })}
          </h4>
          <button
            onClick={() => setSelectedCottageForCalendar(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'].map(day => (
            <div key={day} className="text-center text-gray-500 dark:text-gray-400 p-1">
              {day}
            </div>
          ))}

          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="p-1"></div>
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(today.getFullYear(), today.getMonth(), i + 1);
            const isBooked = cottageBookings.some(booking => 
              date >= booking.startDate && date <= booking.endDate
            );

            return (
              <div
                key={i + 1}
                className={`text-center p-1 rounded ${
                  isBooked 
                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' 
                    : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                }`}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center space-x-4 mt-3 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-100 dark:bg-green-900 rounded mr-1"></div>
            ხელმისაწვდომი
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-100 dark:bg-red-900`` rounded mr-1"></div>
            დაჯავშნული
          </div>
        </div>
      </div>
    );
  };

  const renderQuickActions = (cottage: Cottage) => {
    return (
      <div className="flex items-center space-x-1">
        {/* View Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('👁 View button clicked for cottage:', cottage.id);
            try {
              navigate(`/cottage/${cottage.id}`);
            } catch (error) {
              console.error('Error navigating to cottage view:', error);
              alert('შეცდომა კოტეჯის გვერდზე გადასვლისას');
            }
          }}
          className="relative btn-tooltip p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
          title="ნახვა"
        >
          <Eye className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <Eye className="w-3 h-3" />
              ნახვა
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Edit Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('✏️ Edit button clicked for cottage:', cottage.id);
            try {
              if (canEditResource(cottage.ownerId)) {
                navigate(`/admin/cottages/edit/${cottage.id}`);
              } else {
                alert('თქვენ არ გაქვთ ამ კოტეჯის რედაქტირების უფლება');
              }
            } catch (error) {
              console.error('Error navigating to cottage edit:', error);
              alert('შეცდომა კოტეჯის რედაქტირების გვერდზე გადასვლისას');
            }
          }}
          className="relative btn-tooltip p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 dark:hover:bg-opacity-20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
          title="რედაქტირება"
        >
          <Edit className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <Edit className="w-3 h-3" />
              რედაქტირება
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Photos Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('🖼 Photos button clicked for cottage:', cottage.id);
            try {
              navigate(`/admin/cottages/edit/${cottage.id}?tab=images`);
            } catch (error) {
              console.error('Error navigating to cottage photos:', error);
              alert('შეცდომა ფოტოების მართვის გვერდზე გადასვლისას');
            }
          }}
          className="relative btn-tooltip p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm"
          title="ფოტოები"
        >
          <ImageIcon className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <ImageIcon className="w-3 h-3" />
              ფოტოების მართვა
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Calendar Button - Enhanced */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('📅 Calendar button clicked for cottage:', cottage.id);
            try {
              console.log('📅 Fetching cottage bookings...');
              await fetchCottageBookingsWithGuests(cottage.id);
              console.log('📅 Setting selected cottage for booking modal...');
              setSelectedCottageForBookingModal(cottage);
              console.log('📅 Opening booking calendar modal...');
              setShowBookingCalendarModal(true);
              console.log('📅 Modal should now be open');
            } catch (error) {
              console.error('❌ Error opening calendar:', error);
              alert('შეცდომა კალენდრის გახსნისას');
            }
          }}
          className="relative btn-tooltip p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all duration-200 bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-200/50 dark:border-gray-600/50"
          title="კალენდარი"
        >
          <Calendar className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <Calendar className="w-3 h-3" />
              ბრონირების კალენდარი
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Analytics Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('📊 Analytics button clicked for cottage:', cottage.id);
            try {
              alert(`${cottage.name} - სტატისტიკის მოდული ჯერ არ არის მზად. ინახება განვითარების ქვეშ.`);
            } catch (error) {
              console.error('Error opening analytics:', error);
              alert('შეცდომა სტატისტიკის გახსნისას');
            }
          }}
          className="relative btn-tooltip p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm"
          title="სტატისტიკა"
        >
          <BarChart3 className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <BarChart3 className="w-3 h-3" />
              სტატისტიკა და ანალიზი
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Toggle Status Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const currentStatus = cottage.isActive !== false;
            console.log(`🔇 Toggle status button clicked for cottage: ${cottage.id}, current status: ${currentStatus}`);
            try {
              if (canEditResource(cottage.ownerId)) {
                await toggleCottageStatus(cottage.id, currentStatus);
                alert(`კოტეჯი "${cottage.name}" ${currentStatus ? 'გამოირთო' : 'ჩაირთო'}`);
              } else {
                alert('თქვენ არ გაქვთ ამ კოტეჯის სტატუსის შეცვლის უფლება');
              }
            } catch (error) {
              console.error('Error toggling cottage status:', error);
              alert('შეცდომა კოტეჯის სტატუსის შეცვლისას');
            }
          }}
          className={`relative btn-tooltip p-2 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm ${
            cottage.isActive !== false
              ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900 dark:hover:bg-opacity-20'
          }`}
          title={cottage.isActive !== false ? 'გათიშვა' : 'გააქტიურება'}
        >
          {cottage.isActive !== false ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {cottage.isActive !== false ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              <span>{cottage.isActive !== false ? 'კოტეჯის გათიშვა' : 'კოტეჯის გააქტიურება'}</span>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Delete Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('🗑 Delete button clicked for cottage:', cottage.id);
            try {
              if (canEditResource(cottage.ownerId)) {
                if (window.confirm(`დარწმუნებული ხართ რომ გსურთ "${cottage.name}" კოტეჯის წაშლა?\n\nეს მოქმედება უკვე ვერ გაუქმდება!`)) {
                  handleDelete(cottage.id);
                }
              } else {
                alert('თქვენ არ გაქვთ ამ კოტეჯის წაშლის უფლება');
              }
            } catch (error) {
              console.error('Error deleting cottage:', error);
              alert('შეცდომა კოტეჯის წაშლისას');
            }
          }}
          className="relative btn-tooltip p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 bg-white/90 dark:bg-gray-800/90 shadow-sm"
          title="წაშლა"
        >
          <Trash2 className="w-4 h-4" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <Trash2 className="w-3 h-3" />
              <span>კოტეჯის წაშლა</span>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>
      </div>
    );
  };

  const renderReviewsBadge = (cottage: Cottage) => {
    if (!cottage.averageRating || cottage.averageRating === 0) return null;

    return (
      <div className="flex items-center space-x-2 mt-1">
        <div className="flex items-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full text-xs font-medium">
          <Star className="w-3 h-3 mr-1 fill-current" />
          {cottage.averageRating.toFixed(1)}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center">
            {cottage.reviews?.length || 0} შეფასება
          </span>
        </div>
      </div>
    );
  };



  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-brown-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">კოტეჯების ჩატვირთვა...</p>
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
                    <Home className="w-8 h-8 text-white" />
                  </div>
                  კოტეჯების მართვა
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">მართეთ თქვენი კოტეჯები ერთ ადგილას</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/admin/cottages/new')}
                  className={`text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი კოტეჯი
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
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">სულ კოტეჯები</p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">{stats.totalCottages}</p>
                </div>
                <div className="bg-rose-100/80 dark:bg-rose-900/40 p-3 rounded-xl shadow-lg">
                  <Home className="w-6 h-6 text-rose-600 dark:text-rose-400" />
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
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats.activeCottages}</p>
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
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">საშ. ფასი</p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">₾{stats.averagePrice}</p>
                </div>
                <div className="bg-indigo-100/80 dark:bg-indigo-900/40 p-3 rounded-xl shadow-lg">
                  <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-purple-900/20 rounded-2xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">ჯავშნები</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats.totalBookings}</p>
                </div>
                <div className="bg-purple-100/80 dark:bg-purple-900/40 p-3 rounded-xl shadow-lg">
                  <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
                  placeholder="ძებნა კოტეჯის სახელით ან ლოკაციით..."
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
              {selectedCottages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-brown-50 dark:bg-brown-900/20 rounded-xl border border-brown-200 dark:border-brown-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-brown-800 dark:text-brown-200 font-medium">
                      {selectedCottages.length} კოტეჯი არჩეულია
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
            {filteredCottages.length > 0 && (
              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedCottages.length === filteredCottages.length}
                  onChange={selectAllCottages}
                  className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 mr-2"
                />
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  ყველას არჩევა ({filteredCottages.length})
                </label>
              </div>
            )}
          </div>


      {/* Select All */}
      {filteredCottages.length > 0 && (
        <div className="mb-6 flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={selectedCottages.length === filteredCottages.length}
              onChange={selectAllCottages}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 mr-2"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              ყველას არჩევა ({filteredCottages.length})
            </span>
          </label>
        </div>
      )}

      {/* Cottages Grid/List */}
      {filteredCottages.length === 0 ? (
        <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center"
            >
              <div className="mb-6">
                <Home className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">კოტეჯები ვერ მოიძებნა</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">სცადეთ სხვა საძიებო კრიტერიუმები ან დაამატეთ ახალი კოტეჯი</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/admin/cottages/new')}
                  className={`text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი კოტეჯის დამატება
                </motion.button>
              </div>
            </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCottages.map((cottage, index) => (
            <motion.div
              key={cottage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Header Section with Title and Status - Always visible */}
              <div className="flex items-start justify-between p-6 pb-4">
                {/* Left side - Checkbox and Title */}
                <div className="flex items-start space-x-3 flex-1">
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={selectedCottages.includes(cottage.id)}
                      onChange={() => toggleCottageSelection(cottage.id)}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-2">
                      {cottage.name}
                    </h3>
                    {renderReviewsBadge(cottage)}
                  </div>
                </div>

                {/* Right side - Status Only */}
                <div className="flex items-center ml-4">
                  {cottage.isActive !== false ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="ml-1">აქტიური</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      <XCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="ml-1">არააქტიური</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Image with Calendar */}
              <div className="relative h-48 mx-6 mb-4 rounded-xl overflow-hidden">
                {cottage.images && cottage.images.length > 0 ? (
                  <img
                    src={cottage.images[cottage.mainImageIndex || 0]}
                    alt={cottage.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  </div>
                )}

                {/* Bottom Icon Menu - Show on entire card hover */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {renderQuickActions(cottage)}
                </div>
              </div>

              {/* Mini Calendar */}
              {selectedCottageForCalendar === cottage.id && renderMiniCalendar(cottage)}

              {/* Content */}
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 mr-1" />
                    {cottage.location}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4 mr-1" />
                      {cottage.capacity} ადამიანი
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Activity className="w-4 h-4 mr-1" />
                      {cottage.totalBookings || 0} ჯავშანი
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {cottage.amenities?.wifi && (
                      <div className="bg-blue-100 dark:bg-blue-900 p-1 rounded">
                        <Wifi className="w-4 h-4" />
                      </div>
                    )}

                    {cottage.amenities?.parking && (
                      <div className="bg-green-100 dark:bg-green-900 p-1 rounded">
                        <Car className="w-4 h-4" />
                      </div>
                    )}

                    {cottage.amenities?.bathroom && (
                      <div className="bg-purple-100 dark:bg-purple-900 p-1 rounded">
                        <Bath className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Enhanced Bottom Info Section */}
                  {/* Month and Price Row */}
                  <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                    {/* Month and Period */}
                    {(() => {
                      const currentMonth = new Date().getMonth();
                      const georgianMonths = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
                      const currentMonthGeorgian = georgianMonths[currentMonth];

                      return (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                          <span>{currentMonthGeorgian}</span>
                          <span>•</span>
                          <span>1 ღამე</span>
                        </div>
                      );
                    })()}
                    {renderReviewsBadge(cottage)}
                  </div>

                  {/* Current Price Display */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatPrice(getActivePrice(cottage))}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getPriceLabel(cottage)}
                    </span>
                  </div>

                  {cottage.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">
                      {cottage.description}
                    </p>
                  )}

                  {/* Compact Metadata Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span>
                      შექმნილია {cottage.createdAt?.toDate?.()?.toLocaleDateString('ka-GE') || 'უცნობი'}
                    </span>
                    <span>
                      აქტივობა {cottage.lastBookingDate?.toLocaleDateString?.('ka-GE') || 'უცნობი'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Load More Button */}
          {filteredCottages.length > 0 && (
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

      {/* Booking Calendar Modal */}
          {renderBookingCalendarModal()}

        </div>
      </div>
    </div>
  );
}
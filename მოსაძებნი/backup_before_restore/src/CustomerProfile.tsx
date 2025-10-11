import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { ArrowLeft, User, Home, Calendar, Car, Hotel as HotelIcon, Star, Phone, Mail, ChevronRight, Download, Sparkles, Heart, Gift, Crown, Trophy, CheckCircle, Clock, CreditCard, RefreshCw, Zap, Palette, Camera } from 'lucide-react';
import { getBookingsByUser, getCottages, getVehicles, getHotels } from './services/bookingService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { Cottage } from './types/cottage';
import type { Vehicle } from './types/vehicle';

// ბუნებრივი ანიმაციის hooks
const useFloatingAnimation = () => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return Math.sin(offset * Math.PI / 180) * 3;
};

const useSparkleAnimation = () => {
  const [sparkles, setSparkles] = useState<Array<{id: number, x: number, y: number, size: number}>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSparkles(prev => [
        ...prev.slice(-20),
        {
          id: Date.now(),
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 4 + 2
        }
      ]);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return sparkles;
};

// User Bookings Display Component
const UserBookingsDisplay: React.FC = () => {
  const { user } = useAuth();
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    const fetchUserBookings = async () => {
      // Check if user exists and has either id or phoneNumber
      if (!user || (!user.id && !user.phoneNumber)) {
        console.log('❌ No user or user credentials found:', user);
        setLoadingBookings(false);
        return;
      }

      try {
        // Use the actual user ID from Firebase auth (could be uid or id)
        const userId = user.id || user.phoneNumber || '';
        const phoneNumber = user.phoneNumber || '';

        console.log('🔍 Fetching bookings for user:', { 
          userId, 
          phoneNumber, 
          userObject: user 
        });

        // Use the getBookingsByUser function that already exists in bookingService
        const allBookings = await getBookingsByUser(userId, phoneNumber);

        console.log('📋 Raw bookings from service:', allBookings);

        // Transform the bookings to match the UI format
        const transformedBookings = allBookings.map((booking) => ({
          id: booking.id,
          type: booking.type,
          resourceName: booking.type === 'cottage' ? booking.cottage : 
                       booking.type === 'vehicle' ? booking.vehicle : 
                       booking.type === 'hotel' ? booking.hotel : 'უცნობი',
          location: booking.type === 'cottage' ? 'ბახმარო, სასტუმროს ქუჩა' :
                   booking.type === 'vehicle' ? 'ბახმარო, მანქანის ქირაობა' :
                   booking.type === 'hotel' ? 'ბახმარო, სასტუმროს ქუჩა' : 'ბახმარო',
          startDate: new Date(booking.checkIn),
          endDate: new Date(booking.checkOut),
          totalPrice: booking.totalAmount || 0,
          depositAmount: booking.bookingAmount || 0,
          isDepositPaid: booking.bookingAmountStatus === 'გადახდილი',
          remainingAmountPaid: booking.remainingAmountStatus === 'გადახდილი',
          createdAt: new Date(booking.createdAt || Date.now())
        }));

        console.log('✅ Loaded and transformed bookings:', transformedBookings.length, transformedBookings);
        setUserBookings(transformedBookings);
      } catch (error) {
        console.error('❌ Error fetching user bookings:', error);
        setUserBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchUserBookings();
  }, [user?.id, user?.phoneNumber, user]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB').replace(/\//g, '/');
  };

  const getBookingIcon = (type: string) => {
    switch (type) {
      case 'cottage': return '🏠';
      case 'vehicle': return '🚗';
      case 'hotel': return '🏨';
      default: return '📅';
    }
  };

  const isExpired = (endDate: Date) => {
    return endDate < new Date();
  };

  const getStatusBadge = (booking: any) => {
    const expired = isExpired(booking.endDate);

    if (expired) {
      return (
        <div className="absolute top-4 right-4">
          <span className="px-3 py-1 bg-gray-500/80 text-white text-xs font-medium rounded-full flex items-center">
            📅 expired
          </span>
        </div>
      );
    }

    if (booking.remainingAmountPaid) {
      return (
        <div className="absolute top-4 right-4">
          <span className="px-3 py-1 bg-green-500/80 text-white text-xs font-medium rounded-full">
            ✅ აქტიური
          </span>
        </div>
      );
    }

    if (booking.isDepositPaid) {
      return (
        <div className="absolute top-4 right-4">
          <span className="px-3 py-1 bg-blue-500/80 text-white text-xs font-medium rounded-full">
            🟢 upcoming
          </span>
        </div>
      );
    }

    return (
      <div className="absolute top-4 right-4">
        <span className="px-3 py-1 bg-yellow-500/80 text-white text-xs font-medium rounded-full animate-pulse">
          ⏳ მუშავდება
        </span>
      </div>
    );
  };

  if (loadingBookings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center space-x-4">
          <RefreshCw className="w-8 h-8 text-white animate-spin" />
          <span className="text-white text-xl">იტვირთება...</span>
        </div>
      </div>
    );
  }

  if (userBookings.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 shadow-2xl border border-white/20 max-w-md mx-auto">
          <Calendar className="w-16 h-16 text-white/50 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-white mb-4">ჯავშნები არ არის</h3>
          <p className="text-white/70 text-lg leading-relaxed">
            თქვენ ჯერჯერობით არ გაქვთ აქტიური ჯავშნები. 
            მთავარ გვერდზე შეგიძლიათ ახალი ჯავშანი გააკეთოთ.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {userBookings.map((booking, index) => (
        <div
          key={booking.id}
          className="bg-gradient-to-br from-purple-800/30 via-purple-700/20 to-pink-800/30 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden group"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Status Badge */}
          {getStatusBadge(booking)}

          {/* Header with icon and title */}
          <div className="mb-6 pr-20">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">
                {getBookingIcon(booking.type)}
              </div>
              <div>
                <h3 className="text-white font-bold text-xl">
                  {booking.resourceName} {booking.type === 'cottage' ? 'აივნით' : ''}
                </h3>
                <p className="text-white/70 text-sm">{booking.location}</p>
              </div>
            </div>

            {/* Date range */}
            <p className="text-white/60 text-sm ml-15">
              {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
            </p>
          </div>

          {/* Financial sections in grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Total amount */}
            <div className="bg-gradient-to-br from-purple-600/40 to-purple-700/40 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-green-300 text-xs uppercase tracking-wider mb-1">ჯამური ღირებულება</p>
              <p className="text-white text-2xl font-bold">{booking.totalPrice}₾</p>
            </div>

            {/* Deposit amount */}
            <div className={`rounded-2xl p-4 backdrop-blur-sm ${
              booking.isDepositPaid 
                ? 'bg-gradient-to-br from-green-500/30 to-emerald-600/30' 
                : 'bg-gradient-to-br from-teal-500/30 to-cyan-600/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-green-300 text-xs uppercase tracking-wider">ჯავშნის თანხა</p>
                {booking.isDepositPaid && (
                  <span className="px-2 py-1 bg-green-500/60 text-white text-xs rounded-full">
                    Paid
                  </span>
                )}
              </div>
              <p className="text-green-400 text-lg font-bold">{booking.depositAmount}₾</p>
              {booking.isDepositPaid && (
                <div className="flex items-center mt-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  <span className="text-green-400 text-xs">✨ გადახდილია ✨</span>
                </div>
              )}
            </div>
          </div>

          {/* Remaining amount (only show if deposit is paid and remaining > 0) */}
          {booking.isDepositPaid && (booking.totalPrice - booking.depositAmount) > 0 && (
            <div className="mb-6">
              <div className={`rounded-2xl p-4 backdrop-blur-sm border ${
                booking.remainingAmountPaid 
                  ? 'bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-400/30' 
                  : 'bg-gradient-to-br from-pink-500/20 to-red-600/20 border-pink-400/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-300 text-xs uppercase tracking-wider mb-1">
                      ჩექინის დღეს გადასახდელი
                    </p>
                    <p className="text-orange-400 text-xl font-bold">
                      {booking.totalPrice - booking.depositAmount}₾
                    </p>
                  </div>
                  {!booking.remainingAmountPaid && (
                    <span className="px-3 py-1 bg-pink-500/60 text-white text-xs rounded-full">
                      Due on check-in
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-white/50 text-sm">ID: #{booking.id.slice(-8)}</span>
            <button className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors duration-300 group">
              <span>დეტალები</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const CustomerProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'bookings' | 'profile'>('dashboard');
  const [showSparkles, setShowSparkles] = useState(true);
    const [cancelModalData, setCancelModalData] = useState<{ isOpen: boolean; bookingId: string; bookingType: string }>({
        isOpen: false,
        bookingId: '',
        bookingType: 'cottage'
    });

  const floatingOffset = useFloatingAnimation();
  const sparkles = useSparkleAnimation();

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        console.warn('⚠️ No user found:', user);
        setLoading(false);
        return;
      }

      try {
        const userId = user.id || user.phoneNumber || '';
        const phoneNumber = user.phoneNumber || '';

        console.log('🔍 Loading profile data for user:', { 
          userId,
          phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          fullUser: user
        });

        // Load reference data first
        console.log('📖 Loading reference data...');
        const [cottagesData, vehiclesData, hotelsData] = await Promise.all([
          getCottages(),
          getVehicles(),
          getHotels()
        ]);

        console.log('📊 Reference data loaded:', {
          cottages: cottagesData.length,
          vehicles: vehiclesData.length,
          hotels: hotelsData.length
        });

        setCottages(cottagesData);
        setVehicles(vehiclesData);
        setHotels(hotelsData);

        // Load bookings
        console.log('📖 Loading user bookings...');
        const allBookings = await getBookingsByUser(userId, phoneNumber);
        console.log('📋 Bookings loaded:', {
          total: allBookings.length,
          bookings: allBookings.map(b => ({
            id: b.id,
            type: b.type,
            cottage: b.cottage,
            vehicle: b.vehicle,
            hotel: b.hotel,
            firstName: b.firstName,
            lastName: b.lastName,
            status: b.bookingStatus
          }))
        });

        setBookings(allBookings);

        // Check for cancelled bookings that need reason modal
        const cancelledBookings = allBookings.filter(booking => 
          booking.status === 'გაუქმებული' && 
          booking.cancellation?.canceledBy === 'system' &&
          (!booking.cancellation?.reason || booking.cancellation?.reason === '') &&
          !localStorage.getItem(`cancelModal_${booking.id}`)
        );

        // Show modal for first cancelled booking without reason
        if (cancelledBookings.length > 0) {
          const firstCancelled = cancelledBookings[0];
          setCancelModalData({
            isOpen: true,
            bookingId: firstCancelled.id,
            bookingType: firstCancelled.type || 'cottage'
          });
        }
      } catch (error) {
        console.error('❌ Error loading profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">იტვირთება...</div>
      </div>
    );
  }

  const getBookingDetails = (booking: any) => {
    console.log('🔍 Getting booking details for:', booking);

    if (booking.cottage || booking.type === 'cottage') {
      const cottage = cottages.find(c => c.id === booking.cottage);
      const name = cottage?.name || `კოტეჯი (${booking.cottage})` || 'უცნობი კოტეჯი';
      console.log('🏠 Cottage booking:', { cottageId: booking.cottage, name });
      return { type: 'cottage', name, icon: Home };
    } else if (booking.vehicle || booking.type === 'vehicle') {
      const vehicle = vehicles.find(v => v.id === booking.vehicle);
      const name = vehicle?.name || `ავტომობილი (${booking.vehicle})` || 'უცნობი ავტომობილი';
      console.log('🚗 Vehicle booking:', { vehicleId: booking.vehicle, name });
      return { type: 'vehicle', name, icon: Car };
    } else if (booking.hotel || booking.type === 'hotel') {
      const hotel = hotels.find(h => h.id === booking.hotel);
      const name = hotel?.name || `სასტუმრო (${booking.hotel})` || 'უცნობი სასტუმრო';
      console.log('🏨 Hotel booking:', { hotelId: booking.hotel, name });
      return { type: 'hotel', name, icon: HotelIcon };
    }

    console.log('❓ Unknown booking type:', booking);
    return { type: 'unknown', name: 'უცნობი ჯავშანი', icon: Calendar };
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ka-GE');
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'გადახდილი':
        return 'from-emerald-400 to-green-500';
      case 'pending':
      case 'მუშავდება':
        return 'from-amber-400 to-orange-500';
      case 'cancelled':
      case 'გაუქმებული':
        return 'from-red-400 to-pink-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'გადახდილი':
        return CheckCircle;
      case 'pending':
      case 'მუშავდება':
        return Clock;
      case 'cancelled':
      case 'გაუქმებული':
        return RefreshCw;
      default:
        return Calendar;
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, delay = 0 }: any) => (
    <div 
      className={`bg-gradient-to-br ${color} p-6 rounded-3xl shadow-2xl transform hover:scale-105 transition-all duration-500 animate-fade-in-up hover:rotate-1 group relative overflow-hidden`}
      style={{ 
        animationDelay: `${delay}ms`,
        transform: `translateY(${floatingOffset}px)`
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative z-10">
        <Icon className="w-10 h-10 text-white mb-4 group-hover:rotate-12 transition-transform duration-300" />
        <h3 className="text-white/90 text-sm font-medium mb-2">{title}</h3>
        <p className="text-white text-3xl font-bold group-hover:scale-110 transition-transform duration-300">{value}</p>
      </div>
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
    </div>
  );

  const BookingCard = ({ booking, index }: any) => {
    const details = getBookingDetails(booking);
    const StatusIcon = getStatusIcon(booking.bookingStatus);

    // Calculate if booking is expired
    const isExpired = () => {
      if (!booking.checkOut) return false;
      const checkoutDate = new Date(booking.checkOut);
      const now = new Date();
      return checkoutDate < now;
    };

    const getBookingStatusDisplay = () => {
      if (isExpired()) return 'expired';
      if (booking.remainingAmountStatus === 'გადახდილი') return 'completed';
      if (booking.bookingAmountStatus === 'გადახდილი') return 'active';
      return 'pending';
    };

    const currentStatus = getBookingStatusDisplay();

    return (
      <div 
        className={`bg-white/10 backdrop-blur-lg p-6 rounded-3xl shadow-2xl border border-white/20 hover:bg-white/15 transition-all duration-500 group hover:shadow-3xl hover:-translate-y-2 animate-fade-in-up relative overflow-hidden`}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        {/* Status indicator in top right */}
        <div className="absolute top-4 right-4">
          {currentStatus === 'expired' && (
            <span className="px-3 py-1 bg-gray-500/80 text-white text-xs font-medium rounded-full">
              expired
            </span>
          )}
          {currentStatus === 'completed' && (
            <span className="px-3 py-1 bg-green-500/80 text-white text-xs font-medium rounded-full">
              ✅ დასრულებული
            </span>
          )}
          {currentStatus === 'active' && (
            <span className="px-3 py-1 bg-blue-500/80 text-white text-xs font-medium rounded-full">
              🟢 აქტიური
            </span>
          )}
          {currentStatus === 'pending' && (
            <span className="px-3 py-1 bg-yellow-500/80 text-white text-xs font-medium rounded-full animate-pulse">
              ⏳ მუშავდება
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="mb-6 pr-20">
          <div className="flex items-center space-x-4 mb-3">
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${getStatusColor(booking.bookingStatus)} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <details.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-xl group-hover:text-yellow-300 transition-colors duration-300">
                {details.name}
              </h3>
              <p className="text-white/70 text-sm">
                {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
              </p>
              {booking.type === 'cottage' && booking.adults && (
                <p className="text-white/60 text-xs mt-1">
                  👥 {booking.adults} ზრდასრული{booking.children ? ` + ${booking.children} ბავშვი` : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Financial information */}
        <div className="space-y-4 mb-6">
          {/* Total amount */}
          <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm">
            <p className="text-white/70 text-xs uppercase tracking-wider mb-1">ჯამური ღირებულება</p>
            <p className="text-white text-2xl font-bold">{booking.totalAmount || 0}₾</p>
          </div>

          {/* Booking fee */}
          {booking.bookingAmount > 0 && (
            <div className={`p-4 rounded-2xl backdrop-blur-sm border ${
              booking.bookingAmountStatus === 'გადახდილი' 
                ? 'bg-green-500/20 border-green-400/30' 
                : 'bg-yellow-500/20 border-yellow-400/30'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs uppercase tracking-wider mb-1 ${
                    booking.bookingAmountStatus === 'გადახდილი' ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                    ✨ ჯავშნის თანხა ✨
                  </p>
                  <p className={`text-xl font-bold ${
                    booking.bookingAmountStatus === 'გადახდილი' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {booking.bookingAmount}₾
                  </p>
                </div>
                {booking.bookingAmountStatus === 'გადახდილი' && (
                  <div className="text-green-400">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                )}
              </div>
              {booking.bookingAmountStatus === 'გადახდილი' && (
                <div className="flex items-center mt-2">
                  <span className="text-green-400 text-sm font-medium">გადახდილია</span>
                </div>
              )}
            </div>
          )}

          {/* Remaining amount (only show if booking fee is paid) */}
          {booking.remainingAmount > 0 && booking.bookingAmountStatus === 'გადახდილი' && (
            <div className={`p-4 rounded-2xl backdrop-blur-sm border ${
              booking.remainingAmountStatus === 'გადახდილი' 
                ? 'bg-green-500/20 border-green-400/30' 
                : 'bg-orange-500/20 border-orange-400/30'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs uppercase tracking-wider mb-1 ${
                    booking.remainingAmountStatus === 'გადახდილი' ? 'text-green-300' : 'text-orange-300'
                  }`}>
                    ჩეკინის დღეს გადასახდელი
                  </p>
                  <p className={`text-xl font-bold ${
                    booking.remainingAmountStatus === 'გადახდილი' ? 'text-green-400' : 'text-orange-400'
                  }`}>
                    {booking.remainingAmount}₾
                  </p>
                  <p className="text-white/50 text-xs mt-1">Due on check-in</p>
                </div>
                {booking.remainingAmountStatus === 'გადახდილი' && (
                  <div className="text-green-400">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <span className="text-white/50 text-sm">ID: #{booking.id?.slice(-8) || 'N/A'}</span>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* ანიმირებული ფონი */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2523ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%224%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse"></div>

        {/* მოძრავი ვარსკვლავები */}
        {showSparkles && sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            className="absolute animate-ping"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
            }}
          >
            <Sparkles className="w-full h-full text-yellow-300/50" />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => window.history.back()}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors duration-300 group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
                <span>მთავარზე დაბრუნება</span>
              </button>

              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Crown className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h1 className="text-white text-xl font-bold">VIP კაბინეტი</h1>
                  <p className="text-white/70 text-sm">{user.firstName} {user.lastName}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSparkles(!showSparkles)}
                className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all duration-300 group"
              >
                <Palette className={`w-5 h-5 ${showSparkles ? 'text-yellow-400' : 'text-white/70'} group-hover:rotate-12 transition-transform duration-300`} />
              </button>

              <button
                onClick={logout}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 font-medium"
              >
                გასვლა
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="flex space-x-2 bg-white/10 backdrop-blur-lg p-2 rounded-3xl border border-white/20 shadow-2xl">
          {[
            { id: 'dashboard', icon: Trophy, label: 'მიმოხილვა' },
            { id: 'bookings', icon: Calendar, label: 'ჯავშნები' },
            { id: 'profile', icon: User, label: 'პროფილი' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 rounded-2xl transition-all duration-500 font-medium transform hover:scale-105 ${
                selectedTab === tab.id
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-2xl scale-105'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${selectedTab === tab.id ? 'animate-bounce' : ''}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center space-x-4">
              <RefreshCw className="w-8 h-8 text-white animate-spin" />
              <span className="text-white text-xl">იტვირთება...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {selectedTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                {/* Welcome Section */}
                <div className="text-center py-12">
                  <div className="inline-flex items-center space-x-3 mb-6">
                    <Heart className="w-8 h-8 text-pink-400 animate-pulse" />
                    <h2 className="text-4xl font-bold text-white">
                      კეთილი იყოს თქვენი მობრძანება!
                    </h2>
                    <Heart className="w-8 h-8 text-pink-400 animate-pulse" />
                  </div>
                  <p className="text-white/80 text-xl max-w-2xl mx-auto leading-relaxed">
                    თქვენი ექსკლუზიური კაბინეტი ბახმაროს კურორტზე - სადაც ყველა ჯავშანი და სერვისი თქვენს ხელთაა
                  </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    icon={Calendar}
                    title="ჯამური ჯავშნები"
                    value={bookings.length}
                    color="from-blue-500 to-cyan-600"
                    delay={0}
                  />
                  <StatCard
                    icon={CheckCircle}
                    title="აქტიური ჯავშნები"
                    value={bookings.filter(b => b.bookingStatus === 'active' || b.bookingStatus === 'გადახდილი').length}
                    color="from-green-500 to-emerald-600"
                    delay={100}
                  />
                  <StatCard
                    icon={Clock}
                    title="მუშავდება"
                    value={bookings.filter(b => b.bookingStatus === 'pending' || b.bookingStatus === 'მუშავდება').length}
                    color="from-orange-500 to-amber-600"
                    delay={200}
                  />
                  <StatCard
                    icon={Star}
                    title="VIP სტატუსი"
                    value="GOLD"
                    color="from-yellow-500 to-orange-600"
                    delay={300}
                  />
                </div>

                {/* Quick Actions */}
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20">
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                    <Zap className="w-6 h-6 mr-3 text-yellow-400" />
                    სწრაფი ქმედებები
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { icon: Home, label: 'ახალი კოტეჯის ჯავშანი', color: 'from-green-400 to-emerald-500' },
                      { icon: Car, label: 'ავტომობილის ჯავშანი', color: 'from-blue-400 to-cyan-500' },
                      { icon: HotelIcon, label: 'სასტუმროს ჯავშანი', color: 'from-purple-400 to-pink-500' }
                    ].map((action, index) => (
                      <button
                        key={index}
                        className={`p-6 bg-gradient-to-br ${action.color} rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group`}
                      >
                        <action.icon className="w-8 h-8 text-white mb-3 group-hover:rotate-12 transition-transform duration-300" />
                        <p className="text-white font-medium text-lg">{action.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {selectedTab === 'bookings' && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
                    <Calendar className="w-8 h-8 mr-3 text-yellow-400" />
                    ჩემი ჯავშნები
                  </h2>
                  <p className="text-white/80 text-lg">თქვენი ყველა ჯავშნის დეტალური ინფორმაცია</p>
                </div>

                <UserBookingsDisplay />
              </div>
            )}

            {/* Profile Tab */}
            {selectedTab === 'profile' && (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
                    <User className="w-8 h-8 mr-3 text-yellow-400" />
                    ჩემი პროფილი
                  </h2>
                  <p className="text-white/80 text-lg">თქვენი პირადი ინფორმაცია და პარამეტრები</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Profile Info */}
                  <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                      <User className="w-6 h-6 mr-3 text-blue-400" />
                      პირადი ინფორმაცია
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                        <span className="text-white/70">სახელი:</span>
                        <span className="text-white font-medium">{user.firstName}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                        <span className="text-white/70">გვარი:</span>
                        <span className="text-white font-medium">{user.lastName}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                        <span className="text-white/70 flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          ტელეფონი:
                        </span>
                        <span className="text-white font-medium">{user.phoneNumber}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                        <span className="text-white/70 flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          ელ-ფოსტა:
                        </span>
                        <span className="text-white font-medium">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Stats */}
                  <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                      <Trophy className="w-6 h-6 mr-3 text-yellow-400" />
                      ანგარიშის სტატისტიკა
                    </h3>
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
                          <Crown className="w-10 h-10 text-white animate-pulse" />
                        </div>
                        <h4 className="text-2xl font-bold text-yellow-400 mb-2">GOLD VIP</h4>
                        <p className="text-white/70">ექსკლუზიური მომხმარებელი</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-white/5 rounded-2xl">
                          <Calendar className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-white">{bookings.length}</p>
                          <p className="text-white/70 text-sm">ჯავშანი</p>
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded-2xl">
                          <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-white">5.0</p>
                          <p className="text-white/70 text-sm">რეიტინგი</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300 z-30 animate-bounce"
        onClick={() => setSelectedTab('bookings')}
      >
        <Camera className="w-8 h-8 text-white" />
      </button>

      {/* Footer Wave Animation */}
      <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-0">
        <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path
            d="M0,0V120H1200V0C1083.33,40 916.67,80 750,60C583.33,40 416.67,0 250,20C83.33,40 0,0 0,0Z"
            className="fill-white/5 animate-pulse"
          ></path>
        </svg>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        .animate-fade-in {
          animation: fade-in-up 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CustomerProfile;
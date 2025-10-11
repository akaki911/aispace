
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/useAuth';
import { bookingExpirationService } from '../services/bookingExpirationService';
import { Home, Car, Hotel, Calendar, ChevronRight, Clock } from 'lucide-react';

interface BookingData {
  id: string;
  type: 'cottage' | 'vehicle' | 'hotel';
  resourceName: string;
  location: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  depositAmount: number;
  isDepositPaid: boolean;
  remainingAmountPaid: boolean;
  createdAt: Date;
  status: string;
}

const UserBookingsSection: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchUserBookings = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching bookings for user:', user.id);
        
        const allBookings: BookingData[] = [];

        // Fetch cottage bookings
        const cottageBookingsQuery = query(
          collection(db, 'bookings'),
          where('customerInfo.userId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        const cottageSnapshot = await getDocs(cottageBookingsQuery);
        
        cottageSnapshot.forEach((doc) => {
          const data = doc.data();
          allBookings.push({
            id: doc.id,
            type: 'cottage',
            resourceName: data.cottage || 'კოტეჯი',
            location: 'ბახმარო, სასტუმროს ქუჩა',
            startDate: data.startDate?.toDate() || new Date(data.startDate),
            endDate: data.endDate?.toDate() || new Date(data.endDate),
            totalPrice: data.totalPrice || data.customTotalPrice || 0,
            depositAmount: data.depositAmount || 0,
            isDepositPaid: data.გადასახდილია || false,
            remainingAmountPaid: data.remainingAmountPaid || false,
            createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
            status: data.status || 'pending'
          });
        });

        // Fetch vehicle bookings
        const vehicleBookingsQuery = query(
          collection(db, 'vehicleBookings'),
          where('customerInfo.userId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        const vehicleSnapshot = await getDocs(vehicleBookingsQuery);
        
        vehicleSnapshot.forEach((doc) => {
          const data = doc.data();
          allBookings.push({
            id: doc.id,
            type: 'vehicle',
            resourceName: data.vehicleTitle || 'ავტომობილი',
            location: 'ბახმარო, მანქანის ქირაობა',
            startDate: data.startDateTime?.toDate() || new Date(data.startDateTime),
            endDate: data.endDateTime?.toDate() || new Date(data.endDateTime),
            totalPrice: data.totalPrice || 0,
            depositAmount: data.depositAmount || 0,
            isDepositPaid: data.გადასახდილია || false,
            remainingAmountPaid: data.remainingAmountPaid || false,
            createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
            status: data.status || 'pending'
          });
        });

        // Fetch hotel bookings
        const hotelBookingsQuery = query(
          collection(db, 'hotelBookings'),
          where('customerInfo.userId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        const hotelSnapshot = await getDocs(hotelBookingsQuery);
        
        hotelSnapshot.forEach((doc) => {
          const data = doc.data();
          allBookings.push({
            id: doc.id,
            type: 'hotel',
            resourceName: data.hotelName || 'სასტუმრო',
            location: 'ბახმარო, სასტუმროს ქუჩა',
            startDate: data.startDate?.toDate() || new Date(data.startDate),
            endDate: data.endDate?.toDate() || new Date(data.endDate),
            totalPrice: data.totalPrice || 0,
            depositAmount: data.depositAmount || 0,
            isDepositPaid: data.გადასახდილია || false,
            remainingAmountPaid: data.remainingAmountPaid || false,
            createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
            status: data.status || 'pending'
          });
        });

        // Sort all bookings by creation date (newest first)
        allBookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        // Set up expiration timers for unpaid bookings
        allBookings.forEach(booking => {
          if (!booking.isDepositPaid && booking.status !== 'expired') {
            bookingExpirationService.setupExpirationTimer(
              booking.id, 
              booking.createdAt,
              () => {
                // Refresh bookings when a booking expires
                console.log('📱 Refreshing bookings due to expiration');
                fetchUserBookings();
              }
            );
          }
        });
        
        console.log('✅ Loaded bookings:', allBookings.length);
        setBookings(allBookings);
      } catch (error) {
        console.error('❌ Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserBookings();
    
    // Initialize existing bookings in the expiration service
    bookingExpirationService.initializeExistingBookings();
  }, [user?.id]);

  const getBookingStatus = (booking: BookingData): 'expired' | 'active' | 'upcoming' | 'temporary' => {
    const now = new Date();
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);

    // Check if booking is temporary (within 15 minutes of creation and not paid)
    const fifteenMinutesAfterCreation = new Date(booking.createdAt.getTime() + 15 * 60 * 1000);
    if (!booking.isDepositPaid && now < fifteenMinutesAfterCreation && booking.status === 'pending') {
      return 'temporary';
    }

    // Check if booking expired due to non-payment
    if (booking.status === 'expired') return 'expired';

    if (endDate < now) return 'expired';
    if (startDate <= now && endDate >= now) return 'active';
    return 'upcoming';
  };

  const getTimeRemaining = (booking: BookingData): string | null => {
    if (booking.isDepositPaid || booking.status !== 'pending') return null;
    
    const now = new Date();
    const expirationTime = new Date(booking.createdAt.getTime() + 15 * 60 * 1000);
    const timeLeft = expirationTime.getTime() - now.getTime();

    if (timeLeft <= 0) return null;

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: 'expired' | 'active' | 'upcoming' | 'temporary') => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1";
    
    switch (status) {
      case 'expired':
        return (
          <span className={`${baseClasses} bg-gray-500/20 text-gray-300 border border-gray-400/30`}>
            <Calendar className="w-3 h-3" />
            expired
          </span>
        );
      case 'active':
        return (
          <span className={`${baseClasses} bg-green-500/20 text-green-300 border border-green-400/30`}>
            <Calendar className="w-3 h-3" />
            active
          </span>
        );
      case 'upcoming':
        return (
          <span className={`${baseClasses} bg-blue-500/20 text-blue-300 border border-blue-400/30`}>
            <Calendar className="w-3 h-3" />
            upcoming
          </span>
        );
      case 'temporary':
        return (
          <span className={`${baseClasses} bg-orange-500/20 text-orange-300 border border-orange-400/30 animate-pulse`}>
            <Clock className="w-3 h-3" />
            temporary
          </span>
        );
    }
  };

  const getResourceIcon = (type: 'cottage' | 'vehicle' | 'hotel') => {
    switch (type) {
      case 'cottage':
        return Home;
      case 'vehicle':
        return Car;
      case 'hotel':
        return Hotel;
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getRemainingAmount = (booking: BookingData): number => {
    return booking.totalPrice - booking.depositAmount;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        <span className="ml-3 text-white/70">იტვირთება...</span>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-white/30 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">ჯავშნები არ არის</h3>
        <p className="text-white/60">თქვენ ჯერ არ გაქვთ არცერთი ჯავშანი</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {bookings.map((booking) => {
        const ResourceIcon = getResourceIcon(booking.type);
        const status = getBookingStatus(booking);
        const remainingAmount = getRemainingAmount(booking);
        const timeRemaining = getTimeRemaining(booking);

        return (
          <div
            key={booking.id}
            className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-lg rounded-3xl p-6 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <ResourceIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {booking.resourceName} №2 აივნით
                  </h3>
                  <p className="text-white/60 text-sm">{booking.location}</p>
                  <p className="text-white/50 text-sm mt-1">
                    {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(status)}
                {timeRemaining && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-300 rounded-lg text-xs font-mono">
                    <Clock className="w-3 h-3" />
                    {timeRemaining}
                  </div>
                )}
              </div>
            </div>

            {/* Financial Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Total Amount */}
              <div className="bg-purple-500/20 backdrop-blur-sm rounded-2xl p-4 border border-purple-400/30">
                <p className="text-purple-200 text-sm mb-1">ჯამური ღირებულება</p>
                <p className="text-white text-3xl font-bold">{booking.totalPrice}₾</p>
              </div>

              {/* Deposit Amount */}
              <div className={`backdrop-blur-sm rounded-2xl p-4 border ${
                booking.isDepositPaid 
                  ? 'bg-emerald-500/20 border-emerald-400/30' 
                  : 'bg-red-500/20 border-red-400/30 animate-pulse'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-sm ${
                    booking.isDepositPaid ? 'text-emerald-200' : 'text-red-200'
                  }`}>
                    ჯავშნის თანხა
                  </p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    booking.isDepositPaid 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-red-600 text-white animate-pulse'
                  }`}>
                    {booking.isDepositPaid ? 'Paid' : 'Pending Payment'}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${
                  booking.isDepositPaid ? 'text-emerald-300' : 'text-red-300'
                }`}>
                  {booking.depositAmount}₾
                </p>
                {booking.isDepositPaid && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-emerald-300 text-sm font-medium">✨ გადასახდელია ✨</span>
                  </div>
                )}
              </div>
            </div>

            {/* Remaining Amount */}
            {remainingAmount > 0 && (
              <div className={`bg-gradient-to-r from-pink-500/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-4 border border-pink-400/30 mb-4 ${
                booking.isDepositPaid && !booking.remainingAmountPaid ? 'animate-pulse' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-pink-200 text-sm mb-1">ჩექინის დღეს გადასახდელი</p>
                    <p className="text-pink-300 text-2xl font-bold">{remainingAmount}₾</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.remainingAmountPaid 
                      ? 'bg-green-600/50 text-green-200' 
                      : booking.isDepositPaid 
                        ? 'bg-red-600/50 text-red-200 animate-pulse' 
                        : 'bg-gray-600/50 text-gray-200'
                  }`}>
                    {booking.remainingAmountPaid 
                      ? 'Paid' 
                      : booking.isDepositPaid 
                        ? 'Due on check-in' 
                        : 'Awaiting booking confirmation'
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Warning for temporary bookings */}
            {status === 'temporary' && (
              <div className="bg-orange-500/20 backdrop-blur-sm rounded-2xl p-4 border border-orange-400/30 mb-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-orange-300 animate-pulse" />
                  <div>
                    <p className="text-orange-200 font-medium">დროებითი ჯავშანი</p>
                    <p className="text-orange-300/80 text-sm">
                      ეს ჯავშანი დროებითია. გადაიხადეთ ჯავშნის თანხა {timeRemaining} წუთში, 
                      სხვა შემთხვევაში ჯავშანი გაუქმდება.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Expired booking message */}
            {status === 'expired' && booking.status === 'expired' && (
              <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4 border border-red-400/30 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-red-500/30 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-red-300" />
                  </div>
                  <div>
                    <p className="text-red-200 font-medium">ვადა ამოიწურა — დაჯავშნა გაუქმდა</p>
                    <p className="text-red-300/80 text-sm">
                      ჯავშნის თანხა არ დადასტურდა 15 წუთში, ამიტომ ჯავშანი ავტომატურად გაუქმდა.
                    </p>
                  </div>
                </div>
                
                {/* Feedback form */}
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-400/20">
                  <p className="text-red-200 text-sm font-medium mb-2">
                    რატომ არ დადასტურდა ეს ჯავშანი?
                  </p>
                  <textarea
                    className="w-full bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2 text-red-200 text-sm placeholder-red-300/60 focus:outline-none focus:ring-2 focus:ring-red-400/50 resize-none"
                    rows={3}
                    placeholder="მაგ.: ტექნიკური პრობლემა, გადახდის სირთულე, არ მომეწონა ფასი..."
                  />
                  <button className="mt-2 bg-red-500/30 hover:bg-red-500/40 text-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    გაგზავნა
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-white/50 text-sm">
                ID: #{booking.id.slice(-8)}
              </span>
              <button className="flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 group">
                <span>დეტალები</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserBookingsSection;

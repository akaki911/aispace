// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, DollarSign, Users, Star, CheckCircle, XCircle, Clock, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { getBookingsByProviderId, calculateProviderStats, Booking } from './services/bookingService';

interface ProviderStats {
  totalBookings: number;
  totalRevenue: number;
  pendingRevenue: number;
  averageRating: number;
  confirmedBookings: number;
  cancelledBookings: number;
  activeBookings: number;
  completedBookings: number;
  pendingBookings: number;
  paidBookings: number;
  unpaidBookings: number;
  revenuePerBooking: number;
  paymentRate: number;
  cancellationRate: number;
}

const ProviderBookings: React.FC = () => {
  const { user } = useAuth();
  const { canManageBookings } = usePermissions();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Check if user is provider
  if (!user || user.role !== 'PROVIDER_ADMIN') {
    return (
      <div className="p-8">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">წვდომა შეზღუდულია</h3>
          <p className="text-gray-500 mb-4">ამ სექციის ნახვა მხოლოდ პროვაიდერებისთვისაა</p>
        </div>
      </div>
    );
  }

  // Load provider's bookings on mount
  useEffect(() => {
    const fetchBookings = async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);
        const providerBookings = await getBookingsByProviderId(user.uid);
        setBookings(providerBookings);

        // Calculate real-time statistics
        const calculatedStats = calculateProviderStats(providerBookings);
        setStats(calculatedStats);
      } catch (error) {
        console.error('Error fetching bookings:', error);
        setBookings([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user?.uid]);

  // Filter bookings based on search and filters
  useEffect(() => {
    let filtered = [...bookings];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.customerPhone.includes(searchTerm) ||
        booking.resourceName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    // Payment filter
    if (paymentFilter === 'paid') {
      filtered = filtered.filter(booking => booking.isPaid);
    } else if (paymentFilter === 'unpaid') {
      filtered = filtered.filter(booking => !booking.isPaid);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(booking => booking.resourceType === typeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let filterDate = new Date();

      switch (dateFilter) {
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(booking => 
        new Date(booking.createdAt) >= filterDate
      );
    }

    setFilteredBookings(filtered);
  }, [searchTerm, statusFilter, typeFilter, paymentFilter, dateFilter, bookings]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">მონაცემების ჩატვირთვა...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">ჩემი ჯავშნები</h1>
        <p className="text-gray-600">თქვენი რესურსების ჯავშნების მენეჯმენტი და სტატისტიკა</p>
      </div>

      {/* Provider Info & Live Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-gray-600">{user.email}</p>
            {user.phoneNumber && (
              <p className="text-gray-500 text-sm">{user.phoneNumber}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              აქტიური პროვაიდერი
            </span>
          </div>
        </div>

        {/* Real-time Statistics Grid */}
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ჯამური ჯავშნები</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalBookings}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">შემოსავალი</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalRevenue}₾</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">მოსალოდნელი</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendingRevenue}₾</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">საშუალო რეიტინგი</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
                  </p>
                </div>
                <Star className="w-8 h-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">აქტიური</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.activeBookings}</p>
                </div>
                <Activity className="w-8 h-8 text-emerald-500" />
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">გაუქმებული</p>
                  <p className="text-2xl font-bold text-red-600">{stats.cancelledBookings}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            სტატისტიკის ჩატვირთვა...
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ძებნა მომხმარებლის, ტელეფონის ან რესურსის მიხედვით..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ყველა სტატუსი</option>
            <option value="active">აქტიური</option>
            <option value="completed">დასრულებული</option>
            <option value="cancelled">გაუქმებული</option>
            <option value="pending">მოლოდინში</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ყველა გადახდა</option>
            <option value="paid">გადახდილი</option>
            <option value="unpaid">გადაუხდელი</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ყველა ტიპი</option>
            <option value="cottage">კოტეჯი</option>
            <option value="hotel">სასტუმრო</option>
            <option value="vehicle">ავტომობილი</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ყველა პერიოდი</option>
            <option value="week">ბოლო კვირა</option>
            <option value="month">ბოლო თვე</option>
            <option value="quarter">ბოლო 3 თვე</option>
            <option value="year">ბოლო წელი</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            ჯავშნების სია ({filteredBookings.length})
          </h3>
        </div>

        {filteredBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    მომხმარებელი
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    რესურსი
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    თარიღები
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    თანხა
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    სტატუსი
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    რეიტინგი
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {booking.customerName}
                        </div>
                        <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {booking.resourceName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.resourceType === 'cottage' ? 'კოტეჯი' :
                           booking.resourceType === 'hotel' ? 'სასტუმრო' : 'ავტომობილი'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{new Date(booking.startDate).toLocaleDateString('ka-GE')}</div>
                        <div className="text-gray-500">
                          {new Date(booking.endDate).toLocaleDateString('ka-GE')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {booking.totalAmount || booking.totalPrice || 0}₾
                          {booking.useCustomPrice && (
                            <span className="ml-1 text-xs bg-orange-100 text-orange-800 px-1 py-0.5 rounded">ინდივიდუალური</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          ღამე: {booking.calculatedDays || 0} • ღამეზე: {booking.dailyRate || 0}₾
                        </div>
                        <div className="text-xs text-orange-600">
                          ჯავშნის თანხა: {booking.depositAmount || 0}₾
                        </div>
                        <div className={`text-xs ${booking.isPaid ? 'text-green-600' : 'text-red-600'}`}>
                          {booking.isPaid ? 'გადახდილი' : 'გადაუხდელი'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        booking.status === 'active' ? 'bg-green-100 text-green-800' :
                        booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status === 'active' ? 'აქტიური' :
                         booking.status === 'completed' ? 'დასრულებული' :
                         booking.status === 'cancelled' ? 'გაუქმებული' :
                         booking.status === 'pending' ? 'მოლოდინში' : booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.rating ? (
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 mr-1" />
                          <span>{booking.rating}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {bookings.length === 0 ? 'თქვენ არ გაქვთ ჯავშნები' : 'ჯავშნები ვერ მოიძებნა'}
            </p>
            <p className="text-gray-400 text-sm">
              {bookings.length === 0 ? 'ჯავშნები გამოჩნდება მომხმარებელთა რეგისტრაციის შემდეგ' : 'შეცვალეთ ფილტრები ან ძებნის პარამეტრები'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderBookings;
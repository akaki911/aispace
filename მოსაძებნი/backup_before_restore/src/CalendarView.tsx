import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useAuth } from "./contexts/AuthContext";
import { usePermissions } from "./hooks/usePermissions";
import { useTheme } from "./contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Car,
  Building2,
  Home,
  CheckCircle,
  XCircle,
  DollarSign,
  Activity,
  TrendingUp,
  Filter,
  Search,
  Grid,
  List,
  Plus,
} from "lucide-react";
import { Card } from "./components/ui/card";

interface Booking {
  id: string;
  type: "cottage" | "hotel" | "vehicle";
  name: string;
  customerName: string;
  startDate: Date;
  endDate: Date;
  status: "confirmed" | "pending" | "cancelled";
  totalPrice: number;
  location?: string;
  capacity?: number;
}

interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalRevenue: number;
}

export default function CalendarView() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "cottage" | "hotel" | "vehicle"
  >("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "confirmed" | "pending" | "cancelled"
  >("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [stats, setStats] = useState<BookingStats>({
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    totalRevenue: 0,
  });

  const { user } = useAuth();
  const { canViewAllResources, isSuperAdmin } = usePermissions();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterAndSortBookings();
  }, [bookings, searchTerm, filterType, filterStatus]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const allBookings: Booking[] = [];

      // Fetch cottage bookings
      const cottageBookingsQuery = isSuperAdmin
        ? query(collection(db, "bookings"), orderBy("startDate", "desc"))
        : query(
            collection(db, "bookings"),
            where("ownerId", "==", user?.uid || ""),
            orderBy("startDate", "desc"),
          );

      const cottageSnapshot = await getDocs(cottageBookingsQuery);
      cottageSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        allBookings.push({
          id: doc.id,
          type: "cottage",
          name: data.cottageName || "უცნობი კოტეჯი",
          customerName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          status: data.გადასახდილია ? "confirmed" : "pending",
          totalPrice: data.totalPrice || 0,
          location: data.location,
        });
      });

      // Fetch hotel bookings
      const hotelBookingsQuery = isSuperAdmin
        ? query(collection(db, "hotelBookings"), orderBy("startDate", "desc"))
        : query(
            collection(db, "hotelBookings"),
            where("ownerId", "==", user?.uid || ""),
            orderBy("startDate", "desc"),
          );

      const hotelSnapshot = await getDocs(hotelBookingsQuery);
      hotelSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        allBookings.push({
          id: doc.id,
          type: "hotel",
          name: data.hotelName || "უცნობი სასტუმრო",
          customerName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          status: data.გადასახდილია ? "confirmed" : "pending",
          totalPrice: data.totalPrice || 0,
          location: data.location,
        });
      });

      // Fetch vehicle bookings
      const vehicleBookingsQuery = isSuperAdmin
        ? query(collection(db, "vehicleBookings"), orderBy("startDate", "desc"))
        : query(
            collection(db, "vehicleBookings"),
            where("ownerId", "==", user?.uid || ""),
            orderBy("startDate", "desc"),
          );

      const vehicleSnapshot = await getDocs(vehicleBookingsQuery);
      vehicleSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        allBookings.push({
          id: doc.id,
          type: "vehicle",
          name: data.vehicleTitle || "უცნობი ავტომობილი",
          customerName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          status: data.გადასახდილია ? "confirmed" : "pending",
          totalPrice: data.totalPrice || 0,
        });
      });

      // Sort by start date
      allBookings.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

      setBookings(allBookings);
      calculateStats(allBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (bookingList: Booking[]) => {
    const totalBookings = bookingList.length;
    const confirmedBookings = bookingList.filter(
      (b) => b.status === "confirmed",
    ).length;
    const pendingBookings = bookingList.filter(
      (b) => b.status === "pending",
    ).length;
    const totalRevenue = bookingList
      .filter((b) => b.status === "confirmed")
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    setStats({
      totalBookings,
      confirmedBookings,
      pendingBookings,
      totalRevenue,
    });
  };

  const filterAndSortBookings = () => {
    let filtered = [...bookings];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (booking) =>
          booking.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((booking) => booking.type === filterType);
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((booking) => booking.status === filterStatus);
    }

    setFilteredBookings(filtered);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "cottage":
        return <Home className="w-5 h-5" />;
      case "hotel":
        return <Building2 className="w-5 h-5" />;
      case "vehicle":
        return <Car className="w-5 h-5" />;
      default:
        return <Calendar className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "cottage":
        return "კოტეჯი";
      case "hotel":
        return "სასტუმრო";
      case "vehicle":
        return "ავტომობილი";
      default:
        return "უცნობი";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400";
      case "pending":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "cancelled":
        return "text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "დადასტურებული";
      case "pending":
        return "მოლოდინში";
      case "cancelled":
        return "გაუქმებული";
      default:
        return "უცნობი";
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-brown-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                ჯავშნების ჩატვირთვა...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-6 lg:mb-0">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center mb-2">
                  <div
                    className={`p-3 rounded-2xl mr-4 ${
                      isDarkMode
                        ? "bg-gradient-to-r from-brown-600 to-amber-600"
                        : "bg-gradient-to-r from-blue-600 to-purple-600"
                    }`}
                  >
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  ჯავშნების კალენდარი
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  ყველა ჯავშნის მართვა ერთ ადგილას
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => (window.location.href = "/admin/cottages")}
                  className={`text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl ${
                    isDarkMode
                      ? "bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი ჯავშანი
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
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                    სულ ჯავშნები
                  </p>
                  <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">
                    {stats.totalBookings}
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
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    დადასტურებული
                  </p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    {stats.confirmedBookings}
                  </p>
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
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    მოლოდინში
                  </p>
                  <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
                    {stats.pendingBookings}
                  </p>
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
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    მთლიანი შემოსავალი
                  </p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    ₾{stats.totalRevenue.toLocaleString()}
                  </p>
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
                  placeholder="ძებნა ჯავშნით ან მომხმარებლით..."
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
                  <option value="cottage">კოტეჯები</option>
                  <option value="hotel">სასტუმროები</option>
                  <option value="vehicle">ავტომობილები</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">ყველა სტატუსი</option>
                  <option value="confirmed">დადასტურებული</option>
                  <option value="pending">მოლოდინში</option>
                  <option value="cancelled">გაუქმებული</option>
                </select>

                <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-4 py-3 ${viewMode === "grid" ? "bg-brown-600 text-white" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"} transition-colors`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-4 py-3 ${viewMode === "list" ? "bg-brown-600 text-white" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"} transition-colors`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
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
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  ჯავშნები ვერ მოიძებნა
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  სცადეთ სხვა საძიებო კრიტერიუმები
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => (window.location.href = "/admin/cottages")}
                  className={`text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center ${
                    isDarkMode
                      ? "bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  }`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ახალი ჯავშნის დამატება
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-4"
              }
            >
              <AnimatePresence>
                {filteredBookings.map((booking, index) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 ${
                      viewMode === "list" ? "flex" : ""
                    }`}
                  >
                    <div
                      className={`p-6 ${viewMode === "list" ? "flex-1" : ""}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-2 rounded-xl ${
                              booking.type === "cottage"
                                ? "bg-brown-100 dark:bg-brown-900/30"
                                : booking.type === "hotel"
                                  ? "bg-amber-100 dark:bg-amber-900/30"
                                  : "bg-orange-100 dark:bg-orange-900/30"
                            }`}
                          >
                            {getTypeIcon(booking.type)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                              {booking.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {getTypeLabel(booking.type)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}
                        >
                          {getStatusLabel(booking.status)}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div className="mb-4">
                        <div className="flex items-center text-gray-600 dark:text-gray-400 mb-2">
                          <Users className="w-4 h-4 mr-2" />
                          <span className="text-sm">
                            {booking.customerName}
                          </span>
                        </div>
                        {booking.location && (
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span className="text-sm">{booking.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          ჯავშნის ვადები
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {booking.startDate.toLocaleDateString("ka-GE")} -{" "}
                          {booking.endDate.toLocaleDateString("ka-GE")}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          მთლიანი ღირებულება
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          ₾{booking.totalPrice}
                        </span>
                      </div>

                      {/* Metadata Footer */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          შექმნილია{" "}
                          {booking.startDate.toLocaleDateString("ka-GE")}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

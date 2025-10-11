// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Calendar,
  Building2,
  Users,
  Settings,
  Plus,
  BarChart3,
  AlertTriangle,
  CreditCard,
  Eye,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "./contexts/useAuth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

interface Booking {
  id: string;
  checkInDate: string;
  listingName: string;
  guestName: string;
  status: string;
  providerId: string;
  price: number;
  checkedIn: boolean;
}

interface Commission {
  id: string;
  providerId: string;
  amountOwed: number;
  dueDate: string;
  status: "paid" | "unpaid";
  paidAt?: any;
}

interface Listing {
  id: string;
  type: string;
  name: string;
  ownerId: string;
  expiryDate?: string;
  isExpired?: boolean;
}

interface Alert {
  id: string;
  type: "commission" | "expired_listing" | "missed_checkin";
  title: string;
  message: string;
  data: any;
}

const MainDashboard: React.FC = () => {
  // State for financial stats
  const [financialStats, setFinancialStats] = useState({
    totalBookings: 0,
    activeBookings: 0,
    pendingBookings: 0,
    totalRevenue: 0,
  });
  const [financialStatsLoading, setFinancialStatsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [revenueChange, setRevenueChange] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [bookingsChange, setBookingsChange] = useState(0);
  const [thirdMetric, setThirdMetric] = useState(0);
  const [thirdMetricChange, setThirdMetricChange] = useState(0);
  const [commission, setCommission] = useState<Commission | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [listingsByType, setListingsByType] = useState<Record<string, number>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true); // General loading state
  const [backendUser, setBackendUser] = useState<any>(null);

  // Check if user is SUPER_ADMIN via backend OR Firebase
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isProvider = !isSuperAdmin;

  // Check user role from AuthContext
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('🔍 [MainDashboard] User authenticated:', { 
        role: user.role, 
        authMethod: user.authMethod,
        isSuperAdmin: user.role === 'SUPER_ADMIN'
      });

      // loadDashboardData(); // Initial load moved to debounced useEffect
    }
  }, [isAuthenticated, user, isSuperAdmin]);

  // Debounced and optimized dashboard data loading
  useEffect(() => {
    // Debounce dashboard loading to prevent multiple calls
    const timeoutId = setTimeout(() => {
      if (user?.id && isAuthenticated) {
        loadDashboardData();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [user?.id, isAuthenticated]);


  const loadDashboardData = async () => {
    // Prevent duplicate loading
    if (isLoading) {
      console.log('Dashboard already loading, skipping...');
      return;
    }

    setIsLoading(true);
    try {
      // Load with delays to prevent quota exhaustion
      await loadFinancialStats();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

      await loadUpcomingBookings(); // Renamed from loadRecentBookings
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay

      await loadListingsOverview(); // Renamed from loadSystemStats
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay

      await loadAlerts(); // Added loadAlerts

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const loadUpcomingBookings = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      let bookingsQuery;

      if (isSuperAdmin) {
        // სუპერ ადმინისთვის - ყველა ჯავშნი
        bookingsQuery = query(
          collection(db, "bookings"),
          where("checkInDate", ">=", today),
          orderBy("checkInDate", "asc"),
          limit(5),
        );
      } else {
        // პროვაიდერისთვის - მისი ჯავშნები
        const userId = user?.uid || backendUser?.id;
        if (!userId) {
          console.log('❌ No user ID for provider bookings');
          return;
        }
        bookingsQuery = query(
          collection(db, "bookings"),
          where("providerId", "==", userId),
          where("checkInDate", ">=", today),
          orderBy("checkInDate", "asc"),
          limit(5),
        );
      }

      const snapshot = await getDocs(bookingsQuery);
      const bookings = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Booking,
      );
      setUpcomingBookings(bookings);
    } catch (error) {
      console.error("Error loading upcoming bookings:", error);
    }
  };

  const loadFinancialStats = async () => {
    try {
      setFinancialStatsLoading(true);

      // Use cached data first, refresh only if needed
      const cacheKey = 'dashboard_financial_stats';
      const cachedData = localStorage.getItem(cacheKey);
      const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);

      // If cache is less than 5 minutes old, use it
      if (cachedData && cacheTimestamp) {
        const age = Date.now() - parseInt(cacheTimestamp);
        if (age < 5 * 60 * 1000) { // 5 minutes
          setFinancialStats(JSON.parse(cachedData));
          setFinancialStatsLoading(false);
          return;
        }
      }

      // Batch all queries with exponential backoff
      const executeWithRetry = async (operation: () => Promise<any>, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            return await operation();
          } catch (error: any) {
            if (error.code === 'resource-exhausted' && i < retries - 1) {
              const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
      };

      // Reduced Firebase calls with smaller query scope
      const results = await Promise.allSettled([
        executeWithRetry(() => getCountFromServer(collection(db, 'bookings'))),
        executeWithRetry(() => getCountFromServer(query(
          collection(db, 'bookings'),
          where('status', '==', 'confirmed'),
          limit(100) // Limit scope
        ))),
        executeWithRetry(() => getCountFromServer(query(
          collection(db, 'bookings'),
          where('status', '==', 'pending'),
          limit(50) // Limit scope
        )))
      ]);

      // Process results safely
      const totalBookings = results[0].status === 'fulfilled' ? results[0].value.data().count : 0;
      const activeBookings = results[1].status === 'fulfilled' ? results[1].value.data().count : 0;
      const pendingBookings = results[2].status === 'fulfilled' ? results[2].value.data().count : 0;

      // Simplified revenue calculation using a smaller sample
      let totalRevenue = 0;
      try {
        const revenueQuery = query(
          collection(db, 'bookings'),
          where('status', '==', 'confirmed'),
          limit(20), // Smaller sample
          orderBy('createdAt', 'desc')
        );
        const revenueSnapshot = await executeWithRetry(() => getDocs(revenueQuery));
        revenueSnapshot.forEach(doc => {
          const booking = doc.data();
          totalRevenue += booking.totalPrice || 0;
        });
        // Estimate total revenue (this is an approximation)
        if (activeBookings > 20) {
          totalRevenue = Math.round(totalRevenue * (activeBookings / 20));
        }
      } catch (error) {
        console.warn('Revenue calculation failed, using estimate:', error);
        totalRevenue = activeBookings * 150; // Fallback estimate
      }

      const stats = {
        totalBookings,
        activeBookings,
        pendingBookings,
        totalRevenue
      };

      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify(stats));
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());

      setFinancialStats(stats);
    } catch (error) {
      console.error('Error loading financial stats:', error);
      // Set fallback values on error
      setFinancialStats({
        totalBookings: 0,
        activeBookings: 0,
        pendingBookings: 0,
        totalRevenue: 0
      });
    } finally {
      setFinancialStatsLoading(false);
    }
  };

  const loadListingsOverview = async () => {
    try {
      let listingsQuery;

      if (isSuperAdmin) {
        listingsQuery = query(collection(db, "listings"));
      } else {
        const userId = user?.uid || backendUser?.id;
        if (!userId) {
          console.log('❌ No user ID for listings overview');
          return;
        }
        listingsQuery = query(
          collection(db, "listings"),
          where("ownerId", "==", userId),
        );
      }

      const snapshot = await getDocs(listingsQuery);
      const typeCount: Record<string, number> = {};

      snapshot.docs.forEach((doc) => {
        const type = doc.data().type || "other";
        typeCount[type] = (typeCount[type] || 0) + 1;
      });

      setListingsByType(typeCount);
    } catch (error) {
      console.error("Error loading listings overview:", error);
    }
  };

  const loadCommission = async () => {
    const userId = user?.uid || backendUser?.id;
    if (!userId) {
      console.log('❌ No user ID for commission loading');
      return;
    }

    try {
      const commissionQuery = query(
        collection(db, "commissions"),
        where("providerId", "==", userId),
        where("status", "==", "unpaid"),
      );

      const snapshot = await getDocs(commissionQuery);
      if (!snapshot.empty) {
        const commissionData = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        } as Commission;
        setCommission(commissionData);
      }
    } catch (error) {
      console.error("Error loading commission:", error);
    }
  };

  const loadAlerts = async () => {
    const alertsList: Alert[] = [];

    try {
      if (isProvider) {
        // კომისიის გაფრთხილება
        if (commission) {
          alertsList.push({
            id: "commission-alert",
            type: "commission",
            title: "ანაზღაურებელი კომისია",
            message: `თქვენ გაქვთ გადასახდელი ₾${commission.amountOwed} კომისია. ვადა: ${commission.dueDate}`,
            data: commission,
          });
        }

        // ვადაგასული ობიექტები
        const userId = user?.uid || backendUser?.id;
        if (!userId) {
          console.log('❌ No user ID for alerts');
          return;
        }
        const expiredQuery = query(
          collection(db, "listings"),
          where("ownerId", "==", userId),
          where("expiryDate", "<", new Date().toISOString().split("T")[0]),
        );
        const expiredSnapshot = await getDocs(expiredQuery);

        expiredSnapshot.docs.forEach((doc) => {
          const listing = doc.data();
          alertsList.push({
            id: `expired-${doc.id}`,
            type: "expired_listing",
            title: "ვადაგასული განცხადება",
            message: `თქვენი ობიექტი "${listing.name}" ვადაგასულია ${listing.expiryDate}-დან`,
            data: { listingId: doc.id, ...listing },
          });
        });

        // გამოტოვებული ჩექინები
        const today = new Date().toISOString().split("T")[0];
        const missedCheckinQuery = query(
          collection(db, "bookings"),
          where("providerId", "==", userId),
          where("checkInDate", "<", today),
          where("checkedIn", "==", false),
        );
        const missedSnapshot = await getDocs(missedCheckinQuery);

        missedSnapshot.docs.forEach((doc) => {
          const booking = doc.data();
          alertsList.push({
            id: `missed-checkin-${doc.id}`,
            type: "missed_checkin",
            title: "გადამოწმებული Check-in",
            message: `სტუმარი არ დადასტურდა ჩექინზე ჯავშნით №${doc.id} (${booking.checkInDate})`,
            data: { bookingId: doc.id, ...booking },
          });
        });
      }

      setAlerts(alertsList);
    } catch (error) {
      console.error("Error loading alerts:", error);
    }
  };

  const handleCommissionPayment = async () => {
    if (!commission) return;

    const confirmed = window.confirm(
      `დარწმუნებული ხართ, რომ გადაიხადეთ ₾${commission.amountOwed} კომისია? ამ ქმედების მონიშვნით თქვენ ადასტურებთ, რომ ეს თანხა გადმორიცხულია პლატფორმის მფლობელთან.`,
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "commissions", commission.id), {
        status: "paid",
        paidAt: serverTimestamp(),
        paidBy: user?.uid || backendUser?.id,
      });

      setCommission(null);
      loadAlerts(); // განახლება alerts-ის

      // Success toast
      const toast = document.createElement("div");
      toast.className =
        "fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50";
      toast.textContent = "✅ კომისია მონიშნულია გადახდილად.";
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    } catch (error) {
      console.error("Error marking commission as paid:", error);
      alert("🚫 შეცდომა: გადახდის მონიშვნა ვერ მოხერხდა. სცადეთ კვლავ.");
    }
  };

  const handleAlertAction = async (alert: Alert) => {
    switch (alert.type) {
      case "commission":
        handleCommissionPayment();
        break;
      case "expired_listing":
        const newExpiryDate = prompt("შეიყვანეთ ახალი ვადა (YYYY-MM-DD):");
        if (newExpiryDate) {
          try {
            await updateDoc(doc(db, "listings", alert.data.listingId), {
              expiryDate: newExpiryDate,
              isExpired: false,
            });
            loadAlerts();
            alert("✅ განცხადების ვადა განახლდა.");
          } catch (error) {
            alert("ვერ განახლდა, სცადეთ თავიდან");
          }
        }
        break;
      case "missed_checkin":
        const confirmCheckin = window.confirm(
          "დაადასტურებთ, რომ სტუმარი ნამდვილად ჩექინდა ამ ჯავშნაზე?",
        );
        if (confirmCheckin) {
          try {
            await updateDoc(doc(db, "bookings", alert.data.bookingId), {
              checkedIn: true,
              checkInAt: serverTimestamp(),
            });
            loadAlerts();
            alert("✅ ჩექინი დადასტურებულია.");
          } catch (error) {
            alert("შეცდომა მოხდა");
          }
        }
        break;
    }
  };

  const navigateToCalendar = () => {
    navigate("/admin/calendar");
  };

  const navigateToListings = (type?: string) => {
    const url = type ? `/admin/listings?type=${type}` : "/admin/listings";
    navigate(url);
  };

  const navigateToBookings = () => {
    navigate("/admin/bookings");
  };

  const navigateToUsers = () => {
    if (isSuperAdmin) {
      navigate("/admin/users");
    }
  };

  const navigateToSettings = () => {
    navigate("/admin/settings");
  };

  const navigateToNewBooking = () => {
    navigate("/admin/bookings/new");
  };
  const navigateToMessaging = () => {
    navigate("/admin/messaging");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"
                ></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isSuperAdmin ? "სამართავი პანელი" : "პროვაიდერის დაფა"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {isSuperAdmin
                ? "პლატფორმის მართვა და მონიტორინგი"
                : "თქვენი ობიექტებისა და ჯავშნების მართვა"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <span className="text-sm bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-3 py-1 rounded-full font-medium">
                🔐 SUPER ADMIN
              </span>
            )}
            <span className="text-sm text-green-600 dark:text-green-400">
              ● ონლაინ
            </span>
          </div>
        </div>

        {/* Financial Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {isSuperAdmin ? "პლატფორმის შემოსავალი" : "ჩემი შემოსავალი"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₾{financialStats.totalRevenue.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  +{revenueChange.toFixed(1)}% ამ თვეში
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          {/* Bookings Count Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  სულ ჯავშნები
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {financialStats.totalBookings}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  +{bookingsChange}% ამ თვეში
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </div>

          {/* Third Metric Card */}
          {isSuperAdmin ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    აქტიური პროვაიდერები
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {thirdMetric}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    +{thirdMetricChange}% ამ თვეში
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          ) : commission ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    კომისია საგადხდელო
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    ₾{commission.amountOwed}
                  </p>
                  <p className="text-sm text-red-600">
                    ვადა: {commission.dueDate}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-red-600" />
              </div>
              <button
                onClick={handleCommissionPayment}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                💳 გადახდის მონიშვნა
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    კომისიის დავალიანება არ გაქვთ
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                გაფრთხილებები
              </h2>
            </div>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      {alert.title}
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {alert.message}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAlertAction(alert)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {alert.type === "commission"
                      ? "გადახდა"
                      : alert.type === "expired_listing"
                        ? "განახლება"
                        : "დადასტურება"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Bookings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  უახლოესი ჯავშნები
                </h2>
              </div>
              <button
                onClick={navigateToCalendar}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
              >
                სრული კალენდრის ნახვა
              </button>
            </div>

            {upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {booking.listingName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {booking.guestName}
                      </p>
                      <p className="text-sm text-blue-600">
                        {booking.checkInDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        ₾{booking.price}
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          booking.status === "confirmed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-20 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  უახლოეს პერიოდში ჯავშნები არ არის
                </p>
              </div>
            )}
          </div>

          {/* Listings Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                ობიექტების მიმოხილვა
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries({
                კოტეჯები: "cottage",
                სასტუმროები: "hotel",
                აპარტამენტები: "apartment",
                კემპინგები: "camping",
              }).map(([label, type]) => (
                <button
                  key={type}
                  onClick={() => navigateToListings(type)}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {label}
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {listingsByType[type] || 0}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              სწრაფი მოქმედებები
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigateToMessaging()}
              className="flex flex-col items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                შეტყობინებები
              </span>
            </button>

            <button
              onClick={() => navigateToListings()}
              className="flex flex-col items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Listings მართვა
              </span>
            </button>

            <button
              onClick={navigateToNewBooking}
              className="flex flex-col items-center gap-3 p-4 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-30 transition-colors"
            >
              <Plus className="h-8 w-8 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                ახალი ჯავშნი
              </span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={navigateToUsers}
                className="flex flex-col items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <Users className="h-8 w-8 text-purple-600" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                  მომხმარებლების მართვა
                </span>
              </button>
            )}

            <button
              onClick={navigateToSettings}
              className="flex flex-col items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <Settings className="h-8 w-8 text-gray-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-400">
                პარამეტრები
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanupFirebaseCache, periodicCleanup } from './utils/firebaseCleanup';
import { systemCleanerService } from './services/SystemCleanerService';


import { useAuth } from './contexts/AuthContext';
import Layout from './Layout';
import Login from './Login';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import "./index.css";
import MainPage from "./MainPage";
import CottagePage from "./CottagePage";
import BookingForm from "./BookingForm";
import Javshnissia from "./Javshnissia";
import CalendarView from "./CalendarView";
import AdminCottages from "./AdminCottages";
import CottageForm from "./CottageForm";
import VehiclePage from "./VehiclePage";
import VehicleBookingForm from "./VehicleBookingForm";
import AdminVehicles from './AdminVehicles';
import VehicleForm from './VehicleForm';
import VehiclesList from './VehiclesList';
import AdminHorses from './AdminHorses';
import AdminSnowmobiles from './AdminSnowmobiles';
import AdminUsers from './AdminUsers';
import AdminCustomers from './AdminCustomers';
import AdminBankAccounts from './AdminBankAccounts';
import CustomerProfile from './CustomerProfile';
import AdminHotels from "./AdminHotels";
import HotelForm from "./HotelForm";
import HotelPage from "./HotelPage";
import HotelBookingForm from "./HotelBookingForm";
import HotelsList from './HotelsList';
import CottagesList from './CottagesList';
import ProviderDetails from "./ProviderDetails";
import AdminProviderBookings from "./AdminProviderBookings";
import AdminLogs from './AdminLogs';
import ProviderBookings from './ProviderBookings';
import { createDemoLogs } from './utils/logDemo';
import RolePermissionsPage from './components/RolePermissionsPage';
import { bookingExpirationService } from './services/bookingExpirationService';
import BankAccountManager from './components/BankAccountManager';
import UserDashboard from './UserDashboard'; // Import UserDashboard component
import AdminProviders from './AdminProviders';
import AdminCommission from './AdminCommission';
import AdminMessagingDashboard from './components/AdminMessagingDashboard';
import AIDeveloperPanel from './components/AIDeveloperPanel';
import { Toaster } from 'react-hot-toast';
import MainDashboard from './MainDashboard'; // Import AdminPanel component
import { DevConsolePage } from './features/devconsole/DevConsolePage';
import { FilePreviewProvider } from './contexts/FilePreviewProvider';
import FilePreview from './components/FilePreview';

// Component to initialize Firebase cleanup
function FirebaseInitializer() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase cleanup
        const { periodicCleanup, cleanupFirebaseCache } = await import('./utils/firebaseCleanup');
        await cleanupFirebaseCache();
        periodicCleanup();
        console.log('🔧 Firebase cleanup initialized');
        console.log('🧹 System cleaner initialized');

        // Note: Booking expiration service will be initialized after authentication in AuthContext
        console.log('🔧 App initialization complete - waiting for authentication');
      } catch (error) {
        console.error('❌ Failed to initialize app services:', error);
      }
    };

    initializeApp();
  }, []);

  return null;
}

// Create a client with proper devtools configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1 * 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (was cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Service initialization will be handled after authentication in AuthContext
  // No service initialization at app level

  return (
    <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <PermissionsProvider>
                <FilePreviewProvider>
                  <ErrorBoundary>
                    <FirebaseInitializer />
                    <Router>
                    <Routes>
                {/* Public გვერდები */}
                <Route path="/" element={<MainPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cottages" element={<CottagesList />} />
                <Route path="/cottage/:id" element={<CottagePage />} />
                <Route path="/hotels" element={<HotelsList />} />
                <Route path="/hotel/:id" element={<HotelPage />} />
                <Route path="/vehicles" element={<VehiclesList />} />
                <Route path="/vehicle/:id" element={<VehiclePage />} />
                {/* კლიენტის პროფილი - ყველა ავტორიზებული მომხმარებლისთვის */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <UserDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Dashboard route that redirects to admin */}
                <Route
                  path="/dashboard"
                  element={<Navigate to="/admin" replace />}
                />

                {/* Admin რეგიონი */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN" routeType="admin">
                      <Layout>
                        <MainDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* მომხმარებლების მართვა - სუპერ ადმინისთვის და პროვაიდერ ადმინისთვის */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN">
                      <Layout>
                        <AdminUsers />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/providers/:providerId"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN">
                      <Layout>
                        <ProviderDetails />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                 <Route
                  path="/admin/logs"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN">
                      <Layout>
                        <AdminLogs />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/provider-bookings"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN">
                      <Layout>
                        <AdminProviderBookings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/roles"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN">
                      <Layout>
                        <RolePermissionsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* ჯავშნების მენიუ */}
                <Route
                  path="/admin/javshnissia"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Javshnissia />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/calendar"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CalendarView />
                      </Layout>
                    </ProtectedRoute>
                  }
                />


                {/* კოტეჯების CRUD */}
                <Route
                  path="/admin/cottages"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminCottages />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/cottages/new"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CottageForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/cottages/edit/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CottageForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/cottages/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CottageForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* ავტომობილების CRUD */}
                <Route
                  path="/admin/vehicles"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminVehicles />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/vehicles/new"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <VehicleForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/vehicles/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <VehicleForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                  {/* ცხენების CRUD */}
                   <Route
                    path="/admin/horses"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <AdminHorses />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* თოვლმავლების CRUD */}
                  <Route
                    path="/admin/snowmobiles"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <AdminSnowmobiles />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                {/* სასტუმროების CRUD */}
                <Route
                  path="/admin/hotels"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminHotels />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/hotels/new"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <HotelForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/hotels/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <HotelForm />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                 <Route
                  path="/admin/my-bookings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ProviderBookings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                   <Route
                  path="/admin/customers"
                  element={
                    <ProtectedRoute requiredRole="SUPER_ADMIN">
                      <Layout>
                        <AdminCustomers />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                 <Route
                  path="/admin/bank-accounts"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminBankAccounts />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                   <Route
                  path="/admin/commission"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminCommission />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                  <Route
                  path="/admin/messaging"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AdminMessagingDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                {/* AI Developer Panel Route */}
                <Route
                  path="/admin/ai-developer"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <AIDeveloperPanel />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/ai-developer/console" element={
                  <div className="h-screen">
                    <DevConsolePage />
                  </div>
                } />

                    <Route path="/customer/:customerId" element={<CustomerProfile />} />
              </Routes>
                    <Toaster position="top-center" />
                    {/* Global File Preview Component */}
                    <FilePreview />
                    {/*<SystemStatusWidget />*/}
                  </Router>
                </ErrorBoundary>
                </FilePreviewProvider>
              </PermissionsProvider>
            </AuthProvider>
          </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
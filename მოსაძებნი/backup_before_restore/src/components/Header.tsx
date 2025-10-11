import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mountain, Home, User, LogOut, Settings, Users, Shield, PlusCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UnifiedListingForm from './UnifiedListingForm';
import NotificationSystem from './NotificationSystem';
import { singleFlight } from '@/lib/singleFlight'; // Import singleFlight

// Define HeaderProps if it's not defined elsewhere, otherwise adjust as needed.
interface HeaderProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

// Persistent guard across remounts
let lastRoleLogTime = 0;
let lastRoleSignature = '';

const Header: React.FC<HeaderProps> = ({ onMenuToggle, isMobileMenuOpen }) => {
  // Authentication hooks
  const { user, isAuthenticated, userRole, personalId, firebaseUid, isAuthReady, logout } = useAuth();

  // Derive authentication state
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isProvider = userRole === 'PROVIDER';
  const authMethod = user?.authMethod || 'unknown';

  // Debug authentication state - log once per role/identity change
  const role = userRole ?? "UNKNOWN";
  const uid = personalId ?? firebaseUid ?? user?.email ?? "anon";
  const key = `${role}:${uid}`;
  const lastKeyRef = useRef<string>();

  useEffect(() => {
    if (!import.meta.env.DEV) return;          // no logs in prod
    if (lastKeyRef.current === key) return;    // avoid repeats & StrictMode double call
    lastKeyRef.current = key;
    console.info("Header Role Check", { role, uid, isAuthReady });
  }, [key, isAuthReady]);

  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDiagnostic, setShowDiagnostic] = useState(true); // Temporary diagnostic
  const [backendSession, setBackendSession] = useState<string>('checking...');
  const [showUnifiedForm, setShowUnifiedForm] = useState(false); // Added state for UnifiedForm
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Added for dropdown state
  const lastLoggedRole = useRef<string | null>(null); // Ref to track last logged role

  // Memoize role calculations to prevent frequent re-renders
  const roleInfo = useMemo(() => {
    const isSuperAdmin = userRole === 'SUPER_ADMIN' && personalId === '01019062020';
    const isProvider = userRole === 'PROVIDER';

    return { isSuperAdmin, isProvider };
  }, [userRole, personalId, user?.authMethod]);

  React.useEffect(() => { // Use React.useEffect for clarity
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Check backend session for diagnostic
    const checkBackendSession = async () => {
      try {
        // Assuming '/api/admin/auth/me' is a valid endpoint to check admin status
        const response = await fetch('/api/admin/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          // Assuming data contains an 'isAuthenticated' property for the backend session
          setBackendSession(data.isAuthenticated ? `SUPER_ADMIN / source: backend` : 'none');
        } else {
          setBackendSession('none');
        }
      } catch (error) {
        console.error("Failed to check backend session:", error);
        setBackendSession('error');
      }
    };

    checkBackendSession();
    return () => clearInterval(timer);
  }, []);

  // Role validation logging with rate limiting - prevent console spam
  // Role დასადგენად (with cooldown)
  useEffect(() => {
    const now = Date.now();
    const isDev = import.meta.env.DEV;
    const cooldownMs = isDev ? 5000 : 30000; // 5s dev, 30s prod

    const currentSignature = JSON.stringify({
      userRole: userRole || 'unknown',
      isSuperAdmin: !!isSuperAdmin,
      isProvider: !!isProvider,
      authMethod: authMethod || 'unknown'
    });

    // Log only if signature changed or cooldown passed
    if (currentSignature !== lastRoleSignature || (now - lastRoleLogTime) > cooldownMs) {
      console.log('🔍 [Header] Role check:', {
        userRole: userRole || 'unknown',
        isSuperAdmin: !!isSuperAdmin,
        isProvider: !!isProvider,
        authMethod: authMethod || 'unknown'
      });
      lastRoleLogTime = now;
      lastRoleSignature = currentSignature;
    }
  }, [userRole, isSuperAdmin, isProvider, authMethod]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout, navigate]);

  const handleDropdownToggle = useCallback(() => {
    setIsDropdownOpen(prev => !prev);
  }, []);

  const getProfileLink = () => {
    if (!user) return '/login';

    if (user.role === 'CUSTOMER') {
      return '/profile';
    } else {
      return '/admin';
    }
  };

  const getUserDisplayName = () => {
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-700 relative z-50">
      {/* Temporary Diagnostic Banner */}
      {showDiagnostic && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-700 px-4 py-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-yellow-800 dark:text-yellow-200">
              🔍 [DIAGNOSTIC] Session: {backendSession} | Context: hasUser={!!user} , role={user?.role || 'N/A'}, auth={!!user}
            </span>
            <button
              onClick={() => setShowDiagnostic(false)}
              className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl">
              <Mountain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ბახმარო</h1>
              <p className="text-sm text-gray-600">კოტეჯების ჯავშანი</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <Home className="h-5 w-5" />
              <span>მთავარი</span>
            </Link>

            {!!user && (
              <Link
                to="/profile"
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/profile') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <User className="h-5 w-5" />
                <span>პროფილი</span>
              </Link>
            )}

            {/* Admin Menu Items */}
            {roleInfo.isSuperAdmin && (
              <Link
                to="/admin"
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/admin') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Shield className="h-5 w-5" />
                <span>ადმინ პანელი</span>
              </Link>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {!!user ? (
              <>
                <div className="relative">
                  <button onClick={handleDropdownToggle} className="flex items-center space-x-3 focus:outline-none">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {user.firstName?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email || 'მომხმარებელი'
                        }
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.role === 'SUPER_ADMIN' ? 'სუპერ ადმინისტრატორი' :
                         user.role === 'PROVIDER_ADMIN' ? 'პროვაიდერის ადმინისტრატორი' :
                         user.role === 'ADMIN' ? 'ადმინისტრატორი' :
                         user.role === 'PROVIDER' ? 'პროვაიდერი' :
                         user.role === 'CUSTOMER' ? 'მომხმარებელი' : 'მომხმარებელი'}
                        {user.personalId === '01019062020' && (
                          <span className="ml-1 text-xs text-blue-600 font-semibold">(Passkey Auth)</span>
                        )}
                      </p>
                    </div>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                      <Link to={getProfileLink()} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                        პროფილი
                      </Link>
                      {roleInfo.isSuperAdmin && (
                        <Link to="/admin" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                          ადმინ პანელი
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        გამოსვლა
                      </button>
                    </div>
                  )}
                </div>

                {/* Admin panel access for non-customers */}
                {user && (user.role !== 'CUSTOMER') && (
                  <Link to="/admin" className="hidden md:flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                    <Shield className="w-4 h-4" />
                    <span>ადმინ პანელი</span>
                  </Link>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <User className="h-4 w-4" />
                <span>შესვლა</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Add New Property Button for Providers */}
      {user && (user.role === 'PROVIDER' || roleInfo.isSuperAdmin) && (
        <div className="px-4 py-2">
          <button
            onClick={() => setShowUnifiedForm(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <PlusCircle className="h-5 w-5" />
            <span>ახალი ობიექტი</span>
          </button>
        </div>
      )}

      {/* Unified Property Form Modal */}
      {showUnifiedForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">ახალი ობიექტის დამატება</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              აირჩიეთ რა ტიპის ობიექტი გსურთ დამატება:
            </p>
            <div className="space-y-2">
              <Link
                to="/admin/cottages/new"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-center transition-colors"
                onClick={() => setShowUnifiedForm(false)}
              >
                კოტეჯი
              </Link>
              <Link
                to="/admin/hotels/new"
                className="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-center transition-colors"
                onClick={() => setShowUnifiedForm(false)}
              >
                სასტუმრო
              </Link>
              <Link
                to="/admin/vehicles/new"
                className="block w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-center transition-colors"
                onClick={() => setShowUnifiedForm(false)}
              >
                ტრანსპორტი
              </Link>
            </div>
            <button
              onClick={() => setShowUnifiedForm(false)}
              className="w-full mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded transition-colors"
            >
              გაუქმება
            </button>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="space-y-4">
            <Link
              to="/"
              className={`flex items-center space-x-2 py-2 rounded-lg transition-colors ${
                isActive('/') ? 'text-blue-600 font-semibold' : 'text-gray-700 hover:text-blue-600'
              }`}
              onClick={onMenuToggle}
            >
              <Home className="h-5 w-5" />
              <span>მთავარი</span>
            </Link>

            {!!user && (
              <Link
                to="/profile"
                className={`flex items-center space-x-2 py-2 rounded-lg transition-colors ${
                  isActive('/profile') ? 'text-blue-600 font-semibold' : 'text-gray-700 hover:text-blue-600'
                }`}
                onClick={onMenuToggle}
              >
                <User className="h-5 w-5" />
                <span>პროფილი</span>
              </Link>
            )}

            {/* Mobile Admin Menu Items */}
            {roleInfo.isSuperAdmin && (
              <Link
                to="/admin"
                className={`flex items-center space-x-2 py-2 rounded-lg transition-colors ${
                  isActive('/admin') ? 'text-blue-600 font-semibold' : 'text-gray-700 hover:text-blue-600'
                }`}
                onClick={onMenuToggle}
              >
                <Shield className="h-5 w-5" />
                <span>ადმინ პანელი</span>
              </Link>
            )}

            {!!user && (
              <button
                onClick={() => {
                  handleLogout();
                  onMenuToggle && onMenuToggle();
                }}
                className="w-full text-left flex items-center space-x-2 py-2 rounded-lg transition-colors text-red-500 hover:text-red-700"
              >
                <LogOut className="h-5 w-5" />
                <span>გამოსვლა</span>
              </button>
            )}

            {!user && (
              <Link
                to="/login"
                className={`flex items-center space-x-2 py-2 rounded-lg transition-colors ${
                  isActive('/login') ? 'text-blue-600 font-semibold' : 'text-gray-700 hover:text-blue-600'
                }`}
                onClick={onMenuToggle}
              >
                <User className="h-5 w-5" />
                <span>შესვლა</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
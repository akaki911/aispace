import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { User, Settings, BookOpen, Calendar, CreditCard, LogOut } from 'lucide-react';
import { useAuth } from './contexts/useAuth';
import type { UserRole } from './contexts/AuthContext.types';
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

const UserDashboard: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [showDiagnostic, setShowDiagnostic] = useState(true); // Temporary diagnostic

  const allowedRoles: UserRole[] = ['CUSTOMER', 'PROVIDER', 'PROVIDER_ADMIN', 'ADMIN', 'DEVELOPER', 'SUPER_ADMIN'];

  if (!isAuthenticated || !user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  const roleLabels: Record<UserRole, string> = {
    CUSTOMER: 'მომხმარებელი',
    PROVIDER: 'პროვაიდერი',
    PROVIDER_ADMIN: 'პროვაიდერი',
    ADMIN: 'ადმინი',
    DEVELOPER: 'დეველოპერი',
    SUPER_ADMIN: 'სუპერ ადმინი',
  };

  const userRoleLabel = roleLabels[user.role] ?? 'მომხმარებელი';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    { id: 'profile', label: 'პროფილი', icon: User },
    { id: 'bookings', label: 'ჯავშნები', icon: BookOpen },
    { id: 'calendar', label: 'კალენდარი', icon: Calendar },
    { id: 'payments', label: 'გადახდები', icon: CreditCard },
    { id: 'settings', label: 'პარამეტრები', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Temporary Diagnostic Banner */}
      {showDiagnostic && (
        <div className="bg-blue-100 dark:bg-blue-900 border-b border-blue-200 dark:border-blue-700 px-4 py-2">
          <div className="flex justify-between items-center text-sm max-w-7xl mx-auto">
            <span className="text-blue-800 dark:text-blue-200">
              🔍 [CABINET DIAGNOSTIC] Firebase user: {auth.currentUser ? 'yes' : 'no'}, role: {user?.role || 'none'}
            </span>
            <button
              onClick={() => setShowDiagnostic(false)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                მომხმარებლის კაბინეტი
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                მოგესალმებით, {user.displayName || user.email}! ({userRoleLabel})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              გასვლა
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg min-h-96 p-8">
            {/* Navigation */}
            <div className="mb-8">
              <nav className="flex space-x-8">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`inline-flex items-center px-1 py-2 border-b-2 font-medium text-sm ${
                        activeTab === item.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              {activeTab === 'profile' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    პროფილის ინფორმაცია
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ელ-ფოსტა
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {user.email}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        როლი
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {userRoleLabel}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bookings' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    ჩემი ჯავშნები
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    ჯავშნების ნახვა და მართვა მალე იქნება ხელმისაწვდომი.
                  </p>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    კალენდარი
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    კალენდრის ფუნქცია მალე იქნება ხელმისაწვდომი.
                  </p>
                </div>
              )}

              {activeTab === 'payments' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    გადახდების ისტორია
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    გადახდების ისტორია მალე იქნება ხელმისაწვდომი.
                  </p>
                </div>
              )}

              {activeTab === 'settings' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    პარამეტრები
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    პარამეტრების კონფიგურაცია მალე იქნება ხელმისაწვდომი.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
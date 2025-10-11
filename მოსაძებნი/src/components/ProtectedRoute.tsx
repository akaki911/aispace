import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserRole } from '../contexts/AuthContext';
import { useAuth } from '../contexts/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredRole?: UserRole;
  requireAuth?: boolean;
  routeType?: 'admin' | 'user';
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = [],
  requiredRole,
  requireAuth = true,
  routeType = 'user',
  fallbackPath = '/login',
}) => {
  const { user, isAuthenticated, isLoading, authInitialized } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isTestsTab =
    location.pathname.startsWith('/admin/ai-developer') && searchParams.get('tab') === 'tests';

  console.log('🔍 ProtectedRoute Analysis:', {
    path: location.pathname,
    userRole: user?.role,
    isAuthenticated,
    requiredRole,
    allowedRoles,
    hasUser: !!user
  });

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">ავტენტიკაციის შემოწმება...</p>
      </div>
    );
  }

  // Wait for auth initialization to prevent early redirects
  if (requireAuth && !authInitialized) {
    return null;
  }

  // Check authentication
  if (requireAuth && !isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check role permissions
  if (user) {
    // SUPER_ADMIN has access to everything
    if (user.role === 'SUPER_ADMIN') {
      if (isTestsTab) {
        console.log('🧪 Tests access granted');
      }
      console.log('✅ SUPER_ADMIN access granted to:', location.pathname);
      return <>{children}</>;
    }

    if (isTestsTab) {
      console.log('❌ Tests tab requires SUPER_ADMIN role');
      return <Navigate to="/dashboard" replace />;
    }

    const hasRequiredRole = requiredRole ? user.role === requiredRole : true;
    const hasAllowedRole = allowedRoles.length > 0 ? allowedRoles.includes(user.role) : true;

    if (!hasRequiredRole || !hasAllowedRole) {
      console.log('❌ Role permission denied:', { userRole: user.role, requiredRole, allowedRoles });
      // Redirect based on user role
      if (user.role === 'PROVIDER') {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  console.log('✅ Access granted to:', location.pathname);
  return <>{children}</>;
};

export default ProtectedRoute;

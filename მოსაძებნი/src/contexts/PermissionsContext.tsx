import React, { useEffect, useState, useCallback, ReactNode } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './useAuth';
import { PermissionsContext } from './PermissionsContextObject';
import type { Permission, PermissionsContextType, Role, RolePermissions } from './PermissionsContext.types';
export type { Permission, PermissionsContextType, Role, RolePermissions } from './PermissionsContext.types';

// Default permissions for each role
const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'view_dashboard',
    'manage_users',
    'manage_roles',
    'manage_cottages',
    'manage_hotels',
    'manage_vehicles',
    'manage_bookings',
    'view_bookings',
    'manage_customers',
    'view_logs',
    'manage_bank_accounts',
    'view_analytics',
    'manage_providers',
    'view_own_bookings',
    'create_booking',
    'view_calendar',
    'manage_pricing',
    'view_financial_reports',
    'manage_seasonal_pricing',
    'manage_reviews',
    'view_customer_profile',
    'switch_to_customer_view',
    'view_messaging',
    'send_messages',
    'create_support_conversations',
    'ai_developer_access',
    'view_gurulo_overview',
    'edit_gurulo_prompts',
    'manage_gurulo_users',
    'manage_gurulo_ui',
    'view_gurulo_analytics',
    'manage_gurulo_integrations',
    'view_ai_diagnostics'
  ],
  ADMIN: [
    'view_dashboard',
    'manage_cottages',
    'manage_hotels',
    'manage_vehicles',
    'view_bookings',
    'manage_customers',
    'view_calendar',
    'manage_reviews',
    'view_customer_profile',
    'view_messaging',
    'send_messages',
    'create_support_conversations'
  ],
  DEVELOPER: [
    'view_dashboard',
    'view_logs',
    'ai_developer_access',
    'view_ai_diagnostics',
    'view_gurulo_overview',
    'edit_gurulo_prompts'
  ],
  PROVIDER_ADMIN: [
    'view_dashboard',
    'view_own_bookings',
    'view_calendar',
    'manage_reviews',
    'view_customer_profile',
    'manage_cottages',
    'manage_hotels',
    'manage_vehicles',
    'view_bookings',
    'view_messaging',
    'send_messages',
    'create_support_conversations'
  ],
  PROVIDER: [
    'view_dashboard',
    'view_own_bookings',
    'view_calendar',
    'view_customer_profile',
    'view_bookings',
    'view_messaging',
    'send_messages',
    'create_support_conversations'
  ],
  CUSTOMER: [
    'view_own_bookings',
    'create_booking',
    'view_customer_profile'
  ]
};


interface PermissionsProviderProps {
  children: ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentViewMode, setCurrentViewMode] = useState<'admin' | 'customer'>('admin');
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);

  // Helper function to get permissions based on role
  const getRolePermissions = (role: Role): Permission[] => {
    return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS['CUSTOMER'];
  };

  // Check for role assignment after first booking completion
  const checkFirstBookingCompletion = async () => {
    if (!user || user.role !== 'CUSTOMER') return;

    try {
      // Check if user has completed their first booking
      const userBookingsQuery = query(
        collection(db, 'bookings'),
        where('customerInfo.userId', '==', user.id),
        where('status', '==', 'completed')
      );

      const completedBookings = await getDocs(userBookingsQuery);

      const hasCompletedFirstBooking = Boolean((user as { hasCompletedFirstBooking?: boolean }).hasCompletedFirstBooking);

      if (completedBookings.size >= 1 && !hasCompletedFirstBooking) {
        console.log('🎉 First booking completed, assigning PROVIDER_ADMIN role');

        // Update user role to PROVIDER_ADMIN
        await updateDoc(doc(db, 'users', user.id), {
          role: 'PROVIDER_ADMIN',
          hasCompletedFirstBooking: true,
          roleUpgradedAt: new Date()
        });

        // Reload permissions with new role
        const updatedUser = { ...user, role: 'PROVIDER_ADMIN' as const };
        setPermissions(DEFAULT_PERMISSIONS['PROVIDER_ADMIN']);
        console.log('✅ Role upgraded to PROVIDER_ADMIN after first booking completion');
      }
    } catch (error) {
      console.error('Error checking first booking completion:', error);
    }
  };

  // Load user permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (!isAuthenticated || !user) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        console.log('🔄 Loading permissions for user:', user.email, 'role:', user.role);

        // Check for first booking completion role assignment
        await checkFirstBookingCompletion();

        // Ensure user has a valid role, default to CUSTOMER if not
        const userRole = user.role || 'CUSTOMER';

        // Force default permissions for SUPER_ADMIN
        if (userRole === 'SUPER_ADMIN') {
          const superAdminPerms = DEFAULT_PERMISSIONS['SUPER_ADMIN'];
          setPermissions(superAdminPerms);
          console.log('✅ SUPER_ADMIN permissions loaded:', superAdminPerms.length, 'permissions');
          return;
        }

        // Load custom permissions from Firestore for other roles
        const userPermissionsDoc = await getDoc(doc(db, 'userPermissions', user.id));

        if (userPermissionsDoc.exists()) {
          const customPermissions = userPermissionsDoc.data().permissions || [];
          setPermissions(customPermissions);
          console.log('✅ Custom permissions loaded:', customPermissions);
        } else {
          // Use default permissions for role
          const defaultPerms = DEFAULT_PERMISSIONS[userRole] || DEFAULT_PERMISSIONS['CUSTOMER'];
          setPermissions(defaultPerms);
          console.log('✅ Default permissions loaded for role:', userRole, defaultPerms);
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        // Fallback to customer permissions for safety
        const defaultPerms = DEFAULT_PERMISSIONS['CUSTOMER'];
        setPermissions(defaultPerms);
      } finally {
        setIsLoading(false);
      }
    };

    // Listen for role updates
    const handleRoleUpdate = (event: CustomEvent) => {
      console.log('🔄 Role update detected, refreshing permissions');
      invalidateCache();
    };

    window.addEventListener('roleUpdated', handleRoleUpdate as EventListener);
    loadPermissions();

    return () => {
      window.removeEventListener('roleUpdated', handleRoleUpdate as EventListener);
    };
  }, [user, isAuthenticated, cacheTimestamp]); // Dependency on cacheTimestamp ensures reload on invalidation

  // Set default view mode based on user role
  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      setCurrentViewMode('customer');
    } else if (user?.role && ['SUPER_ADMIN', 'ADMIN', 'PROVIDER_ADMIN'].includes(user.role)) {
      setCurrentViewMode('admin');
    }
  }, [user]);

  const hasPermission = (permission: Permission): boolean => {
    if (!isAuthenticated || !user) return false;

    // Customers can only have customer permissions, regardless of view mode
    if (user.role === 'CUSTOMER') {
      const customerPermissions: Permission[] = [
        'view_own_bookings',
        'create_booking',
        'view_customer_profile'
      ];
      return customerPermissions.includes(permission);
    }

    // In customer view mode, only allow customer permissions
    if (currentViewMode === 'customer') {
      const customerPermissions: Permission[] = [
        'view_own_bookings',
        'create_booking',
        'view_customer_profile'
      ];
      return customerPermissions.includes(permission);
    }

    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: Permission[]): boolean => {
    return permissionList.some(permission => hasPermission(permission));
  };

  const switchViewMode = (mode: 'admin' | 'customer') => {
    if (mode === 'customer' && !canSwitchToCustomerView) {
      console.warn('User cannot switch to customer view');
      return;
    }
    setCurrentViewMode(mode);
    console.log(`🔄 View mode switched to: ${mode}`);
  };

  const canSwitchToCustomerView = hasPermission('switch_to_customer_view');

  const invalidateCache = useCallback(() => {
    console.log('🔄 Invalidating permissions cache');
    setCacheTimestamp(Date.now());
    setPermissions([]);
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Refreshing permissions for role:', user.role);

      // Force real-time role check by fetching user data again
      const backendResponse = await fetch('/api/admin/auth/me', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      let currentRole = user.role;
      if (backendResponse.ok) {
        const data = await backendResponse.json();
        if (data.ok && data.role) {
          currentRole = data.role;
          console.log('✅ Updated role from backend:', currentRole);
        }
      } else {
        console.warn('Failed to fetch user data from /api/admin/auth/me');
      }

      // Fetch custom permissions if available, otherwise use defaults
      const userPermissionsDoc = await getDoc(doc(db, 'userPermissions', user.id));
      let updatedPermissions: Permission[];

      if (userPermissionsDoc.exists()) {
        updatedPermissions = userPermissionsDoc.data().permissions || [];
        console.log('✅ Custom permissions fetched:', updatedPermissions);
      } else {
        updatedPermissions = getRolePermissions(currentRole as Role);
        console.log('✅ Default permissions fetched for role:', currentRole, updatedPermissions);
      }

      setPermissions(updatedPermissions);

    } catch (error) {
      console.error('❌ Error refreshing permissions:', error);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthenticated, cacheTimestamp]); // Depend on cacheTimestamp to re-fetch when cache is invalidated


  // Role management functions (only for SUPER_ADMIN)
  const getAllRolePermissions = async (): Promise<RolePermissions[]> => {
    if (user?.role !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN can access role permissions');
    }

    try {
      const rolePermissionsSnapshot = await getDocs(collection(db, 'rolePermissions'));
      const rolePermissions: RolePermissions[] = [];

      // Get all roles except SUPER_ADMIN
      const managableRoles: Role[] = ['ADMIN', 'DEVELOPER', 'PROVIDER_ADMIN', 'CUSTOMER'];

      for (const role of managableRoles) {
        const existingRoleDoc = rolePermissionsSnapshot.docs.find(doc => doc.id === role);

        if (existingRoleDoc) {
          rolePermissions.push({
            role,
            ...existingRoleDoc.data()
          } as RolePermissions);
        } else {
          // Create default role permissions if none exist
          const defaultRolePermissions: RolePermissions = {
            role,
            permissions: DEFAULT_PERMISSIONS[role],
            isActive: true,
            updatedAt: new Date()
          };

          await setDoc(doc(db, 'rolePermissions', role), defaultRolePermissions);
          rolePermissions.push(defaultRolePermissions);
        }
      }

      return rolePermissions;
    } catch (error) {
      console.error('Error getting role permissions:', error);
      throw error;
    }
  };

  const updateRolePermissions = async (role: Role, newPermissions: Permission[]): Promise<void> => {
    if (user?.role !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN can update role permissions');
    }

    if (role === 'SUPER_ADMIN') {
      throw new Error('Cannot modify SUPER_ADMIN permissions');
    }

    try {
      const rolePermissions: RolePermissions = {
        role,
        permissions: newPermissions,
        isActive: true,
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'rolePermissions', role), rolePermissions);
      console.log(`✅ Updated permissions for role: ${role}`);
      // Invalidate cache for affected users if they are currently logged in
      // Note: This is a simplified approach. A more robust solution might involve notifying active users.
      invalidateCache();
    } catch (error) {
      console.error('Error updating role permissions:', error);
      throw error;
    }
  };

  const resetRoleToDefaults = async (role: Role): Promise<void> => {
    if (user?.role !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN can reset role permissions');
    }

    if (role === 'SUPER_ADMIN') {
      throw new Error('Cannot reset SUPER_ADMIN permissions');
    }

    try {
      const defaultPermissions: RolePermissions = {
        role,
        permissions: DEFAULT_PERMISSIONS[role],
        isActive: true,
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'rolePermissions', role), defaultPermissions);
      console.log(`✅ Reset permissions for role: ${role} to defaults`);
      // Invalidate cache for affected users
      invalidateCache();
    } catch (error) {
      console.error('Error resetting role permissions:', error);
      throw error;
    }
  };

  // Corrected function: refreshUserRole
  const refreshUserRole = async () => {
    console.log('🔄 Refreshing user role and permissions...');

    // Clear cache
    setIsLoading(true);
    setPermissions([]);

    // Force auth context refresh
    // NOTE: This assumes `refreshUserRole` is available in the AuthContext and handles re-fetching user data.
    // If `refreshUserRole` is meant to be the `refreshPermissions` function itself, this needs adjustment.
    // For now, assuming it's a distinct function to refresh the *auth state* which might contain the latest role.
    // If `refreshAuth` is the correct function, it should be called here.
    // Based on the original code, it seems `refreshPermissions` is the intended call to re-fetch data.
    // Let's assume `refreshPermissions` is what's intended to re-fetch the user role and permissions.

    await refreshPermissions(); // Calling refreshPermissions to get the latest user role and permissions.

    // Force re-render
    setTimeout(() => {
      if (user) {
        const currentRole = user.role;
        console.log('✅ User role and permissions refreshed:', currentRole);

        // Force re-render by dispatching an event that might be listened to by consuming components
        window.dispatchEvent(new CustomEvent('permissionsRefreshed'));
      } else {
        setIsLoading(false);
      }
    }, 1000); // Small delay to allow state updates to propagate
  };

  const value: PermissionsContextType = {
    permissions,
    hasPermission,
    hasAnyPermission,
    isLoading,
    currentViewMode,
    switchViewMode,
    canSwitchToCustomerView,
    getAllRolePermissions,
    updateRolePermissions,
    resetRoleToDefaults,
    refreshPermissions,
    invalidateCache,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};
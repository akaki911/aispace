
import { useAuth } from '../contexts/AuthContext';
import { useMemo } from 'react';

export const usePermissions = () => {
  const { user, isLoading } = useAuth();

  return useMemo(() => {
    // Get role info directly from AuthContext user
    const isSuperAdmin = !isLoading && user?.role === 'SUPER_ADMIN';
    const isProviderAdmin = !isLoading && user?.role === 'PROVIDER_ADMIN';

    const canViewAllResources = () => !isLoading && isSuperAdmin;

    const canViewOwnResources = () => !isLoading && (isProviderAdmin || isSuperAdmin);

    const canManageUsers = () => !isLoading && isSuperAdmin;

    const canCreateResource = (resourceType: 'cottage' | 'hotel' | 'vehicle') => {
      return !isLoading && (isSuperAdmin || isProviderAdmin);
    };

    const canEditResource = (ownerId?: string) => {
      if (isLoading || !user) return false;
      if (isSuperAdmin) return true;
      if (isProviderAdmin && ownerId === user.id) return true;
      return false;
    };

    const canDeleteResource = (ownerId?: string) => {
      if (isLoading || !user) return false;
      if (isSuperAdmin) return true;
      if (isProviderAdmin && ownerId === user.id) return true;
      return false;
    };

    const canViewBooking = (resourceOwnerId?: string) => {
      if (isLoading || !user) return false;
      if (isSuperAdmin) return true;
      if (isProviderAdmin && resourceOwnerId === user.id) return true;
      return false;
    };

    const canManageBookingStatus = (resourceOwnerId?: string) => {
      if (isLoading || !user) return false;
      if (isSuperAdmin) return true;
      if (isProviderAdmin && resourceOwnerId === user.id) return true;
      return false;
    };

    const canViewProviderBookings = () => !isLoading && isSuperAdmin;

    const canViewBankAccounts = () => !isLoading && (isSuperAdmin || isProviderAdmin);

    const canManageBankAccounts = () => !isLoading && isSuperAdmin;

    const canManageSystem = () => !isLoading && isSuperAdmin;

    const canEditBankAccount = (ownerId?: string) => {
      if (isLoading || !user) return false;
      if (isSuperAdmin) return true;
      if (isProviderAdmin && ownerId === user.id) return true;
      return false;
    };

    const canViewSystemLogs = () => !isLoading && isSuperAdmin;

    return {
      canViewAllResources,
      canViewOwnResources,
      canManageUsers,
      canCreateResource,
      canEditResource,
      canDeleteResource,
      canViewBooking,
      canManageBookingStatus,
      canViewProviderBookings,
      canViewBankAccounts,
      canManageBankAccounts,
      canManageSystem,
      canEditBankAccount,
      canViewSystemLogs,
      currentUserId: user?.id,
      isSuperAdmin,
      isProviderAdmin,
      isLoading
    };
  }, [user, isLoading]);
};


import { useAuth } from '../contexts/useAuth';
import { useMemo, useCallback } from 'react';

export const usePermissions = () => {
  const { user, isLoading, hasRole } = useAuth();

  const hasDeveloperFlag = useCallback((candidate: typeof user): boolean => {
    if (!candidate) return false;

    const normalizedRole = typeof candidate.role === 'string' ? candidate.role.toUpperCase() : '';
    if (normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'DEVELOPER') {
      return true;
    }

    const permissions = (candidate as any)?.permissions;
    if (Array.isArray(permissions)) {
      return permissions.includes('ai_developer_access');
    }

    if (typeof (candidate as any)?.aiDeveloperAccess === 'boolean') {
      return Boolean((candidate as any)?.aiDeveloperAccess);
    }

    return false;
  }, []);

  return useMemo(() => {
    // Get role info directly from AuthContext user
    const isSuperAdmin = !isLoading && hasRole('SUPER_ADMIN');
    const isProviderAdmin = !isLoading && hasRole('PROVIDER_ADMIN');

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

    const canManageSystem = () => !isLoading && (isSuperAdmin || hasDeveloperFlag(user));

    const canEditBankAccount = (ownerId?: string) => {
      if (isLoading || !user) return false;
      if (isSuperAdmin) return true;
      if (isProviderAdmin && ownerId === user.id) return true;
      return false;
    };

    const canViewSystemLogs = () => !isLoading && isSuperAdmin;

    const hasAIDeveloperAccess = () => !isLoading && hasDeveloperFlag(user);

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
      isLoading,
      hasAIDeveloperAccess,
    };
  }, [user, isLoading, hasDeveloperFlag]);
};

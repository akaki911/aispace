import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type PermissionCheck = (permission: string) => boolean;

export interface PermissionsContextValue {
  permissions: Set<string>;
  isLoading: boolean;
  hasPermission: PermissionCheck;
  hasAIDeveloperAccess: () => boolean;
  setPermissions: (nextPermissions: Iterable<string>) => void;
}

const defaultValue: PermissionsContextValue = {
  permissions: new Set(),
  isLoading: false,
  hasPermission: () => false,
  hasAIDeveloperAccess: () => true,
  setPermissions: () => undefined,
};

const PermissionsContext = createContext<PermissionsContextValue>(defaultValue);

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [permissions, setPermissionState] = useState<Set<string>>(new Set());

  const setPermissions = useCallback((nextPermissions: Iterable<string>) => {
    setPermissionState(new Set(nextPermissions));
  }, []);

  const value = useMemo<PermissionsContextValue>(() => {
    const hasPermission: PermissionCheck = (permission) => permissions.has(permission);
    const hasAIDeveloperAccess = () =>
      hasPermission('ai.developer') || hasPermission('admin') || permissions.size === 0;

    return {
      permissions,
      isLoading: false,
      hasPermission,
      hasAIDeveloperAccess,
      setPermissions,
    };
  }, [permissions, setPermissions]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissionsContext = () => useContext(PermissionsContext);

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  personalId?: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authInitialized: boolean;
  userRole: string;
  hasRole: (role: string) => boolean;
  login: (nextUser: AuthUser) => void;
  logout: () => void;
}

const defaultAuthContext: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  authInitialized: true,
  userRole: 'guest',
  hasRole: () => false,
  login: () => undefined,
  logout: () => undefined,
};

const AuthContext = createContext<AuthContextValue>(defaultAuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const userRole = user?.roles?.[0] ?? 'guest';
    const hasRole = (role: string) => Boolean(user?.roles?.includes(role));

    return {
      user,
      isAuthenticated: Boolean(user),
      isLoading: false,
      authInitialized: true,
      userRole,
      hasRole,
      login,
      logout,
    };
  }, [login, logout, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AuthRole = 'SUPER_ADMIN' | 'ADMIN' | 'DEVELOPER' | 'VIEWER' | string;

export interface AuthUser {
  id?: string;
  personalId: string;
  role: AuthRole;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ initialUser?: AuthUser | null; children: React.ReactNode }> = ({
  initialUser = null,
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback((nextUser: AuthUser) => {
    setIsLoading(true);
    setUser(nextUser);
    setIsLoading(false);
  }, []);

  const signOut = useCallback(() => {
    setIsLoading(true);
    setUser(null);
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, isLoading, signIn, signOut }), [isLoading, signIn, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    return {
      user: null,
      isLoading: false,
      signIn: () => {
        throw new Error('useAuth: signIn is unavailable outside of AuthProvider');
      },
      signOut: () => {
        throw new Error('useAuth: signOut is unavailable outside of AuthProvider');
      },
    } satisfies AuthContextValue;
  }

  return context;
};

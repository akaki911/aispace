import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  getIdTokenResult,
  OAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  personalId?: string;
  roles: string[];
  role?: string;
}

type AuthClaims = Record<string, unknown> & {
  personal_id?: string;
  roles?: string[] | string;
};

interface AuthContextValue {
  user: AuthUser | null;
  claims: AuthClaims | null;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  authInitialized: boolean;
  userRole: string;
  hasRole: (role: string) => boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const apps = getApps();
const firebaseApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const providerId = `oidc.${import.meta.env.VITE_OIDC_PROVIDER_ID || 'azure'}`;
const apiBase = import.meta.env.VITE_API_BASE || '/api';
const allowedPersonalId = import.meta.env.VITE_ALLOWED_PERSONAL_ID;

const defaultAuthContext: AuthContextValue = {
  user: null,
  claims: null,
  isSuperAdmin: false,
  isAuthenticated: false,
  isLoading: true,
  authInitialized: false,
  userRole: 'guest',
  hasRole: () => false,
  login: async () => undefined,
  logout: async () => undefined,
};

const AuthContext = createContext<AuthContextValue>(defaultAuthContext);

const normaliseRoles = (claims: AuthClaims | null): string[] => {
  if (!claims) return [];
  const { roles } = claims;
  if (Array.isArray(roles)) {
    return roles.filter((role): role is string => typeof role === 'string');
  }
  if (typeof roles === 'string') {
    return [roles];
  }
  return [];
};

const buildAuthUser = (firebaseUser: User, claims: AuthClaims | null): AuthUser => {
  const roles = normaliseRoles(claims);
  const personalId =
    typeof claims?.personal_id === 'string' ? (claims.personal_id as string) : undefined;

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: firebaseUser.displayName ?? undefined,
    personalId,
    roles,
    role: roles[0],
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let isActive = true;

    const persistSession = async (idToken: string) => {
      try {
        const response = await fetch(`${apiBase}/auth/session`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });
        if (!response.ok) {
          console.error('Failed to persist Firebase session cookie', response.status);
        }
      } catch (error) {
        console.error('Failed to persist Firebase session cookie', error);
      }
    };

    const completeRedirect = async () => {
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (result?.user) {
          const idToken = await result.user.getIdToken(true);
          await persistSession(idToken);
        }
      } catch (error) {
        console.error('Failed to complete OIDC login redirect', error);
      }
    };

    void completeRedirect();

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setIsLoading(true);
      try {
        if (nextUser) {
          const tokenResult = await getIdTokenResult(nextUser, true);
          await persistSession(tokenResult.token);
          const nextClaims = (tokenResult.claims as AuthClaims) ?? null;
          if (!isActive) {
            return;
          }
          setClaims(nextClaims);
          setUser(buildAuthUser(nextUser, nextClaims));
        } else {
          if (!isActive) {
            return;
          }
          setClaims(null);
          setUser(null);
        }
      } catch (error) {
        if (isActive) {
          console.error('Failed to resolve Firebase authentication state', error);
          setClaims(null);
          setUser(null);
        }
      } finally {
        if (isActive) {
          setAuthInitialized(true);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async () => {
    const provider = new OAuthProvider(providerId);
    await signInWithRedirect(firebaseAuth, provider);
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to call logout endpoint', error);
    } finally {
      try {
        await signOut(firebaseAuth);
      } catch (signOutError) {
        console.error('Failed to sign out from Firebase Auth', signOutError);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const roles = normaliseRoles(claims);
    const userRole = roles[0] ?? 'guest';
    const hasRole = (role: string) => roles.includes(role);
    const isSuperAdmin = Boolean(
      claims?.personal_id && allowedPersonalId && claims.personal_id === allowedPersonalId,
    );

    return {
      user,
      claims,
      isSuperAdmin,
      isAuthenticated: Boolean(user),
      isLoading,
      authInitialized,
      userRole,
      hasRole,
      login,
      logout,
    };
  }, [authInitialized, claims, isLoading, login, logout, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);

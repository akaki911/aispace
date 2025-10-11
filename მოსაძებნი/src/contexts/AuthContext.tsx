// @ts-nocheck
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { auth, db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { singleFlight } from '../lib/singleFlight';
import { getDeviceInfo, logDeviceInfo, isDeviceFingerprintingSupported } from '../utils/deviceFingerprint';
import { AuthContext } from './AuthContextObject';
import type { AuthContextType, BookingUserData, User, UserRole } from './AuthContext.types';
export type { UserRole, AuthContextType, BookingUserData, User } from './AuthContext.types';
import { authenticateWithPasskey, registerPasskey as performPasskeyRegistration } from '../utils/webauthn_support';

interface DeviceRecognitionState {
  isRecognizedDevice: boolean;
  currentDevice?: {
    registeredRole: UserRole;
    deviceId: string;
    lastUsed: Date;
    trusted?: boolean;
  };
  suggestedAuthMethod: 'standard' | 'email' | 'passkey';
}

const KNOWN_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEVELOPER',
  'PROVIDER_ADMIN',
  'PROVIDER',
  'CUSTOMER',
];

const normalizeRoleValue = (role: unknown): UserRole | null => {
  if (typeof role !== 'string') {
    return null;
  }

  const normalized = role.toUpperCase();
  return (KNOWN_ROLES as readonly string[]).includes(normalized)
    ? (normalized as UserRole)
    : null;
};

const deriveRoleHierarchy = (primaryRole: UserRole, extras?: unknown): UserRole[] => {
  const roles = new Set<UserRole>();

  const addRole = (value: unknown) => {
    const normalized = normalizeRoleValue(value);
    if (normalized) {
      roles.add(normalized);
    }
  };

  addRole(primaryRole);

  if (Array.isArray(extras)) {
    extras.forEach(addRole);
  } else {
    addRole(extras);
  }

  if (roles.has('SUPER_ADMIN')) {
    roles.add('ADMIN');
    roles.add('DEVELOPER');
  }

  if (roles.has('DEVELOPER')) {
    roles.add('CUSTOMER');
  }

  if (roles.has('ADMIN')) {
    roles.add('CUSTOMER');
  }

  if (roles.has('PROVIDER_ADMIN')) {
    roles.add('ADMIN');
    roles.add('CUSTOMER');
  }

  if (roles.has('PROVIDER')) {
    roles.add('CUSTOMER');
  }

  if (!roles.has('CUSTOMER')) {
    roles.add('CUSTOMER');
  }

  return Array.from(roles);
};

const normalizeAuthMethod = (method: unknown): DeviceRecognitionState['suggestedAuthMethod'] => {
  return method === 'passkey' || method === 'email' ? method : 'standard';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('CUSTOMER'); // Default role
  const [userRoles, setUserRoles] = useState<UserRole[]>(['CUSTOMER']);
  const [personalId, setPersonalId] = useState<string | undefined>(undefined);
  const [firebaseUid, setFirebaseUid] = useState<string | undefined>(undefined);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [deviceRecognition, setDeviceRecognition] = useState<DeviceRecognitionState>({
    isRecognizedDevice: false,
    currentDevice: undefined,
    suggestedAuthMethod: 'standard'
  });

  // SOL-431: State for route advice
  const [routeAdvice, setRouteAdvice] = useState({
    role: null as UserRole | null,
    deviceTrust: false,
    target: '/login/customer', // Default target
    reason: '',
    authenticated: false
  });

  // Device trust level
  const [deviceTrust, setDeviceTrust] = useState<boolean>(false);

  const applyRoleState = useCallback(
    (role: unknown, extras?: unknown): { primary: UserRole; roles: UserRole[] } => {
      const normalized = normalizeRoleValue(role) ?? 'CUSTOMER';
      const derivedRoles = deriveRoleHierarchy(normalized, extras);
      setUserRole(normalized);
      setUserRoles(derivedRoles);
      return { primary: normalized, roles: derivedRoles };
    },
    []
  );

  // Device recognition functionality
  const performDeviceRecognition = async () => {
    if (!isDeviceFingerprintingSupported()) {
      console.warn('⚠️ Device fingerprinting not supported');
      return;
    }

    try {
      const deviceInfo = getDeviceInfo();
      logDeviceInfo(deviceInfo);

      const response = await fetch('/api/auth/device/recognize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: deviceInfo.clientId,
          fingerprint: deviceInfo.fingerprint,
          uaInfo: deviceInfo.uaInfo
        })
      });

      if (response.ok) {
        const recognition = await response.json();

        if (recognition.success && recognition.recognized) {
          // SOL-422: მხოლოდ trusted devices get deviceTrust=true
          const deviceTrusted = recognition.device.trusted === true;

          setDeviceRecognition({
            isRecognizedDevice: true,
            currentDevice: {
              registeredRole: recognition.device.registeredRole,
              deviceId: recognition.device.deviceId,
              lastUsed: new Date(recognition.device.lastSeenAt),
              trusted: deviceTrusted
            },
            suggestedAuthMethod: normalizeAuthMethod(recognition.suggestedAuthMethod)
          });

          // SOL-422: deviceTrust მხოლოდ Super Admin + Trusted Device
          const allowQuickLogin = recognition.device.registeredRole === 'SUPER_ADMIN' && deviceTrusted;
          setDeviceTrust(allowQuickLogin);

          console.log('📱 [Device] Recognized device:', {
            role: recognition.device.registeredRole,
            trusted: deviceTrusted,
            allowQuickLogin
          });
        } else {
          setDeviceRecognition({
            isRecognizedDevice: false,
            currentDevice: undefined,
            suggestedAuthMethod: normalizeAuthMethod(recognition.suggestedAuthMethod)
          });

          setDeviceTrust(false);

          console.log('📱 [Device] Unknown device, suggesting auth method:', recognition.suggestedAuthMethod);
        }
      }
    } catch (error) {
      console.error('❌ Device recognition failed:', error);
      setDeviceRecognition({
        isRecognizedDevice: false,
        currentDevice: undefined,
        suggestedAuthMethod: 'standard'
      });
      setDeviceTrust(false);
    }
  };

  // SOL-431: Fetch route advice from backend
  const fetchRouteAdvice = async () => {
    try {
      const response = await fetch('/api/auth/route-advice', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const advice = await response.json();
        setRouteAdvice(advice);
        console.log('📍 [Auth] Route advice received:', advice);
        return advice;
      } else {
        // Fallback to default if route advice fails
        console.warn('⚠️ [Auth] Failed to fetch route advice, falling back to default.');
        setRouteAdvice({
          role: null,
          deviceTrust: false,
          target: '/login/customer',
          reason: 'Route advice fetch failed',
          authenticated: false
        });
        return { target: '/login/customer' };
      }
    } catch (error) {
      console.error('❌ [Auth] Error fetching route advice:', error);
      // Fallback to default on error
      setRouteAdvice({
        role: null,
        deviceTrust: false,
        target: '/login/customer',
        reason: 'Route advice fetch error',
        authenticated: false
      });
      return { target: '/login/customer' };
    }
  };

  // Backend session check with timeout handling
  const checkBackendSession = async (): Promise<User | null> => {
    try {
      console.log('🔍 Bootstrap authentication check...');

      // Perform device recognition first
      await performDeviceRecognition();

      // Step 1: Check admin session first
      const adminResponse = await fetch('/api/admin/webauthn/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      // Handle session timeout responses
      if (adminResponse.status === 401) {
        const data = await adminResponse.json();
        if (data.code === 'SESSION_IDLE_TIMEOUT') {
          console.log('🚪 [AUTH] Session expired due to inactivity');
          // Clear local state
          setUser(null);
          setIsAuthenticated(false);
          // Redirect to login if needed
          return null;
        }
      }

      if (import.meta.env.DEV) {
        console.log('🔍 Admin session response:', {
          status: adminResponse.status,
          statusText: adminResponse.statusText
        });
      }

      if (adminResponse.ok) {
        const data = await adminResponse.json();
        const userRole = data.role || data.user?.role;
        const userId = data.userId || data.user?.id;

        if (userRole === 'SUPER_ADMIN' || data.isSuperAdmin) {
          const normalized = normalizeRoleValue(userRole) ?? 'SUPER_ADMIN';
          const resolvedRoles = deriveRoleHierarchy(normalized, data.roles ?? data.user?.roles);
          const adminUser: User = {
            id: userId || '01019062020',
            email: data.user?.email || 'admin@bakhmaro.co',
            role: normalized,
            roles: resolvedRoles,
            personalId: data.user?.personalId || userId || '01019062020',
            displayName: data.user?.displayName || 'სუპერ ადმინისტრატორი',
            authMethod: 'webauthn' as const
          };

          if (import.meta.env.DEV) {
            console.log('✅ Admin session valid:', adminUser);
          }
          return adminUser;
        }
      }

      // Step 2: Check general auth session
      const generalResponse = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (import.meta.env.DEV) {
        console.log('🔍 General session response:', {
          status: generalResponse.status,
          statusText: generalResponse.statusText
        });
      }

      if (generalResponse.ok) {
        const data = await generalResponse.json();

        if (data.user && data.authenticated) {
          const normalized = normalizeRoleValue(data.user.role) ?? 'CUSTOMER';
          const resolvedRoles = deriveRoleHierarchy(normalized, data.user.roles);
          const user: User = {
            id: data.user.id,
            email: data.user.email,
            role: normalized,
            roles: resolvedRoles,
            personalId: data.user.personalId,
            displayName: data.user.displayName,
            authMethod: 'firebase' as const
          };

          if (import.meta.env.DEV) {
            console.log('✅ General session valid:', user);
          }
          return user;
        }
      }

    } catch (error) {
      if (import.meta.env.DEV) {
        console.log('❌ Session check error:', error);
      }
    }
    return null;
  };

  // Get Firebase user role
  const getUserRole = async (firebaseUser: FirebaseUser): Promise<UserRole> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return (userData.role as UserRole) || 'CUSTOMER';
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
    return 'CUSTOMER';
  };

  // Create Firestore user document
  const createUserDocument = async (firebaseUser: FirebaseUser, role: UserRole = 'CUSTOMER', additionalData?: BookingUserData) => {
    try {
      const userData = {
        email: firebaseUser.email,
        role,
        roles: [role],
        createdAt: new Date(),
        updatedAt: new Date(),
        displayName: additionalData?.firstName && additionalData?.lastName
          ? `${additionalData.firstName} ${additionalData.lastName}`
          : firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        emailVerified: firebaseUser.emailVerified,
        ...(additionalData?.phoneNumber && { phoneNumber: additionalData.phoneNumber }),
        ...(additionalData?.personalId && { personalId: additionalData.personalId }),
        ...(additionalData?.firstName && { firstName: additionalData.firstName }),
        ...(additionalData?.lastName && { lastName: additionalData.lastName }),
        isActive: true,
        preferences: {
          notifications: { email: true, sms: !!additionalData?.phoneNumber, push: false },
          language: 'ka',
          theme: 'light'
        },
        totalBookings: 0,
        lastLoginAt: new Date(),
        registrationSource: 'booking_form'
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
      if (import.meta.env.DEV) {
        console.log('✅ User document created in Firestore');
      }
    } catch (error) {
      console.error('❌ Error creating user document:', error);
      throw error;
    }
  };

  // Optimized authentication initialization with faster loading
  useEffect(() => {
    let mounted = true;
    let firebaseUnsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout;

    const initAuth = async () => {
      if (import.meta.env.DEV) {
        console.log('🔄 Initializing authentication...');
      }

      // Increased timeout to prevent 429 errors (10 seconds in dev, 8 in prod)
      const authTimeout = import.meta.env.DEV ? 10000 : 8000;
      timeoutId = setTimeout(() => {
        if (mounted) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Auth initialization timeout after', authTimeout/1000, 'seconds - Proceeding with Firebase');
          }
          setIsLoading(false);
          setAuthInitialized(true);
          setIsAuthReady(true);
        }
      }, authTimeout);

      try {
        // SOL-431: Fetch route advice first
        const advice = await fetchRouteAdvice();

        // Backend session check with timeout
        const backendSessionPromise = checkBackendSession();
        const sessionRaceResult = await Promise.race([
          backendSessionPromise.then((user) => ({ type: 'result', user })),
          new Promise((resolve) =>
            setTimeout(() => {
              if (import.meta.env.DEV) {
                console.warn('⚠️ Session check still pending after 6 seconds; waiting for backend response');
              }
              resolve({ type: 'timeout' });
            }, 6000)
          )
        ]);

        let sessionUser = null;

        if (sessionRaceResult && sessionRaceResult.type === 'timeout') {
          sessionUser = await backendSessionPromise;
        } else if (sessionRaceResult && sessionRaceResult.type === 'result') {
          sessionUser = sessionRaceResult.user;
        }

        if (sessionUser && mounted) {
          clearTimeout(timeoutId);
          const { primary, roles: resolvedRoles } = applyRoleState(
            sessionUser.role,
            sessionUser.roles
          );
          const resolvedUser: User = {
            ...sessionUser,
            role: primary,
            roles: resolvedRoles,
          };
          setUser(resolvedUser);
          setIsAuthenticated(true);
          setPersonalId(resolvedUser.personalId);
          setFirebaseUid(resolvedUser.id);
          // Update route advice based on session user
          setRouteAdvice(prev => ({
            ...prev,
            role: primary,
            target: advice?.target || prev.target, // Use advice target if available
            authenticated: true,
          }));
          setIsLoading(false);
          setAuthInitialized(true);
          setIsAuthReady(true);
          return;
        }
      } catch (error) {
        // Enhanced error logging
        if (import.meta.env.DEV) {
          console.error('❌ [AUTH] Session check error:', {
            error: (error as Error)?.message,
            stack: (error as Error)?.stack,
            timestamp: new Date().toISOString()
          });
          console.log('⚡ Continuing with Firebase auth');
        }
      }

      // Set up Firebase auth listener with network error handling
      firebaseUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;

        // SOL-431: Fetch route advice even if Firebase user is null
        const advice = await fetchRouteAdvice();

        if (firebaseUser) {
          try {
            // Add timeout for Firestore operations
            const userDoc = await Promise.race([
              getDoc(doc(db, 'users', firebaseUser.uid)),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firestore timeout')), 5000)
              )
            ]);

            if (userDoc && userDoc.exists()) {
              const userData = userDoc.data();
              const { primary, roles: resolvedRoles } = applyRoleState(
                userData.role,
                userData.roles
              );
              const newUser: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email!,
                role: primary,
                roles: resolvedRoles,
                displayName: userData.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                personalId: userData.personalId,
                authMethod: 'firebase' as const
              };
              setUser(newUser);
              setIsAuthenticated(true);
              setPersonalId(newUser.personalId);
              setFirebaseUid(newUser.id);
              // Update route advice based on Firebase user
              setRouteAdvice(prev => ({
                ...prev,
                role: primary,
                target: advice?.target || prev.target, // Use advice target if available
                authenticated: true,
              }));
            } else {
              // New user
              const { primary, roles: resolvedRoles } = applyRoleState('CUSTOMER');
              const newUserProfile: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: primary,
                roles: resolvedRoles,
                personalId: '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                authMethod: 'firebase'
              };
              setUser(newUserProfile);
              setIsAuthenticated(true);
              setPersonalId('');
              setFirebaseUid(newUserProfile.id);
              // Update route advice for new user
              setRouteAdvice(prev => ({
                ...prev,
                role: primary,
                target: advice?.target || prev.target, // Use advice target if available
                authenticated: true,
              }));
            }
          } catch (error) {
            console.error('❌ Firebase/Network error:', error);

            // Enhanced fallback for network issues
            const fallbackUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'CUSTOMER' as UserRole,
              personalId: '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
              authMethod: 'firebase' as const,
              offline: true
            };

            const { primary, roles: resolvedRoles } = applyRoleState(fallbackUser.role);
            const resolvedFallbackUser: User = {
              ...fallbackUser,
              role: primary,
              roles: resolvedRoles,
            };

            // Store user in localStorage for offline access
            try {
              localStorage.setItem('offline_user', JSON.stringify(resolvedFallbackUser));
              console.log('💾 User stored offline for future access');
            } catch (storageError) {
              console.warn('⚠️ localStorage not available');
            }

            setUser(resolvedFallbackUser);
            setIsAuthenticated(true);
            setPersonalId('');
            setFirebaseUid(resolvedFallbackUser.id);
            // Update route advice for offline user
            setRouteAdvice(prev => ({
              ...prev,
              role: primary,
              target: advice?.target || prev.target, // Use advice target if available
              authenticated: true, // Assume authenticated for offline access
            }));
          }
        } else {
          // No user - check for offline user
          try {
            const offlineUser = localStorage.getItem('offline_user');
            if (offlineUser && import.meta.env.DEV) {
              const userData = JSON.parse(offlineUser);
              console.log('🔄 Restoring offline user session');
              const { primary, roles: resolvedRoles } = applyRoleState(
                userData.role,
                userData.roles
              );
              const resolvedOfflineUser: User = {
                ...userData,
                role: primary,
                roles: resolvedRoles,
              };
              setUser(resolvedOfflineUser);
              setIsAuthenticated(true);
              setPersonalId(resolvedOfflineUser.personalId);
              setFirebaseUid(resolvedOfflineUser.id);
            } else {
              setUser(null);
              setIsAuthenticated(false);
              applyRoleState('CUSTOMER');
              setPersonalId(undefined);
              setFirebaseUid(undefined);
              // Update route advice when logged out
              setRouteAdvice(prev => ({
                ...prev,
                role: null,
                target: advice?.target || '/login/customer', // Use advice target or default
                authenticated: false,
              }));
            }
          } catch (error) {
            console.warn('⚠️ Could not restore offline user');
            setUser(null);
            setIsAuthenticated(false);
            applyRoleState('CUSTOMER');
            setPersonalId(undefined);
            setFirebaseUid(undefined);
            // Update route advice on error
            setRouteAdvice(prev => ({
              ...prev,
              role: null,
              target: advice?.target || '/login/customer', // Use advice target or default
              authenticated: false,
            }));
          }
        }

        setIsLoading(false);
        setAuthInitialized(true);
        setIsAuthReady(true);
      });
    };

    initAuth();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (firebaseUnsubscribe) {
        firebaseUnsubscribe();
      }
    };
  }, []);

  // Firebase Authentication Methods
  const login = async (email: string, password: string, trustDevice: boolean = false) => {
    try {
      setIsLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const role = await getUserRole(userCredential.user);

      const { primary, roles: resolvedRoles } = applyRoleState(role);
      const user: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        role: primary,
        roles: resolvedRoles,
        displayName: userCredential.user.displayName || userCredential.user.email?.split('@')[0],
        authMethod: 'firebase'
      };

      setUser(user);
      setIsAuthenticated(true);
      setPersonalId(user.personalId);
      setFirebaseUid(user.id);

      // SOL-422: რეგისტრაცია მხოლოდ წარმატებული ავტორიზაციის შემდეგ
      if (!deviceRecognition.isRecognizedDevice) {
        await registerCurrentDevice(primary, trustDevice);
      }
      // SOL-431: Update route advice after login
      const advice = await fetchRouteAdvice();
      setRouteAdvice(prev => ({
        ...prev,
        role: primary,
        target: advice?.target || prev.target,
        authenticated: true,
      }));
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, role: UserRole = 'CUSTOMER', additionalData?: BookingUserData) => {
    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDocument(userCredential.user, role, additionalData);

      const { primary, roles: resolvedRoles } = applyRoleState(role);
      const user: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        role: primary,
        roles: resolvedRoles,
        personalId: additionalData?.personalId,
        displayName: additionalData?.firstName && additionalData?.lastName
          ? `${additionalData.firstName} ${additionalData.lastName}`
          : userCredential.user.email?.split('@')[0],
        authMethod: 'firebase'
      };

      setUser(user);
      setIsAuthenticated(true);
      setPersonalId(user.personalId);
      setFirebaseUid(user.id);

      // SOL-431: Update route advice after registration
      const advice = await fetchRouteAdvice();
      setRouteAdvice(prev => ({
        ...prev,
        role: primary,
        target: advice?.target || prev.target,
        authenticated: true,
      }));
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  // WebAuthn Methods (SUPER_ADMIN only) - Simplified
  const loginWithPasskey = async (trustDevice: boolean = false): Promise<void> => {
    try {
      const advice = await fetchRouteAdvice();
      const result = await authenticateWithPasskey(false);

      if (!result.success || !result.user) {
        throw new Error('Passkey ავტორიზაცია ვერ მოხერხდა');
      }

      const sessionUser = await checkBackendSession();
      const resolvedUser = sessionUser || {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role as UserRole,
        displayName: result.user.displayName,
        authMethod: 'webauthn' as const,
        authenticatedViaPasskey: true,
      };

      const { primary, roles: resolvedRoles } = applyRoleState(
        resolvedUser.role,
        resolvedUser.roles
      );
      const normalizedUser: User = {
        ...resolvedUser,
        role: primary,
        roles: resolvedRoles,
      };

      setUser(normalizedUser);
      setIsAuthenticated(true);
      setPersonalId(normalizedUser.personalId);
      setFirebaseUid(normalizedUser.id);

      if (!deviceRecognition.isRecognizedDevice) {
        await registerCurrentDevice(primary, trustDevice);
      }

      setRouteAdvice(prev => ({
        ...prev,
        role: primary,
        target: advice?.target || prev.target,
        authenticated: true,
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Passkey ავტორიზაცია ვერ მოხერხდა');
    }
  };

  const registerPasskey = async (): Promise<void> => {
    if (!user) {
      throw new Error('მომხმარებლის სესია არ არის აქტიური');
    }

    const registrationId = user.uid || firebaseUid || user.id;
    if (!registrationId) {
      throw new Error('ვერ განისაზღვრა მომხმარებლის იდენტიფიკატორი Passkey-სთვის');
    }

    await performPasskeyRegistration({
      userId: registrationId,
      email: user.email,
    });
  };

  const generateFallbackCode = async (reason: string): Promise<void> => {
    // Implement fallback code generation
    throw new Error('Fallback code generation not implemented');
  };

  const verifyFallbackCode = async (fallbackCode: string): Promise<void> => {
    // Implement fallback code verification
    throw new Error('Fallback code verification not implemented');
  };

  // Logout - synchronized across all services
  const logout = async () => {
    let currentUserRole = user?.role; // Store current role before clearing state
    
    try {
      console.log('🚪 [AUTH] Starting synchronized logout...');

      // 1. Logout from admin WebAuthn session
      try {
        await fetch('/api/admin/webauthn/logout', {
          method: 'POST',
          credentials: 'include',
        });
        console.log('✅ [AUTH] Admin WebAuthn logout successful');
      } catch (error) {
        console.warn('⚠️ [AUTH] Admin WebAuthn logout failed:', error);
      }

      // 2. Logout from admin auth session
      try {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        console.log('✅ [AUTH] Admin auth logout successful');
      } catch (error) {
        console.warn('⚠️ [AUTH] Admin auth logout failed:', error);
      }

      // 3. Logout from general auth session
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        console.log('✅ [AUTH] General auth logout successful');
      } catch (error) {
        console.warn('⚠️ [AUTH] General auth logout failed:', error);
      }

      // 4. Logout from Firebase
      try {
        await signOut(auth);
        console.log('✅ [AUTH] Firebase logout successful');
      } catch (error) {
        console.warn('⚠️ [AUTH] Firebase logout failed:', error);
      }

      // 5. Clear all local state
      setUser(null);
      setIsAuthenticated(false);
      applyRoleState('CUSTOMER'); // Reset role
      setPersonalId(undefined);
      setFirebaseUid(undefined);
      setDeviceRecognition({
        isRecognizedDevice: false,
        currentDevice: undefined,
        suggestedAuthMethod: 'standard'
      });
      setDeviceTrust(false);

      // 6. Store last user role for better UX, then clear localStorage
      try {
        if (currentUserRole) {
          localStorage.setItem('lastUserRole', currentUserRole);
          console.log('💾 [AUTH] Last user role stored:', currentUserRole);
        }
        localStorage.removeItem('offline_user');
        localStorage.removeItem('bakhmaro_session');
        console.log('✅ [AUTH] Local storage cleared');
      } catch (error) {
        console.warn('⚠️ [AUTH] Local storage clear failed:', error);
      }

      // 7. Determine correct logout target based on user role
      let logoutTarget = '/login/customer'; // Default for regular users
      
      if (currentUserRole === 'SUPER_ADMIN') {
        logoutTarget = '/login'; // Redirect SUPER_ADMIN to main login page with admin options
        console.log('🔧 [AUTH] SUPER_ADMIN logout - redirecting to admin login');
      } else if (currentUserRole === 'PROVIDER') {
        logoutTarget = '/login/provider';
        console.log('🔧 [AUTH] PROVIDER logout - redirecting to provider login');
      }

      // 8. Reset route advice on logout with role-specific target
      setRouteAdvice({
        role: null,
        deviceTrust: false,
        target: logoutTarget,
        reason: `${currentUserRole || 'User'} logged out`,
        authenticated: false
      });

      console.log('✅ [AUTH] Synchronized logout completed with target:', logoutTarget);

      // 9. Force navigation to appropriate login page
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.href = logoutTarget;
        }, 100); // Small delay to ensure state is cleared
      }

    } catch (error) {
      console.error('❌ [AUTH] Logout error:', error);
      // Force clear state even if logout calls fail
      setUser(null);
      setIsAuthenticated(false);
      applyRoleState('CUSTOMER');
      setPersonalId(undefined);
      setFirebaseUid(undefined);
      
      // Still redirect based on role even on error
      const fallbackTarget = currentUserRole === 'SUPER_ADMIN' ? '/login' : '/login/customer';
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.href = fallbackTarget;
        }, 100);
      }
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  };

  const refreshUserRole = async () => {
    // Force re-authentication check
    const sessionUser = await checkBackendSession();
    if (sessionUser) {
      const { primary, roles: resolvedRoles } = applyRoleState(
        sessionUser.role,
        sessionUser.roles
      );
      const resolvedUser: User = {
        ...sessionUser,
        role: primary,
        roles: resolvedRoles,
      };
      setUser(resolvedUser);
      setIsAuthenticated(true);
      setPersonalId(resolvedUser.personalId);
      setFirebaseUid(resolvedUser.id);
      // SOL-431: Update route advice after refresh
      const advice = await fetchRouteAdvice();
      setRouteAdvice(prev => ({
        ...prev,
        role: primary,
        target: advice?.target || prev.target,
        authenticated: true,
      }));
      return;
    }

    if (auth.currentUser) {
      const role = await getUserRole(auth.currentUser);
      const { primary, roles: resolvedRoles } = applyRoleState(role);
      const userData: User = {
        id: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        role: primary,
        roles: resolvedRoles,
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0],
        authMethod: 'firebase' as const
      };
      setUser(userData);
      setIsAuthenticated(true);
      setPersonalId(userData.personalId);
      setFirebaseUid(userData.id);
      // SOL-431: Update route advice after refresh
      const advice = await fetchRouteAdvice();
      setRouteAdvice(prev => ({
        ...prev,
        role: primary,
        target: advice?.target || prev.target,
        authenticated: true,
      }));
    }
  };

  // Booking integration methods - simplified
  const registerFromBookingForm = async (userData: BookingUserData): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    await createUserDocument(userCredential.user, 'CUSTOMER', userData);

    const { primary, roles: resolvedRoles } = applyRoleState('CUSTOMER');
    const user: User = {
      id: userCredential.user.uid,
      email: userData.email,
      role: primary,
      roles: resolvedRoles,
      personalId: userData.personalId,
      displayName: `${userData.firstName} ${userData.lastName}`,
      authMethod: 'firebase'
    };

    setUser(user);
    setIsAuthenticated(true);
    setPersonalId(user.personalId);
    setFirebaseUid(user.id);
    // SOL-431: Update route advice after registration from booking form
    const advice = await fetchRouteAdvice();
    setRouteAdvice(prev => ({
      ...prev,
      role: primary,
      target: advice?.target || prev.target,
      authenticated: true,
    }));
    return user;
  };

  const loginWithPhoneAndPassword = async (phone: string, password: string): Promise<void> => {
    // Find user by phone and login with email
    const q = query(collection(db, 'users'), where('phoneNumber', '==', phone.trim()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('მომხმარებელი ამ ტელეფონის ნომრით ვერ მოიძებნა');
    }

    const userData = querySnapshot.docs[0].data();
    if (!userData.email) {
      throw new Error('მომხმარებლის ელ-ფოსტა ვერ მოიძებნა');
    }

    await login(userData.email, password);
  };

  const checkUserExists = async (phoneOrEmail: string, personalId?: string): Promise<boolean> => {
    try {
      const queries = [];
      if (phoneOrEmail.includes('@')) {
        queries.push(query(collection(db, 'users'), where('email', '==', phoneOrEmail.toLowerCase())));
      } else {
        queries.push(query(collection(db, 'users'), where('phoneNumber', '==', phoneOrEmail.trim())));
      }

      if (personalId) {
        queries.push(query(collection(db, 'users'), where('personalId', '==', personalId.trim())));
      }

      const results = await Promise.all(queries.map(q => getDocs(q)));
      return results.some(snapshot => !snapshot.empty);
    } catch (error) {
      console.error('❌ Error checking user existence:', error);
      return false;
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found': return 'მომხმარებელი ვერ მოიძებნა';
      case 'auth/wrong-password': return 'არასწორი პაროლი';
      case 'auth/email-already-in-use': return 'ეს ელ-ფოსტა უკვე გამოიყენება';
      case 'auth/weak-password': return 'ძალიან სუსტი პაროლი (მინიმუმ 6 სიმბოლო)';
      case 'auth/invalid-email': return 'არასწორი ელ-ფოსტის ფორმატი';
      case 'auth/too-many-requests': return 'ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით';
      case 'auth/network-request-failed': return 'ქსელის შეცდომა. შეამოწმეთ ინტერნეტ კავშირი';
      default: return 'შეცდომა ავტორიზაციისას';
    }
  };

  const updateUserRole = (newRole: UserRole) => {
    const { primary, roles: resolvedRoles } = applyRoleState(newRole);
    // Update the user object in state if it exists
    setUser(currentUser =>
      currentUser ? { ...currentUser, role: primary, roles: resolvedRoles } : null
    );
  };

  const updateUserPreferences = useCallback(async (newPreferences) => {
    if (!newPreferences || typeof newPreferences !== 'object') {
      return;
    }

    let mergedPreferences = null;

    setUser(currentUser => {
      if (!currentUser) {
        return currentUser;
      }

      mergedPreferences = {
        ...(currentUser.preferences ?? {}),
        ...newPreferences,
      };

      return {
        ...currentUser,
        preferences: mergedPreferences,
      };
    });

    const docId = firebaseUid || auth.currentUser?.uid;

    if (!docId || !mergedPreferences) {
      return;
    }

    try {
      await setDoc(
        doc(db, 'users', docId),
        {
          preferences: mergedPreferences,
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('❌ Error updating user preferences:', error);
    }
  }, [firebaseUid]);

  const checkUserRole = async () => {
    try {
      const data = await singleFlight("checkUserRole", async () => {
        const response = await fetch("/api/admin/webauthn/me", { // Changed endpoint
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });

      if (data.user) {
        const { primary, roles: resolvedRoles } = applyRoleState(
          data.user.role,
          data.user.roles
        );
        const resolvedUser: User = {
          ...data.user,
          role: primary,
          roles: resolvedRoles,
        };
        setUser(resolvedUser);
        setPersonalId(resolvedUser.personalId);
        setIsAuthenticated(true);
        setFirebaseUid(resolvedUser.id);
        // SOL-431: Update route advice after role check
        const advice = await fetchRouteAdvice();
        setRouteAdvice(prev => ({
          ...prev,
          role: primary,
          target: advice?.target || prev.target,
          authenticated: true,
        }));
      }
    } catch (error) {
      console.error('Role check error:', error);
    } finally {
      setIsAuthReady(true);
    }
  };

  // SOL-422: Set device trust method
  const setDeviceTrustMethod = async (deviceId: string, trusted: boolean) => {
    try {
      const response = await fetch('/api/auth/device/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deviceId, trusted })
      });

      if (response.ok) {
        console.log(`✅ Device trust updated: ${deviceId} -> ${trusted}`);

        // Update local state if this is current device
        if (deviceRecognition.currentDevice?.deviceId === deviceId) {
          setDeviceRecognition(prev => ({
            ...prev,
            currentDevice: prev.currentDevice ? {
              ...prev.currentDevice,
              trusted
            } : undefined
          }));

          // SOL-422: deviceTrust მხოლოდ Super Admin + Trusted Device
          const allowQuickLogin = user?.role === 'SUPER_ADMIN' && trusted;
          setDeviceTrust(allowQuickLogin);
        }
      }
    } catch (error) {
      console.error('❌ Device trust update error:', error);
    }
  };

  // Device recognition functions
  const generateDeviceFingerprint = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('device-fingerprint', 10, 10);
    const canvasData = canvas.toDataURL();

    const fingerprint = btoa(JSON.stringify({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvasData.slice(-50) // Last 50 chars
    })).slice(0, 32);

    return fingerprint;
  };

  const checkDeviceRecognition = async () => {
    try {
      const deviceId = generateDeviceFingerprint();

      const response = await fetch('/api/device/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deviceId })
      });

      if (response.ok) {
        const deviceData = await response.json();
        if (deviceData.recognized) {
          setDeviceRecognition({
            isRecognizedDevice: true,
            currentDevice: deviceData.device,
            suggestedAuthMethod: deviceData.device.registeredRole === 'SUPER_ADMIN' ? 'passkey' : 'email'
          });
          return;
        }
      }
    } catch (error) {
      console.warn('Device recognition check failed:', error);
    }

    setDeviceRecognition({
      isRecognizedDevice: false,
      currentDevice: undefined,
      suggestedAuthMethod: 'standard'
    });
  };

  const registerCurrentDevice = async (role: UserRole, trustDevice: boolean = false) => {
    if (!isDeviceFingerprintingSupported()) {
      console.warn('⚠️ Device fingerprinting not supported');
      return;
    }

    try {
      const deviceInfo = getDeviceInfo();

      const response = await fetch('/api/auth/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId: deviceInfo.clientId,
          fingerprint: deviceInfo.fingerprint,
          uaInfo: deviceInfo.uaInfo,
          trustDevice: trustDevice // SOL-422: გადასცემ trust პრეფერენცს
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log(`✅ Device registered with role: ${role}, trusted: ${trustDevice}`);

          // Update device recognition state
          setDeviceRecognition({
            isRecognizedDevice: true,
            currentDevice: {
              registeredRole: role as UserRole,
              deviceId: result.deviceId,
              lastUsed: new Date(),
              trusted: trustDevice
            },
            suggestedAuthMethod: role === 'SUPER_ADMIN' ? 'passkey' : 'standard'
          });

          // SOL-422: deviceTrust მხოლოდ Super Admin + Trusted Device
          const allowQuickLogin = role === 'SUPER_ADMIN' && trustDevice;
          setDeviceTrust(allowQuickLogin);
        }
      }
    } catch (error) {
      console.error('❌ Device registration error:', error);
    }
  };

  // SOL-431: Auto-routing method
  const getAutoRouteTarget = () => {
    try {
      // Feature flag checking for browser environment
      const isRoleAwareEnabled = localStorage.getItem('ROLE_AWARE_ENTRY') !== 'false';

      if (!isRoleAwareEnabled) {
        console.log('🚫 [ROUTE] Auto-routing disabled by feature flag');
        return '/login/select-role';
      }

      // Special handling for SUPER_ADMIN - always go to admin
      if (user?.role === 'SUPER_ADMIN' || routeAdvice.role === 'SUPER_ADMIN') {
        console.log('🔧 [ROUTE] SUPER_ADMIN detected, redirecting to admin');
        return '/admin';
      }

      return routeAdvice.target;
    } catch (error) {
      console.warn('⚠️ [ROUTE] Error checking feature flags, using default target');
      return routeAdvice.target || '/login/customer';
    }
  };

  const shouldShowRoleSelection = () => {
    // Only show role selection with debug flag
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === '1';
  };

  // Perform device recognition on component mount
  useEffect(() => {
    performDeviceRecognition();
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    roles: userRoles,
    hasRole: (role: UserRole) => userRoles.includes(role),
    isLoading,
    login,
    register,
    resetPassword,
    loginWithPasskey,
    registerPasskey,
    generateFallbackCode,
    verifyFallbackCode,
    logout,
    refreshUserRole,
    registerFromBookingForm,
    loginWithPhoneAndPassword,
    checkUserExists,
    authInitialized,
    deviceRecognition,
    deviceTrust,
    registerCurrentDevice,
    setDeviceTrust: setDeviceTrustMethod,
    getAutoRouteTarget,
    shouldShowRoleSelection,
    routeAdvice,
    // Compatibility properties
    id: user?.id ?? null,
    email: user?.email ?? null,
    role: userRole,
    isAuthReady,
    personalId,
    firebaseUid,
    userRole,
    updateUserRole,
    checkUserRole,
    updateUserPreferences
  }), [
    user, isAuthenticated, isLoading, authInitialized, deviceRecognition, deviceTrust,
    userRole, userRoles, isAuthReady, personalId, firebaseUid,
    login, logout, registerCurrentDevice, setDeviceTrustMethod,
    routeAdvice, // Include routeAdvice in dependencies
    updateUserPreferences,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
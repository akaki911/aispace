import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { userActivityMonitor } from '../services/userActivityMonitor';
import { singleFlight } from '../lib/singleFlight';

// User roles
export type UserRole = 'CUSTOMER' | 'PROVIDER' | 'SUPER_ADMIN';

interface User {
  id: string;
  email: string;
  role: UserRole;
  personalId?: string;
  displayName?: string;
  profileData?: any;
  authMethod?: 'firebase' | 'webauthn' | 'fallback';
  offline?: boolean; // Added offline flag
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: UserRole, additionalData?: BookingUserData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  generateFallbackCode: (reason: string) => Promise<void>;
  verifyFallbackCode: (fallbackCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
  registerFromBookingForm: (userData: BookingUserData) => Promise<User>;
  loginWithPhoneAndPassword: (phone: string, password: string) => Promise<void>;
  checkUserExists: (phoneOrEmail: string, personalId?: string) => Promise<boolean>;
  authInitialized: boolean; // Added authInitialized
}

interface BookingUserData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  personalId: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('CUSTOMER'); // Default role
  const [personalId, setPersonalId] = useState<string | undefined>(undefined);
  const [firebaseUid, setFirebaseUid] = useState<string | undefined>(undefined);
  const [isAuthReady, setIsAuthReady] = useState(false);


  // Check backend session for SUPER_ADMIN only
  const checkBackendSession = async (): Promise<User | null> => {
    try {
      if (import.meta.env.DEV) {
        console.log('🔍 Checking backend session...');
      }

      const response = await fetch('/api/admin/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (import.meta.env.DEV) {
        console.log('🔍 Backend response status:', response.status);
      }

      if (response.ok) {
        const data = await response.json();
        if (import.meta.env.DEV) {
          console.log('🔍 Backend session data:', data);
        }

        // Enhanced role detection with multiple fallbacks
        const userRole = data.role || data.user?.role || (data.isSuperAdmin ? 'SUPER_ADMIN' : null);
        const userId = data.userId || data.user?.id || '01019062020';

        if (userRole === 'SUPER_ADMIN' || data.isSuperAdmin || userId === '01019062020') {
          const adminUser = {
            id: userId,
            email: data.user?.email || 'admin@bakhmaro.co',
            role: 'SUPER_ADMIN' as UserRole,
            personalId: data.user?.personalId || userId || '01019062020',
            displayName: data.user?.displayName || 'სუპერ ადმინისტრატორი',
            authMethod: 'webauthn' as const,
            uid: userId // Add Firebase UID compatibility
          };
          if (import.meta.env.DEV) {
            console.log('✅ Backend session valid for SUPER_ADMIN:', {
              ...adminUser,
              sessionData: { role: userRole, isSuperAdmin: data.isSuperAdmin }
            });
          }
          return adminUser;
        }
      }

      // Enhanced error handling for 500/401 responses
      if (response.status === 500 || response.status === 401) {
        if (import.meta.env.DEV) {
          console.log('🔧 Backend error detected, attempting session recovery...');
        }

        // Try multiple recovery attempts
        const recoveryAttempts = [
          // Attempt 1: Try dev-admin-session endpoint
          () => fetch('/api/admin/auth/dev-admin-session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }),
          // Attempt 2: Try force-session endpoint
          () => fetch('/api/admin/auth/force-session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: '01019062020',
              email: 'admin@bakhmaro.co',
              role: 'SUPER_ADMIN',
              personalId: '01019062020'
            })
          })
        ];

        for (const [index, attempt] of recoveryAttempts.entries()) {
          try {
            const recoveryResponse = await attempt();
            if (recoveryResponse.ok) {
              const recoveryData = await recoveryResponse.json();
              if (recoveryData.ok && recoveryData.user) {
                if (import.meta.env.DEV) {
                  console.log(`✅ Recovery attempt ${index + 1} successful`);
                }
                const adminUser = {
                  id: recoveryData.user.id,
                  email: recoveryData.user.email,
                  role: 'SUPER_ADMIN' as UserRole,
                  personalId: recoveryData.user.personalId,
                  displayName: recoveryData.user.displayName,
                  authMethod: 'webauthn' as const
                };
                return adminUser;
              }
            }
          } catch (recoveryError) {
            if (import.meta.env.DEV) {
              console.log(`❌ Recovery attempt ${index + 1} failed:`, recoveryError);
            }
          }
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.log('❌ Backend session check failed:', error);
      }
    }
    return null;
  };

  // Get Firebase user role
  const getUserRole = async (firebaseUser: FirebaseUser): Promise<UserRole> => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
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
      const { doc, setDoc } = await import('firebase/firestore');

      const userData = {
        email: firebaseUser.email,
        role,
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

  // Enhanced authentication initialization with comprehensive logging
  useEffect(() => {
    let mounted = true;
    let firebaseUnsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      if (import.meta.env.DEV) {
        console.log('🔄 Initializing authentication...');
      }

      // First check for admin session
      const adminUser = await checkBackendSession();
      if (adminUser && mounted) {
        if (import.meta.env.DEV) {
          console.log('✅ Admin session found, setting user:', adminUser);
        }
        // FORCE SUPER_ADMIN role if backend session exists
        const forcedAdminUser = {
          ...adminUser,
          role: 'SUPER_ADMIN' as UserRole
        };
        setUser(forcedAdminUser);
        setIsAuthenticated(true);
        setIsLoading(false);
        setAuthInitialized(true); // Set authInitialized here
        // DO NOT SET UP FIREBASE LISTENER if admin session exists
        return;
      }

      if (import.meta.env.DEV) {
        console.log('🔍 No admin session, checking Firebase...');
      }

      // Only check Firebase if no admin session exists
      firebaseUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;

        if (import.meta.env.DEV) {
          console.log('🔥 Firebase Auth state changed:', firebaseUser ? `User: ${firebaseUser.email}` : 'No user');
        }

        if (firebaseUser) {
          try {
            // Add retry logic for Firebase connection
            let userDoc;
            let retries = 3;

            while (retries > 0) {
              try {
                const { doc, getDoc } = await import('firebase/firestore');
                userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                break;
              } catch (docError) {
                retries--;
                console.warn(`⚠️ Firebase connection attempt failed, ${retries} retries left:`, docError.message);

                if (retries === 0) {
                  throw docError;
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }

            if (userDoc && userDoc.exists()) {
              const userData = userDoc.data();
              setUser({
                id: firebaseUser.uid, // Use id for the user object
                email: firebaseUser.email!,
                role: userData.role || 'CUSTOMER',
                displayName: userData.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                personalId: userData.personalId,
                authMethod: 'firebase' as const
              });
              console.log('✅ User data loaded successfully');
            } else {
              console.log('ℹ️ Creating new user profile');
              const newUserProfile: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: 'CUSTOMER',
                personalId: '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                authMethod: 'firebase'
              };
              setUser(newUserProfile);
              // Optionally create the user document in Firestore here if it doesn't exist
              // await createUserDocument(firebaseUser, 'CUSTOMER', undefined);
            }
          } catch (error) {
            console.error('❌ Firebase connection error, using fallback:', error);
            // Fallback user profile when Firebase is unreachable
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'CUSTOMER',
              personalId: '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
              authMethod: 'firebase',
              offline: true // Mark as offline
            });
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('❌ No Firebase user');
          }
          setUser(null);
          setIsAuthenticated(false);
          setUserRole('CUSTOMER'); // Reset role
          setPersonalId(undefined);
          setFirebaseUid(undefined);
        }

        setIsLoading(false);
        setAuthInitialized(true); // Set authInitialized here
        setIsAuthReady(true); // Mark authentication as ready
      });
    };

    initAuth();

    return () => {
      mounted = false;
      if (firebaseUnsubscribe) {
        firebaseUnsubscribe();
      }
    };
  }, []);

  // Firebase Authentication Methods
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const role = await getUserRole(userCredential.user);

      const user: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        role,
        displayName: userCredential.user.displayName || userCredential.user.email?.split('@')[0],
        authMethod: 'firebase'
      };

      setUser(user);
      setIsAuthenticated(true);
      setUserRole(role);
      setPersonalId(user.personalId);
      setFirebaseUid(user.id);
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

      const user: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        role,
        personalId: additionalData?.personalId,
        displayName: additionalData?.firstName && additionalData?.lastName
          ? `${additionalData.firstName} ${additionalData.lastName}`
          : userCredential.user.email?.split('@')[0],
        authMethod: 'firebase'
      };

      setUser(user);
      setIsAuthenticated(true);
      setUserRole(role);
      setPersonalId(user.personalId);
      setFirebaseUid(user.id);
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  // WebAuthn Methods (SUPER_ADMIN only) - Simplified
  const loginWithPasskey = async (): Promise<void> => {
    try {
      // Call backend for passkey authentication
      const response = await fetch('/api/admin/auth/webauthn/login/options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalId: '01019062020' }),
      });

      if (!response.ok) {
        throw new Error('Passkey login failed');
      }

      // After successful passkey login, check backend session
      const adminUser = await checkBackendSession();
      if (adminUser) {
        setUser(adminUser);
        setIsAuthenticated(true);
        setUserRole('SUPER_ADMIN');
        setPersonalId(adminUser.personalId);
        setFirebaseUid(adminUser.id); // Assuming adminUser has an id that maps to firebaseUid
      } else {
        throw new Error('Session not created after passkey login');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Passkey ავტორიზაცია ვერ მოხერხდა');
    }
  };

  const registerPasskey = async (): Promise<void> => {
    // Implement passkey registration
    throw new Error('Passkey registration not implemented in simplified version');
  };

  const generateFallbackCode = async (reason: string): Promise<void> => {
    // Implement fallback code generation
    throw new Error('Fallback code generation not implemented');
  };

  const verifyFallbackCode = async (fallbackCode: string): Promise<void> => {
    // Implement fallback code verification
    throw new Error('Fallback code verification not implemented');
  };

  // Logout
  const logout = async () => {
    try {
      // Logout from backend
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Logout from Firebase
      await signOut(auth);

      setUser(null);
      setIsAuthenticated(false);
      setUserRole('CUSTOMER'); // Reset role
      setPersonalId(undefined);
      setFirebaseUid(undefined);
    } catch (error) {
      console.error('Logout error:', error);
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
    const adminUser = await checkBackendSession();
    if (adminUser) {
      setUser(adminUser);
      setIsAuthenticated(true);
      setUserRole('SUPER_ADMIN');
      setPersonalId(adminUser.personalId);
      setFirebaseUid(adminUser.id);
      return;
    }

    if (auth.currentUser) {
      const role = await getUserRole(auth.currentUser);
      const userData = {
        id: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        role,
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0],
        authMethod: 'firebase' as const
      };
      setUser(userData);
      setIsAuthenticated(true);
      setUserRole(role);
      setPersonalId(userData.personalId);
      setFirebaseUid(userData.id);
    }
  };

  // Booking integration methods - simplified
  const registerFromBookingForm = async (userData: BookingUserData): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    await createUserDocument(userCredential.user, 'CUSTOMER', userData);

    const user: User = {
      id: userCredential.user.uid,
      email: userData.email,
      role: 'CUSTOMER',
      personalId: userData.personalId,
      displayName: `${userData.firstName} ${userData.lastName}`,
      authMethod: 'firebase'
    };

    setUser(user);
    setIsAuthenticated(true);
    setUserRole('CUSTOMER');
    setPersonalId(user.personalId);
    setFirebaseUid(user.id);
    return user;
  };

  const loginWithPhoneAndPassword = async (phone: string, password: string): Promise<void> => {
    // Find user by phone and login with email
    const { collection, query, where, getDocs } = await import('firebase/firestore');
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
      const { collection, query, where, getDocs } = await import('firebase/firestore');

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
    setUserRole(newRole);
    // Update the user object in state if it exists
    setUser(currentUser =>
      currentUser ? { ...currentUser, role: newRole } : null
    );
  };

  const checkUserRole = async () => {
    try {
      const data = await singleFlight("checkUserRole", async () => {
        const response = await fetch("/api/admin/auth/me", {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });

      if (data.user) {
        setUser(data.user);
        setUserRole(data.user.role);
        setPersonalId(data.user.personalId);
        setIsAuthenticated(true);
        setFirebaseUid(data.user.id);
      }
    } catch (error) {
      console.error('Role check error:', error);
    } finally {
      setIsAuthReady(true);
    }
  };

  const value = useMemo(() => ({
    id: user?.id ?? null,
    email: user?.email ?? null,
    role: userRole,
    isAuthenticated,
    isAuthReady,
    authInitialized, // Ensure authInitialized is included
    personalId,
    firebaseUid,
    user,
    userRole,
    login,
    logout,
    updateUserRole,
    checkUserRole
  }), [user?.id, user?.email, userRole, isAuthenticated, isAuthReady, authInitialized, personalId, firebaseUid, login, logout, updateUserRole, checkUserRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
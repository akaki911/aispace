import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  authenticateWithPasskey,
  initializeConditionalUI,
  checkPasskeyAvailability,
  getWebAuthnErrorMessage
} from './utils/webauthn_support';
import { useAuth } from './contexts/useAuth';

const Login: React.FC = () => {
  console.log("LOGIN_MARKER_2025-09-23", window.location.hostname, window.location.pathname);

  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(false); // State for the new checkbox
  const [email, setEmail] = useState('');
  const [passkeySupport, setPasskeySupport] = useState({
    supported: false,
    platformAuthenticator: false,
    conditionalUI: false
  });

  const { deviceRecognition, user, isAuthenticated, getAutoRouteTarget, deviceTrust: contextDeviceTrust } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const conditionalInitRef = useRef(false);

  // Debug authentication state
  useEffect(() => {
    console.log('🔍 [Login] Auth state:', { user, loading, isAuthenticated: !!user });
  }, [user, loading]);

  // Auto-redirect if already authenticated as SUPER_ADMIN
  useEffect(() => {
    if (isAuthenticated && user?.role === 'SUPER_ADMIN') {
      const targetPath = getAutoRouteTarget();
      console.log('🔧 [LOGIN] SUPER_ADMIN detected, redirecting to', targetPath);
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate, getAutoRouteTarget]);

  // Check if we should show admin-focused login (for admin logout redirections)
  useEffect(() => {
    // If we're on /login (not /login/customer) and have admin device or localStorage hint
    if (window.location.pathname === '/login') {
      const lastUserRole = localStorage.getItem('lastUserRole');
      if (lastUserRole === 'SUPER_ADMIN' || deviceRecognition.currentDevice?.registeredRole === 'SUPER_ADMIN') {
        console.log('🔧 [LOGIN] Admin logout detected, showing admin-focused interface');
      }
    }
  }, [deviceRecognition]);

  // Single initialization effect for WebAuthn
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Force HTTPS redirect for all .replit.dev domains
        if (window.location.protocol !== 'https:' &&
            (window.location.hostname.includes('.replit.dev') ||
             window.location.hostname.includes('.janeway.replit.dev'))) {
          const httpsUrl = window.location.href.replace('http:', 'https:');
          console.log('🔒 Forcing HTTPS redirect for Passkey compatibility:', httpsUrl);
          window.location.replace(httpsUrl);
          return;
        }

        if (!mounted) return;

        // Check Passkey support
        const support = await checkPasskeyAvailability();
        if (mounted) {
          setPasskeySupport(support);
          console.log('🔐 [Login] Passkey support:', support);
        }

        // Initialize conditional UI only once if supported and user is trusted admin
        if (support.conditionalUI && mounted) {
          console.log('🔄 [Login] Starting conditional UI initialization');
          // Will be enabled later when we know device trust status
        }
      } catch (error) {
        console.warn('⚠️ [Login] WebAuthn initialization failed:', error);
      }
    };

    // Listen for conditional UI success
    const handlePasskeyLoginSuccess = (event: CustomEvent) => {
      if (!mounted) return;

      console.log('🎉 [Login] Conditional UI login success:', event.detail);
      const user = event.detail;

      // Navigate based on role
      if (user.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    };

    window.addEventListener('passkey-login-success', handlePasskeyLoginSuccess as EventListener);

    initializeAuth();

    return () => {
      mounted = false;
      window.removeEventListener('passkey-login-success', handlePasskeyLoginSuccess as EventListener);
    };
  }, [navigate]);

  useEffect(() => {
    if (!passkeySupport.conditionalUI) {
      return;
    }

    if (conditionalInitRef.current) {
      return;
    }

    const assumedRole = user?.role || deviceRecognition.currentDevice?.registeredRole;
    const trusted = Boolean(contextDeviceTrust || deviceRecognition.currentDevice?.trusted);

    conditionalInitRef.current = true;

    initializeConditionalUI(assumedRole, trusted).catch((error) => {
      console.warn('⚠️ [Login] Conditional UI setup failed:', error);
    });
  }, [passkeySupport.conditionalUI, user?.role, deviceRecognition.currentDevice?.registeredRole, contextDeviceTrust, deviceRecognition.currentDevice?.trusted]);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('გთხოვთ შეიყვანოთ ელ-ფოსტა');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError(''); // Clear any existing errors
      alert('პაროლის აღდგენის ლინკი გამოგზავნილია თქვენს ელ-ფოსტაზე');
    } catch (error: any) {
      console.error("❌ Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        setError('მომხმარებელი ამ ელ-ფოსტით ვერ მოიძებნა');
      } else {
        setError('პაროლის აღდგენა ვერ მოხერხდა');
      }
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const email = (f.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (f.elements.namedItem("password") as HTMLInputElement).value;

    setLoading(true);
    setError('');

    try {
      // Firebase authentication
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const userRole = userData?.role || 'CUSTOMER';

      // Wait for auth context to update - key fix!
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate based on role after context updates
      if (userRole === 'SUPER_ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        setError('არასწორი ელ-ფოსტა ან პაროლი');
      } else if (error.code === 'auth/user-not-found') {
        setError('მომხმარებელი ვერ მოიძებნა');
      } else if (error.code === 'auth/wrong-password') {
        setError('არასწორი პაროლი');
      } else if (error.code === 'auth/too-many-requests') {
        setError('ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით');
      } else {
        setError(error.message || 'შესვლა ვერ მოხერხდა');
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual Passkey Login (for fallback button)
  const handleManualPasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError('');

    try {
      console.log('🔐 [Login] Manual passkey login triggered');
      const result = await authenticateWithPasskey(false); // Modal, not conditional

      if (result.success && result.user) {
        console.log('✅ [Login] Manual passkey login successful');

        // Navigate based on role
        if (result.user.role === 'SUPER_ADMIN') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError('Passkey-თი შესვლა ვერ მოხერხდა');
      }
    } catch (error: any) {
      console.error('❌ [Login] Manual passkey error:', error);
      setError(getWebAuthnErrorMessage(error));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const goToRegister = () => {
    navigate('/register');
  };

  // Determine login layout based on device recognition
  const getLoginLayout = () => {
    const { isRecognizedDevice, currentDevice, suggestedAuthMethod } = deviceRecognition;

    if (isRecognizedDevice && currentDevice?.registeredRole === 'SUPER_ADMIN') {
      // Super Admin device - focus on Passkey login
      return 'admin-focused';
    } else if (isRecognizedDevice && currentDevice?.registeredRole === 'CUSTOMER') {
      // Customer device - focus on customer login
      return 'customer-focused';
    }

    // Unknown device - show all options
    return 'standard';
  };

  const loginLayout = getLoginLayout();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {loginLayout === 'admin-focused' ? 'Admin სისტემაში შესვლა' :
             loginLayout === 'customer-focused' ? 'მომხმარებლის კაბინეტი' :
             'ბახმაროზე შესვლა'}
          </h1>

          {/* Device Recognition Status */}
          {deviceRecognition.isRecognizedDevice && deviceRecognition.currentDevice && (
            <div className="mt-2 text-sm text-green-600 dark:text-green-400">
              ✅ მოწყობილობა ამოცნობილია ({deviceRecognition.currentDevice.registeredRole})
            </div>
          )}

          {/* Passkey Support Status */}
          {passkeySupport.supported && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              🔐 Passkey მხარდაჭერილია
              {passkeySupport.conditionalUI && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  ✨ ავტომატური შესვლა აქტიურია
                </span>
              )}
            </div>
          )}
        </div>

        {loginLayout === 'admin-focused' ? (
          // Admin-focused layout
          <div className="max-w-md mx-auto">
            <section className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
                Admin ავტორიზაცია
              </h2>

              <div className="space-y-4">
                <div className="text-center text-gray-600 dark:text-gray-400">
                  <p className="mb-4">სუპერ ადმინისტრატორის შესვლა</p>

                  {passkeySupport.supported ? (
                    <div className="space-y-3">
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✅ Passkey მხარდაჭერილია
                      </div>

                      <button
                        onClick={handleManualPasskeyLogin}
                        disabled={passkeyLoading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                      >
                        {passkeyLoading ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            ავთენტიფიკაცია...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center">
                            🔐 Passkey შესვლა
                          </span>
                        )}
                      </button>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        უსაფრთხო შესვლა ბიომეტრიული ან PIN კოდით
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      ⚠️ Passkey არ არის მხარდაჭერილი ამ ბრაუზერში
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
                    {error}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : loginLayout === 'customer-focused' ? (
          // Customer-focused layout
          <div className="max-w-md mx-auto">
            <section className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                მომხმარებლის კაბინეტში შესვლა
              </h2>

              <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
                <div>
                  <input
                    ref={emailInputRef}
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ელ-ფოსტა"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="პაროლი"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M19.536 15.536a10.037 10.037 0 01-.427.588m-1.56 1.56l-.588.427m-2.829 2.829l-4.243-4.243m0 0L8.464 8.464m7.071 7.071L8.464 8.464" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        დამიმახსოვრე
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="trust-device"
                        name="trust-device"
                        type="checkbox"
                        checked={trustThisDevice}
                        onChange={(e) => setTrustThisDevice(e.target.checked)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="trust-device" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        ამ მოწყობილობას ენდო (სწრაფი შესვლისთვის)
                      </label>
                    </div>
                  </div>
                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                    >
                      პაროლი დაგავიწყდა?
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'შესვლა...' : 'შესვლა'}
                </button>

                <div className="text-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ანგარიში არ გაქვთ? </span>
                  <button
                    type="button"
                    onClick={goToRegister}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                  >
                    რეგისტრაცია
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : (
          // Standard layout for unknown devices
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Customer/Provider Section */}
            <section className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">შესვლა</h2>

              <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
                <div>
                  <input
                    ref={emailInputRef}
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ელ-ფოსტა"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    autoComplete="webauthn"
                    title={passkeySupport.conditionalUI ? "შეიყვანეთ ელ-ფოსტა ან შეეხეთ Passkey-ს გამოსატანად" : "შეიყვანეთ ელ-ფოსტა"}
                  />
                  {passkeySupport.conditionalUI && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      💡 ელ-ფოსტის ველზე შეხების შემდეგ Passkey-თი შესვლა შესაძლებელია
                    </p>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="პაროლი"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M19.536 15.536a10.037 10.037 0 01-.427.588m-1.56 1.56l-.588.427m-2.829 2.829l-4.243-4.243m0 0L8.464 8.464m7.071 7.071L8.464 8.464" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        დამიმახსოვრე
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="trust-device"
                        name="trust-device"
                        type="checkbox"
                        checked={trustThisDevice}
                        onChange={(e) => setTrustThisDevice(e.target.checked)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="trust-device" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        ამ მოწყობილობას ენდო (სწრაფი შესვლისთვის)
                      </label>
                    </div>
                  </div>
                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                    >
                      პაროლი დაგავიწყდა?
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'შესვლა...' : 'შესვლა'}
                  </button>

                  {/* Manual Passkey Button - Fallback option */}
                  {passkeySupport.supported && (
                    <button
                      type="button"
                      onClick={handleManualPasskeyLogin}
                      disabled={passkeyLoading}
                      className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <span className="flex items-center">
                        🔐
                        <span className="ml-2">
                          {passkeyLoading ? 'Passkey ავთენტიფიკაცია...' : 'Passkey-თი შესვლა'}
                        </span>
                      </span>
                    </button>
                  )}

                  <div className="text-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">ანგარიში არ გაქვთ? </span>
                    <button
                      type="button"
                      onClick={goToRegister}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                    >
                      რეგისტრაცია
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* Admin Section */}
            <section className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">ადმინისტრატორი</h2>

              <div className="space-y-4">
                <div className="text-center text-gray-600 dark:text-gray-400">
                  <p className="mb-4">ადმინისტრატორების შესვლა</p>

                  {passkeySupport.supported ? (
                    <div className="space-y-3">
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✅ Passkey მხარდაჭერილია
                      </div>

                      <button
                        onClick={handleManualPasskeyLogin}
                        disabled={passkeyLoading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                      >
                        {passkeyLoading ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            ავთენტიფიკაცია...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center">
                            🔐 Admin Passkey შესვლა
                          </span>
                        )}
                      </button>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        უსაფრთხო შესვლა ბიომეტრიული ან PIN კოდით
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      ⚠️ Passkey არ არის მხარდაჭერილი ამ ბრაუზერში
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
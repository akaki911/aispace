import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable
} from '@simplewebauthn/browser';
// Types are included in the browser package
type RegistrationResponseJSON = any;
type AuthenticationResponseJSON = any;

const PASSKEY_ENDPOINTS = {
  registerOptions: ['/api/auth/passkey/register-options', '/api/admin/webauthn/register-options'],
  registerVerify: ['/api/auth/passkey/register-verify', '/api/admin/webauthn/register-verify'],
  loginOptions: ['/api/auth/passkey/login-options', '/api/admin/webauthn/login-options'],
  loginVerify: ['/api/auth/passkey/login-verify', '/api/admin/webauthn/login-verify'],
};

interface PasskeyRequestInit extends RequestInit {
  headers?: Record<string, string>;
}

async function postPasskeyJson(
  endpoints: string[],
  body: unknown,
  init: PasskeyRequestInit = {}
): Promise<{ response: Response; endpoint: string }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const baseHeaders = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };

  let lastError: unknown = null;

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        ...init,
        headers: baseHeaders,
        body: payload,
      });

      if (response.status === 404 && i < endpoints.length - 1) {
        console.warn(`⚠️ [Passkey] Endpoint ${endpoint} not available, trying fallback...`);
        continue;
      }

      return { response, endpoint };
    } catch (error) {
      lastError = error;
      if (i < endpoints.length - 1) {
        console.warn(`⚠️ [Passkey] Endpoint ${endpoint} failed, trying fallback...`, error);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Passkey endpoints unavailable');
}

// ===== WEBAUTHN BROWSER SUPPORT CHECKS =====

export async function ensureWebAuthnReady(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('WebAuthn requires browser environment');
  }

  // Enforce HTTPS for all Replit domains - no exceptions
  if (window.location.protocol !== 'https:') {
    if (window.location.hostname.includes('.replit.dev') || window.location.hostname.includes('.janeway.replit.dev')) {
      const httpsUrl = window.location.href.replace('http:', 'https:');
      console.log('🔒 [WebAuthn] Forcing HTTPS redirect:', httpsUrl);
      window.location.replace(httpsUrl);
      return;
    } else if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
      throw new Error('WebAuthn requires HTTPS connection');
    }
  }

  // Validate current origin matches configured RP settings
  const currentOrigin = window.location.origin;
  const configuredOrigin = (import.meta.env.VITE_ORIGIN || '').trim();
  const configuredRpId = (import.meta.env.VITE_RP_ID || '').trim();
  const expectedOrigin = configuredOrigin || (configuredRpId ? `https://${configuredRpId}` : null);

  if (expectedOrigin) {
    if (currentOrigin !== expectedOrigin) {
      console.warn('⚠️ [WebAuthn] Origin mismatch detected', {
        currentOrigin,
        expectedOrigin,
        configuredRpId
      });
    } else {
      console.log('🔐 [WebAuthn] Origin validated against configuration:', expectedOrigin);
    }
  } else {
    console.log('ℹ️ [WebAuthn] Using dynamic origin fallback:', currentOrigin);
  }

  if (!browserSupportsWebAuthn()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // Check for platform authenticator availability
  const platformAvailable = await platformAuthenticatorIsAvailable().catch(() => false);

  if (!platformAvailable) {
    console.warn('⚠️ No platform authenticator (TouchID/FaceID/Windows Hello) available');
    console.warn('ℹ️ External security keys will still work');
  }

  console.log('✅ WebAuthn is ready and supported');
}

// ===== ERROR HANDLING UTILITIES =====

export function getWebAuthnErrorMessage(error: any): string {
  const errorName = error.name || error.code || '';
  const errorMessage = error.message || '';

  console.error('🔐 [WebAuthn Error]', errorName, errorMessage);

  switch (errorName) {
    case 'NotAllowedError':
      // Enhanced Windows Hello specific messaging
      if (navigator.userAgent.includes('Windows')) {
        return 'Windows Hello-მ დაბლოკა შესვლა. გააქტიურეთ Windows Hello Settings-ში ან გამოიყენეთ PIN კოდი.';
      }
      return 'Passkey-თი შესვლა გაუქმდა. თუ უსაფრთხოების გასაღები გამოიყენეთ, შეეხეთ მას.';

    case 'InvalidStateError':
      return 'ეს Passkey უკვე რეგისტრირებულია ამ მოწყობილობაზე.';

    case 'NotSupportedError':
      if (navigator.userAgent.includes('Windows')) {
        return 'Windows Hello არ არის კონფიგურირებული. გადადით Settings → Accounts → Sign-in options და გააქტიურეთ Face recognition ან Fingerprint.';
      }
      return 'Passkey არ არის მხარდაჭერილი ამ ბრაუზერში ან მოწყობილობაზე.';

    case 'SecurityError':
      if (window.location.protocol !== 'https:') {
        return 'უსაფრთხოების შეცდომა: Passkey-ები მუშაობს მხოლოდ HTTPS-ზე. გთხოვთ გადადით https:// მისამართზე.';
      }
      return 'უსაფრთხოების შეცდომა: შეამოწმეთ domain-ის კონფიგურაცია.';

    case 'NetworkError':
      return 'ქსელის შეცდომა: შეამოწმეთ ინტერნეტ კავშირი.';

    case 'TimeoutError':
      return 'Passkey შექმნა ან შესვლა ძალიან დიდხანს გრძელდება. სცადეთ ხელახლა.';

    case 'UnknownError':
    case 'ConstraintError':
      return 'Passkey დამუშავებისას მოულოდნელი შეცდომა მოხდა.';

    default:
      if (errorMessage.includes('User verification')) {
        return 'მომხმარებლის დამოწმება ვერ მოხერხდა. შეამოწმეთ PIN კოდი ან ბიომეტრიული ავტორიზაცია.';
      }

      if (errorMessage.includes('credential')) {
        return 'ამ მოწყობილობაზე Passkey არ მოიძებნა.';
      }

      return `Passkey-ს შეცდომა: ${errorMessage || 'უცნობი შეცდომა'}`;
  }
}

// ===== PASSKEY REGISTRATION FLOW =====

export interface PasskeyRegistrationOptions {
  userId: string;
  email: string;
}

export async function registerPasskey(options: PasskeyRegistrationOptions): Promise<boolean> {
  try {
    console.log('🔐 [Passkey Registration] Starting registration for:', options.email);
    console.log('🔐 [Passkey Registration] Current domain:', window.location.hostname);

    // Ensure WebAuthn is ready
    await ensureWebAuthnReady();

    // Step 1: Get registration options from server
    console.log('🔐 [Passkey Registration] Requesting options from server...');
    const { response: optionsResponse } = await postPasskeyJson(
      PASSKEY_ENDPOINTS.registerOptions,
      {
        userId: options.userId,
        email: options.email,
        displayName: options.email,
      },
      {
        headers: {
          'x-admin-setup-token': 'DEV_TOKEN',
        },
      }
    );

    console.log('🔐 [Passkey Registration] Options response status:', optionsResponse.status);

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get registration options');
    }

    const { options: registrationOptions } = await optionsResponse.json();

    console.log('🔐 [Passkey Registration] Got options from server');

    // Step 2: Create credential using browser's WebAuthn API (v11+ format)
    const credential: RegistrationResponseJSON = await startRegistration({
      optionsJSON: registrationOptions
    });

    console.log('🔐 [Passkey Registration] Credential created, verifying...');

    // Step 3: Send credential to server for verification
    const { response: verificationResponse } = await postPasskeyJson(
      PASSKEY_ENDPOINTS.registerVerify,
      { credential }
    );

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Passkey registration verification failed');
    }

    const verification = await verificationResponse.json();

    if (!verification.verified) {
      throw new Error('Passkey verification failed');
    }

    console.log('✅ [Passkey Registration] Successfully registered!');
    return true;

  } catch (error: any) {
    console.error('❌ [Passkey Registration] Error:', error);
    throw new Error(getWebAuthnErrorMessage(error));
  }
}

// ===== PASSKEY AUTHENTICATION FLOW =====

export interface PasskeyAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
    authenticatedViaPasskey: boolean;
  };
}

// Global variable to track active WebAuthn requests
let activeWebAuthnRequest: AbortController | null = null;

export async function authenticateWithPasskey(conditional: boolean = false): Promise<PasskeyAuthResult> {
  try {
    console.log(`🔐 [Passkey Login] Starting ${conditional ? 'conditional' : 'modal'} authentication`);
    console.log('🔐 [Passkey Login] Current domain:', window.location.hostname);
    console.log('🔐 [Passkey Login] Current protocol:', window.location.protocol);

    // CRITICAL: Cancel any existing WebAuthn request
    if (activeWebAuthnRequest) {
      console.log('🛑 [WebAuthn] Aborting existing request to prevent conflicts');
      activeWebAuthnRequest.abort();
      activeWebAuthnRequest = null;
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Create new abort controller
    activeWebAuthnRequest = new AbortController();

    // Ensure WebAuthn is ready
    await ensureWebAuthnReady();

    // Step 1: Get authentication options from server
    const { response: optionsResponse } = await postPasskeyJson(
      PASSKEY_ENDPOINTS.loginOptions,
      {},
      {
        signal: activeWebAuthnRequest.signal,
      }
    );

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get authentication options');
    }

    const { options: authenticationOptions } = await optionsResponse.json();

    console.log('🔐 [Passkey Login] Got options from server');

    // Step 2: Enhanced WebAuthn call with Windows Hello/Face ID compatibility
    let credential: AuthenticationResponseJSON;

    try {
      // Enhanced Windows Hello/Face ID configuration
      const authOptions = {
        ...authenticationOptions,
        // Enhanced compatibility settings
        userVerification: 'preferred', // Allow PIN as fallback
        timeout: 120000, // Extended timeout for biometric setup
        // Force platform authenticator preference
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          residentKey: 'preferred'
        }
      };

      console.log('🔐 [Windows Hello/Face ID] Starting authentication with enhanced settings');

      const primaryAuthRequest = {
        optionsJSON: authOptions,
        useBrowserAutofill: conditional,
        mediation: conditional ? 'conditional' : 'required',
      } as Parameters<typeof startAuthentication>[0] & { mediation?: 'conditional' | 'required' };

      credential = await startAuthentication(primaryAuthRequest);
    } catch (error: any) {
      // Enhanced error handling for Windows Hello
      if (error.name === 'AbortError') {
        if (conditional) {
          console.log('🔄 [Passkey Login] Conditional UI aborted, retrying with modal UI');
          // Clean retry for Windows Hello
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Create fresh abort controller
          if (activeWebAuthnRequest) {
            activeWebAuthnRequest.abort();
          }
          activeWebAuthnRequest = new AbortController();

          const fallbackAuthRequest = {
            optionsJSON: {
              ...authenticationOptions,
              userVerification: 'preferred',
              timeout: 60000,
              // Remove problematic extensions for fallback
              extensions: { credProps: true }
            },
            useBrowserAutofill: false,
            mediation: 'required',
          } as Parameters<typeof startAuthentication>[0] & { mediation?: 'conditional' | 'required' };

          credential = await startAuthentication(fallbackAuthRequest);
        } else {
          throw new Error('Windows Hello სესია გაუქმდა. გთხოვთ სცადოთ ხელახლა.');
        }
      } else if (error.name === 'NotAllowedError') {
        throw new Error('Windows Hello მიერ დაბლოკილია. გააქტიურეთ PIN ან ბიომეტრია.');
      } else {
        throw error;
      }
    }

    console.log('🔐 [Passkey Login] Assertion created, verifying...');

    // Step 3: Send assertion to server for verification
    const { response: verificationResponse } = await postPasskeyJson(
      PASSKEY_ENDPOINTS.loginVerify,
      { credential },
      {
        signal: activeWebAuthnRequest.signal,
      }
    );

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Passkey authentication verification failed');
    }

    const verification = await verificationResponse.json();

    if (!verification.success) {
      throw new Error('Passkey authentication failed');
    }

    console.log('✅ [Passkey Login] Successfully authenticated!');

    // Clean up
    activeWebAuthnRequest = null;

    return {
      success: true,
      user: verification.user
    };

  } catch (error: any) {
    console.error('❌ [Passkey Login] Error:', error);

    // Clean up on error
    activeWebAuthnRequest = null;

    // For conditional UI, silently fail certain errors
    if (conditional && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
      console.log('ℹ️ [Conditional Passkey] User canceled or no passkey available - this is normal');
      return { success: false };
    }

    throw new Error(getWebAuthnErrorMessage(error));
  }
}

// ===== CONDITIONAL UI HELPER - SOL-431: Admin Only with Device Trust =====

export async function initializeConditionalUI(userRole?: string, deviceTrust?: boolean): Promise<void> {
  try {
    const requiresTrustedDevice = userRole === 'SUPER_ADMIN';
    if (requiresTrustedDevice && !deviceTrust) {
      console.log('🔐 [Conditional UI] Waiting for trusted device confirmation for SUPER_ADMIN');
      return;
    }

    console.log(`🔐 [Conditional UI] Initializing for ${userRole || 'discoverable-user'}...`);

    // Check if conditional UI is supported
    if (!window.PublicKeyCredential || !window.PublicKeyCredential.isConditionalMediationAvailable) {
      console.warn('⚠️ [Conditional UI] Not supported in this browser');
      return;
    }

    const available = await window.PublicKeyCredential.isConditionalMediationAvailable();
    if (!available) {
      console.warn('⚠️ [Conditional UI] Not available');
      return;
    }

    console.log('✅ [Conditional UI] Available and supported for SUPER_ADMIN');

    // Start conditional authentication automatically
    // This will trigger when user interacts with email input
    authenticateWithPasskey(true).then((result) => {
      if (result.success && result.user) {
        console.log('🎉 [Conditional UI] Auto-login successful!');
        // Trigger a custom event that Login component can listen to
        window.dispatchEvent(new CustomEvent('passkey-login-success', {
          detail: result.user
        }));
      }
    }).catch((error) => {
      // Silently handle conditional UI errors
      console.log('ℹ️ [Conditional UI] No auto-login:', error.message);
    });

  } catch (error) {
    console.warn('⚠️ [Conditional UI] Setup failed:', error);
  }
}

// ===== PASSKEY AVAILABILITY CHECK =====

export async function checkPasskeyAvailability(): Promise<{
  supported: boolean;
  platformAuthenticator: boolean;
  conditionalUI: boolean;
  windowsHello?: boolean;
  faceId?: boolean;
  touchId?: boolean;
  userAgent: string;
}> {
  const result = {
    supported: false,
    platformAuthenticator: false,
    conditionalUI: false,
    windowsHello: false,
    faceId: false,
    touchId: false,
    userAgent: navigator.userAgent
  };

  try {
    result.supported = browserSupportsWebAuthn();

    if (result.supported) {
      result.platformAuthenticator = await platformAuthenticatorIsAvailable().catch(() => false);

      if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
        result.conditionalUI = await window.PublicKeyCredential.isConditionalMediationAvailable().catch(() => false);
      }

      // Enhanced platform detection
      const userAgent = navigator.userAgent.toLowerCase();
      const platform = navigator.platform?.toLowerCase() || '';

      // Windows Hello detection
      if (userAgent.includes('windows') || platform.includes('win')) {
        result.windowsHello = result.platformAuthenticator;
        console.log('🔍 [Platform] Windows detected - Windows Hello support:', result.windowsHello);
      }

      // macOS Face ID/Touch ID detection  
      if (userAgent.includes('mac') || platform.includes('mac')) {
        result.faceId = result.platformAuthenticator;
        result.touchId = result.platformAuthenticator;
        console.log('🔍 [Platform] macOS detected - Face ID/Touch ID support:', result.platformAuthenticator);
      }

      console.log('🔍 [Passkey Availability] Full report:', result);
    }
  } catch (error) {
    console.warn('⚠️ Error checking passkey availability:', error);
  }

  return result;
}
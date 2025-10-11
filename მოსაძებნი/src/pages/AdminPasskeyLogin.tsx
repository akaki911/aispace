import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { 
  checkPasskeyAvailability,
  getWebAuthnErrorMessage 
} from '../utils/webauthn_support';

const AdminPasskeyLogin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trustThisDevice, setTrustThisDevice] = useState(false);
  const [passkeySupport, setPasskeySupport] = useState({
    supported: false,
    platformAuthenticator: false,
    conditionalUI: false
  });

  const { deviceRecognition, loginWithPasskey, registerCurrentDevice } = useAuth();
  const navigate = useNavigate();

  // Initialize passkey support check
  useEffect(() => {
    const initializePasskey = async () => {
      try {
        // Force HTTPS for Replit domains
        if (window.location.protocol !== 'https:' && 
            (window.location.hostname.includes('.replit.dev') || 
             window.location.hostname.includes('.janeway.replit.dev'))) {
          const httpsUrl = window.location.href.replace('http:', 'https:');
          console.log('🔒 Forcing HTTPS redirect for Admin Passkey:', httpsUrl);
          window.location.replace(httpsUrl);
          return;
        }

        const support = await checkPasskeyAvailability();
        setPasskeySupport(support);
        console.log('🔐 [Admin Login] Passkey support:', support);

        if (!support.supported) {
          setError('Passkey-ები არ არის მხარდაჭერილი ამ ბრაუზერში. გთხოვთ გამოიყენოთ Passkey-ების მხარდამჭერი ბრაუზერი.');
        }
      } catch (error) {
        console.error('❌ [Admin Login] Passkey initialization failed:', error);
        setError('Passkey სისტემის ინიციალიზაცია ვერ მოხერხდა');
      }
    };

    initializePasskey();
  }, []);

  const handlePasskeyLogin = async () => {
    if (!passkeySupport.supported) {
      setError('Passkey-ები არ არის მხარდაჭერილი');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔐 [Admin Login] Starting passkey authentication...');
      console.log('🔐 [Admin Login] Environment check:', {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        passkeySupport: passkeySupport,
        trustThisDevice: trustThisDevice
      });
      
      // SOL-422: Pass trust device preference
      await loginWithPasskey(trustThisDevice);
      
      setSuccess('წარმატებული ავტორიზაცია! გადამისამართება...');
      
      setTimeout(() => {
        navigate('/admin');
      }, 1500);

    } catch (error: any) {
      console.error('❌ [Admin Login] Passkey authentication failed:', error);
      const friendlyMessage = getWebAuthnErrorMessage(error);
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToStandard = () => {
    navigate('/login');
  };

  const isRecognizedAdmin = deviceRecognition?.isRecognizedDevice && 
                           deviceRecognition?.currentDevice?.registeredRole === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="bg-white/10 backdrop-blur-lg p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">ადმინისტრატორის პანელი</h2>
          <p className="mt-2 text-white/70">
            {isRecognizedAdmin 
              ? `მოგესალმებით! განაგრძეთ ${deviceRecognition?.currentDevice?.deviceId?.slice(-8)} მოწყობილობიდან`
              : 'Passkey ავტორიზაცია სუპერ ადმინისტრატორისთვის'
            }
          </p>
        </div>

        {/* Device Recognition Status */}
        {isRecognizedAdmin && (
          <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="text-green-400 text-sm">
                მოწყობილობა აღიარებულია როგორც ადმინისტრატორის მოწყობილობა
              </span>
            </div>
          </div>
        )}

        {/* Main Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-8 border border-white/20">
          
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-400/30 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="mb-6 bg-green-500/20 border border-green-400/30 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-green-400 text-sm">{success}</span>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Passkey Support Status */}
            <div className="text-center text-white/70 text-sm">
              <div className="space-y-1">
                <div className={`flex items-center justify-center space-x-2 ${passkeySupport.supported ? 'text-green-400' : 'text-red-400'}`}>
                  <span>Passkey მხარდაჭერა:</span>
                  <span>{passkeySupport.supported ? '✓ მხარდაჭერილია' : '✗ არ არის მხარდაჭერილი'}</span>
                </div>
                {passkeySupport.supported && (
                  <div className={`flex items-center justify-center space-x-2 ${passkeySupport.platformAuthenticator ? 'text-green-400' : 'text-yellow-400'}`}>
                    <span>Platform Authenticator:</span>
                    <span>{passkeySupport.platformAuthenticator ? '✓ ხელმისაწვდომია' : '⚠ შეზღუდული'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Trust Device Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                id="trust-device-admin"
                type="checkbox"
                checked={trustThisDevice}
                onChange={(e) => setTrustThisDevice(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
              <label htmlFor="trust-device-admin" className="text-sm text-white/80">
                ამ მოწყობილობას ენდო სწრაფი შესვლისთვის
              </label>
            </div>

            {/* Passkey Login Button */}
            <button
              onClick={handlePasskeyLogin}
              disabled={loading || !passkeySupport.supported}
              className={`w-full flex items-center justify-center space-x-3 py-4 px-6 rounded-lg font-medium transition-all duration-200 ${
                passkeySupport.supported && !loading
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  : 'bg-gray-600 text-gray-300 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                  <span>ავტორიზაცია...</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>Passkey-ით ავტორიზაცია</span>
                </>
              )}
            </button>

            {/* Back to Standard Login */}
            <button
              onClick={handleBackToStandard}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>სტანდარტული ავტორიზაციისკენ დაბრუნება</span>
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center text-white/50 text-sm">
          <p>ეს არის უსაფრთხო ავტორიზაცია სუპერ ადმინისტრატორისთვის</p>
          <p className="mt-1">Passkey-ები იყენებს თქვენი მოწყობილობის ბიომეტრიულ ან PIN ავტორიზაციას</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPasskeyLogin;
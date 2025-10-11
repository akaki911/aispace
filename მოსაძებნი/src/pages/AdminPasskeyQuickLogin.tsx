
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { 
  authenticateWithPasskey,
  getWebAuthnErrorMessage 
} from '../utils/webauthn_support';

const AdminPasskeyQuickLogin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { deviceRecognition } = useAuth();
  const navigate = useNavigate();

  // Auto-trigger passkey on mount for quick login
  useEffect(() => {
    if (deviceRecognition.isRecognizedDevice && 
        deviceRecognition.currentDevice?.registeredRole === 'SUPER_ADMIN' &&
        deviceRecognition.currentDevice?.trusted) {
      
      console.log('🔐 [QUICK LOGIN] Auto-triggering passkey for trusted admin device');
      handlePasskeyLogin();
    }
  }, [deviceRecognition]);

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🔐 [QUICK LOGIN] Starting quick passkey authentication...');
      
      const result = await authenticateWithPasskey(false);
      
      if (result.success && result.user) {
        console.log('✅ [QUICK LOGIN] Quick passkey login successful');
        navigate('/admin');
      } else {
        setError('Passkey-თი შესვლა ვერ მოხერხდა');
      }
    } catch (error: any) {
      console.error('❌ [QUICK LOGIN] Quick passkey error:', error);
      setError(getWebAuthnErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/login/customer');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-purple-500/30 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">სწრაფი ადმინ შესვლა</h2>
          </div>
          <button onClick={handleCancel} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Device Recognition Status */}
        {deviceRecognition.isRecognizedDevice && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">✅ ნდობილი ადმინისტრატორის მოწყობილობა</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4"></div>
              <p className="text-white text-sm">ბიომეტრიული ავტორიზაცია...</p>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={handlePasskeyLogin}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>🔐</span>
                  <span>შესვლა Passkey-ით</span>
                </div>
              </button>

              <p className="text-gray-400 text-xs mt-4">
                Windows Hello, Touch ID, ან Face ID გამოყენებით
              </p>
            </div>
          )}
        </div>

        {/* Alternative Options */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={handleCancel}
            className="w-full text-gray-400 hover:text-white py-2 text-sm transition-colors"
          >
            სხვა მეთოდით შესვლა
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPasskeyQuickLogin;



import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Building2, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

// Role-specific modals
const SuperAdminModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { loginWithPasskey, deviceRecognition } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithPasskey(true);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Passkey ავტორიზაცია ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleFallback = () => {
    navigate('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-purple-500/30 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Super Admin</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Device Recognition Status */}
        {deviceRecognition.isRecognizedDevice && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">✅ მოწყობილობა ამოცნობილია</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Main Passkey Button */}
        <button
          onClick={handlePasskeyLogin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 mb-4 disabled:opacity-50 shadow-lg"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
              <span>ავტორიზაცია...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <span>🔐</span>
              <span>შესვლა Passkey-ით</span>
            </div>
          )}
        </button>

        {/* Fallback Option */}
        <button
          onClick={handleFallback}
          className="w-full text-gray-400 hover:text-white py-2 text-sm transition-colors"
        >
          სხვა მეთოდით შესვლა
        </button>

        <div className="text-center text-gray-500 text-xs mt-4">
          უსაფრთხო ავტორიზაცია ბიომეტრიული ან PIN კოდით
        </div>
      </div>
    </div>
  );
};

const ProviderModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, true);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'ავტორიზაცია ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigate('/register?role=provider');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border-2 border-green-200 rounded-xl p-8 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">მომწოდებელი</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ელ-ფოსტა"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="პაროლი"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'შესვლა...' : 'შესვლა'}
          </button>
        </form>

        {/* Register Option */}
        <div className="mt-4 text-center">
          <span className="text-gray-600 text-sm">ანგარიში არ გაქვთ? </span>
          <button
            onClick={handleRegister}
            className="text-green-600 hover:text-green-700 font-medium text-sm"
          >
            დარეგისტრირდი როგორც პროვაიდერი
          </button>
        </div>

        <div className="text-center text-gray-500 text-xs mt-4">
          ობიექტების მართვა და ბიზნეს ოპერაციები
        </div>
      </div>
    </div>
  );
};

const CustomerModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/profile');
    } catch (err: any) {
      setError(err.message || 'ავტორიზაცია ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigate('/register');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 max-w-md w-full mx-4 shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">ჩემი კაბინეტი</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ელ-ფოსტა"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              required
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="პაროლი"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-md"
          >
            {loading ? 'შესვლა...' : 'ჩემი კაბინეტში შესვლა'}
          </button>
        </form>

        {/* Register Option */}
        <div className="mt-4 text-center">
          <span className="text-gray-600 text-sm">ანგარიში არ გაქვთ? </span>
          <button
            onClick={handleRegister}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            რეგისტრაცია
          </button>
        </div>

        <div className="text-center text-gray-500 text-xs mt-4">
          ჯავშნები, პროფილი და მომსახურებები
        </div>
      </div>
    </div>
  );
};

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selectedModal, setSelectedModal] = useState<string | null>(null);

  const handleRoleSelect = (role: string) => {
    setSelectedModal(role);
  };

  const handleBack = () => {
    navigate('/');
  };

  const closeModal = () => {
    setSelectedModal(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            სისტემაში შესვლა
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            აირჩიეთ თქვენი როლი სისტემაში
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="space-y-4">
          {/* Super Admin */}
          <button
            onClick={() => handleRoleSelect('super_admin')}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-lg p-6 border border-purple-200 dark:border-purple-700 transition-all duration-200 transform hover:scale-105 group"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-lg group-hover:bg-white/30 transition-colors">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1 text-white">
                <h3 className="text-lg font-semibold">
                  სუპერ ადმინისტრატორი
                </h3>
                <p className="text-sm opacity-90">
                  სისტემის სრული მართვა • Passkey ავტორიზაცია
                </p>
              </div>
            </div>
          </button>

          {/* Provider */}
          <button
            onClick={() => handleRoleSelect('provider')}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 rounded-xl shadow-lg p-6 border border-green-200 dark:border-green-700 transition-all duration-200 transform hover:scale-105 group"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-lg group-hover:bg-white/30 transition-colors">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1 text-white">
                <h3 className="text-lg font-semibold">
                  მომწოდებელი
                </h3>
                <p className="text-sm opacity-90">
                  ობიექტების მენეჯმენტი • ბიზნეს ოპერაციები
                </p>
              </div>
            </div>
          </button>

          {/* Customer */}
          <button
            onClick={() => handleRoleSelect('customer')}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-lg p-6 border border-blue-200 dark:border-blue-700 transition-all duration-200 transform hover:scale-105 group"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-lg group-hover:bg-white/30 transition-colors">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1 text-white">
                <h3 className="text-lg font-semibold">
                  კლიენტი/ვიზიტორი
                </h3>
                <p className="text-sm opacity-90">
                  ჯავშნები და პროფილი • მომხმარებლის კაბინეტი
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Back Button */}
        <button
          onClick={handleBack}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>უკან დაბრუნება</span>
        </button>
      </div>

      {/* Role-specific Modals */}
      <SuperAdminModal isOpen={selectedModal === 'super_admin'} onClose={closeModal} />
      <ProviderModal isOpen={selectedModal === 'provider'} onClose={closeModal} />
      <CustomerModal isOpen={selectedModal === 'customer'} onClose={closeModal} />
    </div>
  );
};

export default RoleSelection;


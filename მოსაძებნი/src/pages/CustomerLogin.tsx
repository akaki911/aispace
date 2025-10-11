
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/useAuth';

const CustomerLogin: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await login(email, password, trustThisDevice);
      navigate('/account');
    } catch (err: any) {
      setError(err.message || 'ავტორიზაცია ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('გთხოვთ შეიყვანოთ ელ-ფოსტა');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError('');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="bg-blue-600 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <User className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            ჩემი კაბინეტი
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            ჯავშნები, პროფილი და მომსახურებები
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="პაროლი"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="trust-device"
                  type="checkbox"
                  checked={trustThisDevice}
                  onChange={(e) => setTrustThisDevice(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="trust-device" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  ამ მოწყობილობას ენდო
                </label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-md"
            >
              {loading ? 'შესვლა...' : 'შესვლა'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-600 dark:text-gray-400 text-sm">ანგარიში არ გაქვთ? </span>
            <button
              onClick={() => navigate('/register')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium text-sm"
            >
              რეგისტრაცია
            </button>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={handleBack}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>მთავარ გვერდზე დაბრუნება</span>
        </button>
      </div>
    </div>
  );
};

export default CustomerLogin;

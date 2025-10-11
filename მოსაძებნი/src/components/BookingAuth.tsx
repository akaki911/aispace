// @ts-nocheck
import React, { useState } from 'react';
import { X, User, Lock, AlertCircle } from 'lucide-react';
import { getUserByPhoneOrPersonalId } from '../services/userService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface BookingAuthProps {
  onAuthSuccess: (user: any) => void;
  onBack: () => void;
  preFilledPhone?: string;
  preFilledPersonalId?: string;
}

export default function BookingAuth({ 
  onAuthSuccess, 
  onBack, 
  preFilledPhone = '', 
  preFilledPersonalId = '' 
}: BookingAuthProps) {
  const [formData, setFormData] = useState({
    phone: preFilledPhone,
    personalId: preFilledPersonalId,
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const { loginWithPhoneAndPassword, registerFromBookingForm, checkUserExists } = useAuth();
  const [isRegistration, setIsRegistration] = useState(false);
  const [additionalFields, setAdditionalFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone && !formData.personalId) {
      setError('შეიყვანეთ ტელეფონი ან პირადი ნომერი');
      return;
    }

    if (!formData.password) {
      setError('შეიყვანეთ პაროლი');
      return;
    }

    if (isRegistration) {
      // Validate registration fields
      if (!additionalFields.firstName || !additionalFields.lastName || !additionalFields.email) {
        setError('შეიყვანეთ ყველა სავალდებულო ველი');
        return;
      }

      if (formData.password !== additionalFields.confirmPassword) {
        setError('პაროლები არ ემთხვევა');
        return;
      }

      if (formData.password.length < 6) {
        setError('პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      if (isRegistration) {
        // Register new user
        const userData = {
          firstName: additionalFields.firstName,
          lastName: additionalFields.lastName,
          phoneNumber: formData.phone,
          personalId: formData.personalId,
          email: additionalFields.email,
          password: formData.password
        };

        const user = await registerFromBookingForm(userData);
        console.log('✅ Registration successful:', user);
        onAuthSuccess(user);
      } else {
        // Login existing user
        await loginWithPhoneAndPassword(formData.phone, formData.password);
        console.log('✅ Login successful');
        onAuthSuccess({ success: true });
      }
    } catch (error: any) {
      console.error('❌ Authentication error:', error);
      setError(error.message || 'ავტორიზაციის შეცდომა');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckUser = async () => {
    if (!formData.phone || formData.phone.length < 6) return;

    try {
      const exists = await checkUserExists(formData.phone, formData.personalId);
      setIsRegistration(!exists);
      
      if (!exists) {
        setError('');
        console.log('ℹ️ New user detected - showing registration form');
      }
    } catch (error) {
      console.error('❌ Error checking user:', error);
    }
  };

  // Check user existence when phone changes
  useEffect(() => {
    const timer = setTimeout(handleCheckUser, 500);
    return () => clearTimeout(timer);
  }, [formData.phone]);

  const handleUserAuthentication = async () => {
    try {
      const user = await getUserByPhoneOrPersonalId(formData.phone, formData.personalId || '');

      if (!user) {
        throw new Error('მომხმარებელი ვერ მოიძებნა');
      }

      // For demo purposes, we'll skip password validation
      // In production, you should hash and verify passwords properly
      console.log('✅ Customer authenticated:', user);
      onAuthSuccess(user);
    } catch (error: any) {
      console.error('❌ Authentication failed:', error);
      setError(error.message || 'ავტორიზაცია ვერ მოხერხდა');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">ავტორიზაცია</h2>
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ტელეფონი
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="9 ციფრი"
                maxLength={9}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              პირადი ნომერი
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                name="personalId"
                value={formData.personalId}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="11 ციფრი"
                maxLength={11}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              პაროლი
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onKeyDown={(e) => {
                  const warning = document.getElementById('capslock-warning-booking-auth');
                  if (e.getModifierState('CapsLock')) {
                    if (warning) warning.style.display = 'block';
                  } else {
                    if (warning) warning.style.display = 'none';
                  }
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="შეიყვანეთ პაროლი"
                required
              />
            </div>
            {/* Caps Lock warning */}
            <div className="text-xs text-yellow-600 mt-1" id="capslock-warning-booking-auth" style={{ display: 'none' }}>
              ⚠️ Caps Lock ჩართულია
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              უკან
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
            >
              {isLoading ? 'მოწმდება...' : 'შესვლა'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
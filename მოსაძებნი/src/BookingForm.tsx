// @ts-nocheck
// BookingForm.tsx - Fixed syntax error and added proper imports
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ArrowLeft, Calendar, Users, User, Clock } from 'lucide-react';
import { calculateSeasonalPrice, type PricingResult } from './utils/pricing';
import { checkUserExists, registerCustomerDuringBooking } from './services/userService';
import CustomCalendar from './components/Calendar';
import BookingAuth from './components/BookingAuth';
import { useAuth } from './contexts/useAuth';
import { useValidation } from './hooks/useValidation';
import WarningToast from './components/WarningToast';

interface BookingData {
  firstName: string;
  lastName: string;
  personalId: string;
  phone: string;
  password: string;
  adults: number;
  children: number;
  cottage: string;
  startDate: Date | null;
  endDate: Date | null;
  arrivalTime: string;
  departureTime: string;
  notes: string;
  useCustomPrice: boolean;
  customTotalPrice: number | null;
  გადასახდილია: boolean;
}

export default function BookingForm() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [userCheckPerformed, setUserCheckPerformed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const { 
    isWarningToastVisible,
    hideValidationErrors: hideWarningToast,
    showWarningToast,
    validateBooking
  } = useValidation();
  const [userDetails, setUserDetails] = useState<any>(null);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [cottageName, setCottageName] = useState<string>('კოტეჯი');
  const [priceVerified, setPriceVerified] = useState(false);

  const [form, setForm] = useState<BookingData>({
    firstName: '',
    lastName: '',
    personalId: '',
    phone: '',
    password: '',
    adults: 1,
    children: 0,
    cottage: id || '',
    startDate: null,
    endDate: null,
    arrivalTime: '14:00',
    departureTime: '12:00',
    notes: '',
    useCustomPrice: false,
    customTotalPrice: null,
    გადასახდილია: false
  });

  // Load cottage name
  useEffect(() => {
    const fetchCottage = async () => {
      if (!id) {
        return;
      }
      try {
        const cottageDoc = await getDoc(doc(db, 'cottages', id));
        if (cottageDoc.exists()) {
          const cottageName = cottageDoc.data().name || 'კოტეჯი';
          setCottageName(cottageName);
        } else {
          setCottageName('კოტეჯი');
        }
      } catch (error) {
        console.error('Error fetching cottage:', error);
        setCottageName('კოტეჯი');
      }
    };

    // Only fetch if we don't already have a cottage name
    if (id && cottageName === 'კოტეჯი') {
      fetchCottage();
    }
  }, [id, cottageName]);

  // Load booked dates
  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(db, 'bookings'), 
          where('cottage', '==', id),
          where('გადასახდილია', '==', true)
        );
        const snap = await getDocs(q);
        const dates: Date[] = [];

        snap.forEach(doc => {
          const data = doc.data();
          if (data.startDate && data.endDate) {
            const startDate = data.startDate.toDate();
            const endDate = data.endDate.toDate();
            for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
              dates.push(new Date(d));
            }
          }
        });

        setBookedDates(dates);
      } catch (error) {
        console.error('Error fetching booked dates:', error);
      }
    };
    fetchBookedDates();
  }, [id]);

  // Calculate pricing
  useEffect(() => {
    if (form.startDate && form.endDate && form.adults && form.endDate > form.startDate) {
      const pricingResult = calculateSeasonalPrice(
        form.startDate,
        form.endDate,
        form.adults,
        form.children,
        form.useCustomPrice,
        form.customTotalPrice
      );
      setPricing(pricingResult);
      setPriceVerified(true); // ფასი გამოითვლა, ავტომატურად ვალიდურია
    } else {
      setPriceVerified(false);
    }
  }, [form.startDate, form.endDate, form.adults, form.children, form.useCustomPrice, form.customTotalPrice]);

  // Form validation
  const isFormValid = useMemo(() => {
    if (!priceVerified) {
      return false;
    }

    if (!form.startDate || !form.endDate) {
      return false;
    }

    if (!form.adults || form.adults < 1) {
      return false;
    }

    // თუ მომხმარებელი ავტორიზებულია, ვამოწმებთ authUser-ის მონაცემებს
    if (authUser) {
      const hasValidAuthData = (
        authUser.firstName && authUser.firstName.trim() !== '' &&
        authUser.lastName && authUser.lastName.trim() !== '' &&
        (authUser.personalId || authUser.phoneNumber || authUser.email)
      );

      return hasValidAuthData;
    }

    // თუ არაა ავტორიზებული, ვამოწმებთ ფორმის პირად ინფოს
    const personalInfoValid = (
      form.firstName.trim() !== '' &&
      form.lastName.trim() !== '' &&
      form.personalId.trim().length === 11 &&
      form.phone.trim().length >= 9
    );

    return personalInfoValid;
  }, [priceVerified, form.startDate, form.endDate, form.adults, form.firstName, form.lastName, form.personalId, form.phone, authUser]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'adults' || name === 'children'
        ? Number(value)
        : value
    }));

    // Real-time validation removed as per instruction

    // User existence check
    if (name === 'phone' || name === 'personalId') {
      setUserCheckPerformed(false);
      setShowPasswordField(false);
      setShowAuthModal(false);
      setAuthenticatedUser(null);

      if (value.length > 5) {
        setTimeout(async () => {
          await checkIfUserExists();
        }, 500);
      }
    }
  };

  const checkIfUserExists = async () => {
    // Skip check if user is already authenticated (any role)
    if (authUser) {
      console.log('✅ User already authenticated, skipping check');
      return;
    }

    if (userCheckPerformed) return;
    if (!form.phone && !form.personalId) return;
    if (form.phone.length < 6 && form.personalId.length < 6) return;

    try {
      console.log('🔍 Checking user existence in Firestore...');
      
      // Check both Firebase Auth and Firestore collections
      const phoneQueries = [
        query(collection(db, 'users'), where('phoneNumber', '==', form.phone.trim())),
        query(collection(db, 'clients'), where('phoneNumber', '==', form.phone.trim()))
      ];

      const personalIdQueries = [
        query(collection(db, 'users'), where('personalId', '==', form.personalId.trim())),
        query(collection(db, 'clients'), where('personalId', '==', form.personalId.trim()))
      ];

      const [usersPhoneSnapshot, clientsPhoneSnapshot, usersPersonalIdSnapshot, clientsPersonalIdSnapshot] = await Promise.all([
        getDocs(phoneQueries[0]),
        getDocs(phoneQueries[1]),
        getDocs(personalIdQueries[0]),
        getDocs(personalIdQueries[1])
      ]);

      const userExists = !usersPhoneSnapshot.empty || !clientsPhoneSnapshot.empty || 
                        !usersPersonalIdSnapshot.empty || !clientsPersonalIdSnapshot.empty;

      if (userExists) {
        console.log('✅ User found in database');
        setShowAuthModal(true);
        setUserCheckPerformed(true);
        setShowPasswordField(true);
      } else {
        console.log('ℹ️ New user - registration will be offered during booking');
        setUserCheckPerformed(true);
        setShowPasswordField(false);
      }
    } catch (error) {
      console.error('❌ Error checking user existence:', error);
      setUserCheckPerformed(true);
    }
  };

  const handleAuthSuccess = (user: any) => {
    setAuthenticatedUser(user);
    setShowAuthModal(false);
    setForm(prev => ({
      ...prev,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phoneNumber || prev.phone,
      personalId: user.personalId || prev.personalId
    }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', date: Date | null) => {
    if (date) {
      setForm(prev => ({ ...prev, [field]: date }));
    }
  };

  const calculateNights = () => {
    if (!form.startDate || !form.endDate) return 0;
    const diffTime = Math.abs(form.endDate.getTime() - form.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔄 Starting booking submission...');

    try {
      // Validate form using new utility (only for non-authenticated users)
      if (!authUser) {
        const validationResult = validateBooking(form);

        if (!validationResult.isValid) {
          showWarningToast(validationResult.errors);
          return;
        }
      }

      // Personal data validation - different logic for authenticated vs non-authenticated users
      let firstName, lastName, personalId, phone;

      if (authUser) {
        // Use authUser data for authenticated users
        firstName = authUser.firstName;
        lastName = authUser.lastName;
        personalId = authUser.personalId || '';
        phone = authUser.phoneNumber || authUser.email || '';

        console.log('📝 Using authenticated user data:', { firstName, lastName, personalId, phone });

        if (!firstName?.trim() || !lastName?.trim()) {
          alert('ავტორიზებული მომხმარებლის მონაცემები არასრული');
          return;
        }
      } else {
        // Use form data for non-authenticated users
        firstName = form.firstName;
        lastName = form.lastName;
        personalId = form.personalId;
        phone = form.phone;

        console.log('📝 Using form data:', { firstName, lastName, personalId, phone });

        if (!firstName?.trim() || !lastName?.trim() || !personalId?.trim() || !phone?.trim()) {
          alert('გთხოვთ შეავსოთ ყველა აუცილებელი ველი');
          return;
        }
      }

      // Validate phone and personal ID format
      const phoneRegex = /^[0-9]{9}$/;
      const personalIdRegex = /^[0-9]{11}$/;

      if (!phoneRegex.test(form.phone.trim())) {
        alert('ტელეფონის ნომერი უნდა შეიცავდეს ზუსტად 9 ციფრს');
        return;
      }

      if (!personalIdRegex.test(form.personalId.trim())) {
        alert('პირადი ნომერი უნდა შეიცავდეს ზუსტად 11 ციფრს');
        return;
      }

      // Check if new user needs password
      if (!authenticatedUser && showPasswordField && (!form.password || form.password.length < 6)) {
        alert('ახალი მომხმარებლისთვის პაროლი აუცილებელია (მინიმუმ 6 სიმბოლო)');
        return;
      }

      // If user exists but not authenticated, show error
      if (userCheckPerformed && !authenticatedUser && !showPasswordField) {
        alert('მომხმარებელი უკვე არსებობს. გთხოვთ გაიარეთ ავტორიზაცია');
        return;
      }

      setLoading(true);

      let userId = authenticatedUser?.id;

      // Register new user if needed or find existing user
      if (!authenticatedUser) {
        console.log('👤 Searching for user in Firestore or creating new...');

        try {
          // First, check if user exists by phone or personalId
          const phoneQuery = query(
            collection(db, 'clients'),
            where('phoneNumber', '==', form.phone.trim())
          );
          const phoneSnapshot = await getDocs(phoneQuery);

          const personalIdQuery = query(
            collection(db, 'clients'),
            where('personalId', '==', form.personalId.trim())
          );
          const personalIdSnapshot = await getDocs(personalIdQuery);

          if (!phoneSnapshot.empty) {
            const existingUser = phoneSnapshot.docs[0];
            userId = existingUser.id;
            console.log('✅ Found existing user by phone:', userId);
          } else if (!personalIdSnapshot.empty) {
            const existingUser = personalIdSnapshot.docs[0];
            userId = existingUser.id;
            console.log('✅ Found existing user by personalId:', userId);
          } else if (showPasswordField && form.password) {
            // Create new user
            console.log('📝 Creating new client in Firestore...');
            const clientRef = doc(collection(db, 'clients'));
            const newClientData = {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              phoneNumber: form.phone.trim(),
              personalId: form.personalId.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
              isActive: true
            };

            await setDoc(clientRef, newClientData);
            userId = clientRef.id;
            console.log('✅ New client created with ID:', userId);
          } else {
            throw new Error('მომხმარებლის იდენტიფიკაცია ვერ მოხერხდა');
          }
        } catch (registrationError: any) {
          console.error('❌ User management failed:', registrationError);
          throw new Error(`მომხმარებლის მართვის შეცდომა: ${registrationError.message}`);
        }
      }

      if (!userId) {
        throw new Error('მომხმარებლის იდენტიფიკაცია ვერ მოხერხდა - გთხოვთ გაიარეთ ავტორიზაცია');
      }

      console.log('💾 Creating booking in Firestore...');

      // Calculate final pricing values
      const numberOfDays = calculateNights();
      const finalTotalPrice = form.useCustomPrice && form.customTotalPrice 
        ? form.customTotalPrice 
        : pricing?.totalPrice || 0;
      const finalDepositAmount = pricing?.depositAmount || Math.ceil(finalTotalPrice * 0.3);

      console.log(`🧮 Booking price calculated: ${numberOfDays} days * rate = ${finalTotalPrice} ₾`);
      console.log(`💰 Deposit amount: ${finalDepositAmount} ₾`);

      // Prepare booking data for Firestore with proper date handling
      const bookingDataForFirestore = {
        // Core booking info
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        personalId: personalId.trim(),
        cottage: form.cottage,

        // Dates as Firestore Timestamps
        startDate: form.startDate,
        endDate: form.endDate,

        // Guest info
        adults: form.adults,
        children: form.children,

        // Timing
        arrivalTime: form.arrivalTime,
        departureTime: form.departureTime,

        // Pricing - Always save totalPrice for admin view
        totalPrice: finalTotalPrice,
        depositAmount: finalDepositAmount,
        calculatedDays: numberOfDays,
        dailyRate: numberOfDays > 0 ? Math.round(finalTotalPrice / numberOfDays) : 0,
        useCustomPrice: form.useCustomPrice,
        customTotalPrice: form.useCustomPrice ? form.customTotalPrice : null,

        // Payment status
        გადასახდილია: form.გადასახდილია,

        // Additional info
        notes: form.notes?.trim() || '',

        // User reference
        userId: userId,

        // Resource info for compatibility
        resourceType: 'cottage',
        resourceName: cottageName || 'კოტეჯი',
        resourceId: form.cottage,

        // Status tracking
        status: 'confirmed',
        isPaid: form.გადასახდილია,

        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('📊 Booking data prepared:', {
        customerName: `${bookingDataForFirestore.firstName} ${bookingDataForFirestore.lastName}`,
        cottage: bookingDataForFirestore.cottage,
        startDate: bookingDataForFirestore.startDate,
        endDate: bookingDataForFirestore.endDate,
        totalAmount: bookingDataForFirestore.totalPrice,
        userId: bookingDataForFirestore.userId
      });

      // Save to Firestore with error handling
      let docRef;
      try {
        docRef = await addDoc(collection(db, 'bookings'), bookingDataForFirestore);
      } catch (firestoreError: any) {
        console.error('❌ Firestore save error:', firestoreError);
        throw new Error(`მონაცემთა ბაზაში შენახვა ვერ მოხერხდა: ${firestoreError.message || 'უცნობი შეცდომა'}`);
      }

      if (!docRef?.id) {
        throw new Error('ჯავშანი შეიქმნა, მაგრამ Document ID არ დააბრუნა Firestore-მ');
      }

      console.log('✅ Booking created successfully with ID:', docRef.id);

      alert('🎉 ჯავშანი წარმატებით შექმნილია!');
      navigate('/');

    } catch (error: any) {
      console.error('❌ Booking submission error:', error);

      // More detailed error message
      let errorMessage = 'უცნობი შეცდომა';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      alert(`❌ ჯავშნის შეცდომა: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Load authenticated user details from Firestore - simplified
  useEffect(() => {
    // This test data loading is no longer needed and could cause performance issues
    // Removed to prevent unnecessary re-renders
  }, []);

  const isDateAvailable = (date: Date) => {
    return !bookedDates.some(bookedDate =>
      date.getDate() === bookedDate.getDate() &&
      date.getMonth() === bookedDate.getMonth() &&
      date.getFullYear() === bookedDate.getFullYear()
    );
  };

  const [customerInfo, setCustomerInfo] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: ''
  });

  // Auto-fill form with authenticated user data for ALL user types
  useEffect(() => {
    if (authUser) {
      console.log('🔑 Auto-filling form with authenticated user data:', authUser);
      setForm(prev => ({
        ...prev,
        firstName: authUser.firstName || '',
        lastName: authUser.lastName || '',
        phone: authUser.phoneNumber || authUser.email || '',
        personalId: authUser.personalId || ''
      }));
      setAuthenticatedUser(authUser);
      setUserCheckPerformed(true);
      setShowPasswordField(false); // User is already authenticated
    }
  }, [authUser]);

  // Debug form validation - simplified
  useEffect(() => {
    // Reduced logging to prevent infinite loops
    if (authUser) {
      console.log('🔧 Form validation: authenticated user');
    }
  }, [authUser]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-16">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            უკან დაბრუნება
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🏠</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">ჯავშნის გაფორმება</h1>
            <p className="text-gray-600">{cottageName}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information - Hidden for ALL authenticated users */}
            {authUser ? (
              /* ავტორიზებული მომხმარებლისთვის შეტყობინება */
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center mb-2">
                  <User className="w-5 h-5 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-green-800">
                    ✅ ავტორიზებული მომხმარებელი
                  </h3>
                </div>
                <p className="text-green-800 font-medium">
                  {authUser.firstName} {authUser.lastName}
                </p>
                <p className="text-green-600 text-sm mt-1">
                  თქვენი პირადი მონაცემები ავტომატურად გამოიყენება ჯავშნისთვის
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  პირადი ინფორმაცია
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">სახელი *</label>
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="შეიყვანეთ სახელი"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">გვარი *</label>
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="შეიყვანეთ გვარი"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">პირადი ნომერი *</label>
                    <input
                      name="personalId"
                      value={form.personalId}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="11 ციფრი"
                      maxLength={11}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ტელეფონი *</label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="9 ციფრი"
                      maxLength={9}
                      required
                    />
                  </div>
                  {showPasswordField && !authenticatedUser && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">პაროლი *</label>
                      <div className="relative">
                        <input
                          type="password"
                          name="password"
                          value={form.password}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="მინიმუმ 6 სიმბოლო"
                          required={showPasswordField}
                        />
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Guest Count */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                სტუმრების რაოდენობა
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ზრდასრულები</label>
                  <input
                    type="number"
                    name="adults"
                    value={form.adults}
                    min={1}
                    max={10}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ბავშვები</label>
                  <input
                    type="number"
                    name="children"
                    value={form.children}
                    min={0}
                    max={10}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                თარიღები
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <CustomCalendar 
                  bookedDates={bookedDates}
                  onDateSelect={(date) => {
                    if (!isDateAvailable(date)) return;

                    setForm(prev => {
                      if (!prev.startDate || (prev.startDate && prev.endDate)) {
                        return { ...prev, startDate: date, endDate: null };
                      } else if (prev.startDate && !prev.endDate) {
                        if (date > prev.startDate) {
                          return { ...prev, endDate: date };
                        } else {
                          return { ...prev, startDate: date, endDate: null };
                        }
                      }
                      return prev;
                    });
                  }}
                  selectedDate={form.startDate}
                  endDate={form.endDate}
                  minDate={new Date()}
                  className="mx-auto"
                />

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-blue-800">მოსვლა:</span>
                      <span className="text-blue-700">
                        {form.startDate ? form.startDate.toLocaleDateString('ka-GE') : 'არ არის არჩეული'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-blue-800">წასვლა:</span>
                      <span className="text-blue-700">
                        {form.endDate ? form.endDate.toLocaleDateString('ka-GE') : 'არ არის არჩეული'}
                      </span>
                    </div>
                    {form.startDate && form.endDate && (
                      <div className="flex justify-between pt-2 border-t border-blue-200">
                        <span className="font-medium text-blue-800">ღამეები:</span>
                        <span className="text-blue-700 font-semibold">{calculateNights()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {pricing && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                💰 ფასის დეტალები
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ბაზისური ტარიფი ({pricing.season}):</span>
                  <span className="font-semibold">{pricing.baseRate}₾</span>
                </div>

                {pricing.additionalGuestFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">დამატებითი ზრდასრული ({Math.round(pricing.additionalGuestFee / 20)}):</span>
                    <span className="font-semibold text-orange-600">+{pricing.additionalGuestFee}₾</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">კომუნალური მომსახურება:</span>
                  <span className="font-semibold text-green-600">+{pricing.utilityCost}₾</span>
                </div>

                {pricing.dynamicPriceMultiplier !== 1.0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">დინამიური ფასი ({pricing.daysUntilCheckIn} დღე):</span>
                    <span className="font-semibold text-red-600">×{pricing.dynamicPriceMultiplier.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ღამეების რაოდენობა:</span>
                  <span className="font-semibold">{pricing.nights}</span>
                </div>

                {pricing.isLongStay && (
                  <div className="text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
                    ✓ გრძელვადიანი დაკავება (21+ ღამე) - ფასდაკლება
                  </div>
                )}

                <hr className="border-blue-200" />

                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold text-gray-700">ღამეში:</span>
                  <span className="font-bold text-blue-600">{pricing.pricePerNight}₾</span>
                </div>

                <div className="flex justify-between items-center text-xl bg-blue-100 p-3 rounded-lg">
                  <span className="font-bold text-blue-800">ჯამური ფასი:</span>
                  <span className="font-bold text-blue-800">{pricing.totalPrice}₾</span>
                </div>

                <div className="flex justify-between items-center text-lg bg-orange-100 p-3 rounded-lg">
                  <span className="font-bold text-orange-800">წინადებეტი ({Math.round((pricing.depositAmount / pricing.totalPrice) * 100)}%):</span>
                  <span className="font-bold text-orange-800">{pricing.depositAmount}₾</span>
                </div>
              </div>
            </div>
          )}
            </div>

            {/* Time */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                დრო
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">მოსვლის დრო</label>
                  <input
                    type="time"
                    name="arrivalTime"
                    value={form.arrivalTime}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">გასვლის დრო</label>
                  <input
                    type="time"
                    name="departureTime"
                    value={form.departureTime}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* ინდივიდუალური ფასი */}
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-orange-800 flex items-center">
                    💰 ინდივიდუალური ფასი
                  </h3>
                  <p className="text-sm text-orange-700 mt-1">სპეციალური ფასის მისანიჭებელი</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.useCustomPrice}
                    onChange={(e) => setForm(prev => ({ 
                      ...prev,                       useCustomPrice: e.target.checked,
                      customTotalPrice: e.target.checked ? prev.customTotalPrice : null
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  <span className="ml-3 text-sm font-medium text-orange-800">გამორთული</span>
                </label>
              </div>

              {form.useCustomPrice && (
                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-2">ჯამური ღირებულება (₾)</label>
                  <input
                    type="number"
                    value={form.customTotalPrice || ''}
                    onChange={(e) => setForm(prev => ({ 
                      ...prev, 
                      customTotalPrice: e.target.value ? Number(e.target.value) : null 
                    }))}
                    className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                    placeholder="შეიყვანეთ სპეციალური ფასი"
                    min="1"
                  />
                  <p className="mt-2 text-xs text-orange-600">
                    ℹ️ ინდივიდუალური ფასი ჩაანაცვლებს ავტომატურ კალკულაციას
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">შენიშვნები</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="დამატებითი ინფორმაცია..."
                maxLength={500}
              />
            </div>

            {/* Payment Status */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="გადასახდილია"
                  checked={form.გადასახდილია}
                  onChange={(e) => setForm(prev => ({ ...prev, გადასახდილია: e.target.checked }))}
                  className="mr-3 h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  გადახდილია (მხოლოდ ადმინისტრაციისთვის)
                </span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
              >
                გაუქმება
              </button>
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    დაჯავშნა...
                  </>
                ) : (
                  'დაჯავშნა'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <BookingAuth
          onAuthSuccess={handleAuthSuccess}
          onBack={() => {
            setShowAuthModal(false);
            setUserCheckPerformed(false);
          }}
          preFilledPhone={form.phone}
          preFilledPersonalId={form.personalId}
        />
      )}

      {/* Warning Toast */}
      <WarningToast
        isVisible={isWarningToastVisible}
        onClose={hideWarningToast}
        messages={validationErrors}
        title="ჯავშნის ფორმა არასრული"
        type="warning"
        position="top"
        autoClose={true}
      />
    </div>
  );
}
// Clean syntax validation
// END
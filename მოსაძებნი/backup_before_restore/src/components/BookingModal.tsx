import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { X, Calendar, Users, Phone, User, Clock, Lock, Home, CreditCard } from 'lucide-react';
import { calculateSeasonalPrice, type PricingResult } from '../utils/pricing';
import { getActivePrice } from '../types/seasonalPricing';
import { checkUserExists, registerCustomerDuringBooking } from '../services/userService';
import CustomCalendar from './Calendar';
import BookingAuth from './BookingAuth';
import ConfirmationModal from './ConfirmationModal';
import { validatePriceCode } from '../services/priceCodeService';
import { useAuth } from '../contexts/AuthContext';
import { useValidation } from '../hooks/useValidation';
import ValidationModal from './ValidationModal';
import { useDebugLogging } from '../hooks/useDebugLogging';

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

interface BookingModalProps {
  cottageId: string;
  cottageName: string;
  isOpen: boolean;
  onClose: () => void;
  booking?: any;
  mode: 'create' | 'edit' | 'view';
  onBookingUpdated?: () => void;
}

export default function BookingModal({ cottageId, cottageName, isOpen, onClose, booking, mode, onBookingUpdated }: BookingModalProps) {
  // Use cottageId from props - it should always be provided when modal is opened
  const finalCottageId = cottageId;
  const { user: authUser } = useAuth();
  const { validationErrors, isValidationModalOpen, hideValidationErrors, validateAndProceed } = useValidation();
  const { logModal, logInfo, logValidation, logError } = useDebugLogging('BookingModal');

  console.log('🏠 BookingModal received cottage ID:', cottageId);
  console.log('🏠 Final cottage ID:', finalCottageId);

  // Early return if no cottage ID
  if (!cottageId) {
    console.error('❌ BookingModal: No cottage ID provided!');
    return null;
  }

  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [userCheckPerformed, setUserCheckPerformed] = useState(false);
  const [showExistingUserBanner, setShowExistingUserBanner] = useState(false);

  // Price code states
  const [priceCode, setPriceCode] = useState('');
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [codeValidationError, setCodeValidationError] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookingConfirmationData, setBookingConfirmationData] = useState<any>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [cottage, setCottage] = useState<any>(null);

  const [form, setForm] = useState<BookingData>({
    firstName: '',
    lastName: '',
    personalId: '',
    phone: '',
    password: '',
    adults: 1,
    children: 0,
    cottage: cottageId || '',
    startDate: null,
    endDate: null,
    arrivalTime: '14:00',
    departureTime: '12:00',
    notes: '',
    useCustomPrice: false,
    customTotalPrice: null,
    გადასახდილია: false
  });

  // Update cottage field when cottageId changes
  useEffect(() => {
    if (cottageId) {
      setForm(prev => ({ ...prev, cottage: cottageId }));
    }
  }, [cottageId]);

  // Auto-set authenticated user if authUser exists
  useEffect(() => {
    if (authUser) {
      setAuthenticatedUser(authUser);
      setForm(prev => ({
        ...prev,
        firstName: authUser.firstName || '',
        lastName: authUser.lastName || '',
        phone: authUser.phoneNumber || authUser.email || '',
        personalId: authUser.personalId || ''
      }));
      setUserCheckPerformed(true);
      setShowPasswordField(false);
    }
  }, [authUser]);

  useEffect(() => {
    const fetchCottage = async () => {
      if (cottageId) {
        try {
          const cottageDoc = await getDoc(doc(db, 'cottages', cottageId));
          if (cottageDoc.exists()) {
            setCottage(cottageDoc.data());
          } else {
            console.log('No such cottage!');
          }
        } catch (error) {
          console.error('Error fetching cottage:', error);
        }
      }
    };

    fetchCottage();
  }, [cottageId]);

  // დაკავებული თარიღების ჩატვირთვა
  useEffect(() => {
    if (!isOpen || !cottageId) return;

    const fetchBookedDates = async () => {
      try {
        const q = query(
          collection(db, 'bookings'), 
          where('cottage', '==', cottageId),
          where('გადასახდილია', '==', true),
          limit(100)
        );
        const snap = await getDocs(q);
        const dates: Date[] = [];

        snap.forEach(doc => {
          const data = doc.data();
          const startDate = data.startDate.toDate();
          const endDate = data.endDate.toDate();

          for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
          }
        });

        setBookedDates(dates);
      } catch (error) {
        console.error('Error fetching booked dates:', error);
      }
    };

    fetchBookedDates();
  }, [isOpen, cottageId]);

  // ფასის გამოთვლა - now uses actual cottage data for accurate base pricing
  useEffect(() => {
    if (form.startDate && form.endDate && form.adults && form.endDate > form.startDate && cottage) {
      const pricingResult = calculateSeasonalPrice(
        form.startDate,
        form.endDate,
        form.adults,
        form.children,
        form.useCustomPrice,
        form.customTotalPrice,
        cottage // Pass cottage object to get accurate base price via getActivePrice()
      );
      setPricing(pricingResult);
    }
  }, [form.startDate, form.endDate, form.adults, form.children, form.useCustomPrice, form.customTotalPrice, cottage]);

  // Validate price code
  const validateCode = async () => {
    if (!priceCode.trim()) {
      setCodeValidationError('შეიყვანეთ კოდი');
      return;
    }

    if (!cottageId) {
      setCodeValidationError('კოტეჯის ID არ არის მითითებული');
      return;
    }

    setIsValidatingCode(true);
    setCodeValidationError('');

    try {
      const result = await validatePriceCode(priceCode.trim(), cottageId);

      if (result.isValid) {
        setIsCodeValid(true);
        setCodeValidationError('');
        setForm(prev => ({ ...prev, useCustomPrice: true }));
        console.log('✅ კოდი დადასტურებულია - ინდივიდუალური ფასის ველი გააქტიურდა');
      } else {
        setIsCodeValid(false);
        setCodeValidationError(result.error || 'კოდი არასწორია');
        setForm(prev => ({ ...prev, useCustomPrice: false, customTotalPrice: null }));
      }
    } catch (error: any) {
      console.error('❌ Error validating code:', error);
      setCodeValidationError('კოდის შემოწმება ვერ მოხერხდა');
      setIsCodeValid(false);
    } finally {
      setIsValidatingCode(false);
    }
  };


  // პაროლის ვალიდაციის ფუნქცია
  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+=-]{6,}$/;

    if (!password) {
      return { isValid: false, message: "პაროლი სავალდებულოა" };
    }

    if (password.length < 6) {
      return { isValid: false, message: "პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს" };
    }

    if (!passwordRegex.test(password)) {
      return { isValid: false, message: "პაროლი უნდა შეიცავდეს მხოლოდ ინგლისურ ასოებს, ციფრებს და მითითებულ სპეციალურ სიმბოლოებს" };
    }

    return { isValid: true, message: "" };
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`📝 Field changed: ${name} = ${value}`);

    setForm(prev => ({
      ...prev,
      [name]: name === 'adults' || name === 'children'
        ? Number(value)
        : value
    }));

    // პაროლის ვალიდაცია real-time-ში
    if (name === 'password' && value) {
      const validation = validatePassword(value);
      if (!validation.isValid) {
        console.warn(`⚠️ Password validation failed: ${validation.message}`);
      }
    }

    if (name === 'phone' || name === 'personalId') {
      console.log(`🔍 Checking user existence for ${name}: ${value}`);
      setUserCheckPerformed(false);
      setShowPasswordField(false);
      setShowAuthModal(false);
      setAuthenticatedUser(null);
      setShowExistingUserBanner(false);

      if (value.length > 5) {
        setTimeout(async () => {
          const updatedForm = { ...form, [name]: value };
          if (updatedForm.phone.length > 5 || updatedForm.personalId.length > 5) {
            try {
              console.log(`📞 Checking if user exists with phone: ${updatedForm.phone}, personalId: ${updatedForm.personalId}`);
              const userCheckResult = await checkUserExists(updatedForm.phone, updatedForm.personalId);
              console.log("checkUserExists result:", userCheckResult);

              if (userCheckResult.exists) {
                console.log(`✅ Existing user found:`, userCheckResult);
                setShowExistingUserBanner(true);
                setShowAuthModal(true);
                setUserCheckPerformed(true);
              } else {
                console.log(`🆕 New user - showing password field`);
                setShowPasswordField(true);
                setUserCheckPerformed(true);
                setShowExistingUserBanner(false);
              }
            } catch (error: any) {
        console.error('❌ Error checking user existence:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Stack trace:', error.stack);
        setShowPasswordField(true);
        setUserCheckPerformed(true);
        alert('მომხმარებლის შემოწმების დროს მოხდა შეცდომა. სცადეთ ხელახლა');
      }
          }
        }, 500);
      }
    }
  };

  const handleAuthSuccess = (user: any) => {
    setAuthenticatedUser(user);
    setShowAuthModal(false);
    setShowExistingUserBanner(false);
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

  // Cache booked dates set for better performance
  const bookedDatesSet = useMemo(() => {
    return new Set(bookedDates.map(date => date.toDateString()));
  }, [bookedDates]);

  const isDateAvailable = useCallback((date: Date) => {
    return !bookedDatesSet.has(date.toDateString());
  }, [bookedDatesSet]);

  const isRangeOverlappingWithBookedDates = useCallback((rangeStart: Date, rangeEnd: Date): boolean => {
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      if (bookedDatesSet.has(d.toDateString())) {
        return true; // Overlap found
      }
    }
    return false; // No overlap
  }, [bookedDatesSet]);

  const resetForm = () => {
    setForm({
      firstName: '',
      lastName: '',
      personalId: '',
      phone: '',
      password: '',
      adults: 1,
      children: 0,
      cottage: cottageId || '',
      startDate: null,
      endDate: null,
      arrivalTime: '14:00',
      departureTime: '12:00',
      notes: '',
      useCustomPrice: false,
      customTotalPrice: null,
      გადასახდილია: false
    });
    setPricing(null);
    setPriceCode('');
    setIsCodeValid(false);
    setCodeValidationError('');
  };

  const createTemporaryBlock = async (
    cottageId: string,
    startDate: Date,
    endDate: Date,
    customerName: string,
    customerPhone: string,
    bookingId: string
  ) => {
    // Logic to create a temporary block (e.g., in Firestore or a cache)
    // This is a placeholder, replace with your actual implementation
    console.log(
      `Creating temporary block for cottage ${cottageId} from ${startDate} to ${endDate} for customer ${customerName} (${customerPhone}) with booking ID ${bookingId}`
    );

    // In a real implementation, you might:
    // 1. Add a document to a "temporaryBlocks" collection in Firestore
    // 2. Store the block information in a cache (e.g., Redis)

    // Example using Firestore:
    try {
      await addDoc(collection(db, 'temporaryBlocks'), {
        cottageId: cottageId,
        startDate: startDate,
        endDate: endDate,
        customerName: customerName,
        customerPhone: customerPhone,
        bookingId: bookingId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      });
      console.log('✅ Temporary block created in Firestore');
    } catch (error) {
      console.error('❌ Error creating temporary block in Firestore:', error);
      throw error; // Re-throw the error to be caught by the handleSubmit function
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 Starting booking submission process');

    const proceedWithBooking = async () => {
      // Additional booking-specific validations
      if (!authenticatedUser && showPasswordField) {
        if (!form.password) {
          alert('გთხოვ შეიყვანე პაროლი რეგისტრაციისთვის');
          return;
        }

        const passwordValidation = validatePassword(form.password);
        if (!passwordValidation.isValid) {
          alert(`პაროლის შეცდომა: ${passwordValidation.message}`);
          return;
        }
      }

      setLoading(true);

      try {
        // calculates the number of nights
        const calculateNights = () => {
          if (!form.startDate || !form.endDate) return 0;
          const diff = form.endDate.getTime() - form.startDate.getTime();
          return Math.ceil(diff / (1000 * 3600 * 24));
        };

        // Calculate final pricing values with logging
        const numberOfDays = calculateNights();
        const finalTotalPrice = form.useCustomPrice && form.customTotalPrice 
          ? form.customTotalPrice 
          : pricing?.totalPrice || 0;
        const finalDepositAmount = pricing?.depositAmount || Math.ceil(finalTotalPrice * 0.3);
        const remainingAmount = finalTotalPrice - finalDepositAmount;

        console.log(`🧮 Modal booking price calculated: ${numberOfDays} days * rate = ${finalTotalPrice} ₾`);
        console.log(`💰 Modal deposit amount: ${finalDepositAmount} ₾`);
        console.log(`💳 Modal remaining amount: ${remainingAmount} ₾`);
        console.log('💾 Creating booking in Firestore...');

        console.log(`🧮 Modal booking price calculated: ${numberOfDays} days * rate = ${finalTotalPrice} ₾`);
        console.log(`💰 Modal deposit amount: ${finalDepositAmount} ₾`);
        console.log(`💳 Modal remaining amount: ${remainingAmount} ₾`);

        // Ensure we have a valid user before creating booking
        let validUserId = authenticatedUser?.id;

        if (!validUserId && form.password) {
          console.log('🔄 No existing user found, creating new user...');

          // Create new user first
          try{
            const newUser = await registerCustomerDuringBooking({
              firstName: form.firstName,
              lastName: form.lastName,
              phoneNumber: form.phone,
              personalId: form.personalId,
              password: form.password || 'bakhmaro2024',
            });

            validUserId = newUser.id;
            console.log('✅ New user created with ID:', validUserId);
          } catch(error){
            console.error("Error creating user", error)
          }

        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 წუთი

        const bookingData = {
          ...form,
          cottage: cottageId, // Ensure cottage field is set correctly
          userId: validUserId,
          customerId: validUserId, // Use the valid user ID
          createdAt: now,
          expiresAt: expiresAt,
          status: 'pending', // შეცვლილი confirmed-დან pending-ზე
          // Pricing - Always save all pricing values for admin view
          totalPrice: finalTotalPrice,
          depositAmount: finalDepositAmount,
          remainingAmount: remainingAmount,
          calculatedDays: calculateNights(),
          dailyRate: calculateNights() > 0 ? Math.round(finalTotalPrice / calculateNights()) : 0,
          useCustomPrice: form.useCustomPrice,
          customTotalPrice: form.useCustomPrice ? form.customTotalPrice : null,
        };

        // Final validation of booking payload
        if (!bookingData.cottage) {
          console.error('❌ Missing cottage field in booking payload');
          alert('კოტეჯის ინფორმაცია არ არის მითითებული. სცადეთ ხელახლა');
          return;
        }

        console.log('📦 Booking Payload:', bookingData);

        // ჯავშნის შექმნა
        try {
          const docRef = await addDoc(collection(db, 'bookings'), bookingData);

          console.log('✅ Booking created successfully with ID:', docRef.id);

          // დროებითი ბლოკის შექმნა 15 წუთით
          try {
            await createTemporaryBlock(
              cottageId,
              form.startDate!,
              form.endDate!,
              `${form.firstName} ${form.lastName}`,
              form.phone,
              docRef.id
            );
            console.log('✅ Temporary block created for 15 minutes');
          } catch (blockError) {
            console.error('❌ Failed to create temporary block:', blockError);
            // ჯავშანი მაინც შენახეს, მაგრამ ბლოკი არ შეიქმნა
          }

          // წარმატების მოდალის ჩვენება
          setBookingSuccess(true);
          setShowConfirmationModal(true);
          // შევქმნათ confirmation modal-ის მონაცემები
          setBookingConfirmationData({
            cottageId: cottageId,
            cottageName: cottageName,
            startDate: form.startDate,
            endDate: form.endDate,
            adults: form.adults,
            children: form.children,
            totalPrice: finalTotalPrice,
            depositAmount: finalDepositAmount,
            customTotalPrice: form.useCustomPrice ? form.customTotalPrice : null,
            useCustomPrice: form.useCustomPrice,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            personalId: form.personalId,
            notes: form.notes,
            customerName: `${form.firstName} ${form.lastName}`
          });

          onSuccess();
        } catch (bookingError: any) {
          console.error('❌ Booking creation failed:', bookingError);
          console.error('❌ Full error object:', bookingError);
          alert('ჯავშნის შექმნა ვერ მოხერხდა. სცადეთ ხელახლა');
        }

      } catch (error: any) {
        console.error('❌ Unexpected error during booking submission:', error);
        alert('მოხდა მოულოდნელი შეცდომა. გთხოვთ სცადოთ ხელახლა');
      } finally {
        setLoading(false);
        console.log('🏁 Booking submission process completed');
      }
    };

    // Use global validation service
    validateAndProceed(form, 'booking', proceedWithBooking);
  };

  const onSuccess = () => {
    // Handle successful booking
    console.log('Booking submission completed successfully');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'view' ? 'ჯავშნის დეტალები' : 
             mode === 'edit' ? 'ჯავშნის რედაქტირება' : 
             'ჯავშნის გაფორმება'}
             </h2>
            <p className="text-gray-600">{cottageName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Existing User Banner */}
        {showExistingUserBanner && (
          <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="text-blue-600 mr-3 text-lg">ℹ️</div>
              <div>
                <h4 className="text-blue-800 font-semibold mb-1">თქვენ უკვე რეგისტრირებული ხართ</h4>
                <p className="text-blue-700 text-sm">
                  გთხოვთ გაიარეთ ავტორიზაცია შესასვლელად და შემდეგ განახორციელეთ ჯავშანი.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* პირადი ინფორმაცია - მხოლოდ არაავტორიზებული მომხმარებლებისთვის */}
            {!authenticatedUser ? (
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  პირადი ინფორმაცია
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">სახელი *</label>
                    <input
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      readOnly={mode === 'view'}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">გვარი *</label>
                    <input
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      readOnly={mode === 'view'}
                    />
                  </div>
                  <div>
                    <label htmlFor="personalId" className="block text-sm font-medium text-gray-700 mb-2">პირადი ნომერი *</label>
                    <input
                      id="personalId"
                      name="personalId"
                      value={form.personalId}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      readOnly={mode === 'view'}
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Phone className="w-4 h-4 mr-1" />
                      ტელეფონი *
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      readOnly={mode === 'view'}
                    />
                  </div>
                  {showPasswordField && (
                    <div className="col-span-2">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Lock className="w-4 h-4 mr-1" />
                        პაროლი * <span className="text-xs text-gray-500 ml-2">(პირველი ჯავშნისთვის)</span>
                      </label>
                      <input
                        id="password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          form.password && !validatePassword(form.password).isValid 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300'
                        }`}
                        placeholder="შექმენით პაროლი მომავალი ჯავშნებისთვის"
                        required={showPasswordField}
                        readOnly={mode === 'view'}
                      />
                      {form.password && !validatePassword(form.password).isValid && (
                        <p className="mt-2 text-sm text-red-600">
                          {validatePassword(form.password).message}
                        </p>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        <p>პაროლი უნდა შეიცავდეს:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>მინიმუმ 6 სიმბოლოს</li>
                          <li>მხოლოდ ინგლისურ ასოებს, ციფრებს და სპეციალურ სიმბოლოებს (!@#$%^&*()_+=-)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ავტორიზებული მომხმარებლისთვის შეტყობინება */
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center mb-2">
                  <User className="w-5 h-5 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-green-800">
                    ✅ ავტორიზებული მომხმარებელი
                  </h3>
                </div>
                <p className="text-green-800 font-medium">
                  {authenticatedUser.firstName} {authenticatedUser.lastName}
                </p>
                <p className="text-green-600 text-sm mt-1">
                  თქვენი პირადი მონაცემები ავტომატურად გამოიყენება ჯავშნისთვის
                </p>
              </div>
            )}

            {/* სტუმრების რაოდენობა */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                სტუმრების რაოდენობა
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adults" className="block text-sm font-medium text-gray-700 mb-2">ზრდასრულები</label>
                  <input
                    id="adults"
                    type="number"
                    name="adults"
                    value={form.adults}
                    min={1}
                    max={10}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    readOnly={mode === 'view'}
                  />
                </div>
                <div>
                  <label htmlFor="children" className="block text-sm font-medium text-gray-700 mb-2">ბავშვები</label>
                  <input
                    id="children"
                    type="number"
                    name="children"
                    value={form.children}
                    min={0}
                    max={10}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly={mode === 'view'}
                  />
                </div>
              </div>
            </div>

            {/* თარიღები */}
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
                      const currentStartDate = prev.startDate;
                      const currentEndDate = prev.endDate;

                      if (!currentStartDate || (currentStartDate && currentEndDate)) {
                          return { ...prev, startDate: date, endDate: null };
                      } else if (currentStartDate && !currentEndDate) {
                          if (date > currentStartDate) {
                              const rangeStart = new Date(currentStartDate);
                              const rangeEnd = new Date(date);

                              if (isRangeOverlappingWithBookedDates(rangeStart, rangeEnd)) {
                                  alert('არჩეული თარიღების დიაპაზონი შეიცავს უკვე დაჯავშნილ თარიღებს. გთხოვთ აირჩიოთ სხვა დიაპაზონი.');
                                  return prev;
                              }

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
                  <div className="text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-800">მოსვლის თარიღი:</span>
                      <span className="text-blue-700">
                        {form.startDate ? form.startDate.toLocaleDateString('ka-GE') : 'არ არის არჩეული'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-800">წასვლის თარიღი:</span>
                      <span className="text-blue-700">
                        {form.endDate ? form.endDate.toLocaleDateString('ka-GE') : 
                         form.startDate ? 'აირჩიეთ წასვლის თარიღი' : 'პირველ რიგში აირჩიეთ მოსვლის თარიღი'}
                      </span>
                    </div>
                  </div>
                </div>

{pricing && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">ფასის დეტალები</h4>
                <div className="space-y-1 text-sm text-blue-700">
                  <div className="flex justify-between">
                    <span>
                      {form.useCustomPrice && form.customTotalPrice ? 'ბაზისური ტარიფი (ივლისი)' : `სეზონური ფასი (${form.startDate ? form.startDate.toLocaleDateString('ka-GE', { month: 'long', day: 'numeric' }) : pricing.season})`}:
                    </span>
                    <span>{Math.round(pricing.baseRate)}₾</span>
                  </div>
                  {pricing.adults > 4 && (
                    <div className="flex justify-between">
                      <span>დამატებითი გადასახადი ზრდასრულებზე:</span>
                      <span>+20₾</span>
                    </div>
                  )}
                  {pricing.additionalGuestFee > 0 && (
                    <div className="flex justify-between">
                      <span>დამატებითი ზრდასრული ({Math.round(pricing.additionalGuestFee / 20)}):</span>
                      <span>+{pricing.additionalGuestFee}₾</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>კომუნალური მომსახურება:</span>
                    <span>+{pricing.utilityCost}₾</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ღამეების რაოდენობა:</span>
                    <span>{pricing.nights}</span>
                  </div>
                  {pricing.isLongStay && (
                    <div className="text-green-600 text-xs">
                      ✓ გრძელვადიანი დაკავება (21+ ღამე)
                    </div>
                  )}
                  <hr className="border-blue-200" />
                  <div className="flex justify-between font-semibold">
                    <span>ღამეში:</span>
                    <span>{pricing.pricePerNight}₾</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>ჯამური ფასი:</span>
                    <span>{pricing.totalPrice + (pricing.adults > 4 ? 20 : 0)}₾</span>
                  </div>
                  <hr className="border-blue-200" />
                  <div className="flex justify-between text-green-600 font-semibold">
                    <span>ჯავშნის გასააქტიურებელი თანხა:</span>
                    <span>{pricing.depositAmount}₾</span>
                  </div>
                  <div className="flex justify-between text-orange-600 font-semibold">
                    <span>ჩექინის დღეს გადასახდელი:</span>
                    <span>{pricing.remainingAmount}₾</span>
                  </div>
                  <div className="flex justify-between text-purple-600">
                    <span>ერთ პირზე საშუალო ღირებულება:</span>
                    <span>{Math.round(pricing.totalPrice / form.adults)}₾</span>
                  </div>
                  {form.children > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>ბავშვები ({form.children}):</span>
                      <span>უფასოა</span>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            </div>

            {/* დრო */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                დრო
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="arrivalTime" className="block text-sm font-medium text-gray-700 mb-2">მოსვლის დრო</label>
                  <input
                    id="arrivalTime"
                    type="time"
                    name="arrivalTime"
                    value={form.arrivalTime}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly={mode === 'view'}
                  />
                </div>
                <div>
                  <label htmlFor="departureTime" className="block text-sm font-medium text-gray-700 mb-2">გასვლის დრო</label>
                  <input
                    id="departureTime"
                    type="time"
                    name="departureTime"
                    value={form.departureTime}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly={mode === 'view'}
                  />
                </div>
              </div>
            </div>

            {/* ინდივიდუალური ფასის კოდი */}
            <div className="bg-orange-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                ინდივიდუალური ფასი
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ფასის კოდი
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={priceCode}
                      onChange={(e) => setPriceCode(e.target.value)}
                      placeholder="შეიყვანეთ 6-ციფრიანი კოდი"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={6}
                      readOnly={mode === 'view'}
                    />
                    <button
                      type="button"
                      onClick={validateCode}
                      disabled={isValidatingCode || !priceCode.trim() || mode === 'view'}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isValidatingCode ? '🔍' : 'შემოწმება'}
                    </button>
                  </div>

                  {codeValidationError && (
                    <p className="mt-2 text-sm text-red-600">❌ {codeValidationError}</p>
                  )}

                  {isCodeValid && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        ✅ კოდი დადასტურებულია! ახლა შეგიძლიათ ინდივიდუალური ფასის მითითება.
                      </p>
                    </div>
                  )}
                </div>

                {isCodeValid && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ჯამური ფასი (₾)
                    </label>
                    <input
                      type="number"
                      name="customTotalPrice"
                      value={form.customTotalPrice || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="შეიყვანეთ ჯამური ფასი"
                      min="1"
                      readOnly={mode === 'view'}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* შენიშვნები */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">შენიშვნები</label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="დამატებითი ინფორმაცია..."
                readOnly={mode === 'view'}
              />
            </div>

            {/* ღილაკები */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
              >
                 {mode === 'view' ? 'დახურვა' : 'გაუქმება'}
              </button>
              {mode !== 'view' && (
              <button
                type="submit"
                disabled={loading || !form.startDate || !form.endDate || form.endDate <= form.startDate || !form.firstName || !form.lastName || !form.personalId || !form.phone}
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
              )}
            </div>
          </form>
        </div>

        {/* Authentication Modal */}
        {showAuthModal && (
          <BookingAuth
            onAuthSuccess={handleAuthSuccess}
            onBack={() => {
              setShowAuthModal(false);
              setUserCheckPerformed(false);
              setShowExistingUserBanner(false);
            }}
            preFilledPhone={form.phone}
            preFilledPersonalId={form.personalId}
          />
        )}

        {/* Confirmation Modal */}
        {showConfirmationModal && (
          <ConfirmationModal
            isOpen={showConfirmationModal}
            onClose={() => {
              setShowConfirmationModal(false);
              setBookingSuccess(false);
              onClose(); // ძირითადი მოდალის დახურვა
            }}
            bookingData={{
              cottageId: cottageId,
              cottageName: cottageName,
              startDate: form.startDate!,
              endDate: form.endDate!,
              totalPrice: form.useCustomPrice && form.customTotalPrice ? form.customTotalPrice : pricing?.totalPrice || 0,
              depositAmount: pricing?.depositAmount || 0,
              customerName: `${form.firstName} ${form.lastName}`
            }}
          />
        )}
      </div>
      <ValidationModal
        isOpen={isValidationModalOpen}
        onClose={hideValidationErrors}
        errors={validationErrors}
        title="ჯავშნის ფორმის შევსება დაუსრულებელია"
      />
    </div>
  );
}
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ArrowLeft, Calendar, Phone, User, Car, Clock, Lock, MapPin } from 'lucide-react';
import { checkUserExists, registerCustomerDuringBooking } from './services/userService';
import BookingAuth from './components/BookingAuth';
import { calculateVehiclePrice, type VehiclePricingResult } from './utils/vehiclePricing';
import { Vehicle, VehicleBooking } from './types/vehicle';
import { useAuth } from './contexts/useAuth';

interface BookingData {
  firstName: string;
  lastName: string;
  personalId: string;
  phone: string;
  vehicleId: string;
  startDateTime: Date;
  endDateTime: Date;
  notes: string;
  excursionType: string;
  pickupLocation: string;
  dropoffLocation: string;
  გადასახდილია: boolean;
}

export default function VehicleBookingForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<VehiclePricingResult | null>(null);
  const [form, setForm] = useState<BookingData>({
    firstName: '',
    lastName: '',
    personalId: '',
    phone: '',
    vehicleId: id || '',
    startDateTime: new Date(),
    endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 საათი
    notes: '',
    excursionType: '',
    pickupLocation: 'ბახმარო',
    dropoffLocation: 'ბახმარო',
    გადასახდილია: false
  });
    const [userExists, setUserExists] = useState(false);
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [password, setPassword] = useState('');
    const [authCompleted, setAuthCompleted] = useState(false);
    const { user: authUser } = useAuth();
 const [passwordError, setPasswordError] = useState<string | null>(null);

  // Auto-fill form with authenticated user data for ALL user types
  useEffect(() => {
    if (authUser) {
      console.log('🔑 Auto-filling vehicle form with authenticated user data:', authUser);
      setForm(prev => ({
        ...prev,
        firstName: authUser.firstName || '',
        lastName: authUser.lastName || '',
        phone: authUser.phoneNumber || authUser.email || '',
        personalId: authUser.personalId || ''
      }));
    }
  }, [authUser]);

  // ავტომობილის ინფორმაციის ჩატვირთვა
  useEffect(() => {
    const fetchVehicle = async () => {
      if (!id) return;
      try {
        const vehicleDoc = await getDoc(doc(db, 'vehicles', id));
        if (vehicleDoc.exists()) {
          setVehicle({ id: vehicleDoc.id, ...vehicleDoc.data() } as Vehicle);
        }
      } catch (error) {
        console.error('Error fetching vehicle:', error);
      }
    };

    fetchVehicle();
  }, [id]);

    useEffect(() => {
        const checkExistingUser = async () => {
            if (form.phone || form.personalId) {
                const exists = await checkUserExists(form.phone, form.personalId);
                setUserExists(exists);
                setShowPasswordInput(!exists);
            } else {
                setUserExists(false);
                setShowPasswordInput(true);
            }
        };

        checkExistingUser();
    }, [form.phone, form.personalId]);

  // ფასის გამოთვლა
  useEffect(() => {
    if (form.startDateTime && form.endDateTime && vehicle) {
      const pricingResult = calculateVehiclePrice(
        form.startDateTime,
        form.endDateTime,
        vehicle.pricePerHour,
        vehicle.pricePerDay
      );
      setPricing(pricingResult);
    }
  }, [form.startDateTime, form.endDateTime, vehicle]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDateTimeChange = (field: 'startDateTime' | 'endDateTime', value: string) => {
    setForm(prev => ({ ...prev, [field]: new Date(value) }));
  };

  const formatDateTimeForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!vehicle || !pricing) {
                throw new Error('ავტომობილის ინფორმაცია ან ფასი არ არის ხელმისაწვდომი');
            }

            if (showPasswordInput) {
                // Register the user if password input is shown
                await registerCustomerDuringBooking(form.phone, form.personalId, password, form.firstName, form.lastName);
            }

            const bookingData: Omit<VehicleBooking, 'id'> = {
                ...form,
                vehicleTitle: vehicle.title,
                totalHours: pricing.totalHours,
                fullDays: pricing.fullDays,
                extraHours: pricing.extraHours,
                totalPrice: pricing.totalPrice,
                depositAmount: pricing.depositAmount,
                createdAt: new Date(),
                status: 'confirmed',
                type: 'vehicle'
            };

            await addDoc(collection(db, 'vehicleBookings'), bookingData);

            alert('ავტომობილის ჯავშანი წარმატებით შესრულდა! ჩვენ მალე დაგიკავშირდებით.');
            navigate('/');
        } catch (error) {
            console.error('Error creating vehicle booking:', error);
            alert('დაფიქსირდა შეცდომა. გთხოვთ სცადოთ ხელახლა.');
        } finally {
            setLoading(false);
        }
    };

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
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

      <div className="max-w-2xl mx-auto px-4 py-8 min-h-screen">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🚗</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">ავტომობილის დაქირავება</h1>
            <p className="text-gray-600">{vehicle.title}</p>
          </div>
              {userExists && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4" role="alert">
                      <strong className="font-bold">ყურადღება!</strong>
                      <span className="block sm:inline">თქვენ უკვე რეგისტრირებული ხართ. გთხოვთ გაიარეთ ავტორიზაცია შესასვლელად და შემდეგ განახორციელეთ ჯავშანი.</span>
                  </div>
              )}

              {!userExists && showPasswordInput && (
                  <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4" role="alert">
                      <strong className="font-bold">პაროლის შეყვანა</strong>
                      <span className="block sm:inline">გთხოვთ, შეიყვანეთ პაროლი თქვენი ანგარიშის დასარეგისტრირებლად.</span>
                  </div>
              )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* პირადი ინფორმაცია - Hidden for ALL authenticated users */}
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">გვარი *</label>
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">პირადი ნომერი *</label>
                    <input
                      name="personalId"
                      value={form.personalId}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Phone className="w-4 h-4 mr-1" />
                      ტელეფონი *
                    </label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  {showPasswordInput && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Lock className="w-4 h-4 mr-1" />
                        პაროლი *
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         onKeyDown={(e) => {
                           const warning = document.getElementById('capslock-warning-vehicle-booking');
                           if (e.getModifierState('CapsLock')) {
                             if (warning) warning.style.display = 'block';
                           } else {
                             if (warning) warning.style.display = 'none';
                           }
                         }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required={showPasswordInput}
                      />
                       {/* Caps Lock warning */}
                       <div className="text-xs text-yellow-600 mt-1" id="capslock-warning-vehicle-booking" style={{ display: 'none' }}>
                         ⚠️ Caps Lock ჩართულია
                       </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* დრო და თარიღი */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                დაქირავების პერიოდი
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">დაწყების თარიღი და დრო</label>
                  <input
                    type="datetime-local"
                    value={formatDateTimeForInput(form.startDateTime)}
                    onChange={(e) => handleDateTimeChange('startDateTime', e.target.value)}
                    min={formatDateTimeForInput(new Date())}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">დასრულების თარიღი და დრო</label>
                  <input
                    type="datetime-local"
                    value={formatDateTimeForInput(form.endDateTime)}
                    onChange={(e) => handleDateTimeChange('endDateTime', e.target.value)}
                    min={formatDateTimeForInput(form.startDateTime)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {pricing && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <div className="space-y-2">
                    <p className="text-green-800 font-medium">
                      ჯამური დრო: {pricing.totalHours} საათი
                    </p>
                    {pricing.fullDays > 0 && (
                      <p className="text-green-700 text-sm">
                        სრული დღეები: <span className="font-semibold">{pricing.fullDays} × {vehicle.pricePerDay}₾ = {pricing.dayPrice}₾</span>
                      </p>
                    )}
                    {pricing.extraHours > 0 && (
                      <p className="text-green-700 text-sm">
                        დამატებითი საათები: <span className="font-semibold">{pricing.extraHours} × {vehicle.pricePerHour}₾ = {pricing.hourPrice}₾</span>
                      </p>
                    )}
                    <div className="border-t border-green-200 pt-2 mt-2">
                      <p className="text-green-800 font-bold text-lg">
                        ჯამური ღირებულება: {pricing.totalPrice}₾
                      </p>
                      <div className="mt-3 space-y-2">
                        <p className="text-orange-700 text-sm font-bold bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                          ჯავშნის თანხა: <span className="text-orange-800 text-lg">{pricing.depositAmount}₾</span>
                        </p>
                        <p className="text-orange-600 text-xs mt-1 px-3">
                          {pricing.totalPrice < 500 ? '50%' : 
                           pricing.totalPrice <= 2000 ? '30%' : '20%'} ჯამური ღირებულებიდან
                        </p>
                        <p className="text-green-700 text-sm font-medium mt-2">
                          დარჩენილი გადასახადი: <span className="font-bold">{pricing.totalPrice - pricing.depositAmount}₾</span>
                        </p>
                        <p className="text-green-600 text-xs">
                          გადასახდელია ავტომობილის მიღებისას
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ლოკაცია */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                ლოკაცია
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">აღების ადგილი</label>
                  <input
                    name="pickupLocation"
                    value={form.pickupLocation}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="მაგ: ბახმარო, ბათუმი, თბილისი"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">დაბრუნების ადგილი</label>
                  <input
                    name="dropoffLocation"
                    value={form.dropoffLocation}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="მაგ: ბახმარო, ბათუმი, თბილისი"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ექსკურსია */}
            {vehicle.excursionServices && (
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Car className="w-5 h-5 mr-2" />
                  ექსკურსიული სერვისები
                </h3>
                <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 text-sm mb-2">{vehicle.excursionServices.description}</p>
                  <p className="text-yellow-700 font-semibold">
                    ფასი: {vehicle.excursionServices.minRate}₾ - {vehicle.excursionServices.maxRate}₾
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ექსკურსიის ტიპი (არასავალდებულო)</label>
                  <select
                    name="excursionType"
                    value={form.excursionType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">აირჩიეთ ექსკურსია</option>
                    <option value="sunset-mountain">მზის ჩასვლის მთა</option>
                    <option value="green-lake">მწვანე ტბა</option>
                    <option value="tabatskuri">ტაბაწყური</option>
                    <option value="custom">ინდივიდუალური მარშრუტი</option>
                  </select>
                </div>
              </div>
            )}

            {/* შენიშვნები */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">შენიშვნები</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="დამატებითი ინფორმაცია, სპეციალური მოთხოვნები..."
              />
            </div>

            {/* მძღოლის შენიშვნა */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-start">
                <div className="text-red-600 mr-3 text-lg">⚠️</div>
                <div>
                  <h4 className="text-red-800 font-semibold mb-2">მნიშვნელოვანი ინფორმაცია</h4>
                  <p className="text-red-700 text-sm">
                    ყველა ავტომობილი მოიცავს პროფესიონალ მძღოლს. თვითმართვა არ არის ხელმისაწვდომი.
                    მძღოლი იცნობს ადგილობრივ მარშრუტებს და უზრუნველყოფს უსაფრთხო მგზავრობას.
                  </p>
                </div>
              </div>
            </div>

            {/* ღილაკები */}
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
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    დაქირავება...
                  </>
                ) : (
                  'დაქირავება'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
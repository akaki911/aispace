import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ArrowLeft, Calendar, Users, Phone, User, Building2, Bed, Lock } from 'lucide-react';
import { checkUserExists, registerCustomerDuringBooking } from './services/userService';
import BookingAuth from './components/BookingAuth';
import { calculateSeasonalPrice, type PricingResult } from './utils/pricing';
import { Hotel, HotelBooking } from './types/hotel';
import CustomCalendar from './components/Calendar';

interface BookingData {
  firstName: string;
  lastName: string;
  personalId: string;
  phone: string;
  hotelId: string;
  roomTypeId: string;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  notes: string;
  გადასახდილია: boolean;
}

export default function HotelBookingForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [form, setForm] = useState<BookingData>({
    firstName: '',
    lastName: '',
    personalId: '',
    phone: '',
    hotelId: id || '',
    roomTypeId: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    adults: 1,
    children: 0,
    notes: '',
    გადასახდილია: false
  });

  // სასტუმროს ინფორმაციის ჩატვირთვა
  useEffect(() => {
    const fetchHotel = async () => {
      if (!id) return;
      try {
        const hotelDoc = await getDoc(doc(db, 'hotels', id));
        if (hotelDoc.exists()) {
          const data = hotelDoc.data() as Hotel;
          setHotel({ id: hotelDoc.id, ...data });
        }
      } catch (error) {
        console.error('Error fetching hotel:', error);
      }
    };

    fetchHotel();
  }, [id]);

  // დაკავებული თარიღების ჩატვირთვა
  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(db, 'hotelBookings'), 
          where('hotelId', '==', id),
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
  }, [id]);

  // ფასის გამოთვლა
  useEffect(() => {
    if (form.startDate && form.endDate && form.adults && form.roomTypeId && hotel) {
      const selectedRoomType = hotel.roomTypes.find(rt => rt.id === form.roomTypeId);
      if (selectedRoomType) {
        // Use room type price as base rate
        const nights = Math.ceil((form.endDate.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalPrice = selectedRoomType.pricePerNight * nights;

        // Calculate deposit using the same logic as cottages
        const depositAmount = totalPrice < 1000 ? Math.ceil(totalPrice * 0.5) :
                             totalPrice <= 5000 ? Math.ceil(totalPrice * 0.3) :
                             Math.ceil(totalPrice * 0.2);

        setPricing({
          totalPrice,
          pricePerNight: selectedRoomType.pricePerNight,
          pricePerGuestPerNight: form.adults > 0 ? selectedRoomType.pricePerNight / form.adults : 0,
          nights,
          baseRate: selectedRoomType.pricePerNight,
          additionalGuestFee: 0,
          season: 'სასტუმრო',
          isLongStay: nights >= 21,
          depositAmount,
          isCustomPrice: false
        });
      }
    }
  }, [form.startDate, form.endDate, form.adults, form.children, form.roomTypeId, hotel]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'adults' || name === 'children'
        ? Number(value)
        : value
    }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', date: Date | null) => {
    if (date) {
      setForm(prev => ({ ...prev, [field]: date }));
    }
  };

  const calculateNights = () => {
    const diffTime = Math.abs(form.endDate.getTime() - form.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getSelectedRoomType = () => {
    return hotel?.roomTypes.find(rt => rt.id === form.roomTypeId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!hotel || !pricing) {
        throw new Error('სასტუმროს ინფორმაცია ან ფასი არ არის ხელმისაწვდომი');
      }

      const selectedRoomType = getSelectedRoomType();
      if (!selectedRoomType) {
        throw new Error('გთხოვთ აირჩიოთ ოთახის ტიპი');
      }

      const bookingData: Omit<HotelBooking, 'id'> = {
        ...form,
        hotelName: hotel.name,
        roomTypeName: selectedRoomType.name,
        totalPrice: pricing.totalPrice,
        depositAmount: pricing.depositAmount,
        createdAt: new Date(),
        status: 'confirmed',
        type: 'hotel'
      };

      await addDoc(collection(db, 'hotelBookings'), bookingData);

      alert('სასტუმროს ჯავშანი წარმატებით შესრულდა! ჩვენ მალე დაგიკავშირდებით.');
      navigate('/');
    } catch (error) {
      console.error('Error creating hotel booking:', error);
      alert('დაფიქსირდა შეცდომა. გთხოვთ სცადოთ ხელახლა.');
    } finally {
      setLoading(false);
    }
  };

  if (!hotel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

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
            <div className="text-4xl mb-4">🏨</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">სასტუმროს ჯავშნა</h1>
            <p className="text-gray-600">{hotel.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* პირადი ინფორმაცია */}
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">გვარი *</label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">პირადი ნომერი *</label>
                  <input
                    name="personalId"
                    value={form.personalId}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ოთახის ტიპი */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Bed className="w-5 h-5 mr-2" />
                ოთახის ტიპი
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">აირჩიეთ ოთახის ტიპი *</label>
                <select
                  name="roomTypeId"
                  value={form.roomTypeId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">აირჩიეთ ოთახის ტიპი</option>
                  {hotel.roomTypes.map(roomType => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name} - {roomType.pricePerNight}₾/ღამე ({roomType.capacity} ადამიანი)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* სტუმრების რაოდენობა */}
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ჩეკ-ინი</label>
                  <DatePicker
                    selected={form.startDate}
                    onChange={(date) => handleDateChange('startDate', date)}
                    excludeDates={bookedDates}
                    minDate={new Date()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    dateFormat="yyyy-MM-dd"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ჩეკ-აუთი</label>
                  <DatePicker
                    selected={form.endDate}
                    onChange={(date) => handleDateChange('endDate', date)}
                    excludeDates={bookedDates}
                    minDate={form.startDate}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    dateFormat="yyyy-MM-dd"
                    required
                  />
                </div>
              </div>

              {/* Calendar Visual */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">ხელმისაწვდომობის კალენდარი</h4>
                <CustomCalendar 
                  bookedDates={bookedDates}
                  selectedDate={form.startDate}
                  onDateSelect={(date) => handleDateChange('startDate', date)}
                  minDate={new Date()}
                  className="w-full max-w-xs mx-auto"
                  maxMonthsAhead={6}
                />
              </div>

              {pricing && (
                <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                  <div className="space-y-2">
                    <p className="text-purple-800 font-medium">
                      ღამეების რაოდენობა: {calculateNights()}
                    </p>
                    <p className="text-purple-700 text-sm">
                      ოთახის ფასი: <span className="font-semibold">{pricing.baseRate}₾/ღამე</span>
                    </p>
                    <div className="border-t border-purple-200 pt-2 mt-2">
                      <p className="text-purple-800 font-bold text-lg">
                        ჯამური ღირებულება: {pricing.totalPrice}₾
                      </p>
                      <div className="border-t border-purple-200 pt-2 mt-2">
                        <p className="text-orange-700 text-sm font-bold bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                          ჯავშნის თანხა: <span className="text-orange-800 text-lg">{pricing.depositAmount}₾</span>
                        </p>
                        <p className="text-orange-600 text-xs mt-1 px-3">
                          {pricing.totalPrice < 1000 ? '50%' : 
                           pricing.totalPrice <= 5000 ? '30%' : '20%'} ჯამური ღირებულებიდან
                        </p>
                        <p className="text-purple-700 text-sm font-medium mt-2">
                          დარჩენილი გადასახადი: <span className="font-bold">{pricing.totalPrice - pricing.depositAmount}₾</span>
                        </p>
                        <p className="text-purple-600 text-xs">
                          გადასახდელია ჩეკ-ინის დღეს
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* შენიშვნები */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">შენიშვნები</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="დამატებითი ინფორმაცია..."
              />
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
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
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
    </div>
  );
}
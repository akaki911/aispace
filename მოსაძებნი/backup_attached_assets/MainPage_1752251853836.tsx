import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { Trees, Sun, Snowflake, Mountain } from 'lucide-react';
import { db } from './firebaseConfig';
import { getDisplayPriceForFamily } from './utils/pricing';
import VehicleCard from './components/VehicleCard';
import HotelCard from './components/HotelCard';
import Header from './components/Header';

import { Vehicle } from './types/vehicle';
import { Hotel } from './types/hotel';
import { calculateSeasonalPrice, getCurrentMonthKey, PriceByMonth } from './types/seasonalPricing';
import { Home, Car, Hotel as HotelIcon, MapPin, Users, Star, Calendar, Clock, Wifi, Bath, Utensils, Wind, Tv, DollarSign } from 'lucide-react';

interface Cottage {
  id: string;
  name: string;
  image: string;
  capacity: string;
  location: string;
  pricePerNight: number;
  displayPrice?: number;
  season?: string;
  bookingsCount?: number;
  isVip?: boolean;
  priceByMonth?: PriceByMonth;
  hasSeasonalPricing?: boolean;
}

export default function MainPage() {
  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);


  const [currentPricing, setCurrentPricing] = useState({ currentPrice: 0, season: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const pricing = getDisplayPriceForFamily();
    setCurrentPricing(pricing);

    const fetchData = async () => {
      try {
        // კოტეჯების ჩატვირთვა
        const cottagesSnap = await getDocs(query(collection(db, 'cottages'), orderBy('createdAt', 'desc'), limit(50)));
        const cottagesList = cottagesSnap.docs.map(doc => {
          const data = doc.data();
          let displayPrice = data.pricePerNight || 100;

          // თუ კოტეჯს აქვს სეზონური ფასები და ახლა სეზონია
          if (data.hasSeasonalPricing && data.priceByMonth) {
            const currentMonth = getCurrentMonthKey();
            if (currentMonth) {
              displayPrice = calculateSeasonalPrice(data.priceByMonth, currentMonth, 3);
            }
          } else {
            displayPrice = pricing.currentPrice;
          }

          return {
            id: doc.id,
            name: data.name || 'უსახელო კოტეჯი',
            image: data.images?.[data.mainImageIndex || 0] || 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg',
            capacity: data.capacity ? `${data.capacity} ადამიანი` : '2 ადამიანი',
            location: data.location || 'ბახმარო',
            pricePerNight: data.pricePerNight || 100,
            displayPrice: displayPrice,
            season: pricing.season,
            bookingsCount: data.bookingsCount || 0,
            isVip: data.isVip || false,
            priceByMonth: data.priceByMonth,
            hasSeasonalPricing: data.hasSeasonalPricing || false
          };
        });
        setCottages(cottagesList);

        // ავტომობილების ჩატვირთვა
        const vehiclesSnap = await getDocs(query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'), limit(50)));
        const vehiclesList = vehiclesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          bookingsCount: doc.data().bookingsCount || 0,
          isVip: doc.data().isVip || false
        } as Vehicle));
        setVehicles(vehiclesList);

        // სასტუმროების ჩატვირთვა
        const hotelsSnap = await getDocs(query(collection(db, 'hotels'), orderBy('createdAt', 'desc'), limit(50)));
        const hotelsList = hotelsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          bookingsCount: doc.data().bookingsCount || 0,
          isVip: doc.data().isVip || false
        } as Hotel));
        setHotels(hotelsList);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleBookingClick = (type: string, id: string, item: any) => {
    if (type === 'cottage') {
      navigate(`/cottage/${id}`);
    } else if (type === 'vehicle') {
      navigate(`/vehicle/${id}`);
    } else if (type === 'hotel') {
      navigate(`/hotel/${id}`);
    }
  };





  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-emerald-700 font-medium">იტვირთება...</p>
        </div>
      </div>
    );
  }

  // Get popular items (sorted by bookings count)
  const popularItems = [
    ...cottages.map(item => ({ ...item, type: 'cottage' })),
    ...hotels.map(item => ({ ...item, type: 'hotel' })),
    ...vehicles.map(item => ({ ...item, type: 'vehicle' }))
  ].sort((a, b) => (b.bookingsCount || 0) - (a.bookingsCount || 0)).slice(0, 6);

  // Get VIP items
  const vipItems = [
    ...cottages.filter(item => item.isVip).map(item => ({ ...item, type: 'cottage' })),
    ...hotels.filter(item => item.isVip).map(item => ({ ...item, type: 'hotel' })),
    ...vehicles.filter(item => item.isVip).map(item => ({ ...item, type: 'vehicle' }))
  ].slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-green-50">
      <Header />

      {/* Hero Section */}
      <section 
        className="relative min-h-[75vh] bg-cover bg-center bg-no-repeat flex items-center justify-center"
        style={{ backgroundImage: 'url(/bakhmaro-pines.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse hidden lg:block"></div>
        <div className="absolute bottom-32 right-16 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl animate-bounce hidden lg:block"></div>

        <div className="relative z-10 text-center text-white max-w-6xl mx-auto">
          <div className="px-4 sm:px-6 md:px-8">
            <div className="space-y-8">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center leading-tight max-w-screen-md mx-auto">
                <span className="block bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent drop-shadow-2xl">
                  მოგესალმებით
                </span>
                <span className="block bg-gradient-to-r from-emerald-200 via-white to-emerald-200 bg-clip-text text-transparent drop-shadow-2xl">
                  ბახმაროში
                </span>
              </h1>

              <div className="space-y-4">
                <p className="text-base sm:text-lg text-gray-100 text-center max-w-screen-sm mx-auto mt-4 leading-relaxed">
                  ბახმარო — იქ, სადაც ჰაერს გემო აქვს.
                </p>
                <p className="text-base sm:text-lg text-emerald-200 text-center max-w-screen-sm mx-auto leading-relaxed">
                  ტყის სიჩუმეში ცხენის ხმა და დოღის გუგუნი ტრადიციას აცოცხლებს.
                </p>
              </div>
            </div>
          </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mt-10">
              <a 
                href="#popular" 
                className="group bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-2xl hover:shadow-emerald-500/25 hover:scale-105 transform"
              >
                <span className="flex items-center justify-center">
                  დაიწყე მოგზაურობა
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </a>
              <a 
                href="tel:+995577241517" 
                className="group border-2 border-white/80 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white hover:text-emerald-600 transition-all duration-300 backdrop-blur-sm hover:scale-105 transform"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  დაგვიკავშირდით
                </span>
              </a>
            </div>
        </div>
      </section>

      {/* Why Bakhmaro Section */}
      <section className="py-20 bg-gradient-to-br from-white via-emerald-50 to-green-50 relative overflow-hidden">
        {/* Background decorative mountain silhouette */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-emerald-100/50 to-transparent"></div>
        <div className="absolute top-10 right-10 opacity-10">
          <Trees className="w-32 h-32 text-emerald-600" />
        </div>
        <div className="absolute bottom-10 left-10 opacity-10">
          <Snowflake className="w-24 h-24 text-blue-400" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 max-w-screen-lg mx-auto px-4">
            <div className="flex items-center justify-center mb-6 flex-wrap">
              <Mountain className="w-8 h-8 sm:w-10 md:w-12 text-emerald-600 mr-2 sm:mr-4" />
              <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-700 to-green-800 bg-clip-text text-transparent leading-tight text-center">
                რატომ ბახმარო?
              </h3>
              <Trees className="w-8 h-8 sm:w-10 md:w-12 text-green-600 ml-2 sm:ml-4" />
            </div>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-[90%] sm:max-w-2xl md:max-w-3xl mx-auto leading-relaxed text-balance">
              მაღალმთიანი კურორტი, რომელიც გთავაზობთ უნიკალურ გამოცდილებას ბუნების გარემოცვაში
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            <div className="group text-center p-6 sm:p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border border-emerald-100">
              <div className="text-5xl sm:text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">🌲</div>
              <h4 className="text-xl sm:text-2xl font-bold mb-4 text-emerald-800">ნაძვნარი</h4>
              <div className="text-gray-600 leading-relaxed space-y-2">
                <p className="text-sm sm:text-base">ტყე არა მხოლოდ ჩრდილია — ბახმაროში ის სუნთქვას აღადგენს.</p>
                <p className="text-sm sm:text-base">ყოველი ჩასუნთქვა ბავშვობის ტყის სუნს გახსენებს.</p>
              </div>
            </div>
            <div className="group text-center p-6 sm:p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border border-emerald-100">
              <div className="text-5xl sm:text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">⛰️</div>
              <h4 className="text-xl sm:text-2xl font-bold mb-4 text-emerald-800">მაღალმთიანი</h4>
              <div className="text-gray-600 leading-relaxed space-y-2">
                <p className="text-sm sm:text-base">ბახმარო იწყება იქ, სადაც გზა ქრება და სიმაღლე იწყებს საუბარს.</p>
                <p className="text-sm sm:text-base">მთის ხაზი არა ჰორიზონტს — არამედ სიმშვიდეს ნიშნავს.</p>
              </div>
            </div>
            <div className="group text-center p-6 sm:p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border border-emerald-100">
              <div className="text-5xl sm:text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">📜</div>
              <h4 className="text-xl sm:text-2xl font-bold mb-4 text-emerald-800">ისტორიული</h4>
              <div className="text-gray-600 leading-relaxed space-y-2 max-w-[280px] mx-auto">
                <p className="text-sm sm:text-base text-balance">აქ მტვერი არ იდება თაროზე — ის გზად მიაყოლებს ისტორიას.</p>
                <p className="text-sm sm:text-base text-balance">ბახმარო — სადაც ყოველი დილა ძველი ზღაპრის გაგრძელებაა.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Section */}
      <section id="popular" className="py-20 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-screen-md mx-auto px-4">
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 flex items-center justify-center leading-tight flex-wrap">
              <span className="text-3xl sm:text-4xl md:text-5xl mr-2 sm:mr-4">🔥</span>
              <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                პოპულარული
              </span>
            </h3>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed text-balance max-w-[90%] mx-auto">ყველაზე მეტი ჯავშნის მქონე ობიექტები</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {popularItems.map(item => (
              <div key={`popular-${item.type}-${item.id}`} className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-orange-100">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.images?.[item.mainImageIndex || 0] || item.image || 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg'}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-orange-600 to-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    🔥 პოპულარული
                  </div>
                  <div className="absolute top-4 right-4 bg-white/90 text-gray-800 px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    {item.bookingsCount || 0} ჯავშნა
                  </div>
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-xl mb-3 text-gray-800 group-hover:text-orange-600 transition-colors">
                    {item.name}
                  </h4>
                  <div className="flex items-center text-gray-600 mb-4 text-sm">
                    <span className="flex items-center mr-4">
                      <span className="text-lg mr-1">
                        {item.type === 'cottage' ? '🏠' : item.type === 'hotel' ? '🏨' : '🚗'}
                      </span>
                      {item.type === 'cottage' ? 'კოტეჯი' : item.type === 'hotel' ? 'სასტუმრო' : 'ავტომობილი'}
                    </span>
                    <span className="flex items-center">
                      <span className="text-lg mr-1">📍</span> 
                      {item.location}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      to={`/${item.type === 'cottage' ? 'cottage' : item.type === 'hotel' ? 'hotel' : 'vehicle'}/${item.id}`}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 text-sm"
                    >
                      დეტალები
                    </Link>
                    <button
                      onClick={() => handleBookingClick(item.type, item.id, item)}
                      className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 shadow-lg text-sm"
                    >
                      დაჯავშნა
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button 
              onClick={() => navigate('/cottages')}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
            >
              იხილე ყველა პოპულარული
            </button>
          </div>
        </div>
      </section>

      {/* VIP Section */}
      {vipItems.length > 0 && (
        <section id="vip" className="py-20 bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 max-w-screen-md mx-auto px-4">
              <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 flex items-center justify-center leading-tight flex-wrap">
                <span className="text-3xl sm:text-4xl md:text-5xl mr-2 sm:mr-4">⭐</span>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  VIP / ფავორიტი
                </span>
              </h3>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed text-balance max-w-[90%] mx-auto">განსაკუთრებული შეთავაზებები და პრემიუმ სერვისები</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {vipItems.map(item => (
                <div key={`vip-${item.type}-${item.id}`} className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border-2 border-gradient-to-r from-purple-200 to-pink-200">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={item.images?.[item.mainImageIndex || 0] || item.image || 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg'}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      ⭐ VIP
                    </div>
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      პრემიუმ
                    </div>
                  </div>
                  <div className="p-6">
                    <h4 className="font-bold text-xl mb-3 text-gray-800 group-hover:text-purple-600 transition-colors">
                      {item.name}
                    </h4>
                    <div className="flex items-center text-gray-600 mb-4 text-sm">
                      <span className="flex items-center mr-4">
                        <span className="text-lg mr-1">👑</span> VIP
                      </span>
                      <span className="flex items-center">
                        <span className="text-lg mr-1">📍</span> 
                        {item.location}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <Link
                        to={`/${item.type === 'cottage' ? 'cottage' : item.type === 'hotel' ? 'hotel' : 'vehicle'}/${item.id}`}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 text-sm"
                      >
                        დეტალები
                      </Link>
                      <button
                        onClick={() => handleBookingClick(item.type, item.id, item)}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 shadow-lg text-sm"
                      >
                        დაჯავშნა
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <button 
                onClick={() => navigate('/cottages')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
              >
                იხილე ყველა VIP
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Cottages Section */}
      <section id="cottages" className="py-20 bg-gradient-to-br from-emerald-50 via-blue-50 to-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-screen-md mx-auto px-4">
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 flex items-center justify-center leading-tight flex-wrap">
              <span className="text-3xl sm:text-4xl md:text-5xl mr-2 sm:mr-4">🏠</span>
              <span className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                კოტეჯები
              </span>
            </h3>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed text-balance max-w-[90%] mx-auto">კომფორტული კოტეჯები ბუნების გარემოცვაში</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cottages.slice(0, 6).map(cottage => (
              <div key={cottage.id} className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-emerald-100">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={cottage.image}
                    alt={cottage.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    {cottage.displayPrice || cottage.pricePerNight}₾/ღამე
                  </div>
                </div>
                <div className="p-8">
                  <h4 className="font-bold text-xl lg:text-2xl mb-4 text-gray-800 group-hover:text-emerald-600 transition-colors">
                    {cottage.name}
                  </h4>

                  <div className="flex items-center text-gray-600 mb-4">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="text-sm">{cottage.location}</span>
                  </div>

                  <div className="flex items-center text-gray-600 mb-4">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm">მაქს. {cottage.capacity} ადამიანი</span>
                  </div>

                  <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="text-2xl font-bold text-emerald-600 mb-1">
                      {cottage.displayPrice || cottage.pricePerNight}₾
                      <span className="text-sm text-gray-600 font-normal"> / ღამე</span>
                    </div>
                    {cottage.season && cottage.season !== 'other' && (
                      <p className="text-xs text-emerald-700">
                        მიმდინარე სეზონი: <span className="font-semibold">{cottage.season}</span>
                      </p>
                    )}
                  </div>

                  

                  <div className="flex gap-4">
                    <Link
                      to={`/cottage/${cottage.id}`}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105"
                    >
                      დეტალები
                    </Link>
                    <button
                      onClick={() => handleBookingClick('cottage', cottage.id, cottage)}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                    >
                      დაჯავშნა
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/cottages"
              className="inline-block bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
            >
              იხილე ყველა კოტეჯი
            </Link>
          </div>
        </div>
      </section>

      {/* Hotels Section */}
      <section id="hotels" className="py-20 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-screen-md mx-auto px-4">
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 flex items-center justify-center leading-tight flex-wrap">
              <span className="text-3xl sm:text-4xl md:text-5xl mr-2 sm:mr-4">🏨</span>
              <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                სასტუმროები
              </span>
            </h3>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed text-balance max-w-[90%] mx-auto">კომფორტული სასტუმროები ყველა საჭიროებით</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hotels.slice(0, 6).map(hotel => (
              <HotelCard key={hotel.id} hotel={hotel} onBookingClick={handleBookingClick} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/hotels"
              className="inline-block bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
            >
              იხილე ყველა სასტუმრო
            </Link>
          </div>
        </div>
      </section>

      {/* Vehicles Section */}
      <section id="cars" className="py-20 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-screen-md mx-auto px-4">
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 flex items-center justify-center leading-tight flex-wrap">
              <span className="text-3xl sm:text-4xl md:text-5xl mr-2 sm:mr-4">🚗</span>
              <span className="bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                ავტომობილები
              </span>
            </h3>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed text-balance max-w-[90%] mx-auto">სანდო ავტომობილები კომფორტული მგზავრობისთვის</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.slice(0, 6).map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} onBookingClick={handleBookingClick} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/vehicles"
              className="inline-block bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
            >
              იხილე ყველა ავტომობილი
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800 text-white relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-40 h-40 bg-white/10 rounded-full animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-60 h-60 bg-white/5 rounded-full animate-bounce"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full animate-ping"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-12 leading-tight max-w-[90%] mx-auto">დაგვიკავშირდით</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="group flex flex-col items-center p-8 bg-white/10 rounded-3xl backdrop-blur-sm hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:-translate-y-2">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📞</div>
              <h4 className="font-bold text-xl mb-2">ტელეფონი</h4>
              <a href="tel:+995577241517" className="text-lg hover:text-emerald-200 transition-colors">
                577 24 15 17
              </a>
            </div>
            <div className="group flex flex-col items-center p-8 bg-white/10 rounded-3xl backdrop-blur-sm hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:-translate-y-2">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📧</div>
              <h4 className="font-bold text-xl mb-2">ელ-ფოსტა</h4>
              <a href="mailto:akaki.cincadze@gmail.com" className="text-lg hover:text-emerald-200 transition-colors">
                akaki.cincadze@gmail.com
              </a>
            </div>
            <div className="group flex flex-col items-center p-8 bg-white/10 rounded-3xl backdrop-blur-sm hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:-translate-y-2">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📍</div>
              <h4 className="font-bold text-xl mb-2">მისამართი</h4>
              <p className="text-lg">ბახმარო, სატყეოს ქუჩა</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Mountain className="w-8 h-8 text-emerald-400 animate-pulse" />
            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
              ბახმარო.
            </span>
            <Trees className="w-8 h-8 text-green-400 animate-pulse" />
          </div>
          <p className="text-gray-400 text-lg">© 2024 ყველა უფლება დაცულია</p>
        </div>
      </footer>


    </div>
  );
}
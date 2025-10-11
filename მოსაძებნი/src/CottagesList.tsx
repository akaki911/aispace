// @ts-nocheck

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getDisplayPriceForFamily } from './utils/pricing';
import Header from './components/Header';
import BookingModal from './components/BookingModal';
import { calculateSeasonalPrice, getCurrentMonthKey, PriceByMonth, getActivePrice, getPriceLabel, formatPrice, SeasonalPricingMixin } from './types/seasonalPricing';
import PriceTag from './components/PriceTag';

interface Cottage extends SeasonalPricingMixin {
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
}

export default function CottagesList() {
  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPricing, setCurrentPricing] = useState({ currentPrice: 0, season: '' });
  const [selectedCottage, setSelectedCottage] = useState<{ id: string; name: string } | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    const pricing = getDisplayPriceForFamily();
    setCurrentPricing(pricing);

    const fetchCottages = async () => {
      try {
        const cottagesSnap = await getDocs(query(collection(db, 'cottages'), orderBy('createdAt', 'desc'), limit(100)));
        const cottagesList = cottagesSnap.docs.map(doc => {
          const data = doc.data();
          let displayPrice = data.pricePerNight || 100;
          
          // 🎯 ერთიანი ფასების სისტემა
          displayPrice = getActivePrice(data);
          
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
      } catch (error) {
        console.error('Error fetching cottages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCottages();
  }, []);

  const handleBookingClick = (cottage: Cottage) => {
    setSelectedCottage({ id: cottage.id, name: cottage.name });
    setShowBookingModal(true);
  };

  const handleBookingSuccess = () => {
    setShowBookingModal(false);
    setSelectedCottage(null);
    // Optionally refresh cottages or show success message
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-emerald-700 font-medium">იტვირთება...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            <span className="text-4xl mr-3">🏡</span>
            ყველა კოტეჯი
          </h1>
          <p className="text-lg text-gray-600">აირჩიეთ იდეალური კოტეჯი თქვენი დასასვენებლად</p>
        </div>

        {cottages.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">🏗️</div>
            <h2 className="text-2xl font-bold text-gray-600 mb-4">
              კოტეჯები ჯერ არ არის განთავსებული
            </h2>
            <p className="text-gray-500 mb-8">
              ჩვენ ვმუშაობთ ახალი კოტეჯების დასამატებლად. დაბრუნდით მალე!
            </p>
            <Link 
              to="/"
              className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              მთავარ გვერდზე დაბრუნება
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cottages.map(cottage => (
              <div key={cottage.id} className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-emerald-100">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={cottage.image}
                    alt={cottage.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    {formatPrice(getActivePrice(cottage))}/ღამე
                  </div>
                  {cottage.isVip && (
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      ⭐ VIP
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-xl mb-3 text-gray-800 group-hover:text-emerald-600 transition-colors">
                    {cottage.name}
                  </h4>
                  <div className="flex items-center text-gray-600 mb-4 text-sm">
                    <span className="flex items-center mr-4">
                      <span className="text-lg mr-1">👥</span> {cottage.capacity}
                    </span>
                    <span className="flex items-center">
                      <span className="text-lg mr-1">📍</span> {cottage.location}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      to={`/cottage/${cottage.id}`}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 text-sm"
                    >
                      დეტალები
                    </Link>
                    <button
                      onClick={() => handleBookingClick(cottage)}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 shadow-lg text-sm"
                    >
                      დაჯავშნა
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedCottage && (
        <BookingModal
          cottageId={selectedCottage.id}
          cottageName={selectedCottage.name}
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedCottage(null);
          }}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
}

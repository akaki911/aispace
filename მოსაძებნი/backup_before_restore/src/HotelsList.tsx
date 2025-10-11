
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Hotel } from './types/hotel';
import Header from './components/Header';
import HotelCard from './components/HotelCard';

export default function HotelsList() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const hotelsSnap = await getDocs(query(collection(db, 'hotels'), orderBy('createdAt', 'desc'), limit(100)));
        const hotelsList = hotelsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          bookingsCount: doc.data().bookingsCount || 0,
          isVip: doc.data().isVip || false
        } as Hotel));
        setHotels(hotelsList);
      } catch (error) {
        console.error('Error fetching hotels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
            <p className="text-purple-700 font-medium">იტვირთება...</p>
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
            <span className="text-4xl mr-3">🏨</span>
            ყველა სასტუმრო
          </h1>
          <p className="text-lg text-gray-600">აირჩიეთ იდეალური სასტუმრო თქვენი ყოფნისთვის</p>
        </div>

        {hotels.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">🏗️</div>
            <h2 className="text-2xl font-bold text-gray-600 mb-4">
              სასტუმროები ჯერ არ არის განთავსებული
            </h2>
            <p className="text-gray-500 mb-8">
              ჩვენ ვმუშაობთ ახალი სასტუმროების დასამატებლად. დაბრუნდით მალე!
            </p>
            <Link 
              to="/"
              className="bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors"
            >
              მთავარ გვერდზე დაბრუნება
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hotels.map(hotel => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

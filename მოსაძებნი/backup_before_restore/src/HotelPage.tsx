import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ArrowLeft, MapPin, Bed, Star, Wifi, Car, Users } from 'lucide-react';
import { Hotel } from './types/hotel';
import Calendar from './components/Calendar';
import Header from './components/Header';

export default function HotelPage() {
  const { id } = useParams<{ id: string }>();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);

  useEffect(() => {
    const fetchHotel = async () => {
      if (!id) return;
      
      try {
        const hotelDoc = await getDoc(doc(db, 'hotels', id));
        if (hotelDoc.exists()) {
          const data = hotelDoc.data();
          setHotel({
            id: hotelDoc.id,
            ...data
          } as Hotel);
          setCurrentImageIndex(data.mainImageIndex || 0);
        }
      } catch (error) {
        console.error('Error fetching hotel:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHotel();
  }, [id]);

  // გადახდილი სასტუმროს ჯავშნების ჩატვირთვა
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
          
          // End-exclusive blocking: block from startDate to endDate (not including endDate)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">სასტუმრო ვერ მოიძებნა</h2>
          <Link to="/" className="text-purple-600 hover:text-purple-700">
            მთავარ გვერდზე დაბრუნება
          </Link>
        </div>
      </div>
    );
  }

  const amenityIcons = {
    wifi: <Wifi className="w-5 h-5" />,
    parking: <Car className="w-5 h-5" />,
    restaurant: '🍽️',
    pool: '🏊',
    spa: '💆',
    gym: '🏋️',
    roomService: '🛎️',
    laundry: '👕',
    airConditioning: '❄️',
    heating: '🔥',
    elevator: '🛗',
    petFriendly: '🐕'
  };

  const amenityLabels = {
    wifi: 'Wi-Fi',
    parking: 'პარკინგი',
    restaurant: 'რესტორანი',
    pool: 'აუზი',
    spa: 'SPA',
    gym: 'სპორტული დარბაზი',
    roomService: 'ოთახის სერვისი',
    laundry: 'სარეცხი სერვისი',
    airConditioning: 'კონდიციონერი',
    heating: 'გათბობა',
    elevator: 'ლიფტი',
    petFriendly: 'შინაური ცხოველები'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-16">
          <Link to="/" className="flex items-center text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5 mr-2" />
            უკან დაბრუნება
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-gray-100">
              <img
                src={hotel.images?.[currentImageIndex] || 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg'}
                alt={hotel.name}
                className="w-full h-full object-contain select-none bg-white"
                loading="eager"
                style={{ 
                  imageRendering: 'auto',
                  objectFit: 'contain',
                  width: '100%',
                  height: '100%',
                  userSelect: 'none'
                }}
              />
            </div>
            {hotel.images && hotel.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {hotel.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 bg-white ${
                      index === currentImageIndex ? 'border-purple-500' : 'border-gray-200'
                    } hover:border-purple-300`}
                  >
                    <img
                      src={image}
                      alt={`${hotel.name} ${index + 1}`}
                      className="w-full h-full object-contain hover:opacity-90 transition-opacity duration-200 select-none"
                      loading="lazy"
                      style={{ 
                        imageRendering: 'auto',
                        objectFit: 'contain',
                        userSelect: 'none'
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{hotel.name}</h1>
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{hotel.location}</span>
              </div>
            </div>

            {/* Room Types */}
            {hotel.roomTypes && hotel.roomTypes.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <Bed className="w-5 h-5 mr-2" />
                  ოთახების ტიპები
                </h3>
                <div className="space-y-4">
                  {hotel.roomTypes.map((roomType, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-lg text-gray-800">{roomType.name}</h4>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">{roomType.pricePerNight}₾</div>
                          <div className="text-sm text-gray-600">ღამეში</div>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600 mb-2">
                        <Users className="w-4 h-4 mr-1" />
                        <span className="text-sm">{roomType.capacity} ადამიანი</span>
                      </div>
                      {roomType.description && (
                        <p className="text-gray-600 text-sm">{roomType.description}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Link
                    to={`/hotel-booking/${hotel.id}`}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors block text-center"
                  >
                    ახლავე დაჯავშნა
                  </Link>
                </div>
              </div>
            )}

            {hotel.description && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-3">აღწერა</h3>
                <p className="text-gray-600 leading-relaxed">{hotel.description}</p>
              </div>
            )}

            {/* Amenities */}
            {hotel.amenities && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-4">სერვისები</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(hotel.amenities)
                    .filter(([key, value]) => value && amenityIcons[key as keyof typeof amenityIcons])
                    .map(([key, value]) => {
                    const icon = amenityIcons[key as keyof typeof amenityIcons];
                    const label = amenityLabels[key as keyof typeof amenityLabels];
                    
                    return (
                      <div key={key} className="flex items-center space-x-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                        <div className="text-purple-600">
                          {typeof icon === 'string' ? <span className="text-lg">{icon}</span> : icon}
                        </div>
                        <span className="text-sm font-medium text-purple-800">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* კალენდარი - დაკავებული დღეები */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                📅 ხელმისაწვდომობის კალენდარი
              </h3>
              <Calendar 
                bookedDates={bookedDates}
                className="w-full max-w-xs mx-auto"
                maxMonthsAhead={3}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
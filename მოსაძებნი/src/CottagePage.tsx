import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ArrowLeft, Users, MapPin, Wifi, Car, Utensils, Bath, Tv, Wind, Home } from 'lucide-react';
import { getDisplayPriceForFamily } from './utils/pricing';
import { getActivePrice, getPriceLabel, formatPrice, SeasonalPricingMixin } from './types/seasonalPricing';
import Calendar from './components/Calendar';
import Header from './components/Header';
import BookingModal from './components/BookingModal';

interface Cottage extends SeasonalPricingMixin {
  id: string;
  name: string;
  description: string;
  location: string;
  capacity: number;
  pricePerNight: number;
  images: string[];
  mainImageIndex: number;
  amenities: {
    hotWater: boolean;
    coldWater: boolean;
    gas: boolean;
    electricity: boolean;
    heater: boolean;
    fireplace: boolean;
    chimney: boolean;
    linens: boolean;
    washingMachine: boolean;
    bathroom: boolean;
    terrace: boolean;
    balcony: boolean;
    outdoorFurniture: boolean;
    bbq: boolean;
    parkingNear: boolean;
    parkingFar: boolean;
  };
  rules: string;
}

export default function CottagePage() {
  const { id } = useParams<{ id: string }>();
  const [cottage, setCottage] = useState<Cottage | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [currentPricing, setCurrentPricing] = useState({ currentPrice: 0, season: '' });
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    // მიმდინარე ფასის გამოთვლა
    const pricing = getDisplayPriceForFamily();
    setCurrentPricing(pricing);

    const fetchCottage = async () => {
      if (!id) return;

      try {
        const cottageDoc = await getDoc(doc(db, 'cottages', id));
        if (cottageDoc.exists()) {
          const data = cottageDoc.data();
          setCottage({
            id: cottageDoc.id,
            ...data
          } as Cottage);
          setCurrentImageIndex(data.mainImageIndex || 0);
        }
      } catch (error) {
        console.error('Error fetching cottage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCottage();
  }, [id]);

  // გადახდილი ჯავშნების თარიღების ჩატვირთვა
  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!id) return;
      try {
        // მხოლოდ გადახდილი ჯავშნები
        const q = query(
          collection(db, 'bookings'), 
          where('cottage', '==', id),
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!cottage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">კოტეჯი ვერ მოიძებნა</h2>
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            მთავარ გვერდზე დაბრუნება
          </Link>
        </div>
      </div>
    );
  }

  const amenityIcons = {
    hotWater: Utensils,
    coldWater: Utensils,
    gas: Wind,
    electricity: Tv,
    heater: Wind,
    fireplace: Home,
    chimney: Home,
    linens: Users,
    washingMachine: Users,
    bathroom: Bath,
    terrace: Home,
    balcony: Home,
    outdoorFurniture: Users,
    bbq: Utensils,
    parkingNear: Car,
    parkingFar: Car
  };

  const amenityLabels = {
    hotWater: 'ცხელი წყალი',
    coldWater: 'ცივი წყალი',
    gas: 'გაზი',
    electricity: 'ელექტროენერგია',
    heater: 'ბუხარი',
    fireplace: 'ფეჩი',
    chimney: 'ჭურჟელი',
    linens: 'თეთრეული',
    washingMachine: 'სარეცხი მანქანა',
    bathroom: 'აბაზანა',
    terrace: 'ტერასა',
    balcony: 'აივანი',
    outdoorFurniture: 'გარე ფანჩატური',
    bbq: 'სამწვადე მოწყობილობა',
    parkingNear: 'პარკინგი სახლთან',
    parkingFar: 'პარკინგი მოშორებით'
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
                src={cottage.images?.[currentImageIndex] || 'https://images.pexels.com/photos/1029599/pexels-photo-1029599.jpeg'}
                alt={cottage.name}
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
            {cottage.images && cottage.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {cottage.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 bg-white ${
                      index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
                    } hover:border-blue-300`}
                  >
                    <img
                      src={image}
                      alt={`${cottage.name} ${index + 1}`}
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
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{cottage.name}</h1>
              <div className="flex items-center text-gray-600 space-x-4">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{cottage.location}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{cottage.capacity} ადამიანი</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatPrice(getActivePrice(cottage))} <span className="text-lg text-gray-600 font-normal ml-1">/ ღამე</span>
              </div>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">
                  <span className="font-bold">{getPriceLabel(cottage)}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  ფასი ერთ ღამეზე (კომუნალურები ჩათვლით)
                </p>
              </div>
              <button
                onClick={() => setShowBookingModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors block text-center"
              >
                ახლავე დაჯავშნა
              </button>
            </div>

            {cottage.description && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-3">აღწერა</h3>
                <p className="text-gray-600 leading-relaxed">{cottage.description}</p>
              </div>
            )}

            {cottage.amenities && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-4">სერვისები</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(cottage.amenities)
                    .filter(([key]) => amenityIcons[key as keyof typeof amenityIcons])
                    .map(([key, value]) => {
                    const Icon = amenityIcons[key as keyof typeof amenityIcons];
                    const label = amenityLabels[key as keyof typeof amenityLabels];

                    return (
                      <div key={key} className={`flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 ${
                        value 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-red-50 border-red-200 text-red-600'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <Icon className={`w-5 h-5 ${value ? 'text-green-600' : 'text-red-500'}`} />
                          {value ? (
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">{label}</span>
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

            {cottage.rules && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-3">წესები</h3>
                <p className="text-gray-600 leading-relaxed">{cottage.rules}</p>
              </div>
            )}
          </div>
        </div>

        {showBookingModal && cottage && id && (
          <BookingModal
            cottageId={id}
            cottageName={cottage.name}
            isOpen={showBookingModal}
            onClose={() => setShowBookingModal(false)}
            mode="create"
          />
        )}
      </div>
    </div>
  );
}
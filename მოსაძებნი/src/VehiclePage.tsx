// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ArrowLeft, Users, Fuel, Settings, Clock, Calendar as CalendarIcon, MapPin, Star } from 'lucide-react';
import { Vehicle } from './types/vehicle';
import Calendar from './components/Calendar';
import Header from './components/Header';

export default function VehiclePage() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookedPeriods, setBookedPeriods] = useState<Date[]>([]);

  useEffect(() => {
    const fetchVehicle = async () => {
      if (!id) return;
      
      try {
        const vehicleDoc = await getDoc(doc(db, 'vehicles', id));
        if (vehicleDoc.exists()) {
          const data = vehicleDoc.data();
          setVehicle({
            id: vehicleDoc.id,
            ...data
          } as Vehicle);
          setCurrentImageIndex(data.mainImageIndex || 0);
        }
      } catch (error) {
        console.error('Error fetching vehicle:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, [id]);

  // გადახდილი ავტომობილის ჯავშნების ჩატვირთვა
  useEffect(() => {
    const fetchBookedPeriods = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(db, 'vehicleBookings'), 
          where('vehicleId', '==', id),
          where('გადასახდილია', '==', true),
          limit(100)
        );
        const snap = await getDocs(q);
        const dates: Date[] = [];
        
        snap.forEach(doc => {
          const data = doc.data();
          const startDateTime = data.startDateTime.toDate();
          const endDateTime = data.endDateTime.toDate();
          
          // ავტომობილისთვის საათობრივი ბლოკირება
          const current = new Date(startDateTime);
          while (current < endDateTime) {
            dates.push(new Date(current));
            current.setHours(current.getHours() + 1);
          }
        });
        
        setBookedPeriods(dates);
      } catch (error) {
        console.error('Error fetching booked periods:', error);
      }
    };

    fetchBookedPeriods();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">ავტომობილი ვერ მოიძებნა</h2>
          <Link to="/" className="text-green-600 hover:text-green-700">
            მთავარ გვერდზე დაბრუნება
          </Link>
        </div>
      </div>
    );
  }

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
                src={vehicle.images?.[currentImageIndex] || 'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg'}
                alt={vehicle.title}
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
            {vehicle.images && vehicle.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {vehicle.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200 bg-white ${
                      index === currentImageIndex ? 'border-green-500' : 'border-gray-200'
                    } hover:border-green-300`}
                  >
                    <img
                      src={image}
                      alt={`${vehicle.title} ${index + 1}`}
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
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{vehicle.title}</h1>
              <div className="flex items-center text-gray-600 space-x-4">
                {vehicle.year && (
                  <div className="flex items-center">
                    <span className="text-sm">{vehicle.year} წ.</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{vehicle.capacity} ადამიანი</span>
                </div>
                <div className="flex items-center">
                  <Fuel className="w-4 h-4 mr-1" />
                  <span>{vehicle.fuelType}</span>
                </div>
                <div className="flex items-center">
                  <Settings className="w-4 h-4 mr-1" />
                  <span>{vehicle.transmission}</span>
                </div>
              </div>
            </div>


            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{vehicle.pricePerHour}₾</div>
                  <div className="text-sm text-green-700">საათში</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <CalendarIcon className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{vehicle.pricePerDay}₾</div>
                  <div className="text-sm text-blue-700">დღეში</div>
                </div>
              </div>
              
              {vehicle.excursionServices && (
                <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
                    <Star className="w-4 h-4 mr-2" />
                    ექსკურსიული სერვისები
                  </h4>
                  <p className="text-yellow-700 text-sm mb-2">{vehicle.excursionServices.description}</p>
                  <div className="text-yellow-800 font-bold">
                    {vehicle.excursionServices.minRate}₾ - {vehicle.excursionServices.maxRate}₾
                  </div>
                </div>
              )}
              
              <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-800 text-sm font-medium flex items-center">
                  <span className="text-lg mr-2">🚗</span>
                  მძღოლი სავალდებულოა - თვითმართვა არ მუშაობს
                </p>
              </div>
              
              <Link
                to={`/vehicle-booking/${vehicle.id}`}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors block text-center"
              >
                ახლავე დაქირავება
              </Link>
            </div>

            {/* Vehicle Details */}
            {vehicle.bodyType && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-4">ავტომობილის მახასიათებლები</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {vehicle.bodyType && (
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600 text-sm">კუზოვის ტიპი:</span>
                      <span className="font-medium">{vehicle.bodyType}</span>
                    </div>
                  )}
                  {vehicle.year && (
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600 text-sm">გამოშვების წელი:</span>
                      <span className="font-medium">{vehicle.year}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 text-sm">საწვავი:</span>
                    <span className="font-medium">{vehicle.fuelType}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 text-sm">ტრანსმისია:</span>
                    <span className="font-medium">{vehicle.transmission}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 text-sm">ტევადობა:</span>
                    <span className="font-medium">{vehicle.capacity} ადამიანი</span>
                  </div>
                </div>
              </div>
            )}
            {vehicle.description && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-3">აღწერა</h3>
                <p className="text-gray-600 leading-relaxed">{vehicle.description}</p>
              </div>
            )}

            {vehicle.features && vehicle.features.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-semibold mb-4">მახასიათებლები</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vehicle.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span className="text-green-800 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* კალენდარი - დაკავებული პერიოდები */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                📅 ხელმისაწვდომობის კალენდარი
              </h3>
              <Calendar 
                bookedDates={bookedPeriods}
                className="w-full max-w-xs mx-auto"
                maxMonthsAhead={3}
              />
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>შენიშვნა:</strong> წითლად მონიშნული დღეები/საათები უკვე დაკავებულია. 
                  ავტომობილის დაქირავება შესაძლებელია საათობრივად.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
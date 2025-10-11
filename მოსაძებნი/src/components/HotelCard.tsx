// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, Users, Wifi, Bath, Utensils, Wind, Tv, DollarSign } from 'lucide-react';
import type { Hotel } from '../types/hotel';

interface HotelCardProps {
  hotel: Hotel;
  onBookingClick?: (type: string, id: string, hotel: Hotel) => void;
}

export default function HotelCard({ hotel, onBookingClick }: HotelCardProps) {
  // Safe check for images array
  if (!hotel || !hotel.images || !Array.isArray(hotel.images) || hotel.images.length === 0) {
    return (
      <div className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 border border-gray-100">
        <div className="p-8">
          <h4 className="font-bold text-xl lg:text-2xl mb-4 text-gray-800 group-hover:text-purple-600 transition-colors">
            {hotel?.name || 'Hotel Name'}
          </h4>
          <p className="text-gray-600 text-sm mb-4">
            {hotel?.description || 'No description available.'}
          </p>
          <div className="flex gap-4">
            <Link
              to={`/hotel/${hotel?.id}`}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105"
            >
              დეტალები
            </Link>
            {onBookingClick ? (
              <button
                onClick={() => onBookingClick('hotel', hotel?.id, hotel)}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
              >
                დაჯავშნა
              </button>
            ) : (
              <Link
                to={`/hotel-booking/${hotel?.id}`}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
              >
                დაჯავშნა
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const minPrice = hotel.roomTypes?.length
    ? Math.min(...hotel.roomTypes.map(rt => rt.pricePerNight))
    : 0;

  const mainImageIndex = (hotel as Hotel & { mainImageIndex?: number }).mainImageIndex ?? 0;
  const currentImage = hotel.images?.[mainImageIndex] ?? 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg';

  const amenitiesList = Array.isArray(hotel.amenities) ? hotel.amenities : [];
  const hasWifi = amenitiesList.some(amenity => typeof amenity === 'string' && amenity.toLowerCase().includes('wifi'));
  const hasParking = amenitiesList.some(amenity => typeof amenity === 'string' && amenity.toLowerCase().includes('parking'));

  return (
    <div className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 border border-gray-100">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
        <img
          src={currentImage}
          alt={hotel.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          style={{
            imageRendering: 'auto',
            objectFit: 'contain',
            width: '100%',
            height: '100%'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
          {minPrice > 0 ? `${minPrice}₾+/ღამე` : 'ფასი მოთხოვნით'}
        </div>
        <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
          🏨 სასტუმრო
        </div>
      </div>

      <div className="p-8">
        <h4 className="font-bold text-xl lg:text-2xl mb-4 text-gray-800 group-hover:text-purple-600 transition-colors">
          {hotel.name}
        </h4>

        <div className="flex items-center text-gray-600 mb-4">
          <MapPin className="w-4 h-4 mr-2" />
          <span className="text-sm">{hotel.location}</span>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {hotel.description}
        </p>

        <div className="space-y-2 mb-6">
          <div className="flex items-center text-gray-600 text-sm">
            <Users className="w-4 h-4 mr-2" />
            <span>{hotel.roomTypes?.length} ოთახის ტიპი</span>
          </div>
          {hasWifi && (
            <div className="flex items-center text-gray-600 text-sm">
              <Wifi className="w-4 h-4 mr-2" />
              <span>უფასო Wi-Fi</span>
            </div>
          )}
          {hasParking && (
            <div className="flex items-center text-gray-600 text-sm">
              <Bath className="w-4 h-4 mr-2" />
              <span>პარკინგი</span>
            </div>
          )}
        </div>

        {hotel.roomTypes?.length > 0 && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-800 font-medium mb-1">ოთახების ტიპები:</div>
            <div className="space-y-1">
              {hotel.roomTypes.slice(0, 2).map((roomType, index) => (
                <div key={index} className="flex justify-between text-xs text-purple-700">
                  <span>{roomType.name}</span>
                  <span className="font-semibold">{roomType.pricePerNight}₾/ღამე</span>
                </div>
              ))}
              {hotel.roomTypes.length > 2 && (
                <div className="text-xs text-purple-600">
                  +{hotel.roomTypes.length - 2} სხვა ტიპი
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <button
            onClick={() => hotel.id && onBookingClick?.('priceOverride', hotel.id, hotel)}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 shadow-md flex items-center justify-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            ფასის კოდის მოთხოვნა
          </button>
        </div>

        <div className="flex gap-4">
          <Link
            to={`/hotel/${hotel.id ?? ''}`}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105"
          >
            დეტალები
          </Link>
          {onBookingClick ? (
            <button
              onClick={() => hotel.id && onBookingClick?.('hotel', hotel.id, hotel)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            >
              დაჯავშნა
            </button>
          ) : (
            <Link
              to={`/hotel-booking/${hotel.id ?? ''}`}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            >
              დაჯავშნა
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
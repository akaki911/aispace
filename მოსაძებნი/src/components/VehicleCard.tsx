import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Fuel, Settings, Clock, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { Vehicle } from '../types/vehicle';

interface VehicleCardProps {
  vehicle: Vehicle;
  onBookingClick?: (type: string, id: string, item: any) => void;
}

export default function VehicleCard({ vehicle, onBookingClick }: VehicleCardProps) {
  return (
    <div className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 border border-gray-100">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
        <img
          src={vehicle.images?.[vehicle.mainImageIndex || 0] || 'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg'}
          alt={vehicle.title}
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
        <div className="absolute top-4 right-4 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
          {vehicle.pricePerDay}₾/დღე
        </div>
        <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
          🚗 მძღოლით
        </div>
      </div>
      
      <div className="p-8">
        <h4 className="font-bold text-xl lg:text-2xl mb-4 text-gray-800 group-hover:text-green-600 transition-colors">
          {vehicle.title}
        </h4>
        
        {vehicle.year && (
          <div className="mb-3 text-gray-600 text-sm">
            {vehicle.year} წელი
          </div>
        )}
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {vehicle.description}
        </p>
        
        <div className="space-y-2 mb-6">
          <div className="flex items-center text-gray-600 text-sm">
            <Users className="w-4 h-4 mr-2" />
            <span>{vehicle.capacity} ადამიანი</span>
          </div>
          {vehicle.bodyType && (
            <div className="flex items-center text-gray-600 text-sm">
              <span className="w-4 h-4 mr-2 text-center">🚗</span>
              <span>{vehicle.bodyType}</span>
            </div>
          )}
          <div className="flex items-center text-gray-600 text-sm">
            <Fuel className="w-4 h-4 mr-2" />
            <span>{vehicle.fuelType}</span>
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Settings className="w-4 h-4 mr-2" />
            <span>{vehicle.transmission}</span>
          </div>
        </div>
        
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-green-700">
              <Clock className="w-4 h-4 mr-1" />
              <span className="font-medium">{vehicle.pricePerHour}₾/საათი</span>
            </div>
            <div className="flex items-center text-green-700">
              <Calendar className="w-4 h-4 mr-1" />
              <span className="font-medium">{vehicle.pricePerDay}₾/დღე</span>
            </div>
          </div>
          {vehicle.excursionServices && (
            <p className="text-xs text-green-600 mt-2">
              ექსკურსიები: {vehicle.excursionServices.minRate}₾ - {vehicle.excursionServices.maxRate}₾
            </p>
          )}
        </div>
        
        <div className="mb-4">
          <button
            onClick={() => onBookingClick && onBookingClick('priceOverride', vehicle.id, vehicle)}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 shadow-md flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            ფასის კოდის მოთხოვნა
          </button>
        </div>
        
        <div className="flex gap-4">
          <Link
            to={`/vehicle/${vehicle.id}`}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105"
          >
            დეტალები
          </Link>
          {onBookingClick ? (
            <button
              onClick={() => onBookingClick('vehicle', vehicle.id, vehicle)}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            >
              დაქირავება
            </button>
          ) : (
            <Link
              to={`/vehicle-booking/${vehicle.id}`}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl text-center font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            >
              დაქირავება
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
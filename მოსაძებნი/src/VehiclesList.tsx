// @ts-nocheck

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Vehicle } from './types/vehicle';
import Header from './components/Header';
import VehicleCard from './components/VehicleCard';

export default function VehiclesList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const vehiclesSnap = await getDocs(query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'), limit(100)));
        const vehiclesList = vehiclesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          bookingsCount: doc.data().bookingsCount || 0,
          isVip: doc.data().isVip || false
        } as Vehicle));
        setVehicles(vehiclesList);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-700 font-medium">იტვირთება...</p>
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
            <span className="text-4xl mr-3">🚗</span>
            ყველა ავტომობილი
          </h1>
          <p className="text-lg text-gray-600">აირჩიეთ იდეალური ავტომობილი თქვენი მგზავრობისთვის</p>
        </div>

        {vehicles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">🏗️</div>
            <h2 className="text-2xl font-bold text-gray-600 mb-4">
              ავტომობილები ჯერ არ არის განთავსებული
            </h2>
            <p className="text-gray-500 mb-8">
              ჩვენ ვმუშაობთ ახალი ავტომობილების დასამატებლად. დაბრუნდით მალე!
            </p>
            <Link 
              to="/"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              მთავარ გვერდზე დაბრუნება
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

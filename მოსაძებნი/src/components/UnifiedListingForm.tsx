
import React, { useState } from 'react';
import { X, Plus, Home, Car, Building, Activity, Snowflake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ListingType {
  id: string;
  name: string;
  icon: React.ReactNode;
  route: string;
  description: string;
}

const listingTypes: ListingType[] = [
  {
    id: 'cottage',
    name: 'კოტეჯი',
    icon: <Home className="w-8 h-8" />,
    route: '/admin/cottages/new',
    description: 'საცხოვრებელი სახლი ან კოტეჯი'
  },
  {
    id: 'vehicle',
    name: 'ავტომობილი',
    icon: <Car className="w-8 h-8" />,
    route: '/admin/vehicles/new',
    description: 'ავტომობილის გაქირავება'
  },
  {
    id: 'hotel',
    name: 'სასტუმრო',
    icon: <Building className="w-8 h-8" />,
    route: '/admin/hotels/new',
    description: 'სასტუმრო ან გესტჰაუსი'
  },
  {
    id: 'horse',
    name: 'ცხენი',
    icon: <Activity className="w-8 h-8" />,
    route: '/admin/horses/new',
    description: 'ცხენოსნობა და ცხენების გაქირავება'
  },
  {
    id: 'snowmobile',
    name: 'სნოუმობილი',
    icon: <Snowflake className="w-8 h-8" />,
    route: '/admin/snowmobiles/new',
    description: 'სნოუმობილის გაქირავება'
  }
];

interface UnifiedListingFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnifiedListingForm({ isOpen, onClose }: UnifiedListingFormProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleTypeSelect = (type: ListingType) => {
    onClose();
    navigate(type.route);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              ახალი ობიექტის დამატება
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              აირჩიეთ რომელი ტიპის ობიექტი გსურთ დაამატოთ
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listingTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type)}
                className="group p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 bg-white dark:bg-gray-750 hover:shadow-lg transform hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {type.description}
                  </p>
                  <div className="flex items-center text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">დამატება</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 rounded-b-2xl">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            💡 <strong>რჩევა:</strong> თითოეული ობიექტისთვის განკუთვნილი ველები გამოჩნდება მხოლოდ მას შემდეგ, რაც აირჩევთ ტიპს
          </p>
        </div>
      </div>
    </div>
  );
}

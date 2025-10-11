import React from 'react';
import { motion } from 'framer-motion';
import { Activity, MapPin, Calendar, DollarSign, Edit, Trash2, Eye, Clock, Users } from 'lucide-react';

interface Horse {
  id: string;
  name: string;
  breed: string;
  pricePerDay: number;
  pricePerHour: number;
  age: number;
  color: string;
  height: string;
  temperament: string;
  experience: string;
  isAvailable: boolean;
  ownerId?: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
  images?: string[];
  description?: string;
}

interface HorseCardProps {
  horse: Horse;
  viewMode: 'grid' | 'list';
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
}

export default function HorseCard({ horse, viewMode, onEdit, onDelete, onView }: HorseCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ka-GE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-brown-100 dark:bg-brown-900/30 flex-shrink-0">
              {horse.images && horse.images.length > 0 ? (
                <img
                  src={horse.images[0]}
                  alt={horse.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-brown-600 dark:text-brown-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{horse.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  horse.isAvailable 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {horse.isAvailable ? 'ხელმისაწვდომი' : 'დაკავებული'}
                </span>
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{horse.breed}</span>
                {horse.age > 0 && <span>{horse.age} წლის</span>}
                {horse.color && <span>{horse.color}</span>}
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{horse.location}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              {horse.pricePerHour > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {horse.pricePerHour}₾/საათი
                </div>
              )}
              <div className="text-lg font-bold text-brown-600 dark:text-brown-400">
                {horse.pricePerDay}₾/დღე
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onView && (
                <button
                  onClick={onView}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title="დეტალურად"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                  title="რედაქტირება"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="წაშლა"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-all duration-500"
    >
      <div className="relative h-48 bg-brown-100 dark:bg-brown-900/30">
        {horse.images && horse.images.length > 0 ? (
          <img
            src={horse.images[0]}
            alt={horse.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Activity className="w-16 h-16 text-brown-600 dark:text-brown-400" />
          </div>
        )}

        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            horse.isAvailable 
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {horse.isAvailable ? 'ხელმისაწვდომი' : 'დაკავებული'}
          </span>
        </div>

        {horse.pricePerDay > 0 && (
          <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 px-3 py-1 rounded-full">
            <div className="flex items-center text-sm font-semibold text-brown-600 dark:text-brown-400">
              <DollarSign className="w-4 h-4 mr-1" />
              {horse.pricePerDay}₾/დღე
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{horse.name}</h3>
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm space-x-3">
            <span className="font-medium">{horse.breed}</span>
            {horse.age > 0 && <span>{horse.age} წლის</span>}
            {horse.color && <span>{horse.color}</span>}
          </div>
        </div>

        {horse.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
            {horse.description}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
            <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
            <span>{horse.location}</span>
          </div>

          {horse.height && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <Users className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>სიმაღლე: {horse.height}</span>
            </div>
          )}

          {horse.temperament && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <span className="w-4 h-4 mr-2 flex-shrink-0 text-center">🐎</span>
              <span>{horse.temperament}</span>
            </div>
          )}

          {horse.experience && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <span className="w-4 h-4 mr-2 flex-shrink-0 text-center">⭐</span>
              <span>{horse.experience}</span>
            </div>
          )}
        </div>

        {horse.pricePerHour > 0 && (
          <div className="mb-4 p-3 bg-brown-50 dark:bg-brown-900/30 rounded-lg border border-brown-200 dark:border-brown-800">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-brown-700 dark:text-brown-400">
                <Clock className="w-4 h-4 mr-1" />
                <span className="font-medium">{horse.pricePerHour}₾/საათი</span>
              </div>
              <div className="flex items-center text-brown-700 dark:text-brown-400">
                <Calendar className="w-4 h-4 mr-1" />
                <span className="font-medium">{horse.pricePerDay}₾/დღე</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>დამატებული: {formatDate(horse.createdAt)}</span>
          <span>განახლდა: {formatDate(horse.updatedAt)}</span>
        </div>

        <div className="flex gap-2">
          {onView && (
            <button
              onClick={onView}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
            >
              <Eye className="w-4 h-4 mr-1" />
              დეტალურად
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              რედაქტირება
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              წაშლა
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
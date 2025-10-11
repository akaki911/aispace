import React from 'react';
import { motion } from 'framer-motion';
import { 
  Edit, 
  Trash2, 
  Snowflake, 
  Users, 
  MapPin, 
  Calendar,
  Settings,
  Zap,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Snowmobile {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  pricePerDay: number;
  pricePerHour: number;
  engineSize: string;
  trackLength: string;
  maxSpeed: string;
  capacity: number;
  isAvailable: boolean;
  ownerId?: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
  images?: string[];
  description?: string;
  fuelType: string;
}

interface SnowmobileCardProps {
  snowmobile: Snowmobile;
  viewMode: 'grid' | 'list';
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function SnowmobileCard({ snowmobile, viewMode, onEdit, onDelete }: SnowmobileCardProps) {
  const { isDarkMode } = useTheme();

  if (viewMode === 'list') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 p-3 rounded-xl">
              <Snowflake className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{snowmobile.name}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  snowmobile.isAvailable 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {snowmobile.isAvailable ? (
                    <span className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      ხელმისაწვდომი
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <XCircle className="w-4 h-4 mr-1" />
                      დაკავებული
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center">
                  <Settings className="w-4 h-4 mr-1" />
                  {snowmobile.brand} {snowmobile.model} ({snowmobile.year})
                </span>
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {snowmobile.capacity} მგზავრი
                </span>
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {snowmobile.location}
                </span>
                {snowmobile.engineSize && (
                  <span className="flex items-center">
                    <Zap className="w-4 h-4 mr-1" />
                    {snowmobile.engineSize}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {snowmobile.pricePerDay}₾
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">დღეში</div>
              {snowmobile.pricePerHour > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {snowmobile.pricePerHour}₾/სთ
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              {onEdit && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onEdit}
                  className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </motion.button>
              )}
              {onDelete && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onDelete}
                  className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300"
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 p-3 rounded-xl">
              <Snowflake className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{snowmobile.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {snowmobile.brand} {snowmobile.model}
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            snowmobile.isAvailable 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {snowmobile.isAvailable ? (
              <span className="flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                ხელმისაწვდომი
              </span>
            ) : (
              <span className="flex items-center">
                <XCircle className="w-3 h-3 mr-1" />
                დაკავებული
              </span>
            )}
          </span>
        </div>

        {/* Price */}
        <div className="text-center py-4 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl mb-4">
          <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
            {snowmobile.pricePerDay}₾
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">დღეში</div>
          {snowmobile.pricePerHour > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {snowmobile.pricePerHour}₾ საათში
            </div>
          )}
        </div>

        {/* Specifications */}
        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span>წელი: {snowmobile.year}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4 mr-2 text-gray-400" />
            <span>მგზავრები: {snowmobile.capacity}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
            <span>მდებარეობა: {snowmobile.location}</span>
          </div>

          {snowmobile.engineSize && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Zap className="w-4 h-4 mr-2 text-gray-400" />
              <span>ძრავა: {snowmobile.engineSize}</span>
            </div>
          )}

          {snowmobile.maxSpeed && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Settings className="w-4 h-4 mr-2 text-gray-400" />
              <span>მაქს. სიჩქარე: {snowmobile.maxSpeed}</span>
            </div>
          )}

          {snowmobile.trackLength && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Settings className="w-4 h-4 mr-2 text-gray-400" />
              <span>ლენტის სიგრძე: {snowmobile.trackLength}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {snowmobile.description && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {snowmobile.description}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-600">
          <div className="flex justify-end space-x-2">
            {onEdit && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-medium"
              >
                <Edit className="w-4 h-4 mr-1" />
                რედაქტირება
              </motion.button>
            )}
            {onDelete && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center text-sm font-medium"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                წაშლა
              </motion.button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
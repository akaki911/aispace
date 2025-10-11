
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/useTheme';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon: Icon, 
  title, 
  description 
}) => {
  const { isDarkMode } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl shadow-lg p-12 text-center ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}
    >
      <div className="mb-6">
        <Icon className={`w-24 h-24 mx-auto mb-4 ${
          isDarkMode ? 'text-gray-600' : 'text-gray-300'
        }`} />
        <h3 className={`text-2xl font-bold mb-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </h3>
        <p className={`${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        } mb-6`}>
          {description}
        </p>
      </div>
    </motion.div>
  );
};

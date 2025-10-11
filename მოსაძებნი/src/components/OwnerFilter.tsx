
import React from 'react';
import { Users } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';

export const OwnerFilter: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <select
      className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
        isDarkMode
          ? 'bg-gray-800 border-gray-600 text-white'
          : 'bg-white border-gray-300 text-gray-900'
      }`}
    >
      <option value="all">ყველა მფლობელი</option>
      <option value="my">ჩემი ობიექტები</option>
    </select>
  );
};

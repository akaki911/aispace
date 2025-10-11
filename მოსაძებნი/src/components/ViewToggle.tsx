
import React from 'react';
import { Grid, List } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';

export const ViewToggle: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`flex border rounded-lg overflow-hidden ${
      isDarkMode ? 'border-gray-600' : 'border-gray-300'
    }`}>
      <button
        className={`p-2 transition-colors ${
          isDarkMode
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
        title="ბადის ხედი"
      >
        <Grid className="w-4 h-4" />
      </button>
      <button
        className={`p-2 transition-colors ${
          isDarkMode
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title="სიის ხედი"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
};

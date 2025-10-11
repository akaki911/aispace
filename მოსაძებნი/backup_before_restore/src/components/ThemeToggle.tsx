
import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = true }: ThemeToggleProps) {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={toggleDarkMode}
      className={`
        flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium w-full
        ${isDarkMode 
          ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-600' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-gray-200'
        }
        ${className}
      `}
      title={isDarkMode ? 'ნათელი რეჟიმზე გადასვლა' : 'მუქ რეჟიმზე გადასვლა'}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        animate={{ rotate: isDarkMode ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {isDarkMode ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </motion.div>
      
      {showLabel && (
        <span className="text-sm">
          {isDarkMode ? '☀️ ნათელი რეჟიმი' : '🌙 მუქი რეჟიმი'}
        </span>
      )}
    </motion.button>
  );
}

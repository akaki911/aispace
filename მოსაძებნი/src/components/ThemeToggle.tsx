
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
      className={`admin-theme-toggle ${className}`.trim()}
      data-mode={isDarkMode ? 'dark' : 'light'}
      title={isDarkMode ? 'ნათელი რეჟიმზე გადასვლა' : 'მუქ რეჟიმზე გადასვლა'}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        className="admin-theme-toggle__icon"
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
        <span className="admin-theme-toggle__label">
          {isDarkMode ? '☀️ ნათელი რეჟიმი' : '🌙 მუქი რეჟიმი'}
        </span>
      )}
    </motion.button>
  );
}


import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    } border rounded-xl shadow-lg transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
};

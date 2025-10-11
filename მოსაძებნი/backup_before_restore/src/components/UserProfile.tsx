
import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, BookOpen, Heart, Star, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileProps {
  onNavigate: (section: 'bookings' | 'favorites' | 'reviews') => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  };

  const handleMenuClick = (section: 'bookings' | 'favorites' | 'reviews') => {
    onNavigate(section);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
          {getInitials(user.firstName, user.lastName)}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700">
          {user.firstName ? `${user.firstName} ${user.lastName}` : user.email}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => handleMenuClick('bookings')}
              className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">ჩემი ჯავშნები</span>
            </button>
            
            <button
              onClick={() => handleMenuClick('favorites')}
              className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <Heart className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">ჩემი ფავორიტები</span>
            </button>
            
            <button
              onClick={() => handleMenuClick('reviews')}
              className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <Star className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">ჩემი შეფასებები</span>
            </button>
            
            <hr className="my-1" />
            
            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">გამოსვლა</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;

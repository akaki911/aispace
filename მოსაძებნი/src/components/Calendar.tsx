import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  bookedDates: Date[];
  temporaryBlockedDates?: Date[];
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  endDate?: Date;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  maxMonthsAhead?: number;
}

const Calendar: React.FC<CalendarProps> = ({
  bookedDates,
  temporaryBlockedDates = [],
  onDateSelect,
  selectedDate,
  endDate,
  minDate,
  maxDate,
  className = '',
  maxMonthsAhead = 6
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = [
    'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
    'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
  ];

  const dayNames = ['ორშ', 'სამშ', 'ოთხშ', 'ხუთშ', 'პარ', 'შაბ', 'კვი'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  // Navigation limits
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const canGoPrevious = !(year === currentYear && month <= currentMonth);
  const maxAllowedDate = new Date(currentYear, currentMonth + maxMonthsAhead, 1);
  const canGoNext = new Date(year, month + 1, 1) <= maxAllowedDate;

  // Generate calendar days
  const calendarDays = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const isDateBooked = (day: number) => {
    const date = new Date(year, month, day);
    return bookedDates.some(bookedDate => 
      bookedDate.toDateString() === date.toDateString()
    );
  };

  const isDateTemporarilyBlocked = (day: number) => {
    const date = new Date(year, month, day);
    return temporaryBlockedDates.some(blockedDate => 
      blockedDate.toDateString() === date.toDateString()
    );
  };

  const isDateSelected = (day: number) => {
    const date = new Date(year, month, day);
    if (selectedDate && selectedDate.toDateString() === date.toDateString()) {
      return 'start';
    }
    if (endDate && endDate.toDateString() === date.toDateString()) {
      return 'end';
    }
    if (selectedDate && endDate && date > selectedDate && date < endDate) {
      return 'range';
    }
    return false;
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;

    return isDateBooked(day) || isDateTemporarilyBlocked(day);
  };

  const handleDateClick = (day: number) => {
    if (isDateDisabled(day) || !onDateSelect) return;

    const date = new Date(year, month, day);
    onDateSelect(date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && !canGoPrevious) return;
    if (direction === 'next' && !canGoNext) return;

    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <div className={`bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden max-w-sm mx-auto ${className}`}>
      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            disabled={!canGoPrevious}
            className={`p-2 rounded-lg transition-colors ${
              canGoPrevious 
                ? 'hover:bg-white/20 text-white' 
                : 'text-white/30 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-lg font-bold">
              {monthNames[month]} {year}
            </h2>
            <p className="text-blue-100 text-xs">
              🔴 დაკავებული • 🔵 არჩეული
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateMonth('next')}
            disabled={!canGoNext}
            className={`p-2 rounded-lg transition-colors ${
              canGoNext 
                ? 'hover:bg-white/20 text-white' 
                : 'text-white/30 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="p-4">
        {/* Day Names Header */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {dayNames.map((day, index) => (
            <div
              key={index}
              className="text-center py-2 text-xs font-semibold text-gray-600 bg-gray-50 rounded"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={index} className="w-10 h-10"></div>;
            }

            const isBooked = isDateBooked(day);
            const isTemporarilyBlocked = isDateTemporarilyBlocked(day);
            const selectionType = isDateSelected(day);
            const isDisabled = isDateDisabled(day);
            const isPast = new Date(year, month, day) < new Date();

            return (
              <button
                type="button"
                key={day}
                onClick={() => handleDateClick(day)}
                disabled={isDisabled}
                className={`
                  w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-all duration-200 relative group
                  ${selectionType === 'start' || selectionType === 'end'
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' 
                    : selectionType === 'range'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : isBooked 
                    ? 'bg-red-600 text-white cursor-not-allowed' 
                    : isTemporarilyBlocked
                    ? 'bg-orange-500 text-white cursor-not-allowed' 
                    : isPast
                    ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:scale-105 cursor-pointer'
                  }
                  ${!isDisabled && !selectionType ? 'hover:shadow-sm' : ''}
                `}
              >
                <span className="relative z-10">{day}</span>

                {/* Tooltip for booked dates */}
                {isBooked && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                    დაკავებული
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                  </div>
                )}

                {/* Tooltip for temporarily blocked dates */}
                {isTemporarilyBlocked && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                    დროებითი ბლოკი - გადახდის მოლოდინში
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
            <span className="text-gray-600">დაკავებული</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            <span className="text-gray-600">დროებითი ბლოკი</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
            <span className="text-gray-600">არჩეული</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded-full mr-2"></div>
            <span className="text-gray-600">ხელმისაწვდომი</span>
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <div className="text-blue-600 mr-2 text-lg">ℹ️</div>
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">ინფორმაცია:</p>
              <p>კალენდარში შეგიძლიათ აირჩიოთ ხელმისაწვდომი თარიღები. ჩეკ-აუთის დღეს 12:00-ის შემდეგ ახალი ჯავშანი შესაძლებელია.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
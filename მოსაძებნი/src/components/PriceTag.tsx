
import React from 'react';
import { formatPrice, getPriceLabel } from '../types/seasonalPricing';

interface PriceTagProps {
  price: number;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  showPeriod?: boolean;
  period?: string;
  className?: string;
  item?: any; // for getPriceLabel
}

export default function PriceTag({
  price,
  label,
  size = 'medium',
  showPeriod = true,
  period = '/ ღამე',
  className = '',
  item
}: PriceTagProps) {
  const sizeClasses = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-3xl'
  };

  const periodClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-lg'
  };

  const displayLabel = label || (item ? getPriceLabel(item) : '');

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold text-blue-600 dark:text-blue-400 ${sizeClasses[size]}`}>
          {formatPrice(price)}
        </span>
        {showPeriod && (
          <span className={`text-gray-600 dark:text-gray-400 font-normal ${periodClasses[size]}`}>
            {period}
          </span>
        )}
      </div>
      {displayLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {displayLabel}
        </span>
      )}
    </div>
  );
}


import React from 'react';
import { formatPrice } from '../types/seasonalPricing';

interface PriceBreakdownItem {
  label: string;
  value: number;
  isMultiplier?: boolean;
  isTotal?: boolean;
  isSubtotal?: boolean;
}

interface PriceBreakdownCardProps {
  items: PriceBreakdownItem[];
  className?: string;
}

export default function PriceBreakdownCard({ items, className = '' }: PriceBreakdownCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item, index) => (
          <div
            key={index}
            className={`px-4 py-3 flex justify-between items-center ${
              item.isTotal
                ? 'bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-700'
                : item.isSubtotal
                ? 'bg-gray-50 dark:bg-gray-700/50'
                : 'bg-white dark:bg-gray-800'
            }`}
          >
            <span
              className={`${
                item.isTotal
                  ? 'text-blue-900 dark:text-blue-100 font-bold text-lg'
                  : item.isSubtotal
                  ? 'text-gray-700 dark:text-gray-300 font-semibold'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {item.label}
            </span>
            <span
              className={`font-mono ${
                item.isTotal
                  ? 'text-blue-900 dark:text-blue-100 font-bold text-xl'
                  : item.isSubtotal
                  ? 'text-gray-700 dark:text-gray-300 font-semibold text-lg'
                  : item.isMultiplier
                  ? 'text-orange-600 dark:text-orange-400 font-medium'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              {item.isMultiplier ? `× ${item.value}` : formatPrice(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

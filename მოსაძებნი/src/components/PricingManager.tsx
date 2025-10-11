
import React, { useState } from 'react';
import { DollarSign, ToggleLeft, ToggleRight, Save, AlertCircle } from 'lucide-react';
import { formatPrice } from '../types/seasonalPricing';

interface PricingManagerProps {
  currentSeasonPrice?: number;
  currentOffSeasonPrice?: number;
  currentIsSeasonal?: boolean;
  onSave: (data: { seasonPrice: number; offSeasonPrice: number; isSeasonal: boolean }) => void;
  className?: string;
}

export default function PricingManager({
  currentSeasonPrice = 0,
  currentOffSeasonPrice = 0,
  currentIsSeasonal = false,
  onSave,
  className = ""
}: PricingManagerProps) {
  const [seasonPrice, setSeasonPrice] = useState(currentSeasonPrice);
  const [offSeasonPrice, setOffSeasonPrice] = useState(currentOffSeasonPrice);
  const [isSeasonal, setIsSeasonal] = useState(currentIsSeasonal);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = () => {
    const newErrors: string[] = [];

    if (!seasonPrice || seasonPrice <= 0) {
      newErrors.push('სეზონური ფასი უნდა იყოს დადებითი რიცხვი');
    }

    if (!offSeasonPrice || offSeasonPrice <= 0) {
      newErrors.push('არასეზონური ფასი უნდა იყოს დადებითი რიცხვი');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    onSave({
      seasonPrice,
      offSeasonPrice,
      isSeasonal
    });
  };

  const activePrice = isSeasonal ? seasonPrice : offSeasonPrice;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center mb-4">
        <DollarSign className="w-5 h-5 text-emerald-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ფასების მართვა</h3>
      </div>

      {/* Current Active Price Display */}
      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
            {formatPrice(activePrice)}
          </div>
          <div className="text-sm text-emerald-700 dark:text-emerald-300">
            {isSeasonal ? 'სეზონური ფასი (აქტიური)' : 'არასეზონური ფასი (აქტიური)'}
          </div>
        </div>
      </div>

      {/* Price Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            სეზონური ფასი (₾)
          </label>
          <input
            type="number"
            value={seasonPrice || ''}
            onChange={(e) => setSeasonPrice(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="სეზონური ფასი"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            არასეზონური ფასი (₾)
          </label>
          <input
            type="number"
            value={offSeasonPrice || ''}
            onChange={(e) => setOffSeasonPrice(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="არასეზონური ფასი"
          />
        </div>
      </div>

      {/* Active Mode Toggle */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          აქტიური ფასი
        </label>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center">
            {isSeasonal ? (
              <ToggleRight 
                className="w-8 h-8 text-emerald-600 cursor-pointer" 
                onClick={() => setIsSeasonal(!isSeasonal)}
              />
            ) : (
              <ToggleLeft 
                className="w-8 h-8 text-gray-400 cursor-pointer" 
                onClick={() => setIsSeasonal(!isSeasonal)}
              />
            )}
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
              {isSeasonal ? 'სეზონური ფასი ჩართულია' : 'არასეზონური ფასი ჩართულია'}
            </span>
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
      >
        <Save className="w-4 h-4 mr-2" />
        ფასების შენახვა
      </button>

      {/* Price Comparison */}
      {seasonPrice > 0 && offSeasonPrice > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="text-xs text-blue-700 dark:text-blue-300 text-center">
            {seasonPrice > offSeasonPrice ? (
              <span>სეზონური ფასი {formatPrice(seasonPrice - offSeasonPrice)} მეტია არასეზონურზე</span>
            ) : seasonPrice < offSeasonPrice ? (
              <span>არასეზონური ფასი {formatPrice(offSeasonPrice - seasonPrice)} მეტია სეზონურზე</span>
            ) : (
              <span>ფასები ტოლია</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

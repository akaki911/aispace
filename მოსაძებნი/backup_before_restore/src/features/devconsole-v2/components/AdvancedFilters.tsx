
import React, { useState } from 'react';
import { Filter, X, Search, Regex } from 'lucide-react';

interface AdvancedFiltersProps {
  filters: {
    sources: string[];
    levels: string[];
    httpStatus: string[];
    routes: string[];
    regex: string;
    regexEnabled: boolean;
  };
  onFiltersChange: (filters: any) => void;
  onClose: () => void;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose
}) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [regexTest, setRegexTest] = useState('');

  const sourceOptions = [
    { value: 'ai', label: '🤖 AI Service', color: 'bg-blue-100 text-blue-800' },
    { value: 'backend', label: '⚙️ Backend', color: 'bg-green-100 text-green-800' },
    { value: 'frontend', label: '🎨 Frontend', color: 'bg-purple-100 text-purple-800' }
  ];

  const levelOptions = [
    { value: 'error', label: '🔴 ERROR', color: 'bg-red-100 text-red-800' },
    { value: 'warn', label: '🟠 WARN', color: 'bg-orange-100 text-orange-800' },
    { value: 'info', label: '🔵 INFO', color: 'bg-blue-100 text-blue-800' },
    { value: 'debug', label: '⚪ DEBUG', color: 'bg-gray-100 text-gray-800' }
  ];

  const httpStatusOptions = [
    { value: '200', label: '✅ 200 OK', color: 'bg-green-100 text-green-800' },
    { value: '404', label: '❌ 404 Not Found', color: 'bg-red-100 text-red-800' },
    { value: '500', label: '💥 500 Server Error', color: 'bg-red-100 text-red-800' },
    { value: '401', label: '🔒 401 Unauthorized', color: 'bg-yellow-100 text-yellow-800' },
    { value: '403', label: '🚫 403 Forbidden', color: 'bg-red-100 text-red-800' }
  ];

  const routeOptions = [
    { value: '/api/booking/*', label: '📅 Booking APIs', color: 'bg-blue-100 text-blue-800' },
    { value: '/api/admin/*', label: '👑 Admin APIs', color: 'bg-purple-100 text-purple-800' },
    { value: '/api/auth/*', label: '🔐 Auth APIs', color: 'bg-green-100 text-green-800' },
    { value: '/api/dev/*', label: '🔧 Dev APIs', color: 'bg-orange-100 text-orange-800' }
  ];

  const toggleSelection = (category: string, value: string) => {
    setLocalFilters(prev => {
      const current = prev[category as keyof typeof prev] as string[];
      const newSelection = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      
      return { ...prev, [category]: newSelection };
    });
  };

  const testRegex = () => {
    if (!localFilters.regex || !regexTest) return false;
    try {
      const regex = new RegExp(localFilters.regex, 'i');
      return regex.test(regexTest);
    } catch {
      return false;
    }
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const clearAllFilters = () => {
    const cleared = {
      sources: [],
      levels: [],
      httpStatus: [],
      routes: [],
      regex: '',
      regexEnabled: false
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Filter className="mr-2" size={20} />
            Advanced Filters
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Filters */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">📡 Sources</h4>
            <div className="space-y-2">
              {sourceOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.sources.includes(option.value)}
                    onChange={() => toggleSelection('sources', option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Level Filters */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">📊 Log Levels</h4>
            <div className="space-y-2">
              {levelOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.levels.includes(option.value)}
                    onChange={() => toggleSelection('levels', option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* HTTP Status Filters */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">🌐 HTTP Status</h4>
            <div className="space-y-2">
              {httpStatusOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.httpStatus.includes(option.value)}
                    onChange={() => toggleSelection('httpStatus', option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Route Filters */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">🛣️ API Routes</h4>
            <div className="space-y-2">
              {routeOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.routes.includes(option.value)}
                    onChange={() => toggleSelection('routes', option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Regex Filter */}
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">🔍 Regex Filter</h4>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.regexEnabled}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, regexEnabled: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Enable</span>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={localFilters.regex}
                  onChange={(e) => setLocalFilters(prev => ({ ...prev, regex: e.target.value }))}
                  placeholder="Enter regex pattern (e.g., /api/.*error.*)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={!localFilters.regexEnabled}
                />
              </div>
              <Regex className={`mt-2 ${localFilters.regexEnabled ? 'text-blue-500' : 'text-gray-400'}`} size={20} />
            </div>

            {localFilters.regexEnabled && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Test your regex:</label>
                <input
                  type="text"
                  value={regexTest}
                  onChange={(e) => setRegexTest(e.target.value)}
                  placeholder="Sample text to test against"
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
                {regexTest && localFilters.regex && (
                  <div className={`mt-1 text-xs ${testRegex() ? 'text-green-600' : 'text-red-600'}`}>
                    {testRegex() ? '✅ Match' : '❌ No match'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            Clear All Filters
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

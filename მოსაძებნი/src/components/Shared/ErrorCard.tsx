import React from 'react';

interface ErrorCardProps {
  error: string;
  onRetry?: () => void;
  canRetry?: boolean;
  suggestions?: string[];
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ 
  error, 
  onRetry, 
  canRetry = false, 
  suggestions = [] 
}) => {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4 mb-3">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-red-500 text-xl">❌</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Error
          </h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>

          {suggestions.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Suggestions:
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                {suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {canRetry && onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
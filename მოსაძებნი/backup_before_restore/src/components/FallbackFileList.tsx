
import React from 'react';
import { AlertTriangle, RefreshCw, Search, Folder, File } from 'lucide-react';

interface FallbackFileListProps {
  error?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  type?: 'search' | 'category' | 'recent';
}

const FallbackFileList: React.FC<FallbackFileListProps> = ({
  error,
  onRetry,
  isRetrying = false,
  type = 'search'
}) => {
  const getTitle = () => {
    switch (type) {
      case 'category': return 'კატეგორიის ფაილები ვერ ჩაიტვირთა';
      case 'recent': return 'ბოლო ფაილები ვერ ჩაიტვირთა';
      default: return 'ძებნა ვერ მოხერხდა';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'category': return <Folder size={24} className="text-gray-400" />;
      case 'recent': return <File size={24} className="text-gray-400" />;
      default: return <Search size={24} className="text-gray-400" />;
    }
  };

  const getMockFiles = () => {
    const commonFiles = [
      { name: 'package.json', path: 'package.json', type: 'config' },
      { name: 'tsconfig.json', path: 'tsconfig.json', type: 'config' },
      { name: 'vite.config.ts', path: 'vite.config.ts', type: 'config' },
      { name: 'index.html', path: 'index.html', type: 'markup' },
      { name: 'main.tsx', path: 'src/main.tsx', type: 'script' }
    ];

    return commonFiles.slice(0, 3);
  };

  return (
    <div className="p-4 text-center">
      <div className="flex flex-col items-center space-y-3">
        <AlertTriangle size={32} className="text-yellow-500" />
        <h3 className="text-sm font-medium text-gray-300">{getTitle()}</h3>
        
        {error && (
          <p className="text-xs text-gray-500 max-w-64 break-words">
            {error}
          </p>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors"
          >
            <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? 'მუშავდება...' : 'ხელახლა ცდა'}</span>
          </button>
        )}

        <div className="mt-4 pt-3 border-t border-gray-700 w-full">
          <p className="text-xs text-gray-500 mb-2">ხშირად გამოყენებული ფაილები:</p>
          <div className="space-y-1">
            {getMockFiles().map((file, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-1.5 hover:bg-gray-700/50 rounded text-xs"
              >
                {getIcon()}
                <span className="text-gray-400 truncate">{file.name}</span>
                <span className="text-xs text-gray-600 ml-auto">{file.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FallbackFileList;

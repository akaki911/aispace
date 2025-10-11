/**
 * Unified File Preview Component
 * Uses FilePreviewProvider for centralized state management
 * Fixes all critical architectural and functionality issues
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconX,
  IconCopy,
  IconExternalLink,
  IconFileText,
  IconCode,
  IconFileTypeJs,
  IconFileTypeCss,
  IconFileTypeHtml,
  IconFileTypePhp,
  IconCalendar,
  IconFile,
  IconSearch,
  IconMaximize,
  IconChevronUp,
  IconChevronDown,
  IconLoader2,
  IconAlertCircle
} from '@tabler/icons-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useFilePreview } from '../contexts/FilePreviewProvider';

interface FilePreviewProps {
  onOpenInEditor?: (filePath: string) => void;
  className?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  onOpenInEditor,
  className = ''
}) => {
  const {
    currentPreview,
    isPreviewOpen,
    isLoading,
    error,
    closePreview,
    getCachedFile
  } = useFilePreview();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get current file data from cache
  const previewData = currentPreview ? getCachedFile(currentPreview) : null;

  // ESC key handler to close preview
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isPreviewOpen) {
        closePreview();
      }
    };

    if (isPreviewOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPreviewOpen, closePreview]);

  // Handle search in content
  useEffect(() => {
    if (!searchTerm || !previewData?.content) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const content = previewData.content.toLowerCase();
    const term = searchTerm.toLowerCase();
    const results: number[] = [];
    let index = content.indexOf(term);

    while (index !== -1) {
      results.push(index);
      index = content.indexOf(term, index + 1);
    }

    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchTerm, previewData?.content]);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'js':
      case 'jsx':
        return <IconFileTypeJs className="text-yellow-400" size={16} />;
      case 'ts':
      case 'tsx':
        return <IconCode className="text-blue-400" size={16} />;
      case 'css':
      case 'scss':
      case 'sass':
        return <IconFileTypeCss className="text-green-400" size={16} />;
      case 'html':
      case 'htm':
        return <IconFileTypeHtml className="text-orange-400" size={16} />;
      case 'py':
        return <IconFileTypePhp className="text-blue-300" size={16} />;
      default:
        return <IconFileText className="text-gray-400" size={16} />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const copyToClipboard = async (content?: string) => {
    try {
      const textToCopy = content || previewData?.content || '';
      await navigator.clipboard.writeText(textToCopy);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    const newIndex = direction === 'next'
      ? (currentSearchIndex + 1) % searchResults.length
      : (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    
    setCurrentSearchIndex(newIndex);
    
    // Scroll to highlight would be implemented here
  };

  const handleOpenInEditor = () => {
    if (previewData?.path && onOpenInEditor) {
      onOpenInEditor(previewData.path);
      closePreview();
    }
  };

  const resetSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  };

  if (!isPreviewOpen || !currentPreview) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed top-0 right-0 h-full bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col ${
          isCollapsed ? 'w-12' : 'w-96'
        } ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
          {!isCollapsed && (
            <>
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {previewData && getFileIcon(previewData.name)}
                <span className="text-sm font-medium text-gray-200 truncate">
                  {previewData?.name || 'ფაილის გადახედვა'}
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                  title="Collapse"
                >
                  <IconChevronUp size={16} />
                </button>
                
                <button
                  onClick={closePreview}
                  className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                  title="Close (ESC)"
                >
                  <IconX size={16} />
                </button>
              </div>
            </>
          )}
          
          {isCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors w-full"
              title="Expand"
            >
              <IconChevronDown size={16} />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <>
            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <IconLoader2 className="animate-spin text-blue-400" size={24} />
                  <span className="ml-2 text-gray-300">ფაილის ჩატვირთვა...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center p-4 bg-red-900/20 border border-red-700 mx-3 mt-3 rounded">
                  <IconAlertCircle className="text-red-400" size={20} />
                  <span className="ml-2 text-red-300 text-sm">{error}</span>
                </div>
              )}

              {previewData && !isLoading && !error && (
                <>
                  {/* File Info */}
                  <div className="p-3 bg-gray-800 border-b border-gray-700">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <IconCalendar size={14} className="text-gray-500" />
                        <span className="text-gray-400">
                          {formatDate(previewData.lastModified)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <IconFile size={14} className="text-gray-500" />
                        <span className="text-gray-400">
                          {formatFileSize(previewData.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="p-3 border-b border-gray-700 bg-gray-800">
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search in file..."
                        className="w-full bg-gray-700 text-white text-sm px-3 py-2 pr-8 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      />
                      <IconSearch className="absolute right-2 top-2.5 text-gray-400" size={16} />
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                        <span>
                          {currentSearchIndex + 1} of {searchResults.length} matches
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => navigateSearch('prev')}
                            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                            disabled={searchResults.length === 0}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => navigateSearch('next')}
                            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                            disabled={searchResults.length === 0}
                          >
                            ↓
                          </button>
                          <button
                            onClick={resetSearch}
                            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => copyToClipboard()}
                        className="flex items-center space-x-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
                      >
                        <IconCopy size={14} />
                        <span>{showCopySuccess ? 'Copied!' : 'Copy'}</span>
                      </button>
                      
                      {onOpenInEditor && (
                        <button
                          onClick={handleOpenInEditor}
                          className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                          <IconExternalLink size={14} />
                          <span>Open</span>
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {}}
                      className="flex items-center space-x-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
                      title="Maximize"
                    >
                      <IconMaximize size={14} />
                    </button>
                  </div>

                  {/* Code Content */}
                  <div className="flex-1 overflow-auto" ref={contentRef}>
                    <SyntaxHighlighter
                      language={previewData.language}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.875rem',
                        lineHeight: '1.5'
                      }}
                      showLineNumbers={true}
                      wrapLines={true}
                      wrapLongLines={true}
                      lineNumberStyle={{
                        color: '#6b7280',
                        paddingRight: '1rem',
                        textAlign: 'right' as const,
                        minWidth: '3rem'
                      }}
                    >
                      {previewData.content}
                    </SyntaxHighlighter>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default FilePreview;
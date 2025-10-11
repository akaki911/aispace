// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  IconSearch,
  IconX,
  IconFilter,
  IconClock,
  IconStar,
  IconFile,
  IconFolder,
  IconCode,
  IconSettings,
  IconLoader2,
  IconAdjustments,
  IconWand,
  IconRegex,
  IconSortAscending,
  IconDatabase,
  IconEye,
  IconHistory,
  IconExternalLink
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { enhancedSearchService } from '../services/enhancedSearchService';
import { SearchResult, SearchOptions } from '../utils/searchAlgorithms';
import { useFilePreview } from '../contexts/useFilePreview';

interface AdvancedSearchProps {
  onFileSelect: (filePath: string) => void;
  className?: string;
}

type SearchMode = 'name' | 'content' | 'fuzzy' | 'all';
type SortMode = 'relevance' | 'name' | 'size' | 'date';

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onFileSelect, className }) => {
  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('name');
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Preview functionality using unified provider
  const {
    openPreview
  } = useFilePreview();
  
  // Filter state
  const [filters, setFilters] = useState<SearchOptions>({
    fuzzy: false,
    includeContent: false,
    regex: false,
    caseSensitive: false,
    limit: 50,
    fileTypes: [],
    categories: [],
    minSize: 0,
    maxSize: undefined
  });

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // File type options
  const fileTypeOptions = [
    { value: '.js', label: 'JavaScript', icon: IconCode, color: 'text-yellow-400' },
    { value: '.tsx', label: 'TypeScript React', icon: IconCode, color: 'text-blue-400' },
    { value: '.ts', label: 'TypeScript', icon: IconCode, color: 'text-blue-400' },
    { value: '.jsx', label: 'React', icon: IconCode, color: 'text-cyan-400' },
    { value: '.css', label: 'CSS', icon: IconCode, color: 'text-green-400' },
    { value: '.html', label: 'HTML', icon: IconCode, color: 'text-red-400' },
    { value: '.json', label: 'JSON', icon: IconDatabase, color: 'text-purple-400' },
    { value: '.md', label: 'Markdown', icon: IconFile, color: 'text-gray-400' }
  ];

  // Category options
  const categoryOptions = [
    { value: 'source', label: 'Source Code', icon: IconCode },
    { value: 'config', label: 'Configuration', icon: IconSettings },
    { value: 'docs', label: 'Documentation', icon: IconFile },
    { value: 'assets', label: 'Assets', icon: IconFolder },
    { value: 'styles', label: 'Stylesheets', icon: IconCode }
  ];

  // Perform search
  const performSearch = async (searchQuery: string, options?: Partial<SearchOptions>) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    
    try {
      const searchOptions: SearchOptions = {
        ...filters,
        ...options,
        fuzzy: searchMode === 'fuzzy' || filters.fuzzy,
        includeContent: searchMode === 'content' || searchMode === 'all' || filters.includeContent,
        sortBy: sortMode
      };

      console.log('🔍 Performing search:', { query: searchQuery, mode: searchMode, options: searchOptions });

      const searchResults = await enhancedSearchService.search(searchQuery, searchOptions);
      setResults(searchResults);

      // Update search history
      if (searchQuery.trim() && !searchHistory.includes(searchQuery.trim())) {
        setSearchHistory(prev => [searchQuery.trim(), ...prev.slice(0, 9)]);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Get search suggestions
  const getSuggestions = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions(searchHistory.slice(0, 5));
      return;
    }

    try {
      const suggestions = await enhancedSearchService.getSearchSuggestions(searchQuery);
      setSuggestions(suggestions);
    } catch (error) {
      console.warn('Failed to get suggestions:', error);
      setSuggestions(searchHistory.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5));
    }
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setQuery(value);
    
    if (value.trim()) {
      performSearch(value);
      getSuggestions(value);
      setShowSuggestions(true);
    } else {
      setResults([]);
      setShowSuggestions(false);
    }
  };

  // Handle search mode change
  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    if (query.trim()) {
      performSearch(query, { 
        fuzzy: mode === 'fuzzy',
        includeContent: mode === 'content' || mode === 'all'
      });
    }
  };

  // Handle filter change
  const handleFilterChange = (key: keyof SearchOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    if (query.trim()) {
      performSearch(query, newFilters);
    }
  };

  // Handle file type toggle
  const toggleFileType = (fileType: string) => {
    const newFileTypes = filters.fileTypes?.includes(fileType)
      ? filters.fileTypes.filter(ft => ft !== fileType)
      : [...(filters.fileTypes || []), fileType];
    
    handleFilterChange('fileTypes', newFileTypes);
  };

  // Handle category toggle
  const toggleCategory = (category: string) => {
    const newCategories = filters.categories?.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...(filters.categories || []), category];
    
    handleFilterChange('categories', newCategories);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
    searchInputRef.current?.focus();
  };

  // Handle file select
  const handleFileSelect = (filePath: string) => {
    onFileSelect(filePath);
    setShowSuggestions(false);
  };

  // Get file icon
  const getFileIcon = (filePath: string) => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const fileType = fileTypeOptions.find(ft => ft.value === `.${extension}`);
    return fileType?.icon || IconFile;
  };

  // Get file type color
  const getFileTypeColor = (filePath: string) => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const fileType = fileTypeOptions.find(ft => ft.value === `.${extension}`);
    return fileType?.color || 'text-gray-400';
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Highlight search matches
  const highlightText = (text: string, matches?: any[]): string | React.ReactElement => {
    if (!matches || matches.length === 0) return text;
    
    let highlighted = text;
    // Simple highlighting - can be enhanced
    const queryLower = query.toLowerCase();
    const index = text.toLowerCase().indexOf(queryLower);
    
    if (index !== -1) {
      highlighted = (
        <>
          {text.substring(0, index)}
          <span className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded">
            {text.substring(index, index + query.length)}
          </span>
          {text.substring(index + query.length)}
        </>
      );
    }
    
    return highlighted;
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      fuzzy: false,
      includeContent: false,
      regex: false,
      caseSensitive: false,
      limit: 50,
      fileTypes: [],
      categories: [],
      minSize: 0,
      maxSize: undefined
    });
    if (query.trim()) {
      performSearch(query);
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.fuzzy) count++;
    if (filters.includeContent) count++;
    if (filters.regex) count++;
    if (filters.caseSensitive) count++;
    if (filters.fileTypes?.length) count++;
    if (filters.categories?.length) count++;
    return count;
  }, [filters]);

  return (
    <div className={`bg-[#161b22] border border-[#30363d] rounded-lg ${className}`}>
      {/* Search Header */}
      <div className="p-4 border-b border-[#30363d]">
        <div className="relative">
          {/* Search Input */}
          <div className="relative">
            <IconSearch 
              size={16} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7d8590]" 
            />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="ძებნა ფაილების სახელებით ან შინაარსით..."
              className="w-full pl-10 pr-20 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] placeholder-[#7d8590] focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:border-transparent"
            />
            
            {/* Clear and Filters Button */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setShowSuggestions(false);
                  }}
                  className="p-1 text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                >
                  <IconX size={14} />
                </button>
              )}
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1 rounded transition-colors relative ${
                  showFilters 
                    ? 'text-[#58a6ff] bg-[#58a6ff]/10' 
                    : 'text-[#7d8590] hover:text-[#e6edf3]'
                }`}
              >
                <IconFilter size={14} />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f85149] text-white text-xs rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              
              {loading && (
                <IconLoader2 size={14} className="text-[#58a6ff] animate-spin" />
              )}
            </div>
          </div>

          {/* Search Suggestions */}
          <AnimatePresence>
            {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
              <motion.div
                ref={suggestionsRef}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#0d1117] border border-[#30363d] rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                {suggestions.length > 0 ? (
                  <>
                    <div className="px-3 py-2 text-xs text-[#7d8590] font-semibold">
                      შესავალები
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-3 py-2 text-left text-sm text-[#e6edf3] hover:bg-[#30363d] flex items-center space-x-2"
                      >
                        <IconSearch size={12} className="text-[#7d8590]" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </>
                ) : searchHistory.length > 0 ? (
                  <>
                    <div className="px-3 py-2 text-xs text-[#7d8590] font-semibold flex items-center space-x-1">
                      <IconHistory size={12} />
                      <span>ძებნის ისტორია</span>
                    </div>
                    {searchHistory.slice(0, 5).map((historyItem, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(historyItem)}
                        className="w-full px-3 py-2 text-left text-sm text-[#e6edf3] hover:bg-[#30363d] flex items-center space-x-2"
                      >
                        <IconClock size={12} className="text-[#7d8590]" />
                        <span>{historyItem}</span>
                      </button>
                    ))}
                  </>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search Mode Buttons */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex space-x-1">
            {[
              { mode: 'name' as SearchMode, label: 'სახელი', icon: IconFile },
              { mode: 'content' as SearchMode, label: 'შინაარსი', icon: IconCode },
              { mode: 'fuzzy' as SearchMode, label: 'ფაზი', icon: IconWand },
              { mode: 'all' as SearchMode, label: 'ყველა', icon: IconStar }
            ].map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => handleSearchModeChange(mode)}
                className={`flex items-center space-x-1 px-3 py-1 text-xs rounded transition-colors ${
                  searchMode === mode
                    ? 'bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/30'
                    : 'bg-[#21262d] text-[#7d8590] hover:bg-[#30363d] hover:text-[#e6edf3]'
                }`}
              >
                <Icon size={12} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#7d8590]">დალაგება:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="text-xs bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-[#e6edf3] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
            >
              <option value="relevance">რელევანტობა</option>
              <option value="name">სახელი</option>
              <option value="date">თარიღი</option>
              <option value="size">ზომა</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[#30363d] overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Search Options */}
              <div>
                <h4 className="text-sm font-semibold text-[#e6edf3] mb-2 flex items-center space-x-2">
                  <IconAdjustments size={14} />
                  <span>ძებნის პარამეტრები</span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'fuzzy', label: 'ფაზი ძებნა', icon: IconWand },
                    { key: 'includeContent', label: 'შინაარსი', icon: IconCode },
                    { key: 'regex', label: 'Regex', icon: IconRegex },
                    { key: 'caseSensitive', label: 'მგრძნობიარე ბარემზე', icon: IconSortAscending }
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={filters[key as keyof SearchOptions] as boolean}
                        onChange={(e) => handleFilterChange(key as keyof SearchOptions, e.target.checked)}
                        className="rounded border-[#30363d] text-[#58a6ff] focus:ring-[#58a6ff] focus:ring-offset-0 bg-[#0d1117]"
                      />
                      <Icon size={12} className="text-[#7d8590]" />
                      <span className="text-[#e6edf3]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* File Types */}
              <div>
                <h4 className="text-sm font-semibold text-[#e6edf3] mb-2">ფაილის ტიპები</h4>
                <div className="flex flex-wrap gap-2">
                  {fileTypeOptions.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      onClick={() => toggleFileType(value)}
                      className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                        filters.fileTypes?.includes(value)
                          ? 'bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/30'
                          : 'bg-[#21262d] text-[#7d8590] hover:bg-[#30363d] hover:text-[#e6edf3]'
                      }`}
                    >
                      <Icon size={12} className={filters.fileTypes?.includes(value) ? 'text-[#58a6ff]' : color} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div>
                <h4 className="text-sm font-semibold text-[#e6edf3] mb-2">კატეგორიები</h4>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => toggleCategory(value)}
                      className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                        filters.categories?.includes(value)
                          ? 'bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/30'
                          : 'bg-[#21262d] text-[#7d8590] hover:bg-[#30363d] hover:text-[#e6edf3]'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              <div className="flex justify-end">
                <button
                  onClick={clearFilters}
                  disabled={activeFiltersCount === 0}
                  className="text-xs text-[#f85149] hover:text-[#ff7b72] disabled:text-[#484f58] disabled:cursor-not-allowed transition-colors"
                >
                  ფილტრების გასუფთავება
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto max-h-96">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 size={20} className="text-[#58a6ff] animate-spin mr-2" />
            <span className="text-[#7d8590]">ძებნა...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="divide-y divide-[#30363d]">
            {results.map((result, index) => {
              const FileIcon = getFileIcon(result.path);
              const fileTypeColor = getFileTypeColor(result.path);
              
              return (
                <motion.div
                  key={`${result.path}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full p-3 hover:bg-[#21262d] transition-colors group"
                >
                  <div className="flex items-start space-x-3">
                    <FileIcon size={16} className={`mt-0.5 ${fileTypeColor}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0">
                          <button
                            onClick={() => handleFileSelect(result.path)}
                            className="text-sm font-medium text-[#e6edf3] truncate hover:text-[#58a6ff] transition-colors text-left"
                          >
                            {highlightText(result.name, result.matches)}
                          </button>
                          {result.score > 0 && (
                            <span className="text-xs text-[#7d8590] bg-[#21262d] px-1 rounded">
                              {Math.round(result.score * 100)}%
                            </span>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPreview(result.path);
                            }}
                            className="p-1 text-[#7d8590] hover:text-[#58a6ff] hover:bg-[#30363d] rounded transition-colors"
                            title="პრევიუ"
                          >
                            <IconEye size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileSelect(result.path);
                            }}
                            className="p-1 text-[#7d8590] hover:text-[#58a6ff] hover:bg-[#30363d] rounded transition-colors"
                            title="რედაქტორში გახსნა"
                          >
                            <IconExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-[#7d8590] truncate">
                        {result.path}
                      </div>
                      
                      <div className="flex items-center space-x-3 mt-1 text-xs text-[#7d8590]">
                        <span>{formatFileSize(result.size)}</span>
                        <span>{formatDate(result.lastModified)}</span>
                        {result.totalMatches && result.totalMatches > 0 && (
                          <span className="text-[#58a6ff]">
                            {result.totalMatches} მუხთვო
                          </span>
                        )}
                      </div>
                      
                      {/* Content Matches Preview */}
                      {result.contentMatches && result.contentMatches.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {result.contentMatches.slice(0, 2).map((match, matchIndex) => (
                            <div key={matchIndex} className="text-xs">
                              <span className="text-[#7d8590] mr-2">
                                {match.lineNumber}:
                              </span>
                              <span className="text-[#e6edf3]">
                                {highlightText(match.line.substring(0, 100), match.matches)}
                                {match.line.length > 100 && '...'}
                              </span>
                            </div>
                          ))}
                          {result.contentMatches.length > 2 && (
                            <div className="text-xs text-[#58a6ff]">
                              +{result.contentMatches.length - 2} მე მუხთვო
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : query && !loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#7d8590]">
            <IconSearch size={32} className="mb-2 opacity-50" />
            <span className="text-sm">შედეგები არ მოიძებნა "{query}"</span>
            <span className="text-xs mt-1">სცადეთ სხვა საძებნი სიტყვები</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-[#7d8590]">
            <IconSearch size={32} className="mb-2 opacity-50" />
            <span className="text-sm">დაიწყეთ ძებნა ფაილების პოვნისთვის</span>
            <span className="text-xs mt-1">გამოიყენეთ სახელები, შინაარსი ან ფაზი ძებნა</span>
          </div>
        )}
      </div>

      {/* File Preview now handled by global component in App.tsx */}
    </div>
  );
};

export default AdvancedSearch;
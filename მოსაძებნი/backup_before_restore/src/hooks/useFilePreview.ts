import { useState, useCallback, useRef } from 'react';

interface PreviewFile {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  lastModified: string;
  timestamp: number;
}

interface UseFilePreviewOptions {
  maxCacheSize?: number;
  cacheTTL?: number; // Time to live in milliseconds
}

interface UseFilePreviewReturn {
  // State
  currentPreview: string | null;
  isPreviewOpen: boolean;
  previewHistory: string[];
  
  // Actions
  openPreview: (filePath: string) => void;
  closePreview: () => void;
  clearCache: () => void;
  getCachedFile: (filePath: string) => PreviewFile | null;
  
  // Cache info
  cacheSize: number;
  cacheHitRate: number;
}

export const useFilePreview = (options: UseFilePreviewOptions = {}): UseFilePreviewReturn => {
  const {
    maxCacheSize = 10,
    cacheTTL = 5 * 60 * 1000 // 5 minutes
  } = options;

  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);

  // Cache management
  const cache = useRef(new Map<string, PreviewFile>());
  const cacheStats = useRef({ hits: 0, misses: 0 });

  const getCachedFile = useCallback((filePath: string): PreviewFile | null => {
    const cached = cache.current.get(filePath);
    
    if (!cached) {
      cacheStats.current.misses++;
      return null;
    }

    // Check if cache entry is still valid
    const isExpired = Date.now() - cached.timestamp > cacheTTL;
    if (isExpired) {
      cache.current.delete(filePath);
      cacheStats.current.misses++;
      return null;
    }

    cacheStats.current.hits++;
    return cached;
  }, [cacheTTL]);

  const setCachedFile = useCallback((filePath: string, fileData: Omit<PreviewFile, 'timestamp'>) => {
    // Remove oldest entries if cache is full
    if (cache.current.size >= maxCacheSize) {
      const oldestKey = cache.current.keys().next().value;
      if (oldestKey) {
        cache.current.delete(oldestKey);
      }
    }

    cache.current.set(filePath, {
      ...fileData,
      timestamp: Date.now()
    });
  }, [maxCacheSize]);

  const openPreview = useCallback((filePath: string) => {
    setCurrentPreview(filePath);
    setIsPreviewOpen(true);

    // Update preview history
    setPreviewHistory(prev => {
      const filtered = prev.filter(path => path !== filePath);
      return [filePath, ...filtered.slice(0, 9)]; // Keep last 10 items
    });

    console.log(`🔍 Opening file preview: ${filePath}`);
  }, []);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    // Don't clear currentPreview immediately to allow for smooth animation
    setTimeout(() => {
      setCurrentPreview(null);
    }, 300);

    console.log('🔍 Closing file preview');
  }, []);

  const clearCache = useCallback(() => {
    cache.current.clear();
    cacheStats.current = { hits: 0, misses: 0 };
    console.log('🗑️ File preview cache cleared');
  }, []);

  // Calculate cache hit rate
  const cacheHitRate = useCallback(() => {
    const { hits, misses } = cacheStats.current;
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }, []);

  return {
    // State
    currentPreview,
    isPreviewOpen,
    previewHistory,
    
    // Actions
    openPreview,
    closePreview,
    clearCache,
    getCachedFile,
    
    // Cache info
    cacheSize: cache.current.size,
    cacheHitRate: cacheHitRate()
  };
};

export default useFilePreview;
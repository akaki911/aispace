/**
 * Unified File Preview Provider
 * Eliminates duplicate state management across components
 * Provides centralized preview state with caching
 */

import React, { useState, useCallback, useRef } from 'react';
import { decodeCodeContent, formatCode } from '../utils/codeDecoder';
import { FilePreviewContext } from './FilePreviewContextObject';
import type { FilePreviewContextType, PreviewFile } from './FilePreviewContext.types';
export type { FilePreviewContextType, PreviewFile } from './FilePreviewContext.types';

interface FilePreviewProviderProps {
  children: React.ReactNode;
  maxCacheSize?: number;
  cacheTTL?: number; // Time to live in milliseconds
}

export const FilePreviewProvider: React.FC<FilePreviewProviderProps> = ({
  children,
  maxCacheSize = 15,
  cacheTTL = 10 * 60 * 1000 // 10 minutes
}) => {
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache management with real implementation
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
    console.log(`📁 Cache hit for: ${filePath}`);
    return cached;
  }, [cacheTTL]);

  const setCachedFile = useCallback((filePath: string, fileData: Omit<PreviewFile, 'timestamp'>) => {
    // Remove oldest entries if cache is full
    if (cache.current.size >= maxCacheSize) {
      const oldestKey = cache.current.keys().next().value;
      if (oldestKey) {
        cache.current.delete(oldestKey);
        console.log(`🗑️ Cache evicted: ${oldestKey}`);
      }
    }

    cache.current.set(filePath, {
      ...fileData,
      timestamp: Date.now()
    });

    console.log(`💾 Cached file: ${filePath} (${cache.current.size}/${maxCacheSize})`);
  }, [maxCacheSize]);

  const loadFileContent = async (filePath: string): Promise<PreviewFile> => {
    // Check cache first
    const cached = getCachedFile(filePath);
    if (cached) {
      return cached;
    }

    const fileName = filePath.split('/').pop() || filePath;
    
    try {
      console.log(`🔍 Loading file content: ${filePath}`);
      
      // Use correct backend endpoint with authentication
      const response = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load file`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load file content');
      }

      // Extract content from response
      const rawContent = data.content || data.data?.content || '';
      
      // Decode and format content
      const decoded = decodeCodeContent(rawContent, fileName);
      const content = decoded.success ? decoded.content : rawContent;
      const formattedContent = formatCode(content, decoded.language || getLanguageFromFileName(fileName));

      // Get file stats from response or defaults
      const fileData: Omit<PreviewFile, 'timestamp'> = {
        path: filePath,
        name: fileName,
        content: formattedContent,
        language: decoded.language || getLanguageFromFileName(fileName),
        size: data.size || data.data?.size || content.length,
        lastModified: data.lastModified || data.data?.lastModified || new Date().toISOString()
      };

      // Cache the result
      setCachedFile(filePath, fileData);

      console.log(`✅ File loaded: ${fileName}`);
      return { ...fileData, timestamp: Date.now() };

    } catch (error) {
      console.error('❌ Failed to load file:', error);
      throw error;
    }
  };

  const openPreview = useCallback(async (filePath: string) => {
    if (!filePath) return;

    setIsLoading(true);
    setError(null);
    setCurrentPreview(filePath);
    setIsPreviewOpen(true);

    try {
      // Load file content (uses cache if available)
      await loadFileContent(filePath);

      // Update preview history
      setPreviewHistory(prev => {
        const filtered = prev.filter(path => path !== filePath);
        return [filePath, ...filtered.slice(0, 9)]; // Keep last 10 items
      });

      console.log(`🔍 Opened file preview: ${filePath}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load file');
      console.error('❌ Preview error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setError(null);
    // Don't clear currentPreview immediately to allow for smooth animation
    setTimeout(() => {
      setCurrentPreview(null);
    }, 300);

    console.log('🔍 Closed file preview');
  }, []);

  const clearCache = useCallback(() => {
    cache.current.clear();
    cacheStats.current = { hits: 0, misses: 0 };
    console.log('🗑️ File preview cache cleared');
  }, []);

  // Helper function to get language from filename
  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sh': 'shell',
      'bash': 'shell',
      'sql': 'sql',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml'
    };

    return languageMap[ext] || 'plaintext';
  };

  const value: FilePreviewContextType = {
    // State
    currentPreview,
    isPreviewOpen,
    previewHistory,
    isLoading,
    error,
    
    // Actions
    openPreview,
    closePreview,
    clearCache,
    
    // Cache info
    cacheSize: cache.current.size,
    getCachedFile
  };

  return (
    <FilePreviewContext.Provider value={value}>
      {children}
    </FilePreviewContext.Provider>
  );
};

export default FilePreviewProvider;
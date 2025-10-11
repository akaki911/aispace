/**
 * Enhanced Search Service
 * Provides advanced search functionality with caching, fuzzy matching, and content search
 */

import {
  SearchResult,
  SearchOptions,
  ContentMatch,
  SearchMatch,
  fuzzyMatch,
  searchInText,
  filterAndSortResults,
  calculateRelevanceScore,
  generateSearchSuggestions
} from '../utils/searchAlgorithms';

interface SearchCache {
  query: string;
  type: string;
  results: SearchResult[];
  timestamp: number;
  options: SearchOptions;
}

interface SearchStats {
  totalQueries: number;
  cacheHits: number;
  averageResponseTime: number;
  popularQueries: string[];
}

export class EnhancedSearchService {
  private cache = new Map<string, SearchCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private searchHistory: string[] = [];
  private stats: SearchStats = {
    totalQueries: 0,
    cacheHits: 0,
    averageResponseTime: 0,
    popularQueries: []
  };
  private debouncedSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Main search function with caching and multiple search types
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    if (!query || query.trim().length === 0) {
      return [];
    }

    const normalizedQuery = query.trim();
    const cacheKey = this.generateCacheKey(normalizedQuery, options);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      console.log(`🔍 Cache hit for query: "${normalizedQuery}"`);
      return cached.results;
    }

    // Perform actual search
    const results = await this.performSearch(normalizedQuery, options);

    // Cache results
    this.setCache(cacheKey, {
      query: normalizedQuery,
      type: options.includeContent ? 'content' : 'name',
      results,
      timestamp: Date.now(),
      options
    });

    // Update statistics
    this.updateStats(normalizedQuery, Date.now() - startTime);

    return results;
  }

  /**
   * Debounced search for real-time search input
   */
  searchDebounced(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (this.debouncedSearchTimeout) {
      clearTimeout(this.debouncedSearchTimeout);
    }

    return new Promise((resolve, reject) => {
      this.debouncedSearchTimeout = setTimeout(async () => {
        try {
          const results = await this.performSearch(query, options);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, 300);
    });
  }

  /**
   * Perform the actual search using backend APIs
   */
  private async performSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      fuzzy = false,
      includeContent = false,
      regex = false,
      limit = 50,
      sortBy = 'relevance',
      threshold = 0.3,
      caseSensitive = false
    } = options;

    try {
      let endpoint = '/api/search/search';
      let searchType = 'name';

      // Determine search type
      if (includeContent) {
        searchType = 'all'; // Search both name and content
      } else if (fuzzy) {
        searchType = 'fuzzy';
      }

      const params = new URLSearchParams({
        q: query,
        type: searchType,
        limit: limit.toString(),
        fuzzy: fuzzy.toString(),
        threshold: threshold.toString(),
        sortBy,
        caseSensitive: caseSensitive.toString(),
        regex: regex.toString()
      });

      console.log(`🔍 Enhanced search request: ${endpoint}?${params.toString()}`);

      const response = await fetch(`${endpoint}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      // Transform backend results to frontend format
      const results = this.transformBackendResults(data.results || []);

      // Apply additional client-side filtering and sorting
      return filterAndSortResults(results, options);

    } catch (error) {
      console.error('❌ Enhanced search error:', error);
      
      // Fallback to basic search if enhanced search fails
      return await this.fallbackSearch(query, options);
    }
  }

  /**
   * Search by file name only
   */
  async searchByName(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: (options.limit || 50).toString(),
        fuzzy: (options.fuzzy || false).toString(),
        threshold: (options.threshold || 0.3).toString(),
        sortBy: options.sortBy || 'relevance'
      });

      const response = await fetch(`/api/search/search/name?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Name search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Name search failed');
      }

      return this.transformBackendResults(data.results || []);

    } catch (error) {
      console.error('❌ Name search error:', error);
      return [];
    }
  }

  /**
   * Search within file contents
   */
  async searchInContent(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: (options.limit || 50).toString(),
        caseSensitive: (options.caseSensitive || false).toString(),
        regex: (options.regex || false).toString()
      });

      const response = await fetch(`/api/search/search/content?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Content search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Content search failed');
      }

      return this.transformBackendResults(data.results || []);

    } catch (error) {
      console.error('❌ Content search error:', error);
      return [];
    }
  }

  /**
   * Filter files by criteria
   */
  async filterFiles(filters: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams();

      if (filters.fileTypes?.length) {
        params.append('extensions', filters.fileTypes.join(','));
      }
      if (filters.categories?.length) {
        params.append('categories', filters.categories.join(','));
      }
      if (filters.minSize !== undefined) {
        params.append('minSize', filters.minSize.toString());
      }
      if (filters.maxSize !== undefined) {
        params.append('maxSize', filters.maxSize.toString());
      }
      if (filters.modifiedAfter) {
        params.append('modifiedAfter', filters.modifiedAfter.toISOString());
      }
      if (filters.modifiedBefore) {
        params.append('modifiedBefore', filters.modifiedBefore.toISOString());
      }
      params.append('limit', (filters.limit || 100).toString());

      const response = await fetch(`/api/search/filter?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Filter failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Filter failed');
      }

      return this.transformBackendResults(data.results || []);

    } catch (error) {
      console.error('❌ Filter error:', error);
      return [];
    }
  }

  /**
   * Get recent files
   */
  async getRecentFiles(limit = 20): Promise<SearchResult[]> {
    try {
      const response = await fetch(`/api/search/recent?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Recent files failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Recent files failed');
      }

      return this.transformBackendResults(data.results || []);

    } catch (error) {
      console.error('❌ Recent files error:', error);
      return [];
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
    if (!query || query.length < 2) {
      return this.getPopularQueries(limit);
    }

    try {
      // Get file categories for suggestions
      const response = await fetch('/api/search/categories');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const suggestions = data.categories
            .filter((cat: any) => cat.name.toLowerCase().includes(query.toLowerCase()))
            .map((cat: any) => cat.name)
            .slice(0, limit);
          
          return suggestions;
        }
      }
    } catch (error) {
      console.warn('Failed to get search suggestions:', error);
    }

    // Fallback to search history
    return this.searchHistory
      .filter(historical => historical.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  /**
   * Get popular queries from history
   */
  getPopularQueries(limit = 5): string[] {
    const queryCount = new Map<string, number>();
    
    this.searchHistory.forEach(query => {
      queryCount.set(query, (queryCount.get(query) || 0) + 1);
    });

    return Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query]) => query);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Search cache cleared');
  }

  /**
   * Get search statistics
   */
  getStats(): SearchStats & { cacheSize: number } {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      popularQueries: this.getPopularQueries(10)
    };
  }

  /**
   * Transform backend results to frontend format
   */
  private transformBackendResults(backendResults: any[]): SearchResult[] {
    return backendResults.map(result => ({
      path: result.path || '',
      name: result.name || (result.path ? String(result.path).split('/').pop() || '' : ''),
      type: result.type || 'file',
      size: result.size || 0,
      lastModified: result.lastModified || new Date().toISOString(),
      category: result.category,
      score: result.score || 0,
      matches: result.matches || [],
      contentMatches: result.contentMatches || [],
      totalMatches: result.totalMatches || 0
    }));
  }

  /**
   * Fallback search using current API
   */
  private async fallbackSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      console.log('🔄 Falling back to basic search...');
      
      const response = await fetch(`/api/files/search?q=${encodeURIComponent(query)}&limit=${options.limit || 50}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Fallback search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        return data.map(result => ({
          path: result.file || '',
          name: result.file?.split('/').pop() || 'Unknown',
          type: this.getFileType(result.file || ''),
          size: 0,
          lastModified: new Date().toISOString(),
          score: 0.5,
          contentMatches: result.lines || []
        }));
      }

      return [];

    } catch (error) {
      console.error('❌ Fallback search failed:', error);
      return [];
    }
  }

  /**
   * Get file type from file path
   */
  private getFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'css': 'stylesheet',
      'html': 'markup',
      'json': 'data',
      'md': 'documentation',
      'txt': 'text'
    };

    return typeMap[extension || ''] || 'file';
  }

  /**
   * Generate cache key for query and options
   */
  private generateCacheKey(query: string, options: SearchOptions): string {
    const optionsKey = JSON.stringify({
      fuzzy: options.fuzzy,
      includeContent: options.includeContent,
      regex: options.regex,
      caseSensitive: options.caseSensitive,
      fileTypes: options.fileTypes?.sort(),
      categories: options.categories?.sort(),
      sortBy: options.sortBy
    });
    
    return `${query}:${optionsKey}`;
  }

  /**
   * Get results from cache
   */
  private getFromCache(key: string): SearchCache | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Set cache with size limit
   */
  private setCache(key: string, value: SearchCache): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const iterator = this.cache.keys().next();
      if (!iterator.done && typeof iterator.value === 'string') {
        this.cache.delete(iterator.value);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Update search statistics
   */
  private updateStats(query: string, responseTime: number): void {
    this.stats.totalQueries++;
    
    // Update average response time
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.totalQueries - 1) + responseTime) / this.stats.totalQueries;

    // Add to search history
    this.searchHistory.unshift(query);
    
    // Keep only last 100 searches
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(0, 100);
    }

    // Remove duplicates from history while preserving order
    this.searchHistory = [...new Set(this.searchHistory)];
  }
}

// Export singleton instance
export const enhancedSearchService = new EnhancedSearchService();
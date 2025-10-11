/**
 * Advanced Search Algorithms for File Tree Search
 * Supports fuzzy matching, content search, and filtering with Georgian text support
 */

export interface SearchMatch {
  start: number;
  end: number;
  score: number;
}

export interface SearchResult {
  path: string;
  name: string;
  type: string;
  size: number;
  lastModified: string;
  category?: string;
  score: number;
  matches?: SearchMatch[];
  contentMatches?: ContentMatch[];
  totalMatches?: number;
}

export interface ContentMatch {
  lineNumber: number;
  line: string;
  matches: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  context?: string[];
  contextStart?: number;
}

export interface SearchOptions {
  fuzzy?: boolean;
  threshold?: number;
  caseSensitive?: boolean;
  regex?: boolean;
  limit?: number;
  sortBy?: 'relevance' | 'name' | 'size' | 'date';
  includeContent?: boolean;
  fileTypes?: string[];
  categories?: string[];
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

/**
 * Georgian text detection utility
 */
export const isGeorgianText = (text: string): boolean => {
  const georgianPattern = /[\u10A0-\u10FF]/;
  return georgianPattern.test(text);
};

/**
 * Normalize text for search (handles Georgian and other Unicode)
 */
export const normalizeText = (text: string, caseSensitive = false): string => {
  if (!text) return '';
  
  // Normalize Unicode characters
  const normalized = text.normalize('NFD');
  
  // Apply case sensitivity
  return caseSensitive ? normalized : normalized.toLowerCase();
};

/**
 * Advanced fuzzy matching algorithm
 * Uses Levenshtein distance with scoring
 */
export const fuzzyMatch = (
  query: string, 
  text: string, 
  threshold = 0.3
): { isMatch: boolean; score: number; matches: SearchMatch[] } => {
  if (!query || !text) {
    return { isMatch: false, score: 0, matches: [] };
  }

  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);

  // Exact match gets highest score
  if (normalizedText === normalizedQuery) {
    return {
      isMatch: true,
      score: 1.0,
      matches: [{ start: 0, end: text.length, score: 1.0 }]
    };
  }

  // Substring match gets high score
  const substringIndex = normalizedText.indexOf(normalizedQuery);
  if (substringIndex !== -1) {
    return {
      isMatch: true,
      score: 0.9,
      matches: [{
        start: substringIndex,
        end: substringIndex + normalizedQuery.length,
        score: 0.9
      }]
    };
  }

  // Calculate edit distance for fuzzy matching
  const score = calculateFuzzyScore(normalizedQuery, normalizedText);
  const isMatch = score >= threshold;

  return {
    isMatch,
    score,
    matches: isMatch ? findFuzzyMatches(normalizedQuery, normalizedText) : []
  };
};

/**
 * Calculate fuzzy score using optimized Levenshtein distance
 */
export const calculateFuzzyScore = (query: string, text: string): number => {
  const queryLen = query.length;
  const textLen = text.length;

  if (queryLen === 0) return textLen === 0 ? 1 : 0;
  if (textLen === 0) return 0;

  // Optimize for short queries
  if (queryLen > textLen * 2) return 0;

  // Use rolling array optimization for memory efficiency
  let previousRow = Array(textLen + 1).fill(0).map((_, i) => i);
  
  for (let i = 1; i <= queryLen; i++) {
    const currentRow = [i];
    
    for (let j = 1; j <= textLen; j++) {
      const cost = query[i - 1] === text[j - 1] ? 0 : 1;
      const deletion = previousRow[j] + 1;
      const insertion = currentRow[j - 1] + 1;
      const substitution = previousRow[j - 1] + cost;
      
      currentRow[j] = Math.min(deletion, insertion, substitution);
    }
    
    previousRow = currentRow;
  }

  const editDistance = previousRow[textLen];
  const maxLength = Math.max(queryLen, textLen);
  return 1 - (editDistance / maxLength);
};

/**
 * Find fuzzy match positions for highlighting
 */
export const findFuzzyMatches = (query: string, text: string): SearchMatch[] => {
  const matches: SearchMatch[] = [];
  let queryIndex = 0;
  let startIndex = -1;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      if (startIndex === -1) startIndex = i;
      queryIndex++;
      
      if (queryIndex === query.length) {
        matches.push({ 
          start: startIndex, 
          end: i + 1, 
          score: query.length / (i - startIndex + 1) 
        });
        queryIndex = 0;
        startIndex = -1;
      }
    }
  }

  return matches;
};

/**
 * Search within text content using various algorithms
 */
export const searchInText = (
  query: string,
  content: string,
  options: SearchOptions = {}
): ContentMatch[] => {
  const {
    caseSensitive = false,
    regex = false,
    fuzzy = false,
    threshold = 0.3
  } = options;

  const matches: ContentMatch[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineMatches: Array<{ start: number; end: number; text: string }> = [];

    if (regex) {
      try {
        const pattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
        const regexMatches = [...line.matchAll(pattern)];
        lineMatches = regexMatches.map(match => ({
          start: match.index!,
          end: match.index! + match[0].length,
          text: match[0]
        }));
      } catch (e) {
        // Invalid regex, skip
        continue;
      }
    } else if (fuzzy) {
      const fuzzyResult = fuzzyMatch(query, line, threshold);
      if (fuzzyResult.isMatch) {
        lineMatches = fuzzyResult.matches.map(match => ({
          start: match.start,
          end: match.end,
          text: line.substring(match.start, match.end)
        }));
      }
    } else {
      // Simple substring search
      const normalizedQuery = normalizeText(query, caseSensitive);
      const normalizedLine = normalizeText(line, caseSensitive);
      
      const index = normalizedLine.indexOf(normalizedQuery);
      if (index !== -1) {
        lineMatches = [{
          start: index,
          end: index + query.length,
          text: line.substring(index, index + query.length)
        }];
      }
    }

    if (lineMatches.length > 0) {
      matches.push({
        lineNumber: i + 1,
        line: line.trim(),
        matches: lineMatches
      });
    }
  }

  return matches;
};

/**
 * Filter and sort search results
 */
export const filterAndSortResults = (
  results: SearchResult[],
  options: SearchOptions = {}
): SearchResult[] => {
  const {
    fileTypes = [],
    categories = [],
    minSize = 0,
    maxSize = Infinity,
    modifiedAfter,
    modifiedBefore,
    sortBy = 'relevance',
    limit = 50
  } = options;

  let filtered = results.filter(result => {
    // File type filter
    if (fileTypes.length > 0) {
      const extension = result.path.split('.').pop()?.toLowerCase();
      if (!extension || !fileTypes.includes(`.${extension}`)) {
        return false;
      }
    }

    // Category filter
    if (categories.length > 0 && result.category) {
      if (!categories.includes(result.category)) {
        return false;
      }
    }

    // Size filter
    if (result.size < minSize || result.size > maxSize) {
      return false;
    }

    // Date filter
    if (modifiedAfter || modifiedBefore) {
      const fileDate = new Date(result.lastModified);
      if (modifiedAfter && fileDate < modifiedAfter) return false;
      if (modifiedBefore && fileDate > modifiedBefore) return false;
    }

    return true;
  });

  // Sort results
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return b.size - a.size;
      case 'date':
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      case 'relevance':
      default:
        // Sort by score, then by name as tiebreaker
        const scoreDiff = (b.score || 0) - (a.score || 0);
        return scoreDiff !== 0 ? scoreDiff : a.name.localeCompare(b.name);
    }
  });

  return filtered.slice(0, limit);
};

/**
 * Highlight text matches in search results
 */
export const highlightMatches = (
  text: string,
  matches: SearchMatch[],
  className = 'search-highlight'
): string => {
  if (!matches || matches.length === 0) {
    return text;
  }

  // Sort matches by start position
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
  
  let highlighted = '';
  let lastIndex = 0;

  for (const match of sortedMatches) {
    // Add text before match
    highlighted += text.substring(lastIndex, match.start);
    
    // Add highlighted match
    highlighted += `<span class="${className}">${text.substring(match.start, match.end)}</span>`;
    
    lastIndex = match.end;
  }

  // Add remaining text
  highlighted += text.substring(lastIndex);

  return highlighted;
};

/**
 * Debounce function for search input
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Generate search suggestions based on file structure
 */
export const generateSearchSuggestions = (
  query: string,
  fileStructure: SearchResult[],
  limit = 5
): string[] => {
  if (!query || query.length < 2) return [];

  const suggestions = new Set<string>();
  const normalizedQuery = normalizeText(query);

  // Extract file names and path segments
  fileStructure.forEach(file => {
    const fileName = file.name.toLowerCase();
    const pathSegments = file.path.toLowerCase().split('/');

    // Add file name if it starts with query
    if (fileName.startsWith(normalizedQuery)) {
      suggestions.add(file.name);
    }

    // Add path segments that start with query
    pathSegments.forEach(segment => {
      if (segment.startsWith(normalizedQuery) && segment !== normalizedQuery) {
        suggestions.add(segment);
      }
    });

    // Add extension-based suggestions
    const extension = file.path.split('.').pop();
    if (extension && normalizedQuery.includes('.')) {
      const queryExt = normalizedQuery.split('.').pop();
      if (extension.startsWith(queryExt || '')) {
        suggestions.add(`.${extension}`);
      }
    }
  });

  return Array.from(suggestions).slice(0, limit);
};

/**
 * Calculate relevance score for search results
 */
export const calculateRelevanceScore = (
  query: string,
  result: SearchResult,
  options: SearchOptions = {}
): number => {
  const { fuzzy = false, threshold = 0.3 } = options;
  let score = 0;

  // File name match (highest priority)
  const nameMatch = fuzzy 
    ? fuzzyMatch(query, result.name, threshold)
    : { isMatch: result.name.toLowerCase().includes(query.toLowerCase()), score: 0.8 };
    
  if (nameMatch.isMatch) {
    score += nameMatch.score * 0.6;
  }

  // Path match (medium priority)
  const pathMatch = fuzzy
    ? fuzzyMatch(query, result.path, threshold)
    : { isMatch: result.path.toLowerCase().includes(query.toLowerCase()), score: 0.6 };
    
  if (pathMatch.isMatch) {
    score += pathMatch.score * 0.3;
  }

  // Content matches (lower priority but can add up)
  if (result.contentMatches && result.contentMatches.length > 0) {
    const contentScore = Math.min(result.contentMatches.length * 0.1, 0.4);
    score += contentScore;
  }

  // File type bonus (small boost for common file types)
  const commonExtensions = ['.js', '.tsx', '.jsx', '.ts', '.css', '.html', '.json', '.md'];
  const extension = result.path.split('.').pop();
  if (extension && commonExtensions.includes(`.${extension}`)) {
    score += 0.05;
  }

  // Recently modified bonus
  const daysSinceModified = (Date.now() - new Date(result.lastModified).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceModified < 7) {
    score += 0.1 * (7 - daysSinceModified) / 7;
  }

  return Math.min(score, 1.0); // Cap at 1.0
};
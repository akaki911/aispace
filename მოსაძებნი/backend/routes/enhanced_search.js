const express = require('express');
const advancedSearchService = require('../services/advancedSearchService');
const router = express.Router();

console.log('🔍 Enhanced search routes loading...');

/**
 * Advanced file search endpoint
 * Supports fuzzy search, content search, and filtering
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q: query,
      type = 'name', // name, content, fuzzy, all
      limit = 50,
      fuzzy = 'true',
      threshold = 0.3,
      sortBy = 'relevance',
      caseSensitive = 'false',
      regex = 'false'
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const options = {
      limit: parseInt(limit),
      fuzzy: fuzzy === 'true',
      threshold: parseFloat(threshold),
      sortBy,
      caseSensitive: caseSensitive === 'true',
      regex: regex === 'true'
    };

    let results = [];
    const startTime = Date.now();

    switch (type) {
      case 'content':
        results = await advancedSearchService.searchInContent(query, options);
        break;
      case 'fuzzy':
        options.fuzzy = true;
        results = await advancedSearchService.searchByName(query, options);
        break;
      case 'all':
        // Search both name and content
        const nameResults = await advancedSearchService.searchByName(query, { ...options, limit: Math.ceil(limit / 2) });
        const contentResults = await advancedSearchService.searchInContent(query, { ...options, limit: Math.ceil(limit / 2) });
        results = [...nameResults, ...contentResults];
        // Sort combined results
        advancedSearchService.sortResults(results, sortBy);
        results = results.slice(0, parseInt(limit));
        break;
      case 'name':
      default:
        results = await advancedSearchService.searchByName(query, options);
        break;
    }

    const searchTime = Date.now() - startTime;

    console.log(`🔍 Enhanced search completed: "${query}" (${type}) - ${results.length} results in ${searchTime}ms`);

    res.json({
      success: true,
      query,
      type,
      results,
      total: results.length,
      searchTime,
      options
    });

  } catch (error) {
    console.error('❌ Enhanced search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * File name search with fuzzy matching
 */
router.get('/search/name', async (req, res) => {
  try {
    const {
      q: query,
      limit = 50,
      fuzzy = 'true',
      threshold = 0.3,
      sortBy = 'relevance'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const results = await advancedSearchService.searchByName(query, {
      limit: parseInt(limit),
      fuzzy: fuzzy === 'true',
      threshold: parseFloat(threshold),
      sortBy
    });

    res.json({
      success: true,
      query,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('❌ Name search error:', error);
    res.status(500).json({
      success: false,
      error: 'Name search failed',
      message: error.message
    });
  }
});

/**
 * Content search within files
 */
router.get('/search/content', async (req, res) => {
  try {
    const {
      q: query,
      limit = 50,
      maxFileSize = 1048576, // 1MB
      contextLines = 2,
      caseSensitive = 'false',
      regex = 'false'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    const results = await advancedSearchService.searchInContent(query, {
      limit: parseInt(limit),
      maxFileSize: parseInt(maxFileSize),
      contextLines: parseInt(contextLines),
      caseSensitive: caseSensitive === 'true',
      regex: regex === 'true'
    });

    res.json({
      success: true,
      query,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('❌ Content search error:', error);
    res.status(500).json({
      success: false,
      error: 'Content search failed',
      message: error.message
    });
  }
});

/**
 * Filter files by various criteria
 */
router.get('/filter', async (req, res) => {
  try {
    const {
      extensions,
      categories,
      minSize = 0,
      maxSize,
      modifiedAfter,
      modifiedBefore,
      limit = 100
    } = req.query;

    const filters = {
      extensions: extensions ? extensions.split(',').map(ext => ext.trim()) : [],
      categories: categories ? categories.split(',').map(cat => cat.trim()) : [],
      minSize: parseInt(minSize),
      maxSize: maxSize ? parseInt(maxSize) : Infinity,
      modifiedAfter: modifiedAfter ? new Date(modifiedAfter) : null,
      modifiedBefore: modifiedBefore ? new Date(modifiedBefore) : null,
      limit: parseInt(limit)
    };

    const results = await advancedSearchService.filterFiles(filters);

    res.json({
      success: true,
      filters,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('❌ Filter error:', error);
    res.status(500).json({
      success: false,
      error: 'Filter failed',
      message: error.message
    });
  }
});

/**
 * Get recent files
 */
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const results = await advancedSearchService.getRecentFiles(parseInt(limit));

    res.json({
      success: true,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('❌ Recent files error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent files',
      message: error.message
    });
  }
});

/**
 * Get search statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = advancedSearchService.getStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

/**
 * Rebuild search index
 */
router.post('/index/rebuild', async (req, res) => {
  try {
    console.log('🔄 Rebuilding search index...');
    await advancedSearchService.clearCache();
    await advancedSearchService.buildFileIndex();
    
    const stats = advancedSearchService.getStats();

    res.json({
      success: true,
      message: 'Search index rebuilt successfully',
      stats
    });

  } catch (error) {
    console.error('❌ Index rebuild error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rebuild index',
      message: error.message
    });
  }
});

/**
 * Clear search cache
 */
router.delete('/cache', async (req, res) => {
  try {
    advancedSearchService.clearCache();

    res.json({
      success: true,
      message: 'Search cache cleared successfully'
    });

  } catch (error) {
    console.error('❌ Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * Get file categories
 */
router.get('/categories', async (req, res) => {
  try {
    const stats = advancedSearchService.getStats();
    const categories = Object.keys(stats.categories).map(category => ({
      name: category,
      count: stats.categories[category]
    }));

    res.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('❌ Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
      message: error.message
    });
  }
});

console.log('✅ Enhanced search routes loaded');

module.exports = router;
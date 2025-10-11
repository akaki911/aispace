const express = require('express');
const performanceMonitor = require('../services/performance_monitoring');
const aiCacheService = require('../services/ai_cache_service');
const streamingService = require('../services/streaming_service');
const router = express.Router();

// Get real-time performance metrics
router.get('/realtime', (req, res) => {
  try {
    const metrics = performanceMonitor.getRealTimeMetrics();
    const cacheStats = aiCacheService.getCacheStats();
    const activeStreams = streamingService.getActiveStreams();

    res.json({
      metrics,
      cache: cacheStats,
      streams: {
        active: activeStreams.length,
        details: activeStreams
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// Get detailed performance statistics
router.get('/stats', (req, res) => {
  try {
    const timeframe = parseInt(req.query.timeframe) || 3600000; // Default 1 hour
    const stats = performanceMonitor.getStats(timeframe);

    res.json({
      stats,
      cache: aiCacheService.getCacheStats(),
      timeframe: timeframe,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Performance stats error:', error);
    res.status(500).json({ error: 'Failed to get performance stats' });
  }
});

// Export all metrics for external monitoring
router.get('/export', (req, res) => {
  try {
    // Check if user is Super Admin
    const personalId = req.query.personalId;
    if (personalId !== '01019062020') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exportData = performanceMonitor.exportMetrics();
    const cacheStats = aiCacheService.getCacheStats();

    res.json({
      performance: exportData,
      cache: cacheStats,
      exportedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Performance export error:', error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

// Clear cache endpoint
router.post('/cache/clear', (req, res) => {
  try {
    const { personalId } = req.body;

    // Check if user is Super Admin
    if (personalId !== '01019062020') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetUserId = req.body.targetUserId || personalId;
    const success = aiCacheService.clearUserCache(targetUserId);

    res.json({
      success,
      message: success ? `Cache cleared for user ${targetUserId}` : 'Failed to clear cache',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
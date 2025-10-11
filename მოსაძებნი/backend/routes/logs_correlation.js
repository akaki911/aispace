
const express = require('express');
const router = express.Router();
const { getCurrentCorrelationId, logWithCorrelation } = require('../middleware/correlation_middleware');

// Get logs by correlation ID
router.get('/correlation/:correlationId', async (req, res) => {
  try {
    const { correlationId } = req.params;
    
    logWithCorrelation(req, 'info', 'LogsCorrelation', `Fetching logs for correlation ID: ${correlationId}`);
    
    // In a real implementation, you would query your logging database
    // For now, we'll return a mock response indicating the structure
    const logs = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        service: 'frontend',
        level: 'info',
        component: 'AutoImprove',
        message: 'User clicked approve proposal',
        correlationId,
        details: {
          proposalId: 'prop-123',
          userId: 'user-456'
        }
      },
      {
        id: '2',
        timestamp: new Date().toISOString(),
        service: 'backend',
        level: 'info',
        component: 'AutoImprove',
        message: 'Processing proposal approval',
        correlationId,
        details: {
          proposalId: 'prop-123',
          status: 'processing'
        }
      },
      {
        id: '3',
        timestamp: new Date().toISOString(),
        service: 'backend',
        level: 'info',
        component: 'AutoImprove',
        message: 'Generating code improvements',
        correlationId,
        details: {
          modelUsed: 'llama-3.3-70b-versatile',
          tokensUsed: 1542
        }
      }
    ];
    
    res.json({
      success: true,
      correlationId,
      logs,
      totalCount: logs.length,
      services: ['frontend', 'backend'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithCorrelation(req, 'error', 'LogsCorrelation', 'Failed to fetch correlation logs', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch correlation logs',
      message: error.message,
      correlationId: getCurrentCorrelationId(req),
      timestamp: new Date().toISOString()
    });
  }
});

// Get correlation ID statistics
router.get('/correlation/:correlationId/stats', async (req, res) => {
  try {
    const { correlationId } = req.params;
    
    logWithCorrelation(req, 'info', 'LogsCorrelation', `Fetching stats for correlation ID: ${correlationId}`);
    
    // Mock stats - in real implementation, aggregate from your logging system
    const stats = {
      correlationId,
      totalLogs: 3,
      services: {
        frontend: { count: 1, levels: { info: 1 } },
        backend: { count: 2, levels: { info: 2 } }
      },
      timeline: {
        start: new Date(Date.now() - 5000).toISOString(),
        end: new Date().toISOString(),
        duration: '5.2s'
      },
      status: 'completed'
    };
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithCorrelation(req, 'error', 'LogsCorrelation', 'Failed to fetch correlation stats', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch correlation stats',
      message: error.message,
      correlationId: getCurrentCorrelationId(req),
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

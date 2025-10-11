/**
 * Replit-style AI Assistant Integration
 * Based on SOL-210 Architecture Document
 * 
 * Main endpoint for Replit-style AI interactions
 */

const express = require('express');
const { ToolRegistry } = require('../core/tool_registry');

// SOL-211: Import security middleware
const { 
  requireAssistantAuth, 
  requireRole, 
  assistantRateLimit,
  securityHeaders,
  auditLog 
} = require('../middleware/authz');
const { 
  requestTimeout,
  validatePayloadSize,
  validateAssistantRequest,
  validateToolRequest,
  validateContentType 
} = require('../middleware/validate');

const router = express.Router();
const toolRegistry = new ToolRegistry();

// SOL-211: Apply security middleware to all routes
router.use(securityHeaders);
router.use(auditLog);
router.use(requestTimeout(10000)); // 10s timeout
router.use(validatePayloadSize(1024 * 1024)); // 1MB max

/**
 * Main Replit Assistant endpoint
 * SOL-211: Enhanced with auth, validation, and rate limiting
 */
router.post('/replit-assistant', 
  requireAssistantAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  assistantRateLimit(),
  validateContentType,
  validateAssistantRequest,
  async (req, res) => {
  const startTime = Date.now();
  const { userRequest, context = {}, options = {} } = req.validatedBody || req.body;

  if (!userRequest) {
    return res.status(400).json({
      success: false,
      error: 'User request is required',
      timestamp: new Date().toISOString()
    });
  }

  console.log(`🤖 [REPLIT_ASSISTANT] Processing request: "${userRequest}"`);

  try {
    // Process request using Tool Registry
    const result = await toolRegistry.processRequest(userRequest, {
      ...context,
      userId: context.userId || 'anonymous',
      sessionId: context.sessionId || Date.now().toString(36),
      timestamp: new Date().toISOString()
    });

    const executionTime = Date.now() - startTime;

    // Return structured response
    res.json({
      ...result,
      executionTime,
      api: 'replit-assistant',
      version: '1.0.0'
    });

    console.log(`🤖 [REPLIT_ASSISTANT] ${result.success ? 'SUCCESS' : 'FAILED'} in ${executionTime}ms`);

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error(`❌ [REPLIT_ASSISTANT] Error: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: error.message,
      userRequest,
      executionTime,
      timestamp: new Date().toISOString(),
      api: 'replit-assistant'
    });
  }
});

/**
 * Tool execution endpoint for direct tool calls
 * SOL-211: Enhanced with auth and validation
 */
router.post('/tool/:toolName',
  requireAssistantAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  assistantRateLimit(),
  validateContentType,
  validateToolRequest(toolRegistry),
  async (req, res) => {
  const { toolName } = req.validatedParams || req.params;
  const { inputs, options = {} } = req.validatedBody || req.body;

  console.log(`🔧 [TOOL_EXEC] Direct tool call: ${toolName}`);

  try {
    const result = await toolRegistry.executeTool(toolName, inputs, options);
    
    res.json({
      ...result,
      api: 'tool-execution'
    });

  } catch (error) {
    console.error(`❌ [TOOL_EXEC] Error: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: error.message,
      tool: toolName,
      timestamp: new Date().toISOString(),
      api: 'tool-execution'
    });
  }
});

/**
 * Get available tools
 * SOL-211: Public endpoint with basic auth
 */
router.get('/tools',
  requireAssistantAuth,
  (req, res) => {
  const tools = toolRegistry.getAvailableTools();
  
  res.json({
    success: true,
    tools,
    count: tools.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get tool statistics
 * SOL-211: Admin only endpoint
 */
router.get('/stats',
  requireAssistantAuth,
  requireRole(['SUPER_ADMIN']),
  (req, res) => {
  const stats = toolRegistry.getToolStatistics();
  
  res.json({
    success: true,
    statistics: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * Health check for assistant
 * SOL-211: Enhanced with proper structure
 */
router.get('/health', async (req, res) => {
  try {
    const health = await toolRegistry.performHealthCheck();
    const stats = toolRegistry.getCacheStats();
    
    res.json({
      success: true,
      healthy: health.healthy,
      tools: toolRegistry.getAvailableTools(),
      uptime: process.uptime(),
      cacheStats: stats,
      api: 'replit-assistant',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness check for assistant
 * SOL-211: New readiness endpoint
 */
router.get('/ready', async (req, res) => {
  try {
    const health = await toolRegistry.performHealthCheck();
    
    if (health.healthy) {
      res.status(200).json({
        ready: true,
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        ready: false,
        status: 'not_ready',
        issues: health.tools.filter(t => t.status !== 'healthy'),
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Restore from backup endpoint
 * SOL-211: New restore functionality
 */
router.post('/restore',
  requireAssistantAuth,
  requireRole(['SUPER_ADMIN']),
  validateContentType,
  async (req, res) => {
    try {
      const { backupId } = req.body;
      
      if (!backupId) {
        return res.status(400).json({
          error: 'Backup ID required',
          timestamp: new Date().toISOString()
        });
      }

      // Get strict patch mode instance
      const { StrictPatchMode } = require('../tools/strict_patch_mode');
      const patchMode = new StrictPatchMode();
      
      const result = await patchMode.restoreFromBackupId(backupId);
      
      res.json({
        success: true,
        ...result,
        api: 'replit-assistant'
      });

    } catch (error) {
      console.error('❌ [RESTORE] Error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * List available backups
 * SOL-211: New backup listing endpoint
 */
router.get('/backups',
  requireAssistantAuth,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  async (req, res) => {
    try {
      const { StrictPatchMode } = require('../tools/strict_patch_mode');
      const patchMode = new StrictPatchMode();
      
      const backups = await patchMode.listBackups();
      
      res.json({
        success: true,
        backups,
        count: backups.length,
        api: 'replit-assistant',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [BACKUPS] Error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
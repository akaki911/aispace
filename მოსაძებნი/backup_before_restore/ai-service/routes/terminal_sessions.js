/**
 * Terminal Session API Routes
 * Handles multi-tab terminal session management with real-time streaming
 */

const express = require('express');
const { terminalService } = require('../services/terminal_service');
const router = express.Router();

// Store active SSE connections for each session
const sessionConnections = new Map(); // sessionId -> Set of response objects

/**
 * GET /api/terminal/sessions
 * List all terminal sessions for the current user
 */
router.get('/sessions', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const sessions = terminalService.getUserSessions(userId);
    
    console.log(`📋 [TERMINAL API] Listing ${sessions.length} sessions for user ${userId}`);
    
    res.json({
      success: true,
      sessions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list terminal sessions',
      message: error.message
    });
  }
});

/**
 * POST /api/terminal/sessions
 * Create a new terminal session
 */
router.post('/sessions', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { name, workingDirectory } = req.body;
    
    // Generate unique session ID
    const sessionId = `terminal_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = terminalService.createSession(sessionId, userId, name || 'Terminal', {
      workingDirectory: workingDirectory || process.cwd()
    });
    
    console.log(`✨ [TERMINAL API] Created session ${sessionId} for user ${userId}`);
    
    res.json({
      success: true,
      session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create terminal session',
      message: error.message
    });
  }
});

/**
 * GET /api/terminal/sessions/:sessionId
 * Get terminal session details and recent output
 */
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = terminalService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }
    
    console.log(`📖 [TERMINAL API] Retrieved session ${sessionId}`);
    
    res.json({
      success: true,
      session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get terminal session',
      message: error.message
    });
  }
});

/**
 * DELETE /api/terminal/sessions/:sessionId
 * Destroy a terminal session
 */
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = terminalService.destroySession(sessionId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }
    
    // Close any active SSE connections for this session
    if (sessionConnections.has(sessionId)) {
      const connections = sessionConnections.get(sessionId);
      connections.forEach(connection => {
        try {
          connection.write(`data: ${JSON.stringify({ type: 'session_terminated' })}\n\n`);
          connection.end();
        } catch (writeError) {
          console.warn('⚠️ [TERMINAL API] Failed to send termination message:', writeError.message);
        }
      });
      sessionConnections.delete(sessionId);
    }
    
    console.log(`🗑️ [TERMINAL API] Destroyed session ${sessionId}`);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error destroying session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to destroy terminal session',
      message: error.message
    });
  }
});

/**
 * POST /api/terminal/sessions/:sessionId/execute
 * Execute a command in a terminal session - returns JSON immediately, real-time updates via /stream
 */
router.post('/sessions/:sessionId/execute', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { command, safetyConfirmed = false } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required'
      });
    }
    
    const session = terminalService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }
    
    console.log(`⚡ [TERMINAL API] Executing command in session ${sessionId}: ${command}`);
    
    try {
      // Execute command - events will be broadcast to session listeners via EventEmitter
      const result = await terminalService.executeCommandInSession(
        sessionId,
        command,
        { safetyConfirmed } // Pass safety confirmation to terminal service
      );
      
      // Return immediate JSON response - real-time updates go via /stream EventSource
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (commandError) {
      console.error(`❌ [TERMINAL API] Command execution failed in session ${sessionId}:`, commandError.message);
      
      // Return error response
      const statusCode = commandError.message.includes('requires safety confirmation') ? 422 : 400;
      res.status(statusCode).json({
        success: false,
        error: commandError.message,
        requiresSafety: commandError.message.includes('requires safety confirmation'),
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ [TERMINAL API] Error executing command:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute command',
      message: error.message
    });
  }
});

/**
 * GET /api/terminal/sessions/:sessionId/stream
 * Connect to real-time terminal session output stream with event broadcasting
 */
router.get('/sessions/:sessionId/stream', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = terminalService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }
    
    console.log(`🔌 [TERMINAL API] SSE connection established for session ${sessionId}`);
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Track this connection
    if (!sessionConnections.has(sessionId)) {
      sessionConnections.set(sessionId, new Set());
    }
    sessionConnections.get(sessionId).add(res);
    
    // Send initial connection confirmation and recent output
    res.write(`data: ${JSON.stringify({
      type: 'connection_established',
      sessionId,
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        workingDirectory: session.workingDirectory
      },
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // Send recent output history
    session.output.forEach(outputEntry => {
      res.write(`data: ${JSON.stringify({
        type: 'history_output',
        outputType: outputEntry.type,
        data: outputEntry.content,
        timestamp: outputEntry.timestamp
      })}\n\n`);
    });
    
    // Listen for real-time events from TerminalService for this session
    const eventHandler = (eventData) => {
      // Only forward events for this specific session
      if (eventData.sessionId === sessionId && !res.writableEnded) {
        try {
          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        } catch (writeError) {
          console.warn(`⚠️ [TERMINAL API] Failed to write SSE data for session ${sessionId}:`, writeError.message);
        }
      }
    };
    
    // Subscribe to session events
    terminalService.on('session_output', eventHandler);
    
    // Handle client disconnect
    const cleanup = () => {
      console.log(`🔌 [TERMINAL API] SSE connection closed for session ${sessionId}`);
      
      // Remove event listener
      terminalService.removeListener('session_output', eventHandler);
      
      // Remove from session connections
      if (sessionConnections.has(sessionId)) {
        sessionConnections.get(sessionId).delete(res);
        if (sessionConnections.get(sessionId).size === 0) {
          sessionConnections.delete(sessionId);
        }
      }
      
      // Clear heartbeat
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    };
    
    req.on('close', cleanup);
    req.on('aborted', cleanup);
    
    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000); // 30 second heartbeat
    
  } catch (error) {
    console.error('❌ [TERMINAL API] Error establishing SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to establish terminal stream',
        message: error.message
      });
    }
  }
});

/**
 * PUT /api/terminal/sessions/:sessionId
 * Update terminal session properties
 */
router.put('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, workingDirectory } = req.body;
    
    const session = terminalService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }
    
    // Update session properties
    if (name) session.name = name;
    if (workingDirectory) session.workingDirectory = workingDirectory;
    
    terminalService.updateSessionActivity(sessionId);
    
    console.log(`📝 [TERMINAL API] Updated session ${sessionId}`);
    
    res.json({
      success: true,
      session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error updating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update terminal session',
      message: error.message
    });
  }
});

module.exports = router;
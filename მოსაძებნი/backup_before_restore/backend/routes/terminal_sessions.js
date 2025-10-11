
const express = require('express');
const router = express.Router();

// Terminal sessions store (in-memory for simplicity)
const terminalSessions = new Map();
const activeSSEConnections = new Map(); // sessionId -> Set of SSE responses
let sessionCounter = 1;

// 📋 Get all terminal sessions
router.get('/sessions', (req, res) => {
  try {
    console.log('🔍 [TERMINAL API] GET /sessions requested');
    
    const sessions = Array.from(terminalSessions.values()).map(session => ({
      id: session.id,
      name: session.name,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      output: Array.isArray(session.output) ? session.output : [],
      history: Array.isArray(session.history) ? session.history : [],
      workingDirectory: session.workingDirectory || '/home/runner/workspace'
    }));

    console.log(`✅ [TERMINAL API] Returning ${sessions.length} sessions`);
    res.json({
      success: true,
      sessions: sessions
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get terminal sessions'
    });
  }
});

// 🆕 Create new terminal session
router.post('/sessions', (req, res) => {
  try {
    const { name } = req.body;
    console.log('🔧 [TERMINAL API] Creating new session:', name);

    const sessionId = `terminal_${sessionCounter++}`;
    const session = {
      id: sessionId,
      name: name || `Terminal ${sessionCounter - 1}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      output: [],
      history: [],
      workingDirectory: '/home/runner/workspace',
      userId: 'dev-user',
      environment: {}
    };

    terminalSessions.set(sessionId, session);

    console.log(`✅ [TERMINAL API] Session created: ${sessionId}`);
    res.json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        createdAt: session.createdAt
      }
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create terminal session'
    });
  }
});

// 📤 Execute command in terminal session
router.post('/sessions/:sessionId/execute', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { command } = req.body;

    console.log(`🚀 [TERMINAL API] Executing command in ${sessionId}:`, command);

    const session = terminalSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }

    // Simple command simulation
    let output = '';
    let outputType = 'stdout';
    
    switch (command.trim()) {
      case 'pwd':
        output = session.cwd + '\n';
        break;
      case 'ls':
        output = 'src  backend  ai-service  package.json  README.md\n';
        break;
      case 'ls -la':
        output = `total 64
drwxr-xr-x  8 runner runner  4096 Jan 12 19:30 .
drwxr-xr-x  3 runner runner  4096 Jan 12 19:30 ..
drwxr-xr-x  3 runner runner  4096 Jan 12 19:30 ai-service
drwxr-xr-x  3 runner runner  4096 Jan 12 19:30 backend  
drwxr-xr-x  2 runner runner  4096 Jan 12 19:30 src
-rw-r--r--  1 runner runner  1024 Jan 12 19:30 package.json
-rw-r--r--  1 runner runner  2048 Jan 12 19:30 README.md
`;
        break;
      case 'whoami':
        output = 'runner\n';
        break;
      case 'date':
        output = new Date().toString() + '\n';
        break;
      case 'echo "Hello World"':
        output = 'Hello World\n';
        break;
      default:
        output = `bash: ${command}: command not found\n`;
        outputType = 'stderr';
    }

    // Add command to history
    session.history = session.history || [];
    session.history.push({
      command: command,
      timestamp: new Date().toISOString()
    });

    // Add command output
    session.output = session.output || [];
    session.output.push({
      type: 'command',
      content: `$ ${command}\n`,
      timestamp: new Date().toISOString()
    });

    if (output.trim()) {
      session.output.push({
        type: outputType,
        content: output,
        timestamp: new Date().toISOString()
      });
    }

    session.lastActivity = new Date().toISOString();

    // Broadcast to active SSE connections
    const sseConnections = activeSSEConnections.get(sessionId);
    if (sseConnections && sseConnections.size > 0) {
      // Broadcast command and output separately
      sseConnections.forEach(sseRes => {
        try {
          if (!sseRes.writableEnded) {
            // Send command
            sseRes.write(`data: ${JSON.stringify({
              type: 'output',
              data: `$ ${command}\n`,
              outputType: 'command',
              timestamp: new Date().toISOString()
            })}\n\n`);

            // Send output if exists
            if (output.trim()) {
              sseRes.write(`data: ${JSON.stringify({
                type: 'output',
                data: output,
                outputType,
                timestamp: new Date().toISOString()
              })}\n\n`);
            }
          }
        } catch (writeError) {
          console.warn('⚠️ [TERMINAL API] Failed to write to SSE connection:', writeError.message);
        }
      });

      sseConnections.forEach(sseRes => {
        try {
          if (!sseRes.writableEnded) {
            sseRes.write(`data: ${updateData}\n\n`);
          }
        } catch (writeError) {
          console.warn('⚠️ [TERMINAL API] Failed to write to SSE connection:', writeError.message);
        }
      });
    }

    res.json({
      success: true,
      output: output.trim(),
      sessionId: sessionId
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error executing command:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute command'
    });
  }
});

// 📜 Get terminal session output
router.get('/sessions/:sessionId/output', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = terminalSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }

    res.json({
      success: true,
      output: session.output,
      sessionId: sessionId,
      lastActivity: session.lastActivity
    });
  } catch (error) {
    console.error('❌ [TERMINAL API] Error getting output:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session output'
    });
  }
});

// 📡 Stream terminal session output (SSE)
router.get('/sessions/:sessionId/stream', (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`🔌 [TERMINAL API] SSE connection requested for ${sessionId}`);

    const session = terminalSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Track this SSE connection
    if (!activeSSEConnections.has(sessionId)) {
      activeSSEConnections.set(sessionId, new Set());
    }
    activeSSEConnections.get(sessionId).add(res);

    // Send connection confirmation
    res.write(`data: ${JSON.stringify({
      type: 'connection_established',
      sessionId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Send existing output history
    if (session.output && Array.isArray(session.output)) {
      session.output.forEach((outputEntry, index) => {
        res.write(`data: ${JSON.stringify({
          type: 'history_output',
          data: outputEntry.content || outputEntry,
          outputType: outputEntry.type || 'stdout',
          index,
          timestamp: outputEntry.timestamp || new Date().toISOString()
        })}\n\n`);
      });
    }

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }, 30000);

    // Handle client disconnect
    const cleanup = () => {
      console.log(`🔌 [TERMINAL API] SSE connection closed for ${sessionId}`);
      
      // Remove from active connections
      if (activeSSEConnections.has(sessionId)) {
        activeSSEConnections.get(sessionId).delete(res);
        if (activeSSEConnections.get(sessionId).size === 0) {
          activeSSEConnections.delete(sessionId);
        }
      }
      
      clearInterval(heartbeat);
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);

  } catch (error) {
    console.error('❌ [TERMINAL API] Error establishing SSE connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to establish terminal stream'
    });
  }
});

// 🗑️ Delete terminal session
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`🗑️ [TERMINAL API] Deleting session: ${sessionId}`);

    if (terminalSessions.has(sessionId)) {
      terminalSessions.delete(sessionId);
      console.log(`✅ [TERMINAL API] Session deleted: ${sessionId}`);
      res.json({
        success: true,
        message: 'Terminal session deleted'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }
  } catch (error) {
    console.error('❌ [TERMINAL API] Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete terminal session'
    });
  }
});

module.exports = router;
